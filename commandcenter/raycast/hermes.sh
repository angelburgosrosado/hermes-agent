#!/bin/bash

# Required parameters:
# @raycast.schemaVersion 1
# @raycast.title Hermes Agent
# @raycast.mode fullOutput
# @raycast.argument1 { "type": "text", "placeholder": "Task for Hermes" }

# Optional parameters:
# @raycast.icon 🌟
# @raycast.packageName Command Center

# Documentation:
# @raycast.description Run a task with Hermes Agent
# @raycast.author Command Center

/usr/local/bin/cc hermes "$1"
