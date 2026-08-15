import { describe, expect, it } from "vitest";
import { enforceBillingEvidence, hasCompletedWorkEvidence, isSourceGrounded, normalizedBillingFingerprint, parseBillingVoiceCommand, parseExplicitDurationSeconds } from "./billing";

describe("CounselScribe billing evidence guardrails", () => {
  it("accepts only explicit numeric time statements", () => {
    expect(parseExplicitDurationSeconds("Bill 0.4 hours for reviewing discovery responses.")).toBe(1440);
    expect(parseExplicitDurationSeconds("I spent 24 minutes drafting the motion.")).toBe(1440);
    expect(parseExplicitDurationSeconds("I reviewed the settlement offer.")).toBeNull();
    expect(parseExplicitDurationSeconds("The filing contains 30 pages.")).toBeNull();
  });

  it("requires exact source grounding", () => {
    const source = "I spent 24 minutes drafting the motion in limine for Hartwell.";
    expect(isSourceGrounded(source, "24 minutes drafting the motion in limine")).toBe(true);
    expect(isSourceGrounded(source, "one hour negotiating settlement")).toBe(false);
  });

  it("overrides AI-estimated duration with deterministic source evidence", () => {
    const candidate = enforceBillingEvidence("I reviewed the settlement offer.", {
      activityCode: "REVIEW",
      narrative: "Review settlement offer",
      sourceQuote: "I reviewed the settlement offer.",
      explicitDurationText: "30 minutes",
      durationSeconds: 1800,
      confidence: 0.9,
    });
    expect(candidate?.durationSeconds).toBeNull();
    expect(candidate?.explicitDurationText).toBe("");
  });

  it("rejects legal-news commentary while retaining explicit completed attorney work", () => {
    expect(hasCompletedWorkEvidence("based on the evidence we've been watching you present")).toBe(false);
    expect(hasCompletedWorkEvidence("The client asked her to draft a motion in limine.")).toBe(false);
    expect(hasCompletedWorkEvidence("Attorney Maya Reed reviewed the deposition notice.")).toBe(true);
    expect(hasCompletedWorkEvidence("She spent 24 minutes reviewing the responses.")).toBe(true);
  });

  it("parses explicit timer and billing voice commands without estimating time", () => {
    expect(parseBillingVoiceCommand("Start billing timer for drafting motion in limine")).toEqual({ type: "start_timer", activityCode: "DRAFTING", narrative: "drafting motion in limine" });
    expect(parseBillingVoiceCommand("Bill 24 minutes for reviewing discovery responses")).toEqual({ type: "create_entry", activityCode: "REVIEW", narrative: "reviewing discovery responses", durationSeconds: 1440, sourceQuote: "Bill 24 minutes for reviewing discovery responses" });
    expect(parseBillingVoiceCommand("Bill for reviewing the settlement offer")).toEqual({ type: "create_entry", activityCode: "REVIEW", narrative: "reviewing the settlement offer", durationSeconds: null, sourceQuote: "Bill for reviewing the settlement offer" });
    expect(parseBillingVoiceCommand("Stop timer")).toEqual({ type: "stop_timer" });
  });

  it("flags the same work as a duplicate even when it came through a different capture path", () => {
    const base = { firmId: 1, matterId: 9, activityCode: "REVIEW", narrative: "Review discovery responses", workDate: new Date("2026-08-15T12:00:00Z"), durationSeconds: 1440 };
    expect(normalizedBillingFingerprint({ ...base, sourceIdentifier: "analysis:1" })).toBe(normalizedBillingFingerprint({ ...base, sourceIdentifier: "voice:2" }));
  });
});
