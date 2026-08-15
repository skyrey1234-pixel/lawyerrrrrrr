import { EmptyState, PageFrame, PageHeader } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowRight, BriefcaseBusiness, MapPin, Plus, Scale } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const initialForm = { name: "", matterNumber: "", clientName: "", jurisdiction: "Florida", practiceArea: "", description: "" };

export default function Matters() {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const matters = trpc.matters.list.useQuery();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialForm);
  const createMatter = trpc.matters.create.useMutation({
    onSuccess: async data => {
      await utils.matters.list.invalidate();
      toast.success("Matter workspace created.");
      setOpen(false);
      setForm(initialForm);
      setLocation(`/matters/${data.matterId}`);
    },
    onError: error => toast.error(error.message),
  });

  return (
    <PageFrame>
      <PageHeader eyebrow="Firm docket" title="Matters" description="Each matter isolates its own people, organizations, experts, legal vocabulary, document templates, and dictation sessions." actions={<Button className="bg-[#d6b65d] text-[#07111d] hover:bg-[#e2c46f]" onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" /> Create matter</Button>} />

      {matters.data?.length ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {matters.data.map(matter => (
            <button key={matter.id} onClick={() => setLocation(`/matters/${matter.id}`)} className="group border border-white/10 bg-[#0a1827] p-6 text-left shadow-[0_20px_60px_rgba(0,0,0,.18)] transition hover:-translate-y-0.5 hover:border-[#d6b65d]/35">
              <div className="flex items-start justify-between gap-4"><BriefcaseBusiness className="h-5 w-5 text-[#d6b65d]" /><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#a5afba]">{matter.status}</span></div>
              <h2 className="mt-6 font-display text-3xl font-semibold leading-tight text-[#f4eee2]">{matter.name}</h2>
              <p className="mt-2 text-sm text-[#939fab]">{matter.clientName}</p>
              <div className="mt-6 space-y-2 border-t border-white/8 pt-4 font-mono text-[9px] uppercase tracking-[0.13em] text-[#7f8b98]">
                <p className="flex items-center gap-2"><Scale className="h-3.5 w-3.5" /> {matter.practiceArea}</p>
                <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {matter.jurisdiction} · {matter.matterNumber}</p>
              </div>
              <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold text-[#d6b65d]">Open matter intelligence <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span>
            </button>
          ))}
        </div>
      ) : <EmptyState title="No matters on the docket" description="Create an approved pilot matter. Keep real client information out until the firm has accepted the processing and retention policy." action={{ label: "Create matter", onClick: () => setOpen(true) }} />}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="border-[#d6b65d]/25 bg-[#0b1725] text-[#f7f1e5] sm:max-w-2xl">
          <DialogHeader><DialogTitle className="font-display text-3xl">Create a matter workspace</DialogTitle><DialogDescription className="text-[#97a2ae]">Use synthetic or firm-approved information during pilot testing.</DialogDescription></DialogHeader>
          <div className="grid gap-4 py-3 sm:grid-cols-2">
            {[
              ["name", "Matter name", "e.g. Hartwell — Synthetic Demo"],
              ["matterNumber", "Matter number", "e.g. FL-DEMO-0247"],
              ["clientName", "Client name", "Synthetic or approved"],
              ["jurisdiction", "Jurisdiction", "Florida"],
              ["practiceArea", "Practice area", "Insurance defense"],
            ].map(([key, label, placeholder]) => <div key={key} className="space-y-2"><Label htmlFor={key}>{label}</Label><Input id={key} value={form[key as keyof typeof form]} placeholder={placeholder} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} className="border-white/10 bg-white/5" /></div>)}
            <div className="space-y-2 sm:col-span-2"><Label htmlFor="description">Description</Label><Textarea id="description" value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} className="border-white/10 bg-white/5" /></div>
          </div>
          <DialogFooter><Button variant="outline" className="border-white/15 bg-transparent" onClick={() => setOpen(false)}>Cancel</Button><Button className="bg-[#d6b65d] text-[#07111d]" disabled={createMatter.isPending || !form.name || !form.matterNumber || !form.clientName || !form.practiceArea} onClick={() => createMatter.mutate(form)}>{createMatter.isPending ? "Creating…" : "Create matter"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}

