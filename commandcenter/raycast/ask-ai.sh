#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Ask AI
# @raycast.mode fullOutput
# @raycast.argument1 { "type": "text", "placeholder": "Your question" }

# Optional parameters:
# @raycast.icon 🤖
# @raycast.packageName Command Center

# Documentation:
# @raycast.description Ask local Ollama AI a question
# @raycast.author Command Center

/usr/local/bin/cc ask "$1"
