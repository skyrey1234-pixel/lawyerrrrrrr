import { PageFrame, PageHeader, ProcessingBadge, SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { AudioLines, BrainCircuit, CalendarDays, Check, FileText, ListTodo, Quote, ReceiptText, ShieldAlert, Sparkles, Upload, UserRoundSearch, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const itemConfig = {
  fact: { title: "Key facts", icon: Quote },
  entity: { title: "People & organizations", icon: UserRoundSearch },
  date: { title: "Dates", icon: CalendarDays },
  deadline: { title: "Unverified deadlines", icon: CalendarDays },
  action: { title: "Action items", icon: ListTodo },
  vocabulary: { title: "Vocabulary", icon: AudioLines },
  billing: { title: "Billing candidates", icon: ReceiptText },
} as const;

type ItemType = keyof typeof itemConfig;

type AnalysisItemRecord = {
  id: number;
  itemType: string;
  label: string;
  value: string;
  sourceQuote: string;
  status: "proposed" | "accepted" | "rejected";
};

type BillingCodeOption = { id: number; code: string; label: string; category: string };

function AnalysisItemCard({ item, billingCodes, pending, onReview }: {
  item: AnalysisItemRecord;
  billingCodes: BillingCodeOption[];
  pending: boolean;
  onReview: (itemId: number, status: "accepted" | "rejected", billingCodeId?: number) => void;
}) {
  const suggested = billingCodes.find(code => code.category === item.label || code.code === item.label);
  const [selectedCodeId, setSelectedCodeId] = useState<number | undefined>(suggested?.id);
  useEffect(() => { if (!selectedCodeId && suggested) setSelectedCodeId(suggested.id); }, [selectedCodeId, suggested]);
  const selectedCode = billingCodes.find(code => code.id === selectedCodeId);
  const isBilling = item.itemType === "billing";
  return <article className="border-l-2 border-white/10 bg-white/[0.025] p-4">
    <div className="flex items-start justify-between gap-3"><div><strong className="text-sm">{item.label}</strong><p className="mt-2 text-xs leading-relaxed text-[#a5afba]">{item.value}</p></div><span className={`shrink-0 font-mono text-[8px] uppercase tracking-[0.1em] ${item.status === "accepted" ? "text-[#b7c7ac]" : item.status === "rejected" ? "text-[#d08e86]" : "text-[#d6b65d]"}`}>{item.status}</span></div>
    <blockquote className="mt-3 border-l border-[#d6b65d]/45 pl-3 text-[11px] italic leading-relaxed text-[#8996a3]">“{item.sourceQuote}”</blockquote>
    {isBilling ? <div className="mt-4 space-y-2"><Label htmlFor={`candidate-code-${item.id}`}>Firm billing code</Label><Select value={selectedCodeId ? String(selectedCodeId) : "legacy"} onValueChange={value => setSelectedCodeId(value === "legacy" ? undefined : Number(value))}><SelectTrigger id={`candidate-code-${item.id}`} className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent>{billingCodes.map(code => <SelectItem key={code.id} value={String(code.id)}>{code.code} · {code.label}</SelectItem>)}<SelectItem value="legacy">{item.label} · legacy fallback</SelectItem></SelectContent></Select><p className="font-mono text-[9px] uppercase tracking-[0.11em] text-[#7f8b98]">{selectedCode ? `Will enter ledger as ${selectedCode.code} · ${selectedCode.label}` : `Will preserve legacy activity ${item.label}`}</p></div> : null}
    {item.status === "proposed" ? <div className="mt-4 grid grid-cols-2 gap-2"><Button size="sm" className="bg-[#d6b65d] text-[#07111d]" disabled={pending} onClick={() => onReview(item.id, "accepted", isBilling ? selectedCodeId : undefined)}><Check className="mr-1 h-3.5 w-3.5" /> Accept</Button><Button size="sm" variant="outline" className="border-white/12 bg-transparent" disabled={pending} onClick={() => onReview(item.id, "rejected")}><X className="mr-1 h-3.5 w-3.5" /> Reject</Button></div> : null}
  </article>;
}

export default function MatterIntelligence() {
  const utils = trpc.useUtils();
  const matters = trpc.matters.list.useQuery();
  const [matterId, setMatterId] = useState(0);
  const selectedMatterId = matterId || matters.data?.[0]?.id || 0;
  const matter = trpc.matters.get.useQuery({ matterId: selectedMatterId }, { enabled: Boolean(selectedMatterId) });
  const intelligence = trpc.intelligence.get.useQuery({ matterId: selectedMatterId }, { enabled: Boolean(selectedMatterId) });
  const billing = trpc.billing.list.useQuery({ matterId: selectedMatterId }, { enabled: Boolean(selectedMatterId) });
  const billingCodes = trpc.billing.codes.list.useQuery({ includeInactive: false });
  const [title, setTitle] = useState("Attorney-provided matter text");
  const [content, setContent] = useState("");
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null);

  useEffect(() => {
    const latest = intelligence.data?.runs[0]?.id;
    if (latest && !intelligence.data?.runs.some(run => run.id === selectedRunId)) setSelectedRunId(latest);
  }, [intelligence.data?.runs, selectedRunId]);

  const invalidate = async () => {
    await Promise.all([
      utils.intelligence.get.invalidate({ matterId: selectedMatterId }),
      utils.billing.list.invalidate({ matterId: selectedMatterId }),
    ]);
  };
  const analyzeText = trpc.intelligence.analyzeText.useMutation({
    onSuccess: async data => { await utils.intelligence.get.invalidate({ matterId: selectedMatterId }); setSelectedRunId(data.analysisRunId); toast.success(`Matter AI staged ${data.itemCount} source-grounded findings, including ${data.stagedBillingCount} billing candidates. Nothing enters billing until an attorney accepts it.`); },
    onError: error => toast.error(error.message),
  });
  const analyzeTranscript = trpc.intelligence.analyzeTranscript.useMutation({
    onSuccess: async data => { await utils.intelligence.get.invalidate({ matterId: selectedMatterId }); setSelectedRunId(data.analysisRunId); toast.success(`Transcript analysis staged ${data.stagedBillingCount} billing candidates for attorney review; none were added to billing.`); },
    onError: error => toast.error(error.message),
  });
  const reviewItem = trpc.intelligence.reviewItem.useMutation({
    onSuccess: async data => { await invalidate(); toast.success(data.status === "rejected" ? "AI item rejected and not saved." : data.billingEntryId ? "Billing candidate accepted and added to the attorney review ledger." : "AI finding accepted into the matter record."); },
    onError: error => toast.error(error.message),
  });

  const activeRun = intelligence.data?.runs.find(run => run.id === selectedRunId) ?? intelligence.data?.runs[0];
  const activeItems = useMemo(() => intelligence.data?.items.filter(item => item.analysisRunId === activeRun?.id) ?? [], [activeRun?.id, intelligence.data?.items]);
  const grouped = useMemo(() => Object.fromEntries(Object.keys(itemConfig).map(type => [type, activeItems.filter(item => item.itemType === type)])) as Record<ItemType, typeof activeItems>, [activeItems]);

  const readTextFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 1_000_000) { toast.error("Text files are limited to 1 MB in this pilot."); return; }
    setContent(await file.text());
    setTitle(file.name.replace(/\.[^.]+$/, ""));
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Matter intelligence · hosted AI"
        title="Read it once. Organize the work."
        description="CounselScribe reads attorney-selected text or a preserved transcript, then returns source-grounded facts, entities, dates, action items, vocabulary, and candidate billing entries. Nothing becomes verified merely because AI extracted it."
        actions={<span className="border border-[#d6b65d]/30 bg-[#d6b65d]/8 px-3 py-2 font-mono text-[9px] uppercase tracking-[0.13em] text-[#e0c873]">Hosted AI analysis</span>}
      />

      <div className="mb-7 grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="border border-[#d6b65d]/18 bg-[#0a1827] p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 flex-1"><Label>Matter</Label><Select value={selectedMatterId ? String(selectedMatterId) : undefined} onValueChange={value => { setMatterId(Number(value)); setSelectedRunId(null); }}><SelectTrigger className="mt-2 border-white/10 bg-white/5"><SelectValue placeholder="Select matter" /></SelectTrigger><SelectContent>{matters.data?.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.matterNumber} · {item.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#8f9aa7]">{matter.data?.matter.clientName || "Select a client matter"}</div>
          </div>
        </section>
        <section className="border border-[#d6b65d]/18 bg-[#d6b65d]/7 p-5">
          <div className="flex items-center gap-2 text-[#d6b65d]"><ShieldAlert className="h-4 w-4" /><span className="font-mono text-[9px] uppercase tracking-[0.14em]">Evidence boundary</span></div>
          <p className="mt-3 text-xs leading-relaxed text-[#aab4bf]">Hosted AI receives only the text you explicitly submit. Findings without an exact source quotation are discarded. AI never invents duration; missing time remains <strong className="text-[#f2dc9b]">needs duration</strong>.</p>
        </section>
      </div>

      <Tabs defaultValue="text" className="mb-8">
        <TabsList className="h-auto border border-white/10 bg-[#0a1827] p-1"><TabsTrigger value="text">Paste or upload text</TabsTrigger><TabsTrigger value="transcript">Analyze transcript</TabsTrigger></TabsList>
        <TabsContent value="text" className="mt-4">
          <section className="grid gap-6 border border-white/10 bg-[#0a1827] p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_280px]">
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="source-title">Source title</Label><Input id="source-title" value={title} onChange={event => setTitle(event.target.value)} className="border-white/10 bg-white/5" /></div>
              <div className="space-y-2"><div className="flex items-center justify-between gap-4"><Label htmlFor="source-content">Attorney-selected text</Label><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#7f8b98]">{content.length.toLocaleString()} / 60,000 characters</span></div><Textarea id="source-content" value={content} onChange={event => setContent(event.target.value)} placeholder="Paste a memo, client communication, work log, case note, or other approved text. CounselScribe will organize it and preserve exact source quotations." className="min-h-[320px] resize-y border-white/10 bg-[#071421] leading-7" maxLength={60_000} /></div>
            </div>
            <aside className="space-y-4">
              <label className="block cursor-pointer border border-dashed border-white/15 bg-white/[0.025] p-5 text-center transition hover:border-[#d6b65d]/45"><Upload className="mx-auto h-5 w-5 text-[#d6b65d]" /><strong className="mt-3 block text-sm">Load a text file</strong><span className="mt-1 block text-xs text-[#84909d]">TXT or Markdown · 1 MB max</span><input type="file" accept="text/plain,text/markdown,.txt,.md" className="sr-only" onChange={event => void readTextFile(event.target.files?.[0])} /></label>
              <div className="border-l-2 border-[#d6b65d]/60 bg-[#d6b65d]/7 p-4 text-xs leading-relaxed text-[#b8ad8c]">This action uses the managed AI service. Do not submit privileged production material until the firm approves that processing boundary.</div>
              <Button className="w-full bg-[#d6b65d] text-[#07111d]" disabled={!selectedMatterId || title.trim().length < 2 || content.trim().length < 20 || analyzeText.isPending} onClick={() => analyzeText.mutate({ matterId: selectedMatterId, title, content })}>{analyzeText.isPending ? "Reading and grounding…" : <><BrainCircuit className="mr-2 h-4 w-4" /> Analyze matter text</>}</Button>
            </aside>
          </section>
        </TabsContent>
        <TabsContent value="transcript" className="mt-4">
          <section className="border border-white/10 bg-[#0a1827] p-5 sm:p-6">
            <SectionHeading label="Preserved work product" title="Select a transcript" />
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{matter.data?.sessions.length ? matter.data.sessions.map(session => <article key={session.id} className="border border-white/10 bg-white/[0.025] p-4"><div className="flex items-center justify-between"><ProcessingBadge mode={session.processingMode} /><span className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#7f8b98]">{session.status}</span></div><strong className="mt-4 block font-display text-xl">{session.title}</strong><p className="mt-2 text-xs text-[#8f9aa7]">{session.wordCount} words · {session.sourceType}</p><Button variant="outline" className="mt-4 w-full border-white/12 bg-transparent" disabled={analyzeTranscript.isPending || session.wordCount === 0} onClick={() => analyzeTranscript.mutate({ matterId: selectedMatterId, sessionId: session.id, title: `Transcript analysis · ${session.title}` })}><AudioLines className="mr-2 h-4 w-4" /> Analyze transcript</Button></article>) : <p className="text-sm text-[#8f9aa7]">This matter has no preserved transcripts yet.</p>}</div>
          </section>
        </TabsContent>
      </Tabs>

      <div className="grid gap-7 2xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3">
          <SectionHeading label="Analysis history" title={`${intelligence.data?.runs.filter(run => run.status === "completed").length || 0} completed runs`} />
          {intelligence.data?.runs.filter(run => run.status === "completed").map(run => <button key={run.id} onClick={() => setSelectedRunId(run.id)} className={`w-full border p-4 text-left transition ${run.id === activeRun?.id ? "border-[#d6b65d]/45 bg-[#d6b65d]/8" : "border-white/10 bg-[#0a1827] hover:border-white/20"}`}><div className="flex items-center justify-between"><span className="font-mono text-[8px] uppercase tracking-[0.13em] text-[#d6b65d]">Run {run.id}</span><span className="text-[10px] uppercase text-[#8f9aa7]">verified source</span></div><p className="mt-3 line-clamp-3 text-xs leading-relaxed text-[#9ba6b2]">{run.summary}</p><span className="mt-3 block text-[10px] text-[#6f7c89]">{new Date(run.createdAt).toLocaleString()}</span></button>)}
        </aside>

        <section className="min-w-0">
          {activeRun ? <>
            <div className="mb-6 border border-[#d6b65d]/18 bg-[#eee9dd] p-6 text-[#28251f] shadow-[0_20px_60px_rgba(0,0,0,.22)]"><span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-[#756b55]">AI reading memo · attorney verification required</span><h2 className="mt-3 font-display text-3xl">Executive summary</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7">{activeRun.summary || "Analysis is still running."}</p></div>
            <div className="grid gap-5 xl:grid-cols-2">{(Object.keys(itemConfig) as ItemType[]).map(type => {
              const config = itemConfig[type]; const Icon = config.icon; const items = grouped[type];
              return <section key={type} className="border border-white/10 bg-[#0a1827] p-5"><div className="mb-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><Icon className="h-4 w-4 text-[#d6b65d]" /><h3 className="font-display text-2xl">{config.title}</h3></div><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#788592]">{items.length}</span></div><div className="space-y-3">{items.length ? items.map(item => <AnalysisItemCard key={item.id} item={item as AnalysisItemRecord} billingCodes={billingCodes.data || []} pending={reviewItem.isPending} onReview={(itemId, status, billingCodeId) => reviewItem.mutate({ itemId, status, billingCodeId })} />) : <p className="border border-dashed border-white/12 p-4 text-xs text-[#7f8b98]">No source-grounded items in this category.</p>}</div></section>;
            })}</div>
            <div className="mt-6 flex items-center justify-between border border-white/10 bg-white/[0.025] p-4 text-xs text-[#8f9aa7]"><span>{billing.data?.length || 0} billing entries currently linked to this matter.</span><a href="/billing" className="font-semibold text-[#d6b65d]">Open Billing Copilot →</a></div>
          </> : <div className="grid min-h-96 place-items-center border border-dashed border-white/15 bg-white/[0.02] p-8 text-center"><div><Sparkles className="mx-auto h-7 w-7 text-[#d6b65d]" /><h2 className="mt-4 font-display text-3xl">No analysis selected</h2><p className="mt-3 max-w-md text-sm leading-relaxed text-[#8f9aa7]">Submit attorney-approved text or analyze a preserved transcript to create a source-grounded matter reading.</p></div></div>}
        </section>
      </div>
    </PageFrame>
  );
}
