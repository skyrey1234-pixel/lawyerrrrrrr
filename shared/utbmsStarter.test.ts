import { describe, expect, it } from "vitest";
import {
  FLORIDA_RATE_BENCHMARKS_2025,
  FLORIDA_RATE_BENCHMARK_SOURCE_URL,
  UTBMS_LITIGATION_SOURCE_URL,
  UTBMS_LITIGATION_STARTER,
} from "./utbmsStarter";

describe("authoritative public billing starter", () => {
  it("contains 29 unique ABA UTBMS litigation task codes with attribution", () => {
    expect(UTBMS_LITIGATION_STARTER).toHaveLength(29);
    expect(new Set(UTBMS_LITIGATION_STARTER.map(item => item.code)).size).toBe(29);
    expect(UTBMS_LITIGATION_STARTER.find(item => item.code === "L120")?.label).toBe("Analysis/Strategy");
    expect(UTBMS_LITIGATION_STARTER.find(item => item.code === "L320")?.label).toBe("Document Production");
    expect(UTBMS_LITIGATION_STARTER.every(item => item.description.includes(UTBMS_LITIGATION_SOURCE_URL))).toBe(true);
  });

  it("keeps public Florida rates as sourced benchmark values rather than active lawyer rates", () => {
    expect(FLORIDA_RATE_BENCHMARKS_2025.find(item => item.id === "fl-civil-litigation")?.hourlyRateCents).toBe(32_400);
    expect(FLORIDA_RATE_BENCHMARK_SOURCE_URL).toContain("clio.com");
  });
});
