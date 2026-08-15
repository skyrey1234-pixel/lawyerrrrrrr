#!/bin/zsh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
VENV_DIR="$ROOT_DIR/.venv"

if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "CounselScribe local transcription is intended for macOS." >&2
  exit 1
fi

if [[ "$(uname -m)" != "arm64" ]]; then
  echo "This MLX configuration requires an Apple Silicon Mac." >&2
  exit 1
fi

python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/pip" install -r "$ROOT_DIR/requirements.txt"

echo "Installed. Copy configuration.example to an uncommitted .env file, replace every placeholder, then run ./run.sh."
