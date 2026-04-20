"""
War Room Voice Server — ClaudeClaw OS v2

Dual-mode voice architecture:
  production (default) — Gemini Live speech-to-speech via Pipecat
  legacy               — Deepgram STT → Agent → Cartesia TTS (direct WebSocket)

Environment:
  WARROOM_MODE=production|legacy
  WARROOM_PORT=7860
"""

import asyncio
import json
import logging
import struct

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.responses import HTMLResponse, JSONResponse
import uvicorn

# ── Transcript sink (forward-declared; filled after Pipecat import) ───────────
_FrameProcessor = None

from .config import (
    PORT, MODE, DEBUG_LOG,
    ANTHROPIC_API_KEY, GEMINI_API_KEY,
    DEEPGRAM_API_KEY, CARTESIA_API_KEY,
    GEMINI_LIVE_MODEL,
    DEFAULT_PERSONA,
    CLAUDECLAW_OS_URL,
)
from .personas import PERSONAS, get_persona, list_persona_keys
from .raw_audio_serializer import RawAudioSerializer
from .router import route_utterance, pin_agent, unpin_agent, get_pinned_agent
from .agent_bridge import invoke_agent

logging.basicConfig(level=logging.DEBUG if DEBUG_LOG else logging.WARNING)
logger = logging.getLogger("warroom.server")

# ── Pipecat availability check ────────────────────────────────────────────────

try:
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.pipeline.runner import PipelineRunner
    from pipecat.pipeline.task import PipelineTask, PipelineParams
    from pipecat.frames.frames import EndFrame
    from pipecat.processors.aggregators.llm_context import LLMContext
    from pipecat.processors.frame_processor import FrameProcessor
    from pipecat.frames.frames import (
        LLMContextFrame, TranscriptionFrame,
        LLMTextFrame, LLMFullResponseEndFrame,
    )

    class TranscriptSink(FrameProcessor):
        """Intercepts transcript/text frames and forwards them to the browser."""
        def __init__(self, websocket: WebSocket):
            super().__init__()
            self._ws = websocket
            self._bot_buf = ""

        async def process_frame(self, frame, direction):
            await super().process_frame(frame, direction)
            if isinstance(frame, TranscriptionFrame):
                await self._send({"type": "transcript_user", "text": frame.text})
            elif isinstance(frame, LLMTextFrame):
                self._bot_buf += frame.text
            elif isinstance(frame, LLMFullResponseEndFrame):
                if self._bot_buf.strip():
                    await self._send({"type": "transcript_agent", "text": self._bot_buf.strip()})
                self._bot_buf = ""
            await self.push_frame(frame, direction)

        async def _send(self, data: dict):
            try:
                await self._ws.send_text(json.dumps(data))
            except Exception:
                pass
    try:
        from pipecat.transports.websocket.fastapi import (
            FastAPIWebsocketTransport, FastAPIWebsocketParams,
        )
    except (ImportError, Exception):
        from pipecat.transports.network.fastapi_websocket import (  # type: ignore[no-redef]
            FastAPIWebsocketTransport, FastAPIWebsocketParams,
        )
    
    _PIPECAT_OK = True
except Exception:
    _PIPECAT_OK = False
    logger.warning("Pipecat not installed — production mode unavailable, falling back to legacy")

_GeminiLiveLLMService = None
try:
    # Pipecat >= 0.0.70: new google service path
    from pipecat.services.google.gemini_live.llm import GeminiLiveLLMService as _GeminiLiveLLMService  # type: ignore[assignment]
except Exception:
    pass

if _GeminiLiveLLMService is None:
    try:
        # Pipecat < 0.0.70: legacy path
        from pipecat.services.gemini_multimodal_live.gemini import GeminiMultimodalLiveLLMService as _GeminiLiveLLMService  # type: ignore[assignment]
    except Exception:
        pass

GeminiMultimodalLiveLLMService = _GeminiLiveLLMService  # unified alias used below

_GEMINI_LIVE_OK = _GeminiLiveLLMService is not None


# ── Helpers ───────────────────────────────────────────────────────────────────

def pcm_to_wav(pcm: bytes, sample_rate: int = 16000, channels: int = 1, bits: int = 16) -> bytes:
    data_size = len(pcm)
    header = struct.pack(
        "<4sI4s4sIHHIIHH4sI",
        b"RIFF", 36 + data_size, b"WAVE",
        b"fmt ", 16, 1, channels, sample_rate,
        sample_rate * channels * bits // 8,
        channels * bits // 8, bits,
        b"data", data_size,
    )
    return header + pcm


