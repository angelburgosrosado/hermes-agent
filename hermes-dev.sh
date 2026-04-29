#!/bin/bash
# Wrapper script to launch Hermes Dev version with isolated config
export HERMES_HOME="$HOME/Repo/.hermes_dev"

# Check if we should start gateway or run a chat
if [ "$1" = "gateway" ]; then
    echo "Starting Isolated Dev Gateway on port 8652..."
    ~/Repo/.venv/bin/hermes gateway
else
    echo "Starting Isolated Dev CLI..."
    ~/Repo/.venv/bin/hermes "$@"
fi