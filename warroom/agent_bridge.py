"""
War Room — async bridge to the Node.js agent-voice-bridge subprocess.

Calls: node dist/agent-voice-bridge.js --persona=<key> --text=<text> [--chat-id=<id>]
Expects JSON stdout: {"reply": "...", "tokens": 123, "cost": 0.001}
Falls back to direct Anthropic API call if Node bridge is unavailable.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import TypedDict

import httpx

from .config import (
    NODE_BRIDGE, NODE_CMD, AGENT_TIMEOUT,
    ANTHROPIC_API_KEY, OPENROUTER_API_KEY,
)
from .personas import get_persona

logger = logging.getLogger("warroom.bridge")


class BridgeResult(TypedDict):
    reply: str
    tokens: int
    cost: float
    source: str  # "agent" | "llm_fallback" | "error_fallback"


# ── Node.js subprocess bridge ─────────────────────────────────────────────────

async def invoke_agent(
    persona_key: str,
    text: str,
    chat_id: str | None = None,
) -> BridgeResult:
    """
    Invoke the ClaudeClaw agent via Node.js subprocess.
    Falls back to direct LLM call if the bridge is unavailable.
    """
    effective_chat_id = chat_id or f"warroom:{persona_key}"

    try:
        result = await _call_node_bridge(persona_key, text, effective_chat_id)
        result["source"] = "agent"
        return result
    except NodeBridgeError as e:
        logger.warning("Node bridge unavailable (%s) — falling back to direct LLM", e)
        return await _llm_fallback(persona_key, text)


async def _call_node_bridge(
    persona_key: str,
    text: str,
    chat_id: str,
) -> BridgeResult:
    """Spawn the Node.js agent-voice-bridge as a subprocess."""
    import shlex

    cmd = [
        NODE_CMD,
        NODE_BRIDGE,
        f"--persona={persona_key}",
        f"--text={text}",
        f"--chat-id={chat_id}",
    ]

    try:
        proc = await asyncio.wait_for(
            asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            ),
            timeout=5.0,  # subprocess spawn timeout
        )
    except (FileNotFoundError, PermissionError) as e:
        raise NodeBridgeError(f"Cannot start Node.js: {e}") from e
    except asyncio.TimeoutError:
        raise NodeBridgeError("Node.js spawn timed out")

    try:
        stdout, stderr = await asyncio.wait_for(
            proc.communicate(),
            timeout=float(AGENT_TIMEOUT),
        )
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        raise NodeBridgeError(f"Agent timed out after {AGENT_TIMEOUT}s")

    if proc.returncode != 0:
        err_text = stderr.decode(errors="replace")[:300]
        raise NodeBridgeError(f"Bridge exited {proc.returncode}: {err_text}")

    raw = stdout.decode(errors="replace").strip()
    if not raw:
        raise NodeBridgeError("Bridge returned empty stdout")

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as e:
        raise NodeBridgeError(f"Bridge JSON parse error: {e} | raw={raw[:200]}") from e

    if "error" in data and "reply" not in data:
        raise NodeBridgeError(data["error"])

    return BridgeResult(
        reply=data.get("reply", ""),
        tokens=int(data.get("tokens", 0)),
        cost=float(data.get("cost", 0.0)),
        source="agent",
    )


class NodeBridgeError(RuntimeError):
    pass


# ── Direct LLM fallback ───────────────────────────────────────────────────────

async def _llm_fallback(persona_key: str, text: str) -> BridgeResult:
    """Call Anthropic (or OpenRouter) directly when Node bridge is down."""
    persona = get_persona(persona_key)
    system = persona["system"]

    try:
        if ANTHROPIC_API_KEY:
            reply = await _call_anthropic(system, text)
        elif OPENROUTER_API_KEY:
            reply = await _call_openrouter(system, text)
        else:
            reply = "I apologize — the ravens have gone silent. No LLM credentials available."
        return BridgeResult(reply=reply, tokens=0, cost=0.0, source="llm_fallback")
    except Exception as e:
        logger.error("LLM fallback failed: %s", e)
        persona_name = persona["name"]
        return BridgeResult(
            reply=f"I apologize — {persona_name} cannot speak at this moment. Try again shortly.",
            tokens=0,
            cost=0.0,
            source="error_fallback",
        )


async def _call_anthropic(system: str, text: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-6",
                "max_tokens": 256,
                "system": system,
                "messages": [{"role": "user", "content": text}],
            },
        )
        r.raise_for_status()
        return r.json()["content"][0]["text"]


async def _call_openrouter(system: str, text: str) -> str:
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {OPENROUTER_API_KEY}",
                "content-type": "application/json",
            },
            json={
                "model": "anthropic/claude-sonnet-4-6",
                "max_tokens": 256,
                "messages": [
                    {"role": "system", "content": system},
                    {"role": "user", "content": text},
                ],
            },
        )
        r.raise_for_status()
        return r.json()["choices"][0]["message"]["content"]
