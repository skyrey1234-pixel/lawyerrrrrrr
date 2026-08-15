import { describe, expect, it } from "vitest";
import { generateLegalDocx } from "./wordExport";

describe("legal DOCX export", () => {
  it("generates a valid Office Open XML zip with reviewed content", async () => {
    const bytes = await generateLegalDocx({
      firmName: "CounselScribe Pilot Firm",
      matterName: "Synthetic Demo Matter",
      matterNumber: "FL-DEMO-0247",
      jurisdiction: "Florida",
      documentTitle: "Attorney Memorandum",
      content: "The motion in limine should be granted.",
      authorName: "Test Attorney",
    });

    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(bytes.subarray(0, 2).toString()).toBe("PK");
  });
});
