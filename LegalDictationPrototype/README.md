# Legal Dictation Prototype

A local-first legal dictation cleaner built for Terri / Gregory A. Anderson.
Transcribes attorney dictation, filters out filler/tangents, and corrects legal jargon.

## Quick Start

```bash
# 1. Create venv
python3 -m venv .venv
source .venv/bin/activate

# 2. Install deps
pip install -r requirements.txt

# 4. Run
python server.py

# 5. Open browser
# http://localhost:5001
```

## Architecture

```
transcribe.py   → faster-whisper local transcription
cleaner.py      → legal jargon dictionary + filler/tangent filters
server.py       → Flask API backend
build_html.py   → generates the single-file UI
index.html      → standalone HTML/CSS/JS frontend
```

## What It Does

1. **Upload audio** → local transcription via faster-whisper
2. **Clean output** → removes filler, tangents, repetition
3. **Correct jargon** → fixes legal mishearings (motion in limine, et al., etc.)
4. **Show confidence** → highlights legal terms found

## Prototype Scope

- Florida-specific: insurance defense + wrongful death
- Local only, no cloud
- Mac mini / laptop compatible
- No real-time streaming (post-processing for now)

## Not Included (yet)

- Voice personalization / accent learning
- Real-time filtering while speaking
- State-by-state legal database
- Mobile app
- Patent / licensing framework
