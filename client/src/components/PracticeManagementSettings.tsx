import { SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import type { PracticeProvider } from "@shared/practiceManagement";
import { Cloud, ExternalLink, KeyRound, Link2, RefreshCw, ShieldCheck, Unplug } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const providerName = (provider: PracticeProvider) => provider === "clio" ? "Clio Manage" : "MyCase";

export function PracticeManagementSettings({ canAdminister }: { canAdminister: boolean }) {
  const utils = trpc.useUtils();
  const settings = trpc.integrations.settings.useQuery();
  const readiness = trpc.integrations.readiness.useQuery();
  const [provider, setProvider] = useState<PracticeProvider>("clio");
  const [matterId, setMatterId] = useState("");
  const [externalMatterId, setExternalMatterId] = useState("");
  const [externalMatterName, setExternalMatterName] = useState("");
  const [membershipId, setMembershipId] = useState("");
  const [externalUserId, setExternalUserId] = useState("");
  const [externalUserName, setExternalUserName] = useState("");
  const [billingCodeId, setBillingCodeId] = useState("");
  const [externalActivityId, setExternalActivityId] = useState("");
  const [externalActivityName, setExternalActivityName] = useState("");
  const [utbmsActivityCode, setUtbmsActivityCode] = useState("");
  const [utbmsTaskCode, setUtbmsTaskCode] = useState("");

  const invalidate = async () => { await utils.integrations.settings.invalidate(); };
  const authorization = trpc.integrations.authorizationUrl.useMutation({ onSuccess: data => { window.location.assign(data.url); }, onError: error => toast.error(error.message) });
  const disconnect = trpc.integrations.disconnect.useMutation({ onSuccess: async () => { await invalidate(); toast.success("Provider disconnected. Stored OAuth tokens were removed."); }, onError: error => toast.error(error.message) });
  const mapMatter = trpc.integrations.mapMatter.useMutation({ onSuccess: async () => { await invalidate(); toast.success(`${providerName(provider)} matter mapping saved.`); }, onError: error => toast.error(error.message) });
  const mapUser = trpc.integrations.mapUser.useMutation({ onSuccess: async () => { await invalidate(); toast.success(`${providerName(provider)} lawyer mapping saved.`); }, onError: error => toast.error(error.message) });
  const mapCode = trpc.integrations.mapBillingCode.useMutation({ onSuccess: async () => { await invalidate(); toast.success(`${providerName(provider)} billing-code mapping saved.`); }, onError: error => toast.error(error.message) });

  const selectedConnection = settings.data?.connections.find(item => item.provider === provider);
  const connected = selectedConnection?.status === "connected";
  const credentialsReady = readiness.data?.[provider] ?? false;
  const matterMap = useMemo(() => settings.data?.matterMappings.find(item => item.provider === provider && item.matterId === Number(matterId)), [settings.data, provider, matterId]);
  const userMap = useMemo(() => settings.data?.userMappings.find(item => item.provider === provider && item.membershipId === Number(membershipId)), [settings.data, provider, membershipId]);
  const codeMap = useMemo(() => settings.data?.codeMappings.find(item => item.provider === provider && item.billingCodeId === Number(billingCodeId)), [settings.data, provider, billingCodeId]);

  const chooseMatter = (value: string) => { setMatterId(value); const item = settings.data?.matterMappings.find(row => row.provider === provider && row.matterId === Number(value)); setExternalMatterId(item?.externalMatterId ?? ""); setExternalMatterName(item?.externalMatterName ?? ""); };
  const chooseUser = (value: string) => { setMembershipId(value); const item = settings.data?.userMappings.find(row => row.provider === provider && row.membershipId === Number(value)); setExternalUserId(item?.externalUserId ?? ""); setExternalUserName(item?.externalUserName ?? ""); };
  const chooseCode = (value: string) => { setBillingCodeId(value); const item = settings.data?.codeMappings.find(row => row.provider === provider && row.billingCodeId === Number(value)); setExternalActivityId(item?.externalActivityId ?? ""); setExternalActivityName(item?.externalActivityName ?? ""); setUtbmsActivityCode(item?.utbmsActivityCode ?? ""); setUtbmsTaskCode(item?.utbmsTaskCode ?? ""); };

  return (
    <section className="border border-white/10 bg-[#0a1827] p-6">
      <SectionHeading label="Practice management" title="Clio and MyCase sync" />
      <p className="mb-5 max-w-3xl text-xs leading-relaxed text-[#8f9aa7]">Only approved entries can be synchronized. Every provider post requires a fresh confirmation, uses a revision-specific idempotency key, and records the remote time-entry ID without storing transcript text in the audit log.</p>

      <div className="grid gap-4 md:grid-cols-2">
        {(["clio", "mycase"] as const).map(item => {
          const connection = settings.data?.connections.find(row => row.provider === item);
          const ready = readiness.data?.[item] ?? false;
          const isConnected = connection?.status === "connected";
          return <article key={item} className={`border p-5 ${isConnected ? "border-[#b9c8ad]/35 bg-[#b9c8ad]/5" : "border-white/10 bg-white/[0.02]"}`}><div className="flex items-start justify-between gap-3"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center border border-[#d6b65d]/25 bg-[#d6b65d]/8"><Cloud className="h-4 w-4 text-[#d6b65d]" /></div><div><strong className="font-display text-xl">{providerName(item)}</strong><span className={`block font-mono text-[9px] uppercase tracking-[0.12em] ${isConnected ? "text-[#b9c8ad]" : "text-[#8793a0]"}`}>{connection?.status?.replaceAll("_", " ") || (ready ? "ready to authorize" : "credentials required")}</span></div></div>{isConnected ? <ShieldCheck className="h-5 w-5 text-[#b9c8ad]" /> : <KeyRound className="h-5 w-5 text-[#8793a0]" />}</div><p className="mt-4 text-xs leading-relaxed text-[#8f9aa7]">{item === "clio" ? "OAuth connection to Clio Manage activities, matters, users, and activity descriptions." : "OAuth connection to MyCase cases, staff, time entries, and optional UTBMS mappings."}</p>{connection?.lastError ? <p className="mt-3 border-l-2 border-[#a4564d] bg-[#a4564d]/8 p-3 text-xs text-[#e1a59e]">{connection.lastError}</p> : null}<div className="mt-4 flex flex-wrap gap-2">{isConnected ? <Button variant="outline" className="border-white/15 bg-transparent" disabled={!canAdminister || disconnect.isPending} onClick={() => disconnect.mutate({ provider: item })}><Unplug className="mr-2 h-4 w-4" /> Disconnect</Button> : <Button className="bg-[#d6b65d] text-[#07111d]" disabled={!canAdminister || !ready || authorization.isPending} onClick={() => authorization.mutate({ provider: item })}><ExternalLink className="mr-2 h-4 w-4" /> Connect {providerName(item)}</Button>}</div>{!ready ? <p className="mt-3 text-[10px] leading-relaxed text-[#d1b075]">Add the provider’s OAuth client ID and secret before connecting. No credentials are stored in browser code.</p> : null}</article>;
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4"><div className="min-w-[220px] space-y-2"><Label>Configure mappings for</Label><Select value={provider} onValueChange={value => { setProvider(value as PracticeProvider); setMatterId(""); setMembershipId(""); setBillingCodeId(""); }}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="clio">Clio Manage</SelectItem><SelectItem value="mycase">MyCase</SelectItem></SelectContent></Select></div><span className={`mb-2 font-mono text-[9px] uppercase tracking-[0.12em] ${connected ? "text-[#b9c8ad]" : "text-[#dc978e]"}`}>{connected ? "Connection active" : "Connect before synchronization"}</span></div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <div className="border border-white/10 p-4"><div className="mb-4 flex items-center gap-2 text-[#d6b65d]"><Link2 className="h-4 w-4" /><strong className="text-sm">Matter mapping</strong></div><div className="space-y-3"><Select value={matterId} onValueChange={chooseMatter}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue placeholder="CounselScribe matter" /></SelectTrigger><SelectContent>{settings.data?.matters.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.matterNumber} · {item.name}</SelectItem>)}</SelectContent></Select><Input placeholder={`${providerName(provider)} matter/case ID`} value={externalMatterId} onChange={event => setExternalMatterId(event.target.value)} className="border-white/10 bg-white/5" /><Input placeholder="External matter name (optional)" value={externalMatterName} onChange={event => setExternalMatterName(event.target.value)} className="border-white/10 bg-white/5" /><Button className="w-full bg-[#d6b65d] text-[#07111d]" disabled={!canAdminister || !matterId || !externalMatterId || mapMatter.isPending} onClick={() => mapMatter.mutate({ provider, matterId: Number(matterId), externalMatterId, externalMatterName: externalMatterName || undefined, active: matterMap?.active ?? true })}>Save matter mapping</Button></div></div>
        <div className="border border-white/10 p-4"><div className="mb-4 flex items-center gap-2 text-[#d6b65d]"><Link2 className="h-4 w-4" /><strong className="text-sm">Lawyer mapping</strong></div><div className="space-y-3"><Select value={membershipId} onValueChange={chooseUser}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue placeholder="CounselScribe lawyer" /></SelectTrigger><SelectContent>{settings.data?.members.map(({ membership, user }) => <SelectItem key={membership.id} value={String(membership.id)}>{user.name || user.email || `Member ${membership.id}`}</SelectItem>)}</SelectContent></Select><Input placeholder={`${providerName(provider)} user/staff ID`} value={externalUserId} onChange={event => setExternalUserId(event.target.value)} className="border-white/10 bg-white/5" /><Input placeholder="External lawyer name (optional)" value={externalUserName} onChange={event => setExternalUserName(event.target.value)} className="border-white/10 bg-white/5" /><Button className="w-full bg-[#d6b65d] text-[#07111d]" disabled={!canAdminister || !membershipId || !externalUserId || mapUser.isPending} onClick={() => mapUser.mutate({ provider, membershipId: Number(membershipId), externalUserId, externalUserName: externalUserName || undefined, active: userMap?.active ?? true })}>Save lawyer mapping</Button></div></div>
        <div className="border border-white/10 p-4"><div className="mb-4 flex items-center gap-2 text-[#d6b65d]"><Link2 className="h-4 w-4" /><strong className="text-sm">Billing-code mapping</strong></div><div className="space-y-3"><Select value={billingCodeId} onValueChange={chooseCode}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue placeholder="Firm billing code" /></SelectTrigger><SelectContent>{settings.data?.codes.map(item => <SelectItem key={item.id} value={String(item.id)}>{item.code} · {item.label}</SelectItem>)}</SelectContent></Select>{provider === "clio" ? <Input placeholder="Clio activity description ID (optional)" value={externalActivityId} onChange={event => setExternalActivityId(event.target.value)} className="border-white/10 bg-white/5" /> : <Input placeholder="MyCase activity name" value={externalActivityName} onChange={event => setExternalActivityName(event.target.value)} className="border-white/10 bg-white/5" />}<div className="grid grid-cols-2 gap-2"><Input placeholder="UTBMS activity" value={utbmsActivityCode} onChange={event => setUtbmsActivityCode(event.target.value)} className="border-white/10 bg-white/5" /><Input placeholder="UTBMS task" value={utbmsTaskCode} onChange={event => setUtbmsTaskCode(event.target.value)} className="border-white/10 bg-white/5" /></div><Button className="w-full bg-[#d6b65d] text-[#07111d]" disabled={!canAdminister || !billingCodeId || mapCode.isPending} onClick={() => mapCode.mutate({ provider, billingCodeId: Number(billingCodeId), externalActivityId: externalActivityId || undefined, externalActivityName: externalActivityName || undefined, utbmsActivityCode: utbmsActivityCode || undefined, utbmsTaskCode: utbmsTaskCode || undefined, active: codeMap?.active ?? true })}>Save code mapping</Button></div></div>
      </div>

      <div className="mt-6 border-t border-white/10 pt-5"><div className="mb-3 flex items-center justify-between"><strong className="text-sm">Recent synchronization attempts</strong><Button size="sm" variant="outline" className="border-white/12 bg-transparent" onClick={() => void settings.refetch()}><RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh</Button></div><div className="space-y-2">{settings.data?.attempts.length ? settings.data.attempts.slice(0, 8).map(attempt => <div key={attempt.id} className="grid gap-2 border-b border-white/7 py-3 text-xs sm:grid-cols-[100px_1fr_120px]"><span className="font-mono uppercase text-[#d6b65d]">{attempt.provider}</span><span className="text-[#9aa5b1]">Entry #{attempt.billingEntryId} · revision {attempt.billingEntryRevision}{attempt.externalRecordId ? ` · remote #${attempt.externalRecordId}` : ""}</span><span className={attempt.status === "succeeded" ? "text-[#b9c8ad]" : attempt.status === "failed" ? "text-[#dc978e]" : "text-[#d6b65d]"}>{attempt.status}</span></div>) : <p className="text-xs text-[#84909d]">No direct synchronization attempts yet.</p>}</div></div>
    </section>
  );
}
