import { describe, expect, it } from "vitest";
import { buildBillingCsv } from "./billingCsv";

describe("billing CSV", () => {
  it("exports exact time and safely quotes legal narratives", () => {
    const output = buildBillingCsv([{
      entry: { id: 7, workDate: new Date("2026-08-15T12:00:00Z"), activityCode: "REVIEW", narrative: 'Review discovery, including "Exhibit A"', durationSeconds: 1440, durationSource: "explicit_statement", sourceType: "voice", sourceQuote: "I spent 24 minutes reviewing discovery.", status: "approved" },
      matter: { matterNumber: "FL-100", clientName: "Hartwell", name: "Hartwell v. Jones" },
      attorney: { name: "Alex Counsel", email: "alex@example.com" },
    }]);
    expect(output).toContain('"1440","0.4000"');
    expect(output).toContain('"Review discovery, including ""Exhibit A"""');
    expect(output).toContain('"approved"');
  });
});
