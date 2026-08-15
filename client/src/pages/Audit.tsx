import { EmptyState, PageFrame, PageHeader } from "@/components/PilotUI";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { ClipboardCheck, Clock3, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

export default function Audit() {
  const audit = trpc.workspace.audit.useQuery({ limit: 200 });
  const [search, setSearch] = useState("");
  const events = useMemo(() => (audit.data || []).filter(event => `${event.eventType} ${event.resourceType} ${event.resourceId || ""}`.toLowerCase().includes(search.toLowerCase())), [audit.data, search]);
  return (
    <PageFrame>
      <PageHeader eyebrow="Append-only activity view" title="Audit history" description="Access, matter creation, audio upload, transcription, attorney decisions, version restoration, exports, and administrative changes are recorded as separate events." />
      <div className="mb-5 flex items-center gap-3 border border-white/10 bg-[#0a1827] px-4 py-3"><Search className="h-4 w-4 text-[#d6b65d]" /><Input value={search} onChange={event => setSearch(event.target.value)} placeholder="Filter event type or resource" className="border-0 bg-transparent p-0 shadow-none focus-visible:ring-0" /></div>
      {events.length ? <div className="border-y border-white/10 bg-[#0a1827]">{events.map(event => <article key={event.id} className="grid gap-3 border-b border-white/8 px-5 py-4 md:grid-cols-[210px_160px_minmax(0,1fr)_180px] md:items-center"><div className="flex items-center gap-2"><ClipboardCheck className="h-4 w-4 text-[#d6b65d]" /><strong className="text-sm text-[#eef0eb]">{event.eventType}</strong></div><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#8995a2]">{event.resourceType}{event.resourceId ? ` · ${event.resourceId}` : ""}</span><span className="truncate text-xs text-[#8f9aa7]">{event.metadata ? JSON.stringify(event.metadata) : "No content metadata stored"}</span><span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.11em] text-[#7f8b98]"><Clock3 className="h-3.5 w-3.5" />{new Date(event.createdAt).toLocaleString()}</span></article>)}</div> : <EmptyState title="No matching audit events" description="Activity appears here as the firm creates matters, sessions, review decisions, versions, exports, and settings changes." />}
      <div className="mt-5 flex items-start gap-3 border-l-2 border-[#aeb3a2] bg-white/[0.025] p-4 text-xs leading-relaxed text-[#9ca7b3]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#d6b65d]" />Audit metadata excludes raw transcript content by default. The event ledger proves workflow actions without duplicating privileged document text into every log record.</div>
    </PageFrame>
  );
}

