#!/bin/bash
# Command Center Launcher

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CC_DIR="${CC_DATA_DIR:-$HOME/CommandCenter}"
cd "$SCRIPT_DIR"

# Prefer local venv if present; fall back to the data-dir venv (~/CommandCenter/venv)
if [ -f "$SCRIPT_DIR/venv/bin/activate" ]; then
    source "$SCRIPT_DIR/venv/bin/activate"
else
    source "$CC_DIR/venv/bin/activate"
fi

streamlit run app.py --server.port 8080 --server.headless true --browser.gatherUsageStats false