async def cartesia_tts(text: str, voice_id: str) -> bytes:
    import httpx
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.cartesia.ai/tts/bytes",
            headers={
                "Cartesia-Version": "2024-06-10",
                "X-API-Key": CARTESIA_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "model_id": "sonic-2",
                "transcript": text,
                "voice": {"mode": "id", "id": voice_id},
                "output_format": {
                    "container": "raw",
                    "encoding": "pcm_s16le",
                    "sample_rate": 16000,
                },
            },
        )
        r.raise_for_status()
        return r.content


# ── Production mode: Gemini Live via Pipecat ──────────────────────────────────

async def run_gemini_live_session(websocket: WebSocket, persona_key: str) -> None:
    """
    Full Pipecat pipeline:
      Browser WS → VAD → Gemini Live (speech-to-speech) → Browser WS
    Agent delegation is handled via Gemini tool calls.
    """
    if not (_PIPECAT_OK and _GEMINI_LIVE_OK and GEMINI_API_KEY):
        await websocket.send_text(json.dumps({
            "type": "error",
            "text": "Gemini Live unavailable. Check GEMINI_API_KEY and pipecat install.",
        }))
        # Graceful degradation: fall through to legacy handler
        await run_legacy_session(websocket, persona_key)
        return

    persona = get_persona(persona_key)

    # Tool functions the LLM can call during the session
    tools = [
        {
            "function_declarations": [
                {
                    "name": "delegate_to_agent",
                    "description": "Delegate a task to a specific War Room agent persona.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "persona": {"type": "string", "description": "Agent persona key (hand/fire/wolf/raven/maester)"},
                            "task": {"type": "string", "description": "Task or question to pass to the agent"},
                        },
                        "required": ["persona", "task"],
                    },
                },
                {
                    "name": "pin_agent",
                    "description": "Pin a specific agent so all subsequent queries go to it.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "persona": {"type": "string"},
                        },
                        "required": ["persona"],
                    },
                },
                {
                    "name": "unpin_agent",
                    "description": "Remove the agent pin and return to default routing.",
                    "parameters": {"type": "object", "properties": {}},
                },
                {
                    "name": "list_agents",
                    "description": "List available War Room agents.",
                    "parameters": {"type": "object", "properties": {}},
                },
                {
                    "name": "get_time",
                    "description": "Return the current date and time.",
                    "parameters": {"type": "object", "properties": {}},
                },
            ]
        }
    ]

    async def handle_tool_call(tool_name: str, args: dict) -> str:
        if tool_name == "delegate_to_agent":
            result = await invoke_agent(args["persona"], args["task"])
            return result["reply"]
        elif tool_name == "pin_agent":
            try:
                pin_agent(args["persona"])
                return f"Pinned to {args['persona']}"
            except ValueError as e:
                return str(e)
        elif tool_name == "unpin_agent":
            unpin_agent()
            return "Agent pin removed"
        elif tool_name == "list_agents":
            return ", ".join(list_persona_keys())
        elif tool_name == "get_time":
            from datetime import datetime
            return datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return "Unknown tool"

    await websocket.accept()

    transport = FastAPIWebsocketTransport(
        websocket=websocket,
        params=FastAPIWebsocketParams(
            audio_in_enabled=True,
            audio_out_enabled=True,
            audio_in_sample_rate=16000,
            audio_out_sample_rate=16000,
            audio_in_passthrough=True,
            serializer=RawAudioSerializer(sample_rate=16000),
        ),
    )

    gemini_voice = persona.get("gemini_voice", "Charon")

    # Always-on ClaudeClaw: wrap persona system prompt so every substantive
    # query is delegated to ClaudeClaw agents (memory + MCP tools).
    always_on_suffix = (
        "\n\nCRITICAL ROUTING RULE: For any question, task, research request, or "
        "action that requires knowledge, memory, or reasoning — always call the "
        "`delegate_to_agent` tool first. Only answer directly for simple greetings, "
        "clarifications, or meta-questions about this voice interface. "
        "When in doubt, delegate."
    )
    system_instruction = persona["system"] + always_on_suffix

    llm = GeminiMultimodalLiveLLMService(
        api_key=GEMINI_API_KEY,
        model=GEMINI_LIVE_MODEL,
        voice_id=gemini_voice,
        system_instruction=system_instruction,
        tools=tools,
        tool_call_handler=handle_tool_call,
        inference_on_context_initialization=False,
    )

    transcript_sink = TranscriptSink(websocket)

    # Gemini Live is speech-to-speech and manages conversation state internally.
    # Context aggregators are not needed and cause a Pipecat 0.0.108 API mismatch.
    pipeline = Pipeline([
        transport.input(),
        llm,
        transcript_sink,
        transport.output(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(allow_interruptions=True),
        enable_rtvi=False,
    )

    @transport.event_handler("on_client_connected")
    async def on_connected(_transport, _client):
        logger.debug("Gemini Live client connected — persona: %s", persona_key)
        # Trigger _create_initial_response so _ready_for_realtime_input becomes True
        context = LLMContext()
        await task.queue_frames([LLMContextFrame(context=context)])

    @transport.event_handler("on_client_disconnected")
    async def on_disconnected(_transport, _client):
        await task.queue_frames([EndFrame()])

    runner = PipelineRunner(handle_sigint=False)
    await runner.run(task)


# ── Legacy mode: Deepgram STT → Agent → Cartesia TTS ─────────────────────────

class LegacyVoiceSession:
    def __init__(self, ws: WebSocket, persona_key: str):
        self.ws = ws
        self.persona_key = persona_key
        self._audio_queue: asyncio.Queue = asyncio.Queue()

    async def start(self) -> None:
        await self.ws.accept()
        await asyncio.gather(
            self._deepgram_session(),
            self._browser_reader(),
        )

    async def _deepgram_session(self) -> None:
        import websockets

        dg_url = (
            "wss://api.deepgram.com/v1/listen"
            "?model=nova-2"
            "&encoding=opus"
            "&container=webm"
            "&sample_rate=48000"
            "&channels=1"
            "&interim_results=true"
            "&endpointing=500"
            "&utterance_end_ms=1500"
        )
        try:
            async with websockets.connect(
                dg_url,
                additional_headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"},
                ping_interval=10,
            ) as dg:
                await asyncio.gather(
                    self._dg_sender(dg),
                    self._dg_receiver(dg),
                )
        except Exception as e:
            await self._send_json({"type": "error", "text": str(e)})

    async def _dg_sender(self, dg) -> None:
        import time
        last_audio = time.monotonic()
        while True:
            try:
                chunk = await asyncio.wait_for(self._audio_queue.get(), timeout=5.0)
            except asyncio.TimeoutError:
                # Send keepalive if no audio in 5s to prevent Deepgram 1011 timeout
                if time.monotonic() - last_audio > 5.0:
                    try:
                        await dg.send(b'\x00' * 320)  # 20ms of silence (16kHz PCM)
                    except Exception:
                        break
                continue
            if chunk is None:
                break
            last_audio = time.monotonic()
            try:
                await dg.send(chunk)
            except Exception:
                break

    async def _dg_receiver(self, dg) -> None:
        import websockets

        async for raw in dg:
            try:
                msg = json.loads(raw)
            except Exception:
                continue

            if msg.get("type") != "Results":
                continue

            alts = msg.get("channel", {}).get("alternatives", [])
            if not alts:
                continue

            transcript = alts[0].get("transcript", "").strip()
            is_final = msg.get("is_final", False)
            speech_final = msg.get("speech_final", False)

            if transcript:
                await self._send_json({
                    "type": "transcript_user",
                    "text": transcript,
                    "final": is_final,
                })

            if speech_final and transcript:
                await self._handle_utterance(transcript)

    async def _handle_utterance(self, text: str) -> None:
        # Route to appropriate agent(s)
        route = route_utterance(text)

        for target_persona in route.targets:
            result = await invoke_agent(target_persona, route.text)
            reply = result["reply"]
            persona = get_persona(target_persona)

            await self._send_json({
                "type": "transcript_agent",
                "text": reply,
                "persona": persona["name"],
                "persona_key": target_persona,
            })

            # TTS
            if CARTESIA_API_KEY:
                try:
                    pcm = await cartesia_tts(reply, persona["cartesia_voice"])
                    wav = pcm_to_wav(pcm)
                    await self.ws.send_bytes(wav)
                except Exception as e:
                    await self._send_json({"type": "tts_error", "text": str(e)})

    async def _browser_reader(self) -> None:
        try:
            while True:
                msg = await self.ws.receive()
                if "bytes" in msg and msg["bytes"]:
                    await self._audio_queue.put(msg["bytes"])
                elif "text" in msg and msg["text"]:
                    try:
                        data = json.loads(msg["text"])
                        if data.get("type") == "set_persona":
                            key = data.get("persona", DEFAULT_PERSONA)
                            if key in PERSONAS:
                                self.persona_key = key
                        elif data.get("type") == "pin":
                            pin_agent(data.get("persona", DEFAULT_PERSONA))
                        elif data.get("type") == "unpin":
                            unpin_agent()
                    except Exception:
                        pass
        except WebSocketDisconnect:
            pass
        finally:
            await self._audio_queue.put(None)

    async def _send_json(self, data: dict) -> None:
        try:
            await self.ws.send_text(json.dumps(data))
        except Exception:
            pass


async def run_legacy_session(websocket: WebSocket, persona_key: str) -> None:
    if not DEEPGRAM_API_KEY:
        await websocket.accept()
        await websocket.send_text(json.dumps({
            "type": "error",
            "text": "Missing DEEPGRAM_API_KEY for legacy mode",
        }))
        await websocket.close()
        return
    session = LegacyVoiceSession(websocket, persona_key)
    await session.start()


# ── FastAPI app ───────────────────────────────────────────────────────────────

app = FastAPI(title="War Room — ClaudeClaw OS")


@app.get("/", response_class=HTMLResponse)
async def index():
    from .warroom_html import build_html
    return build_html(PERSONAS, active_mode=_effective_mode())


@app.get("/health")
async def health():
    mode = _effective_mode()
    return {
        "status": "ok",
        "mode": mode,
        "pipecat": _PIPECAT_OK,
        "gemini_live": _GEMINI_LIVE_OK and bool(GEMINI_API_KEY),
        "deepgram": bool(DEEPGRAM_API_KEY),
        "cartesia": bool(CARTESIA_API_KEY),
        "anthropic": bool(ANTHROPIC_API_KEY),
        "personas": list_persona_keys(),
        "pinned": get_pinned_agent(),
    }


@app.get("/api/personas")
async def personas_endpoint():
    return {k: {"name": v["name"], "color": v.get("color", "#c9a84c")} for k, v in PERSONAS.items()}


@app.post("/api/pin/{persona_key}")
async def pin_endpoint(persona_key: str):
    try:
        pin_agent(persona_key)
        return {"ok": True, "pinned": persona_key}
    except ValueError as e:
        return JSONResponse(status_code=400, content={"error": str(e)})


@app.post("/api/unpin")
async def unpin_endpoint():
    unpin_agent()
    return {"ok": True}


@app.post("/api/text")
async def text_endpoint(request: Request):
    """Typed text input — routes to agent and returns the reply as JSON."""
    body = await request.json()
    text = (body.get("text") or "").strip()
    if not text:
        return JSONResponse(status_code=400, content={"error": "text required"})
    persona_key = body.get("persona") or DEFAULT_PERSONA
    if persona_key not in PERSONAS:
        persona_key = DEFAULT_PERSONA
    result = await invoke_agent(persona_key, text)
    persona = get_persona(persona_key)
    return {"reply": result.get("reply", ""), "persona": persona["name"], "persona_key": persona_key}


@app.get("/api/os-status")
async def os_status_endpoint():
    """Proxy to ClaudeClaw OS dashboard — returns stats + agent list."""
    import httpx
    try:
        async with httpx.AsyncClient(timeout=2.0) as client:
            stats_r, agents_r = await asyncio.gather(
                client.get(f"{CLAUDECLAW_OS_URL}/api/stats"),
                client.get(f"{CLAUDECLAW_OS_URL}/api/agents"),
                return_exceptions=True,
            )
            stats = stats_r.json() if not isinstance(stats_r, Exception) and stats_r.status_code == 200 else {}
            agents = agents_r.json() if not isinstance(agents_r, Exception) and agents_r.status_code == 200 else []
            return {"ok": True, "stats": stats, "agents": agents}
    except Exception:
        return {"ok": False, "stats": {}, "agents": []}


@app.websocket("/ws/voice")
async def voice_ws(websocket: WebSocket, persona: str = DEFAULT_PERSONA):
    mode = _effective_mode()
    if mode == "production":
        await run_gemini_live_session(websocket, persona)
    else:
        await run_legacy_session(websocket, persona)


def _effective_mode() -> str:
    if MODE == "production" and _PIPECAT_OK and _GEMINI_LIVE_OK and GEMINI_API_KEY:
        return "production"
    return "legacy"


# ── Entry point ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    mode = _effective_mode()
    print(f"⚔  War Room → http://localhost:{PORT}  |  mode: {mode}")
    if not ANTHROPIC_API_KEY and not GEMINI_API_KEY:
        print("⚠  No LLM API key set — set ANTHROPIC_API_KEY or GEMINI_API_KEY")
    uvicorn.run(
        "warroom.server:app",
        host="0.0.0.0",
        port=PORT,
        log_level="debug" if DEBUG_LOG else "warning",
    )
