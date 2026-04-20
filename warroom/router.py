"""
War Room — utterance routing (3-diamond logic).

Diamond 1 — Broadcast:  starts with "all" / "everyone" → all personas reply
Diamond 2 — Name-prefix: utterance starts with a persona name → that persona
Diamond 3 — Pin-file:    /tmp/warroom-pin.json contains active persona → use it
             Fallback:   default persona (hand)
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from .config import PIN_FILE, DEFAULT_PERSONA
from .personas import PERSONAS, get_persona, list_persona_keys


# ── Broadcast prefixes ────────────────────────────────────────────────────────

_BROADCAST_RE = re.compile(r"^(all|everyone|council|all agents)[,:]?\s+", re.IGNORECASE)


def is_broadcast(text: str) -> bool:
    return bool(_BROADCAST_RE.match(text.strip()))


def strip_broadcast_prefix(text: str) -> str:
    return _BROADCAST_RE.sub("", text.strip())


# ── Name-prefix detection ─────────────────────────────────────────────────────

def _name_prefix_key(text: str) -> str | None:
    """
    Returns persona key if utterance starts with a persona name or trigger word.
    e.g. "Raven, find the latest on…" → "raven"
    """
    normalized = text.strip().lower()
    for key, persona in PERSONAS.items():
        # Check persona key
        if normalized.startswith(key + " ") or normalized.startswith(key + ","):
            return key
        # Check display name (first word)
        first_word = persona["name"].split()[0].lower()
        if normalized.startswith(first_word + " ") or normalized.startswith(first_word + ","):
            return key
        # Check trigger words
        for trigger in persona.get("triggers", []):
            pattern = re.compile(rf"^{re.escape(trigger)}[,\s]", re.IGNORECASE)
            if pattern.match(normalized):
                return key
    return None


def strip_name_prefix(text: str, persona_key: str) -> str:
    """Remove 'PersonaName, ' prefix from text."""
    persona = PERSONAS.get(persona_key, PERSONAS[DEFAULT_PERSONA])
    candidates = (
        [persona_key]
        + [persona["name"].split()[0].lower()]
        + persona.get("triggers", [])
    )
    for prefix in candidates:
        pattern = re.compile(rf"^{re.escape(prefix)}[,\s]+", re.IGNORECASE)
        cleaned = pattern.sub("", text.strip())
        if cleaned != text.strip():
            return cleaned.strip()
    return text.strip()


# ── Pin file ──────────────────────────────────────────────────────────────────

def pin_agent(persona_key: str) -> None:
    """Write persona key to pin file so subsequent utterances go there."""
    if persona_key not in PERSONAS:
        raise ValueError(f"Unknown persona: {persona_key}")
    PIN_FILE.write_text(json.dumps({"persona": persona_key}))


def unpin_agent() -> None:
    """Remove pin file, reverting to default routing."""
    try:
        PIN_FILE.unlink()
    except FileNotFoundError:
        pass


def get_pinned_agent() -> str | None:
    """Return currently pinned persona key, or None."""
    try:
        data = json.loads(PIN_FILE.read_text())
        key = data.get("persona")
        if key in PERSONAS:
            return key
    except (FileNotFoundError, json.JSONDecodeError, KeyError):
        pass
    return None


# ── Main routing entry ────────────────────────────────────────────────────────

class RouteResult:
    __slots__ = ("targets", "text", "broadcast")

    def __init__(self, targets: list[str], text: str, broadcast: bool = False):
        self.targets = targets
        self.text = text
        self.broadcast = broadcast

    def __repr__(self) -> str:
        return f"RouteResult(targets={self.targets}, broadcast={self.broadcast}, text={self.text!r})"


def route_utterance(text: str) -> RouteResult:
    """
    Apply 3-diamond routing to raw utterance text.

    Returns a RouteResult with:
      .targets  — list of persona keys to invoke
      .text     — cleaned text to send (prefix stripped)
      .broadcast — True if all personas should reply
    """
    stripped = text.strip()

    # Diamond 1: Broadcast
    if is_broadcast(stripped):
        cleaned = strip_broadcast_prefix(stripped)
        return RouteResult(targets=list_persona_keys(), text=cleaned, broadcast=True)

    # Diamond 2: Name-prefix
    key = _name_prefix_key(stripped)
    if key:
        cleaned = strip_name_prefix(stripped, key)
        return RouteResult(targets=[key], text=cleaned)

    # Diamond 3: Pin-file
    pinned = get_pinned_agent()
    if pinned:
        return RouteResult(targets=[pinned], text=stripped)

    # Fallback: default persona
    return RouteResult(targets=[DEFAULT_PERSONA], text=stripped)
