"""CounselScribe Mac mini companion.

This service is intentionally independent from the hosted web runtime. It runs on
firm-controlled Apple Silicon hardware, accepts signed requests, deletes temporary
audio after processing, and does not log transcript content.
"""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
import tempfile
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Protocol

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

MAX_AUDIO_BYTES = 16 * 1024 * 1024
ALLOWED_MIME_TYPES = {
    "audio/webm",
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/wave",
    "audio/ogg",
    "audio/m4a",
    "audio/mp4",
}
SIGNATURE_WINDOW_SECONDS = 300


class Segment(BaseModel):
    sequence: int
    startMs: int
    endMs: int
    text: str
    confidence: float | None = None


class TranscriptionResult(BaseModel):
    text: str
    language: str
    durationMs: int
    segments: list[Segment]
    model: str
    processingMode: str = "local"


class TranscriptionProvider(Protocol):
    model_name: str

    def transcribe(self, audio_path: Path, prompt: str) -> TranscriptionResult: ...


@dataclass
class MLXWhisperProvider:
    model_name: str

    def transcribe(self, audio_path: Path, prompt: str) -> TranscriptionResult:
        try:
            import mlx_whisper
        except ImportError as exc:
            raise RuntimeError(
                "mlx-whisper is not installed. Run ./install.sh on the Apple Silicon Mac."
            ) from exc

        raw = mlx_whisper.transcribe(
            str(audio_path),
            path_or_hf_repo=self.model_name,
            initial_prompt=prompt,
            word_timestamps=False,
            verbose=False,
        )
        segments = []
        for sequence, item in enumerate(raw.get("segments", [])):
            segments.append(
                Segment(
                    sequence=sequence,
                    startMs=round(float(item.get("start", 0)) * 1000),
                    endMs=round(float(item.get("end", 0)) * 1000),
                    text=str(item.get("text", "")).strip(),
                    confidence=None,
                )
            )
        duration_ms = segments[-1].endMs if segments else 0
        return TranscriptionResult(
            text=str(raw.get("text", "")).strip(),
            language=str(raw.get("language", "en")),
            durationMs=duration_ms,
            segments=segments,
            model=self.model_name,
        )


class ReplayGuard:
    def __init__(self) -> None:
        self._nonces: dict[str, int] = {}

    def accept(self, nonce: str, now: int) -> bool:
        self._nonces = {
            value: expires
            for value, expires in self._nonces.items()
            if expires >= now
        }
        if nonce in self._nonces:
            return False
        self._nonces[nonce] = now + SIGNATURE_WINDOW_SECONDS
        return True


def request_signature(secret: str, firm_id: str, timestamp: str, nonce: str, body_sha256: str) -> str:
    message = f"{firm_id}\n{timestamp}\n{nonce}\n{body_sha256}".encode("utf-8")
    return hmac.new(secret.encode("utf-8"), message, hashlib.sha256).hexdigest()


def require_config() -> tuple[str, str]:
    firm_id = os.environ.get("COUNSELSCRIBE_FIRM_ID", "").strip()
    shared_secret = os.environ.get("COUNSELSCRIBE_SHARED_SECRET", "").strip()
    if not firm_id or len(shared_secret) < 32:
        raise RuntimeError(
            "Set COUNSELSCRIBE_FIRM_ID and a 32+ character COUNSELSCRIBE_SHARED_SECRET."
        )
    return firm_id, shared_secret


def create_app(provider: TranscriptionProvider | None = None) -> FastAPI:
    app = FastAPI(title="CounselScribe Local Companion", docs_url=None, redoc_url=None)
    replay_guard = ReplayGuard()
    model_name = os.environ.get(
        "COUNSELSCRIBE_MODEL",
        "mlx-community/whisper-large-v3-turbo",
    )
    transcription_provider = provider or MLXWhisperProvider(model_name=model_name)

    @app.get("/health")
    def health() -> dict[str, str | bool]:
        configured = bool(
            os.environ.get("COUNSELSCRIBE_FIRM_ID")
            and len(os.environ.get("COUNSELSCRIBE_SHARED_SECRET", "")) >= 32
        )
        return {
            "service": "counselscribe-local-companion",
            "status": "ready" if configured else "not_configured",
            "configured": configured,
            "model": transcription_provider.model_name,
            "processingMode": "local",
        }

    @app.post("/v1/transcriptions", response_model=TranscriptionResult)
    async def transcribe(
        audio: UploadFile = File(...),
        prompt: str = Form(default="Florida legal dictation. Preserve spoken meaning."),
        x_cs_firm: str = Header(...),
        x_cs_timestamp: str = Header(...),
        x_cs_nonce: str = Header(...),
        x_cs_signature: str = Header(...),
        x_cs_body_sha256: str = Header(...),
    ) -> TranscriptionResult:
        configured_firm, secret = require_config()
        if x_cs_firm != configured_firm:
            raise HTTPException(status_code=403, detail="Firm identity mismatch")

        try:
            timestamp = int(x_cs_timestamp)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail="Invalid timestamp") from exc

        now = int(time.time())
        if abs(now - timestamp) > SIGNATURE_WINDOW_SECONDS:
            raise HTTPException(status_code=401, detail="Expired request")
        if not replay_guard.accept(x_cs_nonce, now):
            raise HTTPException(status_code=409, detail="Replayed request")

        expected = request_signature(
            secret,
            x_cs_firm,
            x_cs_timestamp,
            x_cs_nonce,
            x_cs_body_sha256,
        )
        if not hmac.compare_digest(expected, x_cs_signature):
            raise HTTPException(status_code=401, detail="Invalid signature")

        if audio.content_type not in ALLOWED_MIME_TYPES:
            raise HTTPException(status_code=415, detail="Unsupported audio format")
        contents = await audio.read(MAX_AUDIO_BYTES + 1)
        if not contents or len(contents) > MAX_AUDIO_BYTES:
            raise HTTPException(status_code=413, detail="Audio must be between 1 byte and 16 MB")
        body_hash = hashlib.sha256(contents).hexdigest()
        if not hmac.compare_digest(body_hash, x_cs_body_sha256):
            raise HTTPException(status_code=400, detail="Audio checksum mismatch")

        extension = Path(audio.filename or "audio.bin").suffix or ".audio"
        temporary_path: Path | None = None
        try:
            with tempfile.NamedTemporaryFile(prefix="counselscribe-", suffix=extension, delete=False) as temporary:
                temporary.write(contents)
                temporary_path = Path(temporary.name)
            return transcription_provider.transcribe(temporary_path, prompt[:4000])
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        finally:
            if temporary_path and temporary_path.exists():
                temporary_path.unlink(missing_ok=True)

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app:app",
        host=os.environ.get("COUNSELSCRIBE_BIND", "127.0.0.1"),
        port=int(os.environ.get("COUNSELSCRIBE_PORT", "8765")),
        access_log=False,
    )

