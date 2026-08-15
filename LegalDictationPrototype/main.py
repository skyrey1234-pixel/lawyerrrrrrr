#!/usr/bin/env python3
"""Main entry point - launches the prototype server."""

import sys
import os
from pathlib import Path

# Ensure project root is in path
ROOT = Path(__file__).parent
sys.path.insert(0, str(ROOT))

def check_deps():
    """Check that required packages are installed."""
    missing = []
    try:
        import faster_whisper
    except ImportError:
        missing.append("faster-whisper")
    try:
        import flask
    except ImportError:
        missing.append("flask")
    
    if missing:
        print("Missing dependencies. Install with:")
        print(f"  pip install {' '.join(missing)}")
        print(f"\nOr run: pip install -r {ROOT / 'requirements.txt'}")
        sys.exit(1)


def main():
    check_deps()
    
    # Build HTML if needed
    html_path = ROOT / "index.html"
    if not html_path.exists():
        from build_html import build_html
        build_html(html_path)
        print(f"Built UI: {html_path}")
    
    # Start Flask server
    from server import app
    print("\n🎙️  Legal Dictation Prototype")
    print("=" * 40)
    print("Open in browser: http://localhost:5000")
    print("Press Ctrl+C to stop\n")
    
    app.run(host="0.0.0.0", port=5000, debug=False)


if __name__ == "__main__":
    main()
