type BillingExportRow = {
  entry: {
    id: number;
    workDate: Date;
    activityCode: string;
    narrative: string;
    durationSeconds: number | null;
    durationSource: string;
    sourceType: string;
    sourceQuote: string | null;
    status: string;
  };
  matter: { matterNumber: string; clientName: string; name: string };
  attorney: { name: string | null; email: string | null };
};

const csv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function buildBillingCsv(rows: BillingExportRow[]) {
  const header = ["Entry ID", "Work Date", "Client", "Matter Number", "Matter", "Attorney", "Attorney Email", "Activity", "Duration Seconds", "Exact Hours", "Narrative", "Duration Source", "Source Type", "Source Evidence", "Approval Status"];
  const lines = rows.map(({ entry, matter, attorney }) => [
    entry.id,
    entry.workDate.toISOString().slice(0, 10),
    matter.clientName,
    matter.matterNumber,
    matter.name,
    attorney.name,
    attorney.email,
    entry.activityCode,
    entry.durationSeconds,
    entry.durationSeconds == null ? "" : (entry.durationSeconds / 3600).toFixed(4),
    entry.narrative,
    entry.durationSource,
    entry.sourceType,
    entry.sourceQuote,
    entry.status,
  ]);
  return [header, ...lines].map(row => row.map(csv).join(",")).join("\n");
}
