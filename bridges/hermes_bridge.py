#!/usr/bin/env python3
"""
ClaudeClaw ↔ Hermes Bridge
Allows ClaudeClaw to send tasks to Hermes and get structured responses.

Usage:
    python3 bridges/hermes_bridge.py "Search GitHub for open issues"
    python3 bridges/hermes_bridge.py --toolsets web,terminal "Scrape gaiaherbs.com products"
    python3 bridges/hermes_bridge.py --model gemma4:31b --provider ollama "Summarize this"
"""

import sys
import json
import argparse
from pathlib import Path

HERMES_REPO = Path("/Users/ABGlobalCEO/Repo")
sys.path.insert(0, str(HERMES_REPO))


def invoke_hermes(
    task: str,
    toolsets: list[str] | None = None,
    model: str | None = None,
    provider: str | None = None,
    max_iterations: int = 90,
    quiet: bool = True,
) -> dict:
    """Send a task to Hermes and get a structured response."""
    from run_agent import AIAgent

    agent = AIAgent(
        model=model or "claude-sonnet-4-6",
        max_iterations=max_iterations,
        enabled_toolsets=toolsets or ["terminal", "file", "web"],
        provider=provider or "anthropic",
        quiet_mode=quiet,
        verbose_logging=False,
    )

    response = agent.run_conversation(task)

    result = {
        "response": response,
        "session_id": getattr(agent, "session_id", None),
        "model": agent.model if hasattr(agent, "model") else model,
        "status": "ok",
    }

    # Try to capture token usage if available
    if hasattr(agent, "usage"):
        usage = agent.usage
        result["tokens"] = {
            "input": getattr(usage, "input_tokens", 0),
            "output": getattr(usage, "output_tokens", 0),
        }
        result["cost"] = getattr(usage, "estimated_cost", 0.0)

    return result


def invoke_hermes_cli(task: str, toolsets: str = "web,terminal") -> dict:
    """Fallback: invoke Hermes via CLI subprocess."""
    import subprocess

    cmd = [
        sys.executable, "-m", "hermes_cli.main",
        "-q", task,
        "--toolsets", toolsets,
        "--quiet",
    ]

    try:
        result = subprocess.run(
            cmd,
            cwd=str(HERMES_REPO),
            capture_output=True,
            text=True,
            timeout=300,
        )
        return {
            "response": result.stdout.strip(),
            "status": "ok" if result.returncode == 0 else "error",
            "stderr": result.stderr.strip() if result.stderr else None,
        }
    except subprocess.TimeoutExpired:
        return {"response": None, "status": "timeout"}
    except Exception as e:
        return {"response": None, "status": "error", "error": str(e)}


def main():
    parser = argparse.ArgumentParser(description="ClaudeClaw → Hermes Bridge")
    parser.add_argument("task", help="Task to send to Hermes")
    parser.add_argument("--toolsets", default="terminal,file,web",
                        help="Comma-separated toolsets (default: terminal,file,web)")
    parser.add_argument("--model", default=None, help="Model override")
    parser.add_argument("--provider", default=None, help="Provider override")
    parser.add_argument("--max-iterations", type=int, default=90)
    parser.add_argument("--cli-mode", action="store_true",
                        help="Use CLI subprocess instead of direct Python import")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    toolsets = [t.strip() for t in args.toolsets.split(",")]

    if args.cli_mode:
        result = invoke_hermes_cli(args.task, args.toolsets)
    else:
        try:
            result = invoke_hermes(
                task=args.task,
                toolsets=toolsets,
                model=args.model,
                provider=args.provider,
                max_iterations=args.max_iterations,
            )
        except ImportError:
            # Fallback to CLI if direct import fails
            result = invoke_hermes_cli(args.task, args.toolsets)
            result["fallback"] = "cli"

    if args.json:
        print(json.dumps(result, indent=2, default=str))
    else:
        print(result.get("response", "No response"))


if __name__ == "__main__":
    main()
