import { describe, expect, it } from "vitest";
import { buildBillingCsv } from "./billingCsv";

describe("billing CSV", () => {
  it("exports exact time and safely quotes legal narratives", () => {
    const output = buildBillingCsv([{
      entry: { id: 7, workDate: new Date("2026-08-15T12:00:00Z"), activityCode: "REVIEW", narrative: 'Review discovery, including "Exhibit A"', durationSeconds: 1440, currency: "USD", rateCents: 42500, feeCents: 17000, rateStatus: "applied", rateSource: "lawyer_rate", durationSource: "explicit_statement", sourceType: "voice", sourceQuote: "I spent 24 minutes reviewing discovery.", status: "approved" },
      matter: { matterNumber: "FL-100", clientName: "Hartwell", name: "Hartwell v. Jones" },
      attorney: { name: "Alex Counsel", email: "alex@example.com" },
      billingCode: { code: "L-110", label: "Review discovery", category: "REVIEW" },
    }]);
    expect(output).toContain('"L-110","Review discovery","REVIEW","REVIEW"');
    expect(output).toContain('"1440","0.4000"');
    expect(output).toContain('"USD","42500","425.00","17000","170.00","applied","lawyer_rate"');
    expect(output).toContain('"Review discovery, including ""Exhibit A"""');
    expect(output).toContain('"approved"');
  });
});
