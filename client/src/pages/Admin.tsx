import { useAuth } from "@/_core/hooks/useAuth";
import { BillingCodeSettings } from "@/components/BillingCodeSettings";
import { LawyerRateSettings } from "@/components/LawyerRateSettings";
import { PracticeManagementSettings } from "@/components/PracticeManagementSettings";
import { PageFrame, PageHeader, PrivacyBoundary, SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Database, HardDrive, KeyRound, LockKeyhole, LogOut, ServerCog, ShieldCheck, UserRoundCog } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function Admin() {
  const { logout, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const admin = trpc.workspace.administration.useQuery();
  const [mode, setMode] = useState<"browser" | "hosted" | "local">("hosted");
  const [retentionDays, setRetentionDays] = useState(30);
  const [audioRetention, setAudioRetention] = useState<"keep" | "delete_after_transcription" | "manual">("delete_after_transcription");
  useEffect(() => { if (admin.data) { setMode(admin.data.firm.defaultProcessingMode); setRetentionDays(admin.data.firm.retentionDays); setAudioRetention(admin.data.firm.audioRetention); } }, [admin.data]);
  const update = trpc.workspace.updateSettings.useMutation({ onSuccess: async () => { await utils.workspace.administration.invalidate(); toast.success("Firm controls updated and added to the audit history."); }, onError: error => toast.error(error.message) });
  if (!admin.data) return <PageFrame><PageHeader eyebrow="Firm administration" title="Loading controls" description={admin.error?.message || "Opening the protected administration record."} /></PageFrame>;
  const data = admin.data;
  const canAdminister = data.membership.role === "administrator";
  return (
    <PageFrame>
      <PageHeader eyebrow={`${data.firm.name} · ${data.membership.role}`} title="Firm controls" description="Processing mode, retention posture, membership, encryption status, and local companion readiness are explicit settings—not marketing assumptions." actions={<Button variant="outline" className="border-white/15 bg-transparent" disabled={authLoading} onClick={() => void logout()}><LogOut className="mr-2 h-4 w-4" /> Sign out</Button>} />
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(340px,.8fr)]">
        <div className="space-y-7">
          <section className="border border-white/10 bg-[#0a1827] p-6"><SectionHeading label="Policy" title="Processing and retention" /><div className="grid gap-5 sm:grid-cols-2"><div className="space-y-2 sm:col-span-2"><Label>Default processing mode</Label><Select value={mode} onValueChange={value => setMode(value as typeof mode)}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="browser">Browser demo — synthetic only</SelectItem><SelectItem value="hosted">Hosted transcription — active</SelectItem><SelectItem value="local">Mac mini companion — requires installation</SelectItem></SelectContent></Select></div><div className="space-y-2"><Label>Record retention days</Label><Input type="number" min="1" max="3650" value={retentionDays} onChange={event => setRetentionDays(Number(event.target.value))} className="border-white/10 bg-white/5" /></div><div className="space-y-2"><Label>Audio retention policy</Label><Select value={audioRetention} onValueChange={value => setAudioRetention(value as typeof audioRetention)}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="delete_after_transcription">Delete after transcription</SelectItem><SelectItem value="keep">Keep under retention window</SelectItem><SelectItem value="manual">Manual release</SelectItem></SelectContent></Select></div></div>{mode === "local" ? <p className="mt-5 border-l-2 border-[#d6b65d] bg-[#d6b65d]/8 p-4 text-xs leading-relaxed text-[#d9ca9f]">Selecting local as the desired default does not connect a device. Local sessions remain blocked until the Mac mini service proves identity and health.</p> : null}<Button className="mt-5 bg-[#d6b65d] text-[#07111d]" disabled={!canAdminister || update.isPending} onClick={() => update.mutate({ defaultProcessingMode: mode, retentionDays, audioRetention })}>Save firm controls</Button></section>

          <LawyerRateSettings canAdminister={canAdminister} />

          <BillingCodeSettings canAdminister={canAdminister} />

          <PracticeManagementSettings canAdminister={canAdminister} />

          <section><SectionHeading label="Access control" title={`${data.members.length} firm member${data.members.length === 1 ? "" : "s"}`} /><div className="border-y border-white/10 bg-[#0a1827]">{data.members.map(({ membership, user }) => <div key={membership.id} className="grid gap-2 border-b border-white/8 px-5 py-4 sm:grid-cols-[1fr_160px_110px] sm:items-center"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center border border-white/12 bg-white/5"><UserRoundCog className="h-4 w-4 text-[#d6b65d]" /></div><div><strong className="block text-sm">{user.name || "Unnamed user"}</strong><span className="text-xs text-[#84909d]">{user.email || "No email"}</span></div></div><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#d6b65d]">{membership.role}</span><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#8e9aa7]">{membership.status}</span></div>)}</div></section>
        </div>

        <aside className="space-y-5">
          <PrivacyBoundary />
          <section className="border border-white/10 bg-[#0a1827] p-5"><SectionHeading label="Security posture" title="Current controls" /><div className="space-y-3">{[
            [LockKeyhole, "Authentication", "Protected user sessions active"],
            [Database, "File separation", "Object references stored; no audio bytes in database"],
            [KeyRound, "Encryption status", data.firm.encryptionStatus.replaceAll("_", " ")],
            [ShieldCheck, "Audit trail", "Workflow actions recorded without transcript text"],
          ].map(([Icon, title, detail]) => { const Component = Icon as typeof LockKeyhole; return <div key={String(title)} className="flex items-start gap-3 border-b border-white/7 pb-3"><Component className="mt-0.5 h-4 w-4 text-[#d6b65d]" /><div><strong className="block text-sm">{String(title)}</strong><span className="mt-1 block text-xs leading-relaxed text-[#8793a0]">{String(detail)}</span></div></div>; })}</div></section>
          <section className="border border-[#d6b65d]/20 bg-[#0a1827] p-5"><div className="flex items-center gap-2 text-[#d6b65d]"><HardDrive className="h-4 w-4" /><span className="font-mono text-[9px] font-bold uppercase tracking-[0.14em]">Mac mini companion</span></div>{data.companions.map(companion => <div key={companion.id} className="mt-4"><strong className="font-display text-2xl">{companion.name}</strong><p className="mt-2 text-xs leading-relaxed text-[#8f9aa7]">Status: <span className="text-[#d8ca9f]">{companion.status.replaceAll("_", " ")}</span>. No endpoint, model, or certificate has been configured.</p></div>)}<div className="mt-5 grid grid-cols-2 gap-2"><div className="border border-white/10 p-3"><ServerCog className="h-4 w-4 text-[#d6b65d]" /><span className="mt-2 block text-xs">Service scaffold included</span></div><div className="border border-white/10 p-3"><ShieldCheck className="h-4 w-4 text-[#d6b65d]" /><span className="mt-2 block text-xs">Deployment not claimed</span></div></div></section>
        </aside>
      </div>
    </PageFrame>
  );
}
