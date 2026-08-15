import { describe, expect, it } from "vitest";
import {
  applyVoiceCommands,
  extractCorrectionCommand,
  legalTermAccuracy,
  normalizeLegalDictation,
  parseReviewVoiceCommand,
  wordErrorRate,
} from "./counselscribe";

describe("CounselScribe shared legal processing", () => {
  it("converts explicit spoken formatting commands without inventing legal content", () => {
    expect(applyVoiceCommands("The motion is granted comma new paragraph Costs are reserved period"))
      .toBe("The motion is granted,\n\nCosts are reserved.");
  });

  it("extracts an explicit teachable correction", () => {
    expect(extractCorrectionCommand("Correct motion and lemonade to motion in limine."))
      .toEqual({ heardPhrase: "motion and lemonade", approvedText: "motion in limine" });
  });

  it("parses explicit review navigation, decision, playback, and correction commands", () => {
    expect(parseReviewVoiceCommand("next issue")).toEqual({ type: "next" });
    expect(parseReviewVoiceCommand("previous suggestion")).toEqual({ type: "previous" });
    expect(parseReviewVoiceCommand("accept change")).toEqual({ type: "accept" });
    expect(parseReviewVoiceCommand("keep original")).toEqual({ type: "keep" });
    expect(parseReviewVoiceCommand("play source")).toEqual({ type: "play" });
    expect(parseReviewVoiceCommand("new paragraph")).toEqual({ type: "format", value: "\n\n", label: "new paragraph" });
    expect(parseReviewVoiceCommand("period")).toEqual({ type: "format", value: ".", label: "period" });
    expect(parseReviewVoiceCommand("correct motion and lemonade to motion in limine"))
      .toEqual({ type: "correct", heardPhrase: "motion and lemonade", approvedText: "motion in limine" });
  });

  it("applies approved glossary terms and sentence capitalization", () => {
    const normalized = normalizeLegalDictation(
      "motion and lemonade period the record on a peel is complete period",
      [
        { heardPhrase: "motion and lemonade", approvedText: "motion in limine" },
        { heardPhrase: "record on a peel", approvedText: "record on appeal" },
      ],
    );
    expect(normalized).toBe("Motion in limine. The record on appeal is complete.");
  });

  it("does not capitalize ordinary words after a legal abbreviation", () => {
    const normalized = normalizeLegalDictation(
      "the record cites Jones at all supports exclusion period",
      [{ heardPhrase: "Jones at all", approvedText: "Jones et al." }],
    );
    expect(normalized).toBe("The record cites Jones et al. supports exclusion.");
  });

  it("measures candidate word error rate against attorney-verified reference text", () => {
    expect(wordErrorRate("the motion is granted", "the motion is granted")).toBe(0);
    expect(wordErrorRate("the motion was granted", "the motion is granted")).toBe(25);
  });

  it("measures only legal terms expected in the reference", () => {
    expect(legalTermAccuracy(
      "The motion in limine concerns Jones et al.",
      "The motion in limine concerns Jones et al. and the record on appeal.",
      [
        { approvedText: "motion in limine" },
        { approvedText: "Jones et al." },
        { approvedText: "record on appeal" },
      ],
    )).toBe(66.67);
  });
});
