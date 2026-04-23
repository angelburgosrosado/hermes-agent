#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Quick Task
# @raycast.mode silent
# @raycast.argument1 { "type": "text", "placeholder": "Task description" }

# Optional parameters:
# @raycast.icon 📋
# @raycast.packageName Command Center

# Documentation:
# @raycast.description Add a quick task to Command Center
# @raycast.author Command Center

/usr/local/bin/cc task "$1"
echo "✅ Task added: $1"
