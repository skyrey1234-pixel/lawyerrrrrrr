import { PageFrame, PageHeader, SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { parseBillingVoiceCommand, type BillingActivityCode } from "@shared/billing";
import { AlertTriangle, BadgeDollarSign, Check, Clock3, Download, FileClock, Mic2, Pencil, Play, Plus, ReceiptText, ShieldCheck, Square, TimerOff, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const legacyActivityCodes: BillingActivityCode[] = ["COMMUNICATION", "DRAFTING", "REVIEW", "RESEARCH", "COURT", "NEGOTIATION", "ADMIN", "OTHER"];

type BillingSpeechRecognition = InstanceType<NonNullable<Window["SpeechRecognition"]>>;

function clock(seconds: number) {
  const value = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const remainder = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function hours(seconds?: number | null) {
  return seconds == null ? "—" : `${(seconds / 3600).toFixed(2)} h`;
}

function entryDuration(seconds?: number | null) {
  if (seconds == null) return "—";
  if (seconds < 60) return `${seconds}s`;
  return `${(seconds / 3600).toFixed(2)} h`;
}

export default function BillingCopilot() {
  const utils = trpc.useUtils();
  const matters = trpc.matters.list.useQuery();
  const entries = trpc.billing.list.useQuery({});
  const activeTimer = trpc.billing.activeTimer.useQuery();
  const exports = trpc.billing.exports.useQuery();
  const billingCodes = trpc.billing.codes.list.useQuery({ includeInactive: false });
  const [matterId, setMatterId] = useState(0);
  const selectedMatterId = matterId || matters.data?.[0]?.id || 0;
  const [billingCodeId, setBillingCodeId] = useState<number | undefined>();
  const [activityCode, setActivityCode] = useState("REVIEW");
  const [narrative, setNarrative] = useState("Review and analyze matter materials");
  const [durationMinutes, setDurationMinutes] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now());
  const [isListening, setIsListening] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState("");
  const recognitionRef = useRef<BillingSpeechRecognition | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editBillingCodeId, setEditBillingCodeId] = useState<number | undefined>();
  const [editActivity, setEditActivity] = useState("REVIEW");
  const [editNarrative, setEditNarrative] = useState("");
  const [editMinutes, setEditMinutes] = useState("");
  const [editDate, setEditDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (!activeTimer.data) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [activeTimer.data]);
  useEffect(() => () => recognitionRef.current?.stop(), []);
  useEffect(() => {
    if (!billingCodes.data?.length || billingCodeId) return;
    const first = billingCodes.data[0];
    setBillingCodeId(first.id);
    setActivityCode(first.code);
    if (first.defaultNarrative) setNarrative(first.defaultNarrative);
  }, [billingCodes.data, billingCodeId]);

  const invalidate = async () => {
    await Promise.all([utils.billing.list.invalidate(), utils.billing.activeTimer.invalidate(), utils.billing.exports.invalidate(), utils.workspace.dashboard.invalidate()]);
  };
  const startTimer = trpc.billing.startTimer.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Exact matter timer started."); }, onError: error => toast.error(error.message) });
  const stopTimer = trpc.billing.stopTimer.useMutation({ onSuccess: async data => { await invalidate(); toast.success(`Timer stopped at ${clock(data.elapsedSeconds)}. A draft billing entry was created.`); }, onError: error => toast.error(error.message) });
  const cancelTimer = trpc.billing.cancelTimer.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Timer cancelled without creating a billing entry."); }, onError: error => toast.error(error.message) });
  const createManual = trpc.billing.createManual.useMutation({ onSuccess: async () => { await invalidate(); setDurationMinutes(""); toast.success("Billing draft created for attorney review."); }, onError: error => toast.error(error.message) });
  const createFromVoice = trpc.billing.createFromVoice.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Spoken billing item captured for review."); }, onError: error => toast.error(error.message) });
  const updateEntry = trpc.billing.update.useMutation({ onSuccess: async () => { await invalidate(); setEditingId(null); toast.success("Billing entry updated; approval reset for review."); }, onError: error => toast.error(error.message) });
  const reviewEntry = trpc.billing.review.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const exportCsv = trpc.billing.exportCsv.useMutation({ onSuccess: async data => { await invalidate(); setSelectedIds([]); const link = document.createElement("a"); link.href = data.url; link.download = data.fileName; link.click(); toast.success("Approved billing entries exported to CSV."); }, onError: error => toast.error(error.message) });

  const elapsed = activeTimer.data ? Math.max(0, Math.floor((now - new Date(activeTimer.data.timer.startedAt).getTime()) / 1000)) : 0;
  const totals = useMemo(() => {
    const rows = entries.data || [];
    return {
      needs: rows.filter(row => row.entry.status === "needs_duration").length,
      drafts: rows.filter(row => row.entry.status === "draft").length,
      approvedSeconds: rows.filter(row => row.entry.status === "approved" || row.entry.status === "exported").reduce((sum, row) => sum + (row.entry.durationSeconds || 0), 0),
      duplicates: rows.filter(row => row.entry.duplicateOfEntryId).length,
    };
  }, [entries.data]);

  const openEdit = (record: NonNullable<typeof entries.data>[number]) => {
    setEditingId(record.entry.id);
    setEditBillingCodeId(record.entry.billingCodeId ?? undefined);
    setEditActivity(record.entry.activityCode);
    setEditNarrative(record.entry.narrative);
    setEditMinutes(record.entry.durationSeconds == null ? "" : String(record.entry.durationSeconds / 60));
    setEditDate(new Date(record.entry.workDate).toISOString().slice(0, 10));
  };

  const handleVoiceCommand = (transcript: string) => {
    setLastVoiceCommand(transcript);
    const command = parseBillingVoiceCommand(transcript);
    if (!command) { toast.error("Command not recognized. Use one of the exact examples shown."); return; }
    if (command.type === "start_timer") {
      if (!selectedMatterId) { toast.error("Select a matter first."); return; }
      const firmCode = billingCodes.data?.find(code => code.category === command.activityCode || code.code === command.activityCode);
      const resolvedActivityCode = firmCode?.code ?? command.activityCode;
      const resolvedBillingCodeId = firmCode?.id;
      startTimer.mutate({ matterId: selectedMatterId, billingCodeId: resolvedBillingCodeId, activityCode: resolvedActivityCode, narrative: command.narrative });
    }
    if (command.type === "stop_timer") {
      if (!activeTimer.data) { toast.error("There is no active timer."); return; }
      stopTimer.mutate({ timerId: activeTimer.data.timer.id });
    }
    if (command.type === "cancel_timer") {
      if (!activeTimer.data) { toast.error("There is no active timer."); return; }
      cancelTimer.mutate({ timerId: activeTimer.data.timer.id });
    }
    if (command.type === "create_entry") {
      if (!selectedMatterId) { toast.error("Select a matter first."); return; }
      const firmCode = billingCodes.data?.find(code => code.category === command.activityCode || code.code === command.activityCode);
      const resolvedActivityCode = firmCode?.code ?? command.activityCode;
      const resolvedBillingCodeId = firmCode?.id;
      createFromVoice.mutate({ matterId: selectedMatterId, billingCodeId: resolvedBillingCodeId, activityCode: resolvedActivityCode, narrative: command.narrative, durationSeconds: command.durationSeconds, sourceQuote: command.sourceQuote });
    }
  };

  const startListening = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) { toast.error("Voice billing commands are unavailable in this browser. Manual controls remain available."); return; }
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = event => { for (let index = event.resultIndex; index < event.results.length; index += 1) if (event.results[index].isFinal) handleVoiceCommand(event.results[index][0].transcript.trim()); };
    recognition.onerror = event => { setIsListening(false); toast.error(event.error === "not-allowed" ? "Microphone permission was blocked." : "Voice billing paused. Manual controls remain available."); };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setIsListening(true);
    recognition.start();
  };

  return (
    <PageFrame>
      <PageHeader eyebrow="Attorney-controlled time capture" title="Billing Copilot" description="Capture exact time, turn explicit spoken work into matter-linked drafts, review every narrative, and export only attorney-approved entries. CounselScribe never estimates billable time." actions={<Button variant="outline" className="border-white/15 bg-transparent" onClick={startListening} disabled={isListening}><Mic2 className="mr-2 h-4 w-4" /> {isListening ? "Listening…" : "Speak billing command"}</Button>} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="border-l-2 border-[#d6b65d]/60 bg-white/[0.03] p-5"><ReceiptText className="h-4 w-4 text-[#d6b65d]" /><strong className="mt-3 block font-display text-3xl">{entries.data?.length || 0}</strong><span className="text-xs text-[#8f9aa7]">Total captured entries</span></div>
        <div className="border-l-2 border-[#a4564d]/70 bg-white/[0.03] p-5"><AlertTriangle className="h-4 w-4 text-[#dc978e]" /><strong className="mt-3 block font-display text-3xl">{totals.needs}</strong><span className="text-xs text-[#8f9aa7]">Need verified duration</span></div>
        <div className="border-l-2 border-[#aeb3a2]/60 bg-white/[0.03] p-5"><ShieldCheck className="h-4 w-4 text-[#cdd4c3]" /><strong className="mt-3 block font-display text-3xl">{hours(totals.approvedSeconds)}</strong><span className="text-xs text-[#8f9aa7]">Approved exact time</span></div>
        <div className="border-l-2 border-[#be8d59]/70 bg-white/[0.03] p-5"><FileClock className="h-4 w-4 text-[#d6ae7d]" /><strong className="mt-3 block font-display text-3xl">{totals.duplicates}</strong><span className="text-xs text-[#8f9aa7]">Possible duplicates</span></div>
      </div>

      <div className="mb-7 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <section className="border border-[#d6b65d]/20 bg-[#0a1827] p-5 sm:p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div><SectionHeading label="Server-timed work" title={activeTimer.data ? "Timer running" : "Start a matter timer"} /><p className="mt-2 text-sm text-[#8f9aa7]">One exact timer per attorney. The server calculates final elapsed seconds.</p></div>
            {activeTimer.data ? <div className="text-left md:text-right"><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#d6b65d]">{activeTimer.data.matter.matterNumber}</span><strong className="mt-1 block font-mono text-4xl text-[#f4eee2]">{clock(elapsed)}</strong></div> : null}
          </div>
          {activeTimer.data ? <div className="mt-5 border-l-2 border-[#d6b65d]/60 bg-[#d6b65d]/7 p-4"><strong>{activeTimer.data.timer.narrative}</strong><p className="mt-1 text-xs text-[#9aa5b0]">{activeTimer.data.matter.clientName} · {activeTimer.data.billingCode ? `${activeTimer.data.billingCode.code} · ${activeTimer.data.billingCode.label}` : `${activeTimer.data.timer.activityCode} · legacy fallback`}</p><div className="mt-4 flex flex-wrap gap-2"><Button className="bg-[#d6b65d] text-[#07111d]" onClick={() => stopTimer.mutate({ timerId: activeTimer.data!.timer.id })} disabled={stopTimer.isPending}><Square className="mr-2 h-4 w-4" /> Stop and draft entry</Button><Button variant="outline" className="border-white/12 bg-transparent" onClick={() => cancelTimer.mutate({ timerId: activeTimer.data!.timer.id })} disabled={cancelTimer.isPending}><TimerOff className="mr-2 h-4 w-4" /> Cancel timer</Button></div></div> : <div className="mt-5 grid min-w-0 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div className="min-w-0 space-y-2"><Label>Matter</Label><Select value={selectedMatterId ? String(selectedMatterId) : undefined} onValueChange={value => setMatterId(Number(value))}><SelectTrigger className="w-full min-w-0 border-white/10 bg-white/5"><SelectValue placeholder="Select matter" /></SelectTrigger><SelectContent>{matters.data?.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.matterNumber} · {item.name}</SelectItem>)}</SelectContent></Select></div><div className="min-w-0 space-y-2"><Label>Firm billing code</Label><Select value={billingCodeId ? `firm:${billingCodeId}` : `legacy:${activityCode}`} onValueChange={value => { if (value.startsWith("firm:")) { const id = Number(value.slice(5)); const code = billingCodes.data?.find(item => item.id === id); if (code) { setBillingCodeId(id); setActivityCode(code.code); if (code.defaultNarrative) setNarrative(code.defaultNarrative); } } else { setBillingCodeId(undefined); setActivityCode(value.slice(7)); } }}><SelectTrigger className="w-full min-w-0 border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent>{billingCodes.data?.length ? billingCodes.data.map(code => <SelectItem key={code.id} value={`firm:${code.id}`}>{code.code} · {code.label}</SelectItem>) : legacyActivityCodes.map(code => <SelectItem key={code} value={`legacy:${code}`}>{code} · legacy fallback</SelectItem>)}</SelectContent></Select></div><div className="min-w-0 space-y-2 md:col-span-2"><Label>Billing narrative</Label><Input value={narrative} onChange={event => setNarrative(event.target.value)} className="border-white/10 bg-white/5" /></div><Button className="bg-[#d6b65d] text-[#07111d] md:col-span-2" disabled={!selectedMatterId || narrative.trim().length < 3 || startTimer.isPending} onClick={() => startTimer.mutate({ matterId: selectedMatterId, billingCodeId, activityCode, narrative })}><Play className="mr-2 h-4 w-4" /> Start exact timer</Button></div>}
        </section>

        <aside className="border border-white/10 bg-[#0a1827] p-5">
          <SectionHeading label="Voice grammar" title="Speak the work" />
          <div className="space-y-2 font-mono text-[9px] uppercase tracking-[0.1em] text-[#9da8b5]">{["start billing timer for drafting motion", "stop timer", "cancel timer", "bill 24 minutes for reviewing discovery", "bill for reviewing settlement offer"].map(command => <p key={command} className="border-b border-white/7 pb-2">“{command}”</p>)}</div>
          <Button className={`mt-4 w-full ${isListening ? "bg-[#a4564d] text-white" : "bg-[#d6b65d] text-[#07111d]"}`} onClick={isListening ? () => recognitionRef.current?.stop() : startListening}>{isListening ? <><Square className="mr-2 h-4 w-4" /> Stop listening</> : <><Mic2 className="mr-2 h-4 w-4" /> Speak one command</>}</Button>
          <p className="mt-3 min-h-8 text-xs leading-relaxed text-[#85919e]">{lastVoiceCommand ? <>Last command: “{lastVoiceCommand}”</> : "A spoken task without numeric time becomes needs duration—not an invented estimate."}</p>
        </aside>
      </div>

      <section className="mb-7 border border-white/10 bg-[#0a1827] p-5 sm:p-6">
        <SectionHeading label="Manual capture" title="Add a billing draft" />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[1fr_230px_160px_auto] xl:items-end"><div className="space-y-2"><Label>Narrative</Label><Input value={narrative} onChange={event => setNarrative(event.target.value)} className="border-white/10 bg-white/5" /></div><div className="space-y-2"><Label>Firm billing code</Label><Select value={billingCodeId ? `firm:${billingCodeId}` : `legacy:${activityCode}`} onValueChange={value => { if (value.startsWith("firm:")) { const id = Number(value.slice(5)); const code = billingCodes.data?.find(item => item.id === id); if (code) { setBillingCodeId(id); setActivityCode(code.code); if (code.defaultNarrative) setNarrative(code.defaultNarrative); } } else { setBillingCodeId(undefined); setActivityCode(value.slice(7)); } }}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent>{billingCodes.data?.length ? billingCodes.data.map(code => <SelectItem key={code.id} value={`firm:${code.id}`}>{code.code} · {code.label}</SelectItem>) : legacyActivityCodes.map(code => <SelectItem key={code} value={`legacy:${code}`}>{code} · legacy fallback</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Minutes, if known</Label><Input type="number" min="0.01" step="0.01" value={durationMinutes} onChange={event => setDurationMinutes(event.target.value)} className="border-white/10 bg-white/5" /></div><Button className="bg-[#d6b65d] text-[#07111d]" disabled={!selectedMatterId || narrative.trim().length < 3 || createManual.isPending} onClick={() => createManual.mutate({ matterId: selectedMatterId, billingCodeId, activityCode, narrative, durationSeconds: durationMinutes ? Math.round(Number(durationMinutes) * 60) : undefined })}><Plus className="mr-2 h-4 w-4" /> Add draft</Button></div>
      </section>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><SectionHeading label="Attorney review ledger" title={`${entries.data?.length || 0} entries`} /><Button className="bg-[#d6b65d] text-[#07111d]" disabled={!selectedIds.length || exportCsv.isPending} onClick={() => exportCsv.mutate({ entryIds: selectedIds })}><Download className="mr-2 h-4 w-4" /> Export {selectedIds.length || "approved"} to CSV</Button></div>
      <div className="space-y-3">{entries.data?.length ? entries.data.map(record => {
        const entry = record.entry; const canSelect = entry.status === "approved"; const selected = selectedIds.includes(entry.id);
        return <article key={entry.id} className={`border bg-[#0a1827] p-4 sm:p-5 ${entry.duplicateOfEntryId ? "border-[#be8d59]/45" : "border-white/10"}`}><div className="grid gap-4 xl:grid-cols-[32px_150px_minmax(0,1fr)_120px_170px_auto] xl:items-center"><div><Checkbox checked={selected} disabled={!canSelect} onCheckedChange={checked => setSelectedIds(current => checked ? [...current, entry.id] : current.filter(id => id !== entry.id))} aria-label={`Select entry ${entry.id}`} /></div><div><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#d6b65d]">{record.matter.matterNumber}</span><p className="mt-1 text-xs text-[#8f9aa7]">{record.matter.clientName}</p></div><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm">{entry.narrative}</strong>{entry.duplicateOfEntryId ? <span className="border border-[#be8d59]/40 bg-[#be8d59]/10 px-2 py-1 font-mono text-[8px] uppercase text-[#dfb27e]">Possible duplicate of #{entry.duplicateOfEntryId}</span> : null}</div><blockquote className="mt-2 line-clamp-2 text-xs italic leading-relaxed text-[#7f8b98]">{entry.sourceQuote ? `“${entry.sourceQuote}”` : `${entry.sourceType} entry · no source quotation`}</blockquote></div><div><strong className={`font-mono text-lg ${entry.durationSeconds ? "text-[#f3ead8]" : "text-[#dc978e]"}`}>{entryDuration(entry.durationSeconds)}</strong><p className="text-[10px] uppercase text-[#7f8b98]">{entry.durationSource.replace("_", " ")}</p></div><div><span className={`font-mono text-[9px] uppercase tracking-[0.12em] ${entry.status === "approved" || entry.status === "exported" ? "text-[#b9c8ad]" : entry.status === "rejected" ? "text-[#dc978e]" : entry.status === "needs_duration" ? "text-[#e2a097]" : "text-[#d6b65d]"}`}>{entry.status.replace("_", " ")}</span><p className="mt-1 text-[10px] text-[#7f8b98]">{new Date(entry.workDate).toLocaleDateString()} · {record.billingCode ? `${record.billingCode.code} · ${record.billingCode.label}` : `${entry.activityCode} · legacy`}</p></div><div className="flex flex-wrap justify-start gap-2 xl:justify-end"><Button size="sm" variant="outline" className="border-white/12 bg-transparent" disabled={entry.status === "exported"} onClick={() => openEdit(record)}><Pencil className="h-3.5 w-3.5" /></Button>{["draft", "needs_duration"].includes(entry.status) ? <><Button size="sm" className="bg-[#d6b65d] text-[#07111d]" disabled={!entry.durationSeconds || reviewEntry.isPending} onClick={() => reviewEntry.mutate({ entryId: entry.id, decision: "approved" })}><Check className="h-3.5 w-3.5" /></Button><Button size="sm" variant="outline" className="border-white/12 bg-transparent" disabled={reviewEntry.isPending} onClick={() => reviewEntry.mutate({ entryId: entry.id, decision: "rejected" })}><X className="h-3.5 w-3.5" /></Button></> : null}</div></div></article>;
      }) : <div className="border border-dashed border-white/15 p-8 text-center text-sm text-[#8f9aa7]">No billing entries yet. Start a timer, speak a billing command, create a manual draft, or analyze matter text.</div>}</div>

      {exports.data?.length ? <section className="mt-8"><SectionHeading label="Export history" title={`${exports.data.length} CSV files`} /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{exports.data.map(item => <a key={item.id} href={item.storageUrl} download={item.fileName} className="border border-white/10 bg-white/[0.025] p-4 transition hover:border-[#d6b65d]/35"><div className="flex items-center gap-2 text-[#d6b65d]"><Download className="h-4 w-4" /><strong className="text-sm">{item.fileName}</strong></div><p className="mt-2 text-xs text-[#8f9aa7]">{item.entryCount} approved entries · {new Date(item.createdAt).toLocaleString()}</p></a>)}</div></section> : null}

      <Dialog open={Boolean(editingId)} onOpenChange={open => { if (!open) setEditingId(null); }}>
        <DialogContent className="border-[#d6b65d]/25 bg-[#0b1725] text-[#f7f1e5] sm:max-w-xl"><DialogHeader><DialogTitle className="font-display text-3xl">Review billing entry</DialogTitle><DialogDescription className="text-[#97a2ae]">Editing an approved entry resets it to draft. Exported entries are immutable.</DialogDescription></DialogHeader><div className="space-y-4 py-3"><div className="space-y-2"><Label>Firm billing code</Label><Select value={editBillingCodeId ? `firm:${editBillingCodeId}` : `legacy:${editActivity}`} onValueChange={value => { if (value.startsWith("firm:")) { const id = Number(value.slice(5)); const code = billingCodes.data?.find(item => item.id === id); if (code) { setEditBillingCodeId(id); setEditActivity(code.code); if (code.defaultNarrative && !editNarrative.trim()) setEditNarrative(code.defaultNarrative); } } else { setEditBillingCodeId(undefined); setEditActivity(value.slice(7)); } }}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent>{billingCodes.data?.map(code => <SelectItem key={code.id} value={`firm:${code.id}`}>{code.code} · {code.label}</SelectItem>)}{!editBillingCodeId ? <SelectItem value={`legacy:${editActivity}`}>{editActivity} · legacy fallback</SelectItem> : null}</SelectContent></Select></div><div className="space-y-2"><Label>Narrative</Label><Textarea value={editNarrative} onChange={event => setEditNarrative(event.target.value)} className="min-h-28 border-white/10 bg-white/5" /></div><div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Exact minutes</Label><Input type="number" min="0.01" step="0.01" value={editMinutes} onChange={event => setEditMinutes(event.target.value)} className="border-white/10 bg-white/5" /></div><div className="space-y-2"><Label>Work date</Label><Input type="date" value={editDate} onChange={event => setEditDate(event.target.value)} className="border-white/10 bg-white/5" /></div></div></div><DialogFooter><Button variant="outline" className="border-white/15 bg-transparent" onClick={() => setEditingId(null)}>Cancel</Button><Button className="bg-[#d6b65d] text-[#07111d]" disabled={!editingId || editNarrative.trim().length < 3 || updateEntry.isPending} onClick={() => editingId && updateEntry.mutate({ entryId: editingId, billingCodeId: editBillingCodeId, activityCode: editActivity, narrative: editNarrative, durationSeconds: editMinutes ? Math.round(Number(editMinutes) * 60) : null, workDateMs: new Date(`${editDate}T12:00:00`).getTime() })}><BadgeDollarSign className="mr-2 h-4 w-4" /> Save reviewed entry</Button></DialogFooter></DialogContent>
      </Dialog>
    </PageFrame>
  );
}
