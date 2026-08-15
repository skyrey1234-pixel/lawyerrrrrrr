#!/usr/bin/env python3
"""Local transcription engine using faster-whisper tiny model."""

import os
from pathlib import Path
from typing import Optional

_model = None

def _get_model():
    """Lazy-load the whisper model (only once)."""
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        # tiny is fastest for prototype; small is more accurate
        model_name = os.environ.get("WHISPER_MODEL", "tiny")
        _model = WhisperModel(model_name, device="cpu", compute_type="int8")
    return _model


def transcribe(audio_path: str | Path, language: str = "en") -> dict:
    """
    Transcribe a local audio file.
    
    Args:
        audio_path: Path to audio file (m4a, mp3, wav, etc.)
        language: Language code (default 'en')
    
    Returns:
        dict with 'text', 'segments', 'duration'
    """
    path = str(audio_path)
    if not os.path.exists(path):
        raise FileNotFoundError(f"Audio file not found: {path}")
    
    model = _get_model()
    segments, info = model.transcribe(
        path,
        beam_size=5,
        vad_filter=True,
        vad_parameters=dict(min_silence_duration_ms=500),
        language=language,
    )
    
    seg_list = []
    full_text_parts = []
    
    for seg in segments:
        seg_list.append({
            "start": round(seg.start, 2),
            "end": round(seg.end, 2),
            "text": seg.text.strip(),
        })
        full_text_parts.append(seg.text.strip())
    
    return {
        "text": " ".join(full_text_parts),
        "segments": seg_list,
        "duration": round(info.duration, 2),
        "language": info.language,
    }


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python transcribe.py <audio_file>")
        sys.exit(1)
    
    result = transcribe(sys.argv[1])
    print(f"Duration: {result['duration']}s")
    print(f"Language: {result['language']}")
    print(f"Text: {result['text']}")
    print(f"\nSegments: {len(result['segments'])}")
    for seg in result["segments"][:5]:
        print(f"  [{seg['start']}s-{seg['end']}s] {seg['text']}")
