import { describe, expect, it } from "vitest";
import { parseBillingCodeImport } from "./billingCodeImport";

describe("billing-code list import", () => {
  it("parses quoted CSV and preserves the firm's supplied labels and narratives", () => {
    const result = parseBillingCodeImport('code,label,category,description,defaultNarrative,displayOrder,active\nL-110,"Review, analysis",REVIEW,"Firm guidance","Review and analyze matter materials",10,true');
    expect(result.errors).toEqual([]);
    expect(result.items[0]).toMatchObject({ code: "L-110", label: "Review, analysis", category: "REVIEW", displayOrder: 10, active: true });
  });

  it("rejects duplicate codes instead of silently overwriting a row", () => {
    const result = parseBillingCodeImport("A-1\tCall\tCOMMUNICATION\nA-1\tDuplicate\tOTHER");
    expect(result.items).toHaveLength(1);
    expect(result.errors[0]).toMatch(/duplicate/i);
  });
});
