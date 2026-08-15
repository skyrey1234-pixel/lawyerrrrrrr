/**
 * The Litigator's Desk test contract: legal replacements and cleanup rules
 * must remain deterministic, reviewable, and safe to apply more than once.
 */
import { describe, expect, it } from "vitest";
import {
  applyCleanupRule,
  applyLegalTerms,
  buildCleanupSuggestions,
  DEMO_TRANSCRIPT,
  formatSpokenPunctuation,
} from "./legalEngine";

describe("CounselScribe legal engine", () => {
  it("normalizes the synthetic Florida demonstration terms", () => {
    const result = applyLegalTerms(DEMO_TRANSCRIPT, []);

    expect(result.text).toContain("motion in limine");
    expect(result.text).toContain("Hartwell Insurance Group");
    expect(result.text).toContain("Florida Statute § 90.408");
    expect(result.text).toContain("record on appeal");
    expect(result.text).toContain("Jones et al.");
    expect(result.text).not.toContain("et al..");
    expect(result.hits.length).toBeGreaterThanOrEqual(5);
  });

  it("finds reviewable fillers, restarts, and repetitions", () => {
    const result = applyLegalTerms(DEMO_TRANSCRIPT, []);
    const suggestions = buildCleanupSuggestions(result.text);
    const ids = suggestions.map((suggestion) => suggestion.id);

    expect(ids).toContain("remove-fillers");
    expect(ids).toContain("remove-restarts");
    expect(ids).toContain("collapse-repetitions");
  });

  it("applies cleanup rules without changing the legal term mappings", () => {
    const result = applyLegalTerms(DEMO_TRANSCRIPT, []);
    const withoutFillers = applyCleanupRule(result.text, "remove-fillers");
    const withoutRestarts = applyCleanupRule(withoutFillers, "remove-restarts");
    const reviewed = applyCleanupRule(withoutRestarts, "collapse-repetitions");

    expect(reviewed).not.toMatch(/\b(?:um|uh|I mean)\b/i);
    expect(reviewed).toContain("motion in limine");
    expect(reviewed).not.toContain("motion in limine, a motion in limine");
    expect(reviewed.startsWith("Prepare")).toBe(true);
    expect(reviewed).toContain("Preserve our objection");
    expect(reviewed).toContain("Florida Statute § 90.408");
  });

  it("formats spoken punctuation into document punctuation", () => {
    expect(formatSpokenPunctuation("First clause comma new paragraph second clause period"))
      .toBe("First clause,\n\nsecond clause.");
  });
});
