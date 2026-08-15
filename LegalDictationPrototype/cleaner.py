#!/usr/bin/env python3
"""Legal jargon dictionary and cleaning filters."""

import re
from typing import Optional

# Florida + federal legal terms the model often mishears
# Format: {"misheard": "correct_term", "category": "..."}
LEGAL_TERMS = [
    # Motions
    {"misheard": "motion in liming", "correct": "motion in limine", "category": "motion"},
    {"misheard": "motion in the lemonade", "correct": "motion in limine", "category": "motion"},
    {"misheard": "motion in lemonade", "correct": "motion in limine", "category": "motion"},
    {"misheard": "motion and limiting", "correct": "motion in limine", "category": "motion"},
    {"misheard": "motion for summary judgment", "correct": "motion for summary judgment", "category": "motion"},
    {"misheard": "motion to dismiss", "correct": "motion to dismiss", "category": "motion"},
    {"misheard": "motion to compel", "correct": "motion to compel", "category": "motion"},
    {"misheard": "motion for default", "correct": "motion for default", "category": "motion"},
    
    # Latin terms
    {"misheard": "et al", "correct": "et al.", "category": "latin"},
    {"misheard": "et all", "correct": "et al.", "category": "latin"},
    {"misheard": "et alium", "correct": "et al.", "category": "latin"},
    {"misheard": "inter alia", "correct": "inter alia", "category": "latin"},
    {"misheard": "amicus curiae", "correct": "amicus curiae", "category": "latin"},
    {"misheard": "habeas corpus", "correct": "habeas corpus", "category": "latin"},
    {"misheard": "prima facie", "correct": "prima facie", "category": "latin"},
    {"misheard": "res ipsa loquitur", "correct": "res ipsa loquitur", "category": "latin"},
    {"misheard": "stare decisis", "correct": "stare decisis", "category": "latin"},
    {"misheard": "mens rea", "correct": "mens rea", "category": "latin"},
    {"misheard": "actus reus", "correct": "actus reus", "category": "latin"},
    {"misheard": "per se", "correct": "per se", "category": "latin"},
    {"misheard": "sua sponte", "correct": "sua sponte", "category": "latin"},
    {"misheard": "subpoena", "correct": "subpoena", "category": "latin"},
    {"misheard": "subpoena duces tecum", "correct": "subpoena duces tecum", "category": "latin"},
    
    # Credentials/titles
    {"misheard": "juris doctorate", "correct": "Juris Doctor", "category": "credential"},
    {"misheard": "juris doctor", "correct": "Juris Doctor", "category": "credential"},
    {"misheard": "juris dr", "correct": "Juris Doctor", "category": "credential"},
    {"misheard": "JD", "correct": "J.D.", "category": "credential"},
    {"misheard": "esquire", "correct": "Esquire", "category": "credential"},
    {"misheard": "the bar", "correct": "the Bar", "category": "credential"},
    {"misheard": "pass the bar", "correct": "pass the Bar", "category": "credential"},
    
    # Florida-specific
    {"misheard": "florida statute", "correct": "Florida Statute", "category": "florida"},
    {"misheard": "florida rules of civil procedure", "correct": "Florida Rules of Civil Procedure", "category": "florida"},
    {"misheard": "comparative negligence", "correct": "comparative negligence", "category": "florida"},
    {"misheard": "pure comparative negligence", "correct": "pure comparative negligence", "category": "florida"},
    {"misheard": "modified comparative negligence", "correct": "modified comparative negligence", "category": "florida"},
    {"misheard": "no fault", "correct": "no-fault", "category": "florida"},
    {"misheard": "pi", "correct": "P.I.", "category": "florida"},
    {"misheard": "personal injury", "correct": "personal injury", "category": "florida"},
    
    # Insurance defense
    {"misheard": "uninsured motorist", "correct": "Uninsured Motorist", "category": "insurance"},
    {"misheard": "underinsured motorist", "correct": "Underinsured Motorist", "category": "insurance"},
    {"misheard": "UM", "correct": "UM", "category": "insurance"},
    {"misheard": "UIM", "correct": "UIM", "category": "insurance"},
    {"misheard": "med pay", "correct": "MedPay", "category": "insurance"},
    {"misheard": "medical payments", "correct": "Medical Payments", "category": "insurance"},
    {"misheard": "liability coverage", "correct": "liability coverage", "category": "insurance"},
    {"misheard": "bodily injury", "correct": "bodily injury", "category": "insurance"},
    {"misheard": "property damage", "correct": "property damage", "category": "insurance"},
    {"misheard": "third party bad faith", "correct": "third-party bad faith", "category": "insurance"},
    
    # Wrongful death
    {"misheard": "wrongful death", "correct": "wrongful death", "category": "wrongful_death"},
    {"misheard": "survival action", "correct": "survival action", "category": "wrongful_death"},
    {"misheard": "wrongful death statute", "correct": "wrongful death statute", "category": "wrongful_death"},
    
    # Billing
    {"misheard": "billable hour", "correct": "billable hour", "category": "billing"},
    {"misheard": "billable hours", "correct": "billable hours", "category": "billing"},
    {"misheard": "contingency fee", "correct": "contingency fee", "category": "billing"},
    {"misheard": "hourly rate", "correct": "hourly rate", "category": "billing"},
    {"misheard": "flat fee", "correct": "flat fee", "category": "billing"},
    {"misheard": "retainer", "correct": "retainer", "category": "billing"},
    {"misheard": "fee agreement", "correct": "fee agreement", "category": "billing"},
    
    # Common mishearings from the transcript
    {"misheard": "all", "correct": "et al.", "category": "latin"},
    {"misheard": "at all", "correct": "et al.", "category": "latin"},
    {"misheard": "a t all", "correct": "et al.", "category": "latin"},
]


