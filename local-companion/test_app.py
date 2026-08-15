import hashlib
import os
import time
from pathlib import Path

from fastapi.testclient import TestClient

from app import Segment, TranscriptionResult, create_app, request_signature


class FakeProvider:
    model_name = "test-model"

    def transcribe(self, audio_path: Path, prompt: str) -> TranscriptionResult:
        assert audio_path.exists()
        return TranscriptionResult(
            text="Motion in limine.",
            language="en",
            durationMs=1200,
            segments=[Segment(sequence=0, startMs=0, endMs=1200, text="Motion in limine.")],
            model=self.model_name,
        )


def signed_headers(payload: bytes, nonce: str = "nonce-1") -> dict[str, str]:
    timestamp = str(int(time.time()))
    body_hash = hashlib.sha256(payload).hexdigest()
    signature = request_signature("s" * 32, "firm-1", timestamp, nonce, body_hash)
    return {
        "X-CS-Firm": "firm-1",
        "X-CS-Timestamp": timestamp,
        "X-CS-Nonce": nonce,
        "X-CS-Body-Sha256": body_hash,
        "X-CS-Signature": signature,
    }


def test_signed_transcription_and_replay_protection(monkeypatch):
    monkeypatch.setenv("COUNSELSCRIBE_FIRM_ID", "firm-1")
    monkeypatch.setenv("COUNSELSCRIBE_SHARED_SECRET", "s" * 32)
    client = TestClient(create_app(FakeProvider()))
    payload = b"synthetic-audio"
    headers = signed_headers(payload)
    response = client.post(
        "/v1/transcriptions",
        files={"audio": ("demo.wav", payload, "audio/wav")},
        data={"prompt": "Florida legal dictation"},
        headers=headers,
    )
    assert response.status_code == 200
    assert response.json()["processingMode"] == "local"
    replay = client.post(
        "/v1/transcriptions",
        files={"audio": ("demo.wav", payload, "audio/wav")},
        data={"prompt": "Florida legal dictation"},
        headers=headers,
    )
    assert replay.status_code == 409


def test_health_never_returns_secret(monkeypatch):
    monkeypatch.setenv("COUNSELSCRIBE_FIRM_ID", "firm-1")
    monkeypatch.setenv("COUNSELSCRIBE_SHARED_SECRET", "s" * 32)
    response = TestClient(create_app(FakeProvider())).get("/health")
    assert response.status_code == 200
    assert "secret" not in response.text.lower()

