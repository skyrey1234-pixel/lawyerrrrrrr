import { SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { formatCurrencyFromCents } from "@shared/rates";
import { FLORIDA_RATE_BENCHMARKS_2025, FLORIDA_RATE_BENCHMARK_SOURCE_URL } from "@shared/utbmsStarter";
import { BadgeDollarSign, BarChart3, CalendarClock, ExternalLink, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const today = () => new Date().toISOString().slice(0, 10);
const dateToMs = (value: string) => new Date(`${value}T00:00:00.000Z`).getTime();

export function LawyerRateSettings({ canAdminister }: { canAdminister: boolean }) {
  const utils = trpc.useUtils();
  const rates = trpc.billing.rates.list.useQuery({ includeInactive: true });
  const [membershipId, setMembershipId] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(today());
  const [effectiveTo, setEffectiveTo] = useState("");
  const [notes, setNotes] = useState("");
  const activeMembers = useMemo(() => (rates.data?.members ?? []).filter(row => row.membership.status === "active"), [rates.data]);

  const create = trpc.billing.rates.create.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.billing.rates.list.invalidate(), utils.billing.list.invalidate()]);
      setHourlyRate("");
      setEffectiveTo("");
      setNotes("");
      toast.success("Lawyer rate added. Existing billing snapshots remain unchanged.");
    },
    onError: error => toast.error(error.message),
  });
  const update = trpc.billing.rates.update.useMutation({
    onSuccess: async () => {
      await utils.billing.rates.list.invalidate();
      toast.success("Rate period updated without rewriting historical billing entries.");
    },
    onError: error => toast.error(error.message),
  });

  const submit = () => {
    const dollars = Number(hourlyRate.replace(/[$,]/g, ""));
    if (!membershipId || !Number.isFinite(dollars) || dollars < 0) {
      toast.error("Choose a lawyer and enter a valid hourly rate.");
      return;
    }
    create.mutate({
      membershipId: Number(membershipId),
      hourlyRateCents: Math.round(dollars * 100),
      currency: "USD",
      effectiveFromMs: dateToMs(effectiveFrom),
      effectiveToMs: effectiveTo ? dateToMs(effectiveTo) : null,
      notes: notes || undefined,
    });
  };

  return (
    <section className="border border-white/10 bg-[#0a1827] p-6">
      <SectionHeading label="Rate cards" title="Lawyer hourly rates" />
      <p className="mb-5 max-w-3xl text-xs leading-relaxed text-[#8f9aa7]">
        Fees use exact verified seconds and the rate effective on the work date. Each entry keeps an immutable rate and fee snapshot, so future changes never rewrite historical bills.
      </p>
      <div className="mb-6 border border-[#d6b65d]/20 bg-[#d6b65d]/5 p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex items-center gap-2 text-[#d6b65d]"><BarChart3 className="h-4 w-4" /><span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em]">2025 Florida public benchmarks</span></div><p className="mt-2 max-w-2xl text-xs leading-relaxed text-[#9da7b2]">Published by Clio in March 2026 from aggregated, anonymized legal-professional data. These values are market context—not the firm’s rates. Choosing a benchmark only fills the form; a firm administrator must still select a lawyer and add an effective rate.</p></div><a href={FLORIDA_RATE_BENCHMARK_SOURCE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-[#d6b65d] underline">Source <ExternalLink className="h-3 w-3" /></a></div><div className="mt-4 grid gap-3 md:grid-cols-3">{FLORIDA_RATE_BENCHMARKS_2025.map(benchmark => <div key={benchmark.id} className="border border-white/10 bg-[#07131f] p-4"><span className="text-xs text-[#8d99a6]">{benchmark.label}</span><strong className="mt-1 block font-display text-2xl">{formatCurrencyFromCents(benchmark.hourlyRateCents)}<span className="ml-1 font-sans text-[10px] font-normal text-[#84909d]">/ hr</span></strong><p className="mt-1 text-[10px] text-[#7f8b98]">{benchmark.context}</p>{benchmark.id !== "fl-firm-blended" ? <Button size="sm" variant="outline" className="mt-3 border-[#d6b65d]/25 bg-transparent text-[10px]" disabled={!canAdminister} onClick={() => { setHourlyRate((benchmark.hourlyRateCents / 100).toFixed(2)); setNotes(`${benchmark.label} benchmark (Clio 2025 Florida data) — administrator must confirm firm applicability`); }}>Use as form draft</Button> : <span className="mt-3 block font-mono text-[8px] uppercase text-[#84909d]">Context only · blended</span>}</div>)}</div></div>
      <div className="grid gap-4 lg:grid-cols-[minmax(180px,1.3fr)_minmax(120px,.7fr)_minmax(145px,.8fr)_minmax(145px,.8fr)]">
        <div className="space-y-2">
          <Label>Lawyer</Label>
          <Select value={membershipId} onValueChange={setMembershipId} disabled={!canAdminister}>
            <SelectTrigger className="border-white/10 bg-white/5"><SelectValue placeholder="Select firm member" /></SelectTrigger>
            <SelectContent>{activeMembers.map(({ membership, user }) => <SelectItem key={membership.id} value={String(membership.id)}>{user.name || user.email || `Member ${membership.id}`}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-2"><Label>Hourly rate (USD)</Label><Input inputMode="decimal" placeholder="425.00" value={hourlyRate} onChange={event => setHourlyRate(event.target.value)} disabled={!canAdminister} className="border-white/10 bg-white/5" /></div>
        <div className="space-y-2"><Label>Effective from</Label><Input type="date" value={effectiveFrom} onChange={event => setEffectiveFrom(event.target.value)} disabled={!canAdminister} className="border-white/10 bg-white/5" /></div>
        <div className="space-y-2"><Label>Optional end date</Label><Input type="date" value={effectiveTo} onChange={event => setEffectiveTo(event.target.value)} disabled={!canAdminister} className="border-white/10 bg-white/5" /></div>
        <div className="space-y-2 lg:col-span-3"><Label>Internal notes</Label><Input placeholder="Standard partner rate for 2026" value={notes} onChange={event => setNotes(event.target.value)} disabled={!canAdminister} className="border-white/10 bg-white/5" /></div>
        <div className="flex items-end"><Button className="w-full bg-[#d6b65d] text-[#07111d]" disabled={!canAdminister || create.isPending} onClick={submit}><BadgeDollarSign className="mr-2 h-4 w-4" /> Add rate</Button></div>
      </div>

      <div className="mt-6 border-y border-white/10">
        {(rates.data?.rates ?? []).length === 0 ? <div className="px-4 py-6 text-sm text-[#8f9aa7]">No lawyer rates are configured. Billable entries will remain marked <strong className="text-[#d6b65d]">needs rate</strong> and cannot be approved.</div> : (rates.data?.rates ?? []).map(({ rate, user }) => (
          <div key={rate.id} className="grid gap-3 border-b border-white/8 px-4 py-4 lg:grid-cols-[minmax(180px,1fr)_130px_minmax(210px,1fr)_110px] lg:items-center">
            <div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center border border-[#d6b65d]/25 bg-[#d6b65d]/8"><CalendarClock className="h-4 w-4 text-[#d6b65d]" /></div><div className="min-w-0"><strong className="block truncate text-sm">{user.name || user.email || "Firm lawyer"}</strong><span className="block truncate text-xs text-[#84909d]">{rate.notes || "No internal note"}</span></div></div>
            <strong className="font-display text-xl text-[#efe6cf]">{formatCurrencyFromCents(rate.hourlyRateCents, rate.currency)}<span className="ml-1 font-sans text-[10px] font-normal text-[#84909d]">/ hr</span></strong>
            <div className="text-xs leading-relaxed text-[#9aa5b1]"><span className="block">From {new Date(rate.effectiveFrom).toLocaleDateString()}</span><span className="block">{rate.effectiveTo ? `Through ${new Date(rate.effectiveTo).toLocaleDateString()}` : "Open-ended"}</span></div>
            <Button size="sm" variant="outline" className="border-white/15 bg-transparent" disabled={!canAdminister || update.isPending} onClick={() => update.mutate({ id: rate.id, effectiveToMs: rate.effectiveTo?.getTime() ?? null, notes: rate.notes ?? undefined, active: !rate.active })}>{rate.active ? "Deactivate" : "Reactivate"}</Button>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-start gap-3 border-l-2 border-[#d6b65d] bg-[#d6b65d]/7 p-4 text-xs leading-relaxed text-[#d9ca9f]"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><span>Rate changes apply only when a new entry is created or a draft is deliberately recalculated. Approved, exported, and synchronized fee snapshots remain frozen.</span></div>
    </section>
  );
}
