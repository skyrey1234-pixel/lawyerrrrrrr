import { createHash } from "node:crypto";

export type PracticeProvider = "clio" | "mycase";

export type SyncableBillingEntry = {
  id: number;
  revision: number;
  workDate: Date;
  narrative: string;
  activityName: string;
  durationSeconds: number | null;
  rateCents: number | null;
  feeCents: number | null;
  billable: boolean;
};

export type ExternalSyncMapping = {
  matterId: string;
  userId: string;
  activityId?: string | null;
  activityName?: string | null;
  utbmsActivityCode?: string | null;
  utbmsTaskCode?: string | null;
};

export function assertSyncableEntry(entry: SyncableBillingEntry) {
  if (!entry.durationSeconds || entry.durationSeconds <= 0) throw new Error("A verified duration is required before synchronization");
  if (entry.billable && (entry.rateCents == null || entry.feeCents == null)) throw new Error("An applied lawyer rate is required before synchronization");
}

export function buildSyncIdempotencyKey(provider: PracticeProvider, firmId: number, entry: Pick<SyncableBillingEntry, "id" | "revision">) {
  return createHash("sha256").update(`${provider}:${firmId}:${entry.id}:${entry.revision}`).digest("hex");
}

export function buildSyncRequestFingerprint(provider: PracticeProvider, entry: SyncableBillingEntry, mapping: ExternalSyncMapping) {
  return createHash("sha256").update(JSON.stringify({
    provider,
    entry: { ...entry, workDate: entry.workDate.toISOString() },
    mapping,
  })).digest("hex");
}

export function buildClioTimeEntry(entry: SyncableBillingEntry, mapping: ExternalSyncMapping) {
  assertSyncableEntry(entry);
  return {
    data: {
      type: "TimeEntry",
      date: entry.workDate.toISOString().slice(0, 10),
      quantity: entry.durationSeconds,
      price: entry.rateCents == null ? 0 : entry.rateCents / 100,
      note: entry.narrative,
      matter: { id: Number(mapping.matterId) },
      user: { id: Number(mapping.userId) },
      ...(mapping.activityId ? { activity_description: { id: Number(mapping.activityId) } } : {}),
    },
  };
}

export function buildMyCaseTimeEntry(entry: SyncableBillingEntry, mapping: ExternalSyncMapping) {
  assertSyncableEntry(entry);
  return {
    activity_name: mapping.activityName || entry.activityName,
    description: entry.narrative,
    billable: entry.billable,
    entry_date: entry.workDate.toISOString().slice(0, 10),
    rate: entry.rateCents == null ? 0 : entry.rateCents / 100,
    hours: Number((entry.durationSeconds! / 3600).toFixed(6)),
    flat_fee: false,
    case: { id: Number(mapping.matterId) },
    staff: { id: Number(mapping.userId) },
    ...(mapping.utbmsActivityCode ? { utbms_activity_code: mapping.utbmsActivityCode } : {}),
    ...(mapping.utbmsTaskCode ? { utbms_task_code: mapping.utbmsTaskCode } : {}),
  };
}
