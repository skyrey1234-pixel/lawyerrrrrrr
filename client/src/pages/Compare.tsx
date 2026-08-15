import { EmptyState, PageFrame, PageHeader, SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { BarChart3, CheckCircle2, GitCompareArrows, Plus, Scale, TimerReset } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

function MetricBar({ label, value, lowerIsBetter = false }: { label: string; value: number | null; lowerIsBetter?: boolean }) {
  if (value == null) return <div className="text-xs text-[#83909d]">{label}: reference text required</div>;
  const displayWidth = lowerIsBetter ? Math.max(2, 100 - Math.min(100, value)) : Math.max(2, Math.min(100, value));
  return <div><div className="mb-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-[0.12em] text-[#929eaa]"><span>{label}</span><strong className="text-[#e5cf8e]">{value.toFixed(2)}%</strong></div><div className="h-1.5 bg-white/8"><div className="h-full bg-[#d6b65d]" style={{ width: `${displayWidth}%` }} /></div></div>;
}

export default function Compare() {
  const utils = trpc.useUtils();
  const matters = trpc.matters.list.useQuery();
  const comparisons = trpc.comparisons.list.useQuery();
  const [matterId, setMatterId] = useState(0);
  const selectedMatterId = useMemo(() => matterId || matters.data?.[0]?.id || 0, [matterId, matters.data]);
  const [label, setLabel] = useState("Dragon vs CounselScribe test");
  const [dragonTranscript, setDragonTranscript] = useState("");
  const [counselTranscript, setCounselTranscript] = useState("");
  const [referenceTranscript, setReferenceTranscript] = useState("");
  const [dragonMinutes, setDragonMinutes] = useState("");
  const [counselMinutes, setCounselMinutes] = useState("");
  const create = trpc.comparisons.create.useMutation({
    onSuccess: async () => {
      await utils.comparisons.list.invalidate();
      toast.success("Comparison measured and added to the accuracy ledger.");
      setDragonTranscript(""); setCounselTranscript(""); setReferenceTranscript("");
    },
    onError: error => toast.error(error.message),
  });

  const submit = () => {
    if (!selectedMatterId || !dragonTranscript || !counselTranscript) return;
    create.mutate({
      matterId: selectedMatterId,
      label,
      dragonTranscript,
      counselTranscript,
      referenceTranscript: referenceTranscript || undefined,
      correctionMinutesDragon: dragonMinutes ? Number(dragonMinutes) : undefined,
      correctionMinutesCounsel: counselMinutes ? Number(counselMinutes) : undefined,
    });
  };

  return (
    <PageFrame>
      <PageHeader eyebrow="Proof over promises" title="Dragon comparison" description="Use the same recording, preserve both transcripts, and score them only against attorney-verified reference text. Lower word error rate is better; higher legal-term accuracy is better." />
      <div className="grid gap-7 2xl:grid-cols-[minmax(360px,.75fr)_minmax(0,1.25fr)]">
        <section className="border border-[#d6b65d]/20 bg-[#0a1827] p-5 sm:p-6">
          <SectionHeading label="New controlled test" title="Measure the same dictation" />
          <div className="space-y-4">
            <div className="space-y-2"><Label>Matter</Label><Select value={selectedMatterId ? String(selectedMatterId) : undefined} onValueChange={value => setMatterId(Number(value))}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue placeholder="Select matter" /></SelectTrigger><SelectContent>{matters.data?.map(matter => <SelectItem key={matter.id} value={String(matter.id)}>{matter.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label>Test label</Label><Input value={label} onChange={event => setLabel(event.target.value)} className="border-white/10 bg-white/5" /></div>
            <div className="space-y-2"><Label>Dragon transcript</Label><Textarea value={dragonTranscript} onChange={event => setDragonTranscript(event.target.value)} className="min-h-32 border-white/10 bg-white/5" placeholder="Paste the Dragon output without silently correcting it." /></div>
            <div className="space-y-2"><Label>CounselScribe transcript</Label><Textarea value={counselTranscript} onChange={event => setCounselTranscript(event.target.value)} className="min-h-32 border-white/10 bg-white/5" placeholder="Paste the CounselScribe output from the same recording." /></div>
            <div className="space-y-2"><Label>Attorney-verified reference transcript</Label><Textarea value={referenceTranscript} onChange={event => setReferenceTranscript(event.target.value)} className="min-h-32 border-white/10 bg-white/5" placeholder="Required for word error rate and legal-term accuracy." /></div>
            <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Dragon correction minutes</Label><Input type="number" min="0" value={dragonMinutes} onChange={event => setDragonMinutes(event.target.value)} className="border-white/10 bg-white/5" /></div><div className="space-y-2"><Label>CounselScribe minutes</Label><Input type="number" min="0" value={counselMinutes} onChange={event => setCounselMinutes(event.target.value)} className="border-white/10 bg-white/5" /></div></div>
            <Button className="w-full bg-[#d6b65d] text-[#07111d]" disabled={!selectedMatterId || !dragonTranscript || !counselTranscript || create.isPending} onClick={submit}><Plus className="mr-2 h-4 w-4" /> {create.isPending ? "Measuring…" : "Save controlled comparison"}</Button>
          </div>
        </section>

        <section>
          <SectionHeading label="Accuracy ledger" title={`${comparisons.data?.length || 0} comparison runs`} />
          {comparisons.data?.length ? <div className="space-y-4">{comparisons.data.map(comparison => {
            const dragonWer = comparison.dragonWer == null ? null : Number(comparison.dragonWer);
            const counselWer = comparison.counselWer == null ? null : Number(comparison.counselWer);
            const termAccuracy = comparison.legalTermAccuracy == null ? null : Number(comparison.legalTermAccuracy);
            return <article key={comparison.id} className="border border-white/10 bg-[#0a1827] p-5 sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#d6b65d]">{comparison.status}</span><h2 className="mt-2 font-display text-2xl">{comparison.label}</h2></div>{dragonWer != null && counselWer != null ? <span className={`inline-flex items-center gap-2 border px-3 py-2 text-xs ${counselWer < dragonWer ? "border-[#aeb3a2]/30 bg-[#aeb3a2]/10 text-[#d7dbcf]" : "border-[#a4564d]/35 bg-[#a4564d]/10 text-[#e3aaa3]"}`}>{counselWer < dragonWer ? <CheckCircle2 className="h-4 w-4" /> : <Scale className="h-4 w-4" />}{counselWer < dragonWer ? "CounselScribe lower WER" : "No measured advantage"}</span> : null}</div><div className="mt-6 grid gap-5 sm:grid-cols-3"><MetricBar label="Dragon word error" value={dragonWer} lowerIsBetter /><MetricBar label="CounselScribe word error" value={counselWer} lowerIsBetter /><MetricBar label="Legal-term accuracy" value={termAccuracy} /></div><div className="mt-6 grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-3"><div className="flex items-center gap-2 text-xs text-[#9ca7b3]"><GitCompareArrows className="h-4 w-4 text-[#d6b65d]" />Controlled transcript pair</div><div className="flex items-center gap-2 text-xs text-[#9ca7b3]"><BarChart3 className="h-4 w-4 text-[#d6b65d]" />Reference-based scoring</div><div className="flex items-center gap-2 text-xs text-[#9ca7b3]"><TimerReset className="h-4 w-4 text-[#d6b65d]" />{comparison.timeSavedMinutes ? `${Number(comparison.timeSavedMinutes).toFixed(1)} minutes saved` : "Time not recorded"}</div></div></article>;
          })}</div> : <EmptyState title="No comparison evidence yet" description="Run the same approved test recording through Dragon and CounselScribe, then add attorney-verified reference text before making an accuracy claim." />}
        </section>
      </div>
    </PageFrame>
  );
}