def build_correction_map() -> dict:
    """Build a lowercase -> correct mapping for fast lookup."""
    mapping = {}
    for term in LEGAL_TERMS:
        key = term["misheard"].lower().strip()
        mapping[key] = term["correct"]
    return mapping


CORRECTIONS = build_correction_map()


# Filler words to remove
FILLER_WORDS = {
    "um", "uh", "like", "you know", "i mean", "basically", "literally",
    "actually", "sort of", "kind of", "right", "okay", "ok",
    "yeah", "yeah yeah", "mmm", "hmm", "ah", "oh",
}

# Emotional/tangent markers to strip
TANGENT_PATTERNS = [
    re.compile(r"\b(?:that's crazy|anyways|anyway|oh my god|jeez|jesus)\b", re.I),
    re.compile(r"\b(?:but yeah|so yeah|and yeah|but anyways)\b", re.IGNORECASE),
]

# Repetition patterns
REPEAT_PATTERNS = [
    re.compile(r"\b(\w{2,})\s+\1\b", re.I),  # word repeated
    re.compile(r"\b(?:blah blah blah|blah blah)\b", re.I),
    re.compile(r"\b(?:yada yada)\b", re.I),
]


def clean_transcript(text: str, context: str = "insurance_defense") -> dict:
    """
    Clean raw transcription text.
    
    Returns dict with:
        - original: raw text
        - cleaned: cleaned text
        - corrections: list of fixes applied
        - legal_terms_found: list of legal terms detected
    """
    original = text
    corrections = []
    legal_terms_found = []
    
    # Step 1: Legal jargon correction
    working = text
    for misheard, correct in sorted(CORRECTIONS.items(), key=lambda x: -len(x[0])):
        pattern = re.compile(r"\b" + re.escape(misheard) + r"\b", re.I)
        matches = pattern.findall(working)
        if matches:
            corrections.append({
                "found": misheard,
                "corrected_to": correct,
                "count": len(matches),
            })
            if correct not in [t for t in legal_terms_found]:
                legal_terms_found.append(correct)
        working = pattern.sub(correct, working)
    
    # Step 2: Remove filler words
    words = working.split()
    cleaned_words = []
    i = 0
    while i < len(words):
        w = words[i].lower().strip(".,!?;:")
        if w in FILLER_WORDS:
            corrections.append({
                "found": words[i],
                "corrected_to": "[removed]",
                "count": 1,
                "type": "filler",
            })
            i += 1
            continue
        # Remove "I mean," at start of phrase
        if w == "i" and i + 1 < len(words) and words[i+1].lower().strip(".,") == "mean":
            corrections.append({
                "found": f"{words[i]} {words[i+1]}",
                "corrected_to": "[removed]",
                "count": 1,
                "type": "filler",
            })
            i += 2
            continue
        cleaned_words.append(words[i])
        i += 1
    working = " ".join(cleaned_words)
    
    # Step 3: Remove tangents
    for pat in TANGENT_PATTERNS:
        matches = pat.findall(working)
        if matches:
            corrections.append({
                "found": ", ".join(set(matches)),
                "corrected_to": "[removed]",
                "count": len(matches),
                "type": "tangent",
            })
        working = pat.sub("", working)
    
    # Step 4: Remove repetition
    for pat in REPEAT_PATTERNS:
        matches = pat.findall(working)
        if matches:
            corrections.append({
                "found": ", ".join(set(matches)),
                "corrected_to": "[deduplicated]",
                "count": len(matches),
                "type": "repetition",
            })
        working = pat.sub(r"\1" if r"\1" in pat.pattern else "", working)
    
    # Step 5: Clean up spacing and punctuation
    working = re.sub(r"\s+", " ", working).strip()
    working = re.sub(r"\s+([.,!?;:])", r"\1", working)
    working = re.sub(r"\.{2,}", ".", working)
    
    return {
        "original": original.strip(),
        "cleaned": working.strip(),
        "corrections": corrections,
        "legal_terms_found": legal_terms_found,
        "correction_count": len(corrections),
    }


if __name__ == "__main__":
    # Test with sample text from transcript
    sample = "And then we start, is it possible to set it up where it automatically filters all of that out as it's dictating? Yeah, I mean, like, you know, the motion and limiting, the juris doctorate, all that stuff, you know, and like, blah blah blah, and then she has to go through and be like, oh my God, you know, and try to, it's, it can't be copy and paste it. Right. And I'm telling you, I've pulled legal documents that have been edited and people missed it."
    
    result = clean_transcript(sample)
    print("ORIGINAL:")
    print(result["original"])
    print("\nCLEANED:")
    print(result["cleaned"])
    print(f"\nCorrections: {result['correction_count']}")
    for c in result["corrections"]:
        print(f"  - {c}")
    print(f"\nLegal terms found: {result['legal_terms_found']}")
