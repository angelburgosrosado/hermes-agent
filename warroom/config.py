"""
War Room — shared configuration loaded once at import time.
All modules import from here rather than touching os.getenv directly.
"""

import os
from pathlib import Path
from dotenv import load_dotenv

# Walk up until we find a .env file
_here = Path(__file__).resolve().parent
for _candidate in [_here, _here.parent, _here.parent.parent]:
    if (_candidate / ".env").exists():
        load_dotenv(_candidate / ".env")
        break
else:
    load_dotenv()  # fallback: cwd / system env

# ── Ports & modes ─────────────────────────────────────────────────────────────

PORT: int = int(os.getenv("WARROOM_PORT", "7860"))

# "legacy" = Deepgram STT + Cartesia TTS  |  "production" = Gemini Live speech-to-speech
MODE: str = os.getenv("WARROOM_MODE", "production")

DEBUG_LOG: bool = os.getenv("WARROOM_DEBUG", "").lower() in ("1", "true", "yes")

# ── API keys ──────────────────────────────────────────────────────────────────

ANTHROPIC_API_KEY: str   = os.getenv("ANTHROPIC_API_KEY", "")
GEMINI_API_KEY: str      = os.getenv("GEMINI_API_KEY", "") or os.getenv("GOOGLE_API_KEY", "")
DEEPGRAM_API_KEY: str    = os.getenv("DEEPGRAM_API_KEY", "")
CARTESIA_API_KEY: str    = os.getenv("CARTESIA_API_KEY", "")
GROQ_API_KEY: str        = os.getenv("GROQ_API_KEY", "")
OPENROUTER_API_KEY: str  = os.getenv("OPENROUTER_API_KEY", "")

# ── Node.js bridge ────────────────────────────────────────────────────────────

# Absolute path to the compiled agent-voice-bridge script
NODE_BRIDGE: str = os.getenv(
    "NODE_BRIDGE_PATH",
    str(_here.parent / "dist" / "agent-voice-bridge.js"),
)

NODE_CMD: str = os.getenv("NODE_CMD", "node")

# Timeout for a single agent invocation (seconds)
AGENT_TIMEOUT: int = int(os.getenv("AGENT_TIMEOUT", "45"))

# ── Routing ───────────────────────────────────────────────────────────────────

# JSON file written by the Node side to override the active agent
PIN_FILE: Path = Path(os.getenv("WARROOM_PIN_FILE", "/tmp/warroom-pin.json"))

DEFAULT_PERSONA: str = os.getenv("WARROOM_DEFAULT_PERSONA", "hand")

# Comma-separated allowlist of persona keys (empty = all)
AGENT_ROSTER_ENV: str = os.getenv("WARROOM_AGENTS", "")
AGENT_ROSTER: list[str] = (
    [a.strip() for a in AGENT_ROSTER_ENV.split(",") if a.strip()]
    if AGENT_ROSTER_ENV
    else []
)

# ── Audio ─────────────────────────────────────────────────────────────────────

SAMPLE_RATE: int = 16_000
CHANNELS:    int = 1

# Gemini Live model for speech-to-speech
GEMINI_LIVE_MODEL: str = os.getenv("GEMINI_LIVE_MODEL", "models/gemini-2.5-flash-native-audio-latest")

# ClaudeClaw OS dashboard URL (for status proxy)
CLAUDECLAW_OS_URL: str = os.getenv("CLAUDECLAW_OS_URL", "http://localhost:3141")
