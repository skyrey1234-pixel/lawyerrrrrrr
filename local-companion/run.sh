#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ ! -f "$ROOT_DIR/.env" ]]; then
  echo "Missing $ROOT_DIR/.env. Copy .env.example and configure it first." >&2
  exit 1
fi

set -a
source "$ROOT_DIR/.env"
set +a

cd "$ROOT_DIR"
exec "$ROOT_DIR/.venv/bin/python" app.py

