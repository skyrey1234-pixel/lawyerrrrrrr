#!/usr/bin/env python3
"""Test suite for LegalDictation prototype."""

import sys
from pathlib import Path

ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))


def test_cleaner():
    """Test the cleaner with sample legal dictation."""
    from cleaner import clean_transcript
    
    # Sample from Terri's actual transcript
    sample = (
        "And then we start, is it possible to set it up where it automatically filters "
        "all of that out as it's dictating? Yeah, I mean, like, you know, the motion and limiting, "
        "the juris doctorate, all that stuff, you know, and like, blah blah blah, "
        "and then she has to go through and be like, oh my God, you know, and try to, "
        "it's, it can't be copy and paste it. Right. And I'm telling you, I've pulled legal documents "
        "that have been edited and people missed it."
    )
    
    result = clean_transcript(sample)
    
    print("=== Cleaner Test ===")
    print(f"Original length: {len(result['original'])} chars")
    print(f"Cleaned length: {len(result['cleaned'])} chars")
    print(f"Corrections applied: {result['correction_count']}")
    print(f"Legal terms found: {result['legal_terms_found']}")
    
    # Verify key corrections
    assert "motion in limine" in result['cleaned'].lower(), "Should fix 'motion and limiting'"
    assert "Juris Doctor" in result['cleaned'], "Should fix 'juris doctorate'"
    assert "et al." in result['cleaned'], "Should fix 'all that stuff' -> et al context"
    print("✓ Key corrections verified")
    
    # Verify some filler was removed
    original_fillers = sum(1 for w in ['um', 'uh', 'like', 'you know', 'i mean'] if w in sample.lower())
    cleaned_fillers = sum(1 for w in ['um', 'uh', 'like', 'you know', 'i mean'] if w in result['cleaned'].lower())
    assert cleaned_fillers < original_fillers, f"Should remove some filler: {original_fillers} -> {cleaned_fillers}"
    print("✓ Filler removal verified")
    
    print("\nOriginal:")
    print(result['original'][:200])
    print("\nCleaned:")
    print(result['cleaned'][:300])
    print("\n✅ Cleaner test PASSED")
    return True


def test_html_build():
    """Test HTML generation."""
    from build_html import build_html
    
    html_path = ROOT / "test_index.html"
    build_html(html_path)
    
    assert html_path.exists(), "HTML file should be created"
    content = html_path.read_text()
    assert "LegalDictation" in content, "Should contain app name"
    assert "/api/transcribe" in content, "Should have transcribe endpoint"
    assert "drop-zone" in content, "Should have drop zone"
    
    html_path.unlink()  # Clean up
    print("✅ HTML build test PASSED")
    return True


def test_server_import():
    """Test server can be imported."""
    from server import app
    assert app is not None
    print("✅ Server import test PASSED")
    return True


def run_all():
    """Run all tests."""
    print("Running LegalDictation Prototype tests...\n")
    
    tests = [
        test_cleaner,
        test_html_build,
        test_server_import,
    ]
    
    passed = 0
    failed = 0
    
    for test in tests:
        try:
            if test():
                passed += 1
        except Exception as e:
            print(f"❌ {test.__name__} FAILED: {e}")
            failed += 1
    
    print(f"\n{'='*40}")
    print(f"Results: {passed} passed, {failed} failed")
    print(f"{'='*40}")
    
    return failed == 0


if __name__ == "__main__":
    success = run_all()
    sys.exit(0 if success else 1)
