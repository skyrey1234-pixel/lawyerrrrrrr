import { describe, expect, it } from "vitest";
import { buildClioTimeEntry, buildMyCaseTimeEntry, buildSyncIdempotencyKey } from "./practiceManagement";

const entry = {
  id: 42,
  revision: 3,
  workDate: new Date("2026-08-15T18:00:00Z"),
  narrative: "Review and analyze discovery responses",
  activityName: "Review and analysis",
  durationSeconds: 900,
  rateCents: 42500,
  feeCents: 10625,
  billable: true,
};

describe("practice-management payloads", () => {
  it("sends exact seconds and the snapshotted rate to Clio", () => {
    expect(buildClioTimeEntry(entry, { matterId: "77", userId: "12", activityId: "5" })).toEqual({
      data: {
        type: "TimeEntry",
        date: "2026-08-15",
        quantity: 900,
        price: 425,
        note: "Review and analyze discovery responses",
        matter: { id: 77 },
        user: { id: 12 },
        activity_description: { id: 5 },
      },
    });
  });

  it("converts exact seconds to six-decimal hours for MyCase without changing the rate", () => {
    expect(buildMyCaseTimeEntry(entry, { matterId: "77", userId: "12", activityName: "Review", utbmsTaskCode: "L110" })).toMatchObject({
      activity_name: "Review",
      entry_date: "2026-08-15",
      rate: 425,
      hours: 0.25,
      case: { id: 77 },
      staff: { id: 12 },
      utbms_task_code: "L110",
    });
  });

  it("creates a stable provider-and-revision idempotency key and blocks missing rates", () => {
    expect(buildSyncIdempotencyKey("clio", 9, entry)).toBe(buildSyncIdempotencyKey("clio", 9, entry));
    expect(buildSyncIdempotencyKey("clio", 9, entry)).not.toBe(buildSyncIdempotencyKey("mycase", 9, entry));
    expect(() => buildClioTimeEntry({ ...entry, rateCents: null, feeCents: null }, { matterId: "1", userId: "2" })).toThrow(/rate/i);
  });
});
