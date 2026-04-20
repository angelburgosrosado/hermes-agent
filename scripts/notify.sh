#!/usr/bin/env bash
# Send a Telegram notification from a shell script.
# Usage: ./scripts/notify.sh "Message text"
# Requires: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in environment or .env

set -euo pipefail

# Load .env if present
if [ -f "$(dirname "$0")/../.env" ]; then
  set -o allexport
  # shellcheck disable=SC1091
  source "$(dirname "$0")/../.env"
  set +o allexport
fi

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-${ALLOWED_CHAT_ID:-}}"
MESSAGE="${1:-}"

if [ -z "$BOT_TOKEN" ]; then
  echo "Error: TELEGRAM_BOT_TOKEN not set" >&2
  exit 1
fi

if [ -z "$CHAT_ID" ]; then
  echo "Error: TELEGRAM_CHAT_ID (or ALLOWED_CHAT_ID) not set" >&2
  exit 1
fi

if [ -z "$MESSAGE" ]; then
  echo "Usage: $0 <message>" >&2
  exit 1
fi

curl -s -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
  -d "chat_id=${CHAT_ID}" \
  -d "text=${MESSAGE}" \
  -d "parse_mode=HTML" \
  > /dev/null

echo "✓ Notification sent"
