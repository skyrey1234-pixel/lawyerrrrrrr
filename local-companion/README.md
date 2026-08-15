# CounselScribe Mac mini companion

This folder is a **deployment scaffold**, not proof that local transcription is currently installed. The web application deliberately reports the companion as `not configured` until an Apple Silicon Mac is connected, the service is installed, and a signed health check succeeds.

## What it does

The service accepts one signed audio request at a time, verifies firm identity, rejects stale or replayed requests, validates a SHA-256 checksum, writes a temporary audio file, runs MLX Whisper on Apple Silicon, returns timestamped segments, and deletes the temporary file. Access logging is disabled, and transcript text is not written to service logs.

## Installation boundary

1. Bind a folder on the target Mac through the desktop connection.
2. Copy this folder into that bound location.
3. In Terminal, run `chmod +x install.sh run.sh` and then `./install.sh`.
4. Copy `configuration.example` to an uncommitted `.env` file; generate a unique 32+ character secret and never commit it.
5. Run `./run.sh`, then verify `http://127.0.0.1:8765/health` returns `ready`.
6. Only after the web application verifies the same firm identity and signed request contract should the UI change from `not configured` to `online`.

The default bind address is loopback-only. Exposure to other computers requires a separately reviewed secure tunnel or mutually authenticated proxy; do not open the port directly to the public internet.

## Tests

Inside an activated virtual environment, run `pytest -q`. The tests cover signed requests, checksum validation, replay rejection, and secret-free health output without downloading or executing a speech model.

## Voice model

The default is `mlx-community/whisper-large-v3-turbo`. Change the model only after measuring legal-term accuracy, latency, and memory usage on the actual Mac mini. A model name in configuration is not itself an accuracy or privacy certification.
