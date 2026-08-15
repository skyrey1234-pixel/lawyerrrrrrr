#!/usr/bin/env python3
"""Flask server for the legal dictation prototype."""

import os
import sys
import tempfile
from pathlib import Path
from flask import Flask, render_template, request, jsonify, send_file

# Ensure project root in path
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

app = Flask(__name__, template_folder=str(ROOT))
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max


@app.route('/')
def index():
    return render_template('index.html')


@app.route('/api/transcribe', methods=['POST'])
def transcribe():
    """Transcribe uploaded audio and return cleaned text."""
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400
    
    # Save uploaded file
    suffix = Path(file.filename).suffix or '.m4a'
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        file.save(tmp.name)
        tmp_path = tmp.name
    
    try:
        # Step 1: Transcribe
        from transcribe import transcribe
        result = transcribe(tmp_path)
        
        # Step 2: Clean
        from cleaner import clean_transcript
        cleaned = clean_transcript(result['text'])
        
        # Return combined result
        return jsonify({
            "original": cleaned['original'],
            "cleaned": cleaned['cleaned'],
            "duration": result['duration'],
            "correction_count": cleaned['correction_count'],
            "legal_terms_found": cleaned['legal_terms_found'],
            "corrections": cleaned['corrections'],
        })
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    
    finally:
        # Clean up temp file
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@app.route('/api/health')
def health():
    return jsonify({"status": "ok", "service": "LegalDictation Prototype"})


if __name__ == '__main__':
    import os
    port = int(os.environ.get("PORT", 5001))
    app.run(host='0.0.0.0', port=port, debug=False)
    print(f"\nLegalDictation Prototype running on http://localhost:{port}")
