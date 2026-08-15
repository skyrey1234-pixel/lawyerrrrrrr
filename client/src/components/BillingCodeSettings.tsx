import { SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Check, CircleOff, Plus, Save, Tags } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type CodeDraft = {
  code: string;
  label: string;
  category: string;
  description: string;
  defaultNarrative: string;
  displayOrder: number;
  active: boolean;
};

const emptyDraft: CodeDraft = {
  code: "",
  label: "",
  category: "",
  description: "",
  defaultNarrative: "",
  displayOrder: 0,
  active: true,
};

export function BillingCodeSettings({ canAdminister }: { canAdminister: boolean }) {
  const utils = trpc.useUtils();
  const codes = trpc.billing.codes.list.useQuery({ includeInactive: true });
  const [createDraft, setCreateDraft] = useState<CodeDraft>(emptyDraft);
  const [drafts, setDrafts] = useState<Record<number, CodeDraft>>({});

  useEffect(() => {
    if (!codes.data) return;
    setDrafts(Object.fromEntries(codes.data.map(code => [code.id, {
      code: code.code,
      label: code.label,
      category: code.category,
      description: code.description || "",
      defaultNarrative: code.defaultNarrative || "",
      displayOrder: code.displayOrder,
      active: code.active,
    }])));
  }, [codes.data]);

  const refresh = async () => {
    await Promise.all([utils.billing.codes.list.invalidate(), utils.billing.list.invalidate(), utils.billing.activeTimer.invalidate()]);
  };
  const createCode = trpc.billing.codes.create.useMutation({
    onSuccess: async () => { setCreateDraft(emptyDraft); await refresh(); toast.success("Firm billing code created."); },
    onError: error => toast.error(error.message),
  });
  const updateCode = trpc.billing.codes.update.useMutation({
    onSuccess: async () => { await refresh(); toast.success("Billing code updated."); },
    onError: error => toast.error(error.message),
  });

  const updateDraft = (id: number, patch: Partial<CodeDraft>) => setDrafts(current => ({ ...current, [id]: { ...current[id], ...patch } }));
  const submitCreate = () => createCode.mutate({
    code: createDraft.code,
    label: createDraft.label,
    category: createDraft.category,
    description: createDraft.description || undefined,
    defaultNarrative: createDraft.defaultNarrative || undefined,
    displayOrder: createDraft.displayOrder,
  });
  const submitUpdate = (id: number) => {
    const draft = drafts[id];
    if (!draft) return;
    updateCode.mutate({ id, ...draft, description: draft.description || undefined, defaultNarrative: draft.defaultNarrative || undefined });
  };

  return (
    <section className="border border-white/10 bg-[#0a1827] p-6">
      <SectionHeading label="Billing configuration" title="Firm billing codes" />
      <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#8d99a6]">Define the codes attorneys select while timing, speaking, reviewing AI candidates, and exporting approved work. Inactive codes stay on historical entries but cannot be used for new work.</p>

      <div className="mt-6 border border-[#d6b65d]/20 bg-[#d6b65d]/5 p-5">
        <div className="flex items-center gap-2 text-[#d6b65d]"><Plus className="h-4 w-4" /><span className="font-mono text-[10px] font-bold uppercase tracking-[0.15em]">Create firm code</span></div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="space-y-2"><Label htmlFor="new-code">Code</Label><Input id="new-code" value={createDraft.code} onChange={event => setCreateDraft(current => ({ ...current, code: event.target.value }))} placeholder="L-110" className="border-white/10 bg-white/5 font-mono uppercase" /></div>
          <div className="space-y-2"><Label htmlFor="new-label">Label</Label><Input id="new-label" value={createDraft.label} onChange={event => setCreateDraft(current => ({ ...current, label: event.target.value }))} placeholder="Client communication" className="border-white/10 bg-white/5" /></div>
          <div className="space-y-2"><Label htmlFor="new-category">Category</Label><Input id="new-category" value={createDraft.category} onChange={event => setCreateDraft(current => ({ ...current, category: event.target.value }))} placeholder="COMMUNICATION" className="border-white/10 bg-white/5 font-mono uppercase" /></div>
          <div className="space-y-2"><Label htmlFor="new-order">Display order</Label><Input id="new-order" type="number" min="0" max="10000" value={createDraft.displayOrder} onChange={event => setCreateDraft(current => ({ ...current, displayOrder: Number(event.target.value) }))} className="border-white/10 bg-white/5" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="new-description">Internal description</Label><Textarea id="new-description" value={createDraft.description} onChange={event => setCreateDraft(current => ({ ...current, description: event.target.value }))} placeholder="When attorneys should use this code" className="min-h-20 border-white/10 bg-white/5" /></div>
          <div className="space-y-2 sm:col-span-2"><Label htmlFor="new-narrative">Default narrative</Label><Textarea id="new-narrative" value={createDraft.defaultNarrative} onChange={event => setCreateDraft(current => ({ ...current, defaultNarrative: event.target.value }))} placeholder="Communicate with client regarding…" className="min-h-20 border-white/10 bg-white/5" /></div>
        </div>
        <Button className="mt-4 bg-[#d6b65d] text-[#07111d]" disabled={!canAdminister || createCode.isPending || !createDraft.code.trim() || !createDraft.label.trim() || !createDraft.category.trim()} onClick={submitCreate}><Plus className="mr-2 h-4 w-4" /> Add billing code</Button>
      </div>

      <div className="mt-6 space-y-4">
        {codes.isLoading ? <p className="text-sm text-[#8d99a6]">Loading firm billing codes…</p> : null}
        {codes.data?.length === 0 ? <div className="border border-dashed border-white/15 p-8 text-center"><Tags className="mx-auto h-5 w-5 text-[#d6b65d]" /><strong className="mt-3 block font-display text-xl">No firm codes yet</strong><p className="mt-2 text-sm text-[#8793a0]">Create the first code above. Legacy activity labels remain available until firm codes exist.</p></div> : null}
        {codes.data?.map(code => {
          const draft = drafts[code.id];
          if (!draft) return null;
          return <div key={code.id} className={`border p-5 ${draft.active ? "border-white/10 bg-[#081523]" : "border-white/7 bg-white/[0.02] opacity-70"}`}>
            <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)_180px_90px]">
              <div className="space-y-2"><Label htmlFor={`code-${code.id}`}>Code</Label><Input id={`code-${code.id}`} value={draft.code} disabled={!canAdminister} onChange={event => updateDraft(code.id, { code: event.target.value })} className="border-white/10 bg-white/5 font-mono uppercase" /></div>
              <div className="space-y-2"><Label htmlFor={`label-${code.id}`}>Label</Label><Input id={`label-${code.id}`} value={draft.label} disabled={!canAdminister} onChange={event => updateDraft(code.id, { label: event.target.value })} className="border-white/10 bg-white/5" /></div>
              <div className="space-y-2"><Label htmlFor={`category-${code.id}`}>Category</Label><Input id={`category-${code.id}`} value={draft.category} disabled={!canAdminister} onChange={event => updateDraft(code.id, { category: event.target.value })} className="border-white/10 bg-white/5 font-mono uppercase" /></div>
              <div className="space-y-2"><Label htmlFor={`order-${code.id}`}>Order</Label><Input id={`order-${code.id}`} type="number" min="0" max="10000" value={draft.displayOrder} disabled={!canAdminister} onChange={event => updateDraft(code.id, { displayOrder: Number(event.target.value) })} className="border-white/10 bg-white/5" /></div>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><div className="space-y-2"><Label htmlFor={`description-${code.id}`}>Internal description</Label><Textarea id={`description-${code.id}`} value={draft.description} disabled={!canAdminister} onChange={event => updateDraft(code.id, { description: event.target.value })} className="min-h-20 border-white/10 bg-white/5" /></div><div className="space-y-2"><Label htmlFor={`narrative-${code.id}`}>Default narrative</Label><Textarea id={`narrative-${code.id}`} value={draft.defaultNarrative} disabled={!canAdminister} onChange={event => updateDraft(code.id, { defaultNarrative: event.target.value })} className="min-h-20 border-white/10 bg-white/5" /></div></div>
            <div className="mt-4 flex flex-wrap items-center gap-2"><Button size="sm" className="bg-[#d6b65d] text-[#07111d]" disabled={!canAdminister || updateCode.isPending} onClick={() => submitUpdate(code.id)}><Save className="mr-2 h-3.5 w-3.5" /> Save code</Button><Button size="sm" variant="outline" className="border-white/12 bg-transparent" disabled={!canAdminister || updateCode.isPending} onClick={() => { const next = { ...draft, active: !draft.active }; setDrafts(current => ({ ...current, [code.id]: next })); updateCode.mutate({ id: code.id, ...next, description: next.description || undefined, defaultNarrative: next.defaultNarrative || undefined }); }}>{draft.active ? <CircleOff className="mr-2 h-3.5 w-3.5" /> : <Check className="mr-2 h-3.5 w-3.5" />}{draft.active ? "Deactivate" : "Activate"}</Button><span className={`font-mono text-[9px] uppercase tracking-[0.14em] ${draft.active ? "text-[#a9bc91]" : "text-[#a87979]"}`}>{draft.active ? "Active for new work" : "Historical only"}</span></div>
          </div>;
        })}
      </div>
    </section>
  );
}

