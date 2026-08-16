import { describe, expect, it } from "vitest";
import { calculateFeeCents, dollarsToCents, ratePeriodsOverlap } from "./rates";

describe("lawyer rate calculations", () => {
  it("calculates exact-second fees and rounds only the final cent", () => {
    expect(calculateFeeCents(3600, 42500)).toBe(42500);
    expect(calculateFeeCents(900, 42500)).toBe(10625);
    expect(calculateFeeCents(1, 42500)).toBe(12);
  });

  it("calculates the controlled UTBMS work examples at the public Florida civil-litigation benchmark", () => {
    expect(calculateFeeCents(18 * 60, 32_400)).toBe(9_720);
    expect(calculateFeeCents(11 * 60, 32_400)).toBe(5_940);
    expect(calculateFeeCents(29 * 60, 32_400)).toBe(15_660);
  });

  it("normalizes administrator-entered dollar rates to integer cents", () => {
    expect(dollarsToCents("$425.50")).toBe(42550);
    expect(dollarsToCents(300)).toBe(30000);
    expect(() => dollarsToCents("not a rate")).toThrow(/valid/i);
  });

  it("detects overlapping effective-date ranges", () => {
    const first = { effectiveFrom: new Date("2026-01-01T00:00:00Z"), effectiveTo: new Date("2026-06-30T23:59:59Z") };
    expect(ratePeriodsOverlap(first, { effectiveFrom: new Date("2026-06-30T00:00:00Z"), effectiveTo: null })).toBe(true);
    expect(ratePeriodsOverlap(first, { effectiveFrom: new Date("2026-07-01T00:00:00Z"), effectiveTo: null })).toBe(false);
  });
});
