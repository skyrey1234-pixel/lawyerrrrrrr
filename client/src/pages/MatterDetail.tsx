import { EmptyState, PageFrame, PageHeader, SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BookOpenText, FileText, Plus, Scale, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function MatterDetail({ matterId }: { matterId: number }) {
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const matter = trpc.matters.get.useQuery({ matterId });
  const [heardPhrase, setHeardPhrase] = useState("");
  const [approvedText, setApprovedText] = useState("");
  const [termScope, setTermScope] = useState<"firm" | "matter" | "user">("matter");
  const [entityName, setEntityName] = useState("");
  const [entityType, setEntityType] = useState<"party" | "attorney" | "expert" | "organization" | "medical_provider" | "judge" | "other">("party");
  const addTerm = trpc.matters.addTerm.useMutation({ onSuccess: async () => { await utils.matters.get.invalidate({ matterId }); setHeardPhrase(""); setApprovedText(""); toast.success("Approved term added to the matter dictionary."); }, onError: error => toast.error(error.message) });
  const addEntity = trpc.matters.addEntity.useMutation({ onSuccess: async () => { await utils.matters.get.invalidate({ matterId }); setEntityName(""); toast.success("Matter entity added."); }, onError: error => toast.error(error.message) });
  const createDemo = trpc.sessions.createDemo.useMutation({ onSuccess: data => setLocation(`/sessions/${data.sessionId}`), onError: error => toast.error(error.message) });

  if (matter.isLoading) return <PageFrame><div className="h-64 animate-pulse bg-white/[0.035]" /></PageFrame>;
  if (!matter.data) return <PageFrame><EmptyState title="Matter not available" description={matter.error?.message || "The matter was not found or your membership does not permit access."} /></PageFrame>;
  const data = matter.data;

  return (
    <PageFrame>
      <PageHeader eyebrow={`${data.matter.matterNumber} · ${data.matter.jurisdiction}`} title={data.matter.name} description={`${data.matter.clientName} · ${data.matter.practiceArea}. ${data.matter.description || "No description provided."}`} backTo="/matters" actions={<><Button variant="outline" className="border-white/15 bg-transparent" onClick={() => createDemo.mutate({ matterId })}>Load synthetic session</Button><Button className="bg-[#d6b65d] text-[#07111d]" onClick={() => setLocation(`/sessions?matter=${matterId}`)}>New recording</Button></>} />

      <Tabs defaultValue="terms" className="min-w-0 space-y-6">
        <TabsList className="h-auto max-w-full justify-start overflow-x-auto border border-white/10 bg-[#0a1827] p-1">
          <TabsTrigger value="terms" className="shrink-0"><BookOpenText className="mr-2 h-4 w-4" />Vocabulary</TabsTrigger>
          <TabsTrigger value="entities" className="shrink-0"><UsersRound className="mr-2 h-4 w-4" />People & organizations</TabsTrigger>
          <TabsTrigger value="sessions" className="shrink-0"><FileText className="mr-2 h-4 w-4" />Sessions</TabsTrigger>
          <TabsTrigger value="templates" className="shrink-0"><Scale className="mr-2 h-4 w-4" />Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="terms">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]">
            <section><SectionHeading label="Learned language" title={`${data.terms.length} approved mappings`} />
              <div className="divide-y divide-white/8 border-y border-white/10 bg-[#0a1827]">
                {data.terms.map(term => <div key={term.id} className="grid gap-2 px-5 py-4 sm:grid-cols-[1fr_40px_1fr_90px] sm:items-center"><span className="text-sm text-[#a7b1bc]">“{term.heardPhrase}”</span><span className="text-center text-[#d6b65d]">→</span><strong className="text-sm text-[#f2ede4]">{term.approvedText}</strong><span className="font-mono text-[9px] uppercase tracking-[0.12em] text-[#7f8b98]">{term.scope}</span></div>)}
              </div>
            </section>
            <aside className="border border-[#d6b65d]/20 bg-[#0a1827] p-5"><SectionHeading label="Attorney-approved learning" title="Teach a term" /><div className="space-y-4"><div className="space-y-2"><Label>What was heard</Label><Input value={heardPhrase} onChange={event => setHeardPhrase(event.target.value)} placeholder="motion and lemonade" className="border-white/10 bg-white/5" /></div><div className="space-y-2"><Label>Approved legal text</Label><Input value={approvedText} onChange={event => setApprovedText(event.target.value)} placeholder="motion in limine" className="border-white/10 bg-white/5" /></div><div className="space-y-2"><Label>Learning scope</Label><Select value={termScope} onValueChange={value => setTermScope(value as typeof termScope)}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="matter">This matter</SelectItem><SelectItem value="user">This attorney</SelectItem><SelectItem value="firm">Entire firm</SelectItem></SelectContent></Select></div><Button className="w-full bg-[#d6b65d] text-[#07111d]" disabled={!heardPhrase || !approvedText || addTerm.isPending} onClick={() => addTerm.mutate({ matterId, scope: termScope, heardPhrase, approvedText, category: "Attorney approved" })}><Plus className="mr-2 h-4 w-4" /> Save mapping</Button></div></aside>
          </div>
        </TabsContent>

        <TabsContent value="entities">
          <div className="grid gap-7 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,.6fr)]"><section><SectionHeading label="Matter intelligence" title={`${data.entities.length} named entities`} /><div className="grid gap-3 sm:grid-cols-2">{data.entities.map(entity => <article key={entity.id} className="border-l-2 border-[#d6b65d]/50 bg-white/[0.03] p-5"><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#7f8b98]">{entity.entityType.replace("_", " ")}</span><strong className="mt-2 block font-display text-xl">{entity.displayName}</strong><p className="mt-2 text-xs text-[#8e9aa7]">Aliases: {entity.aliases.length ? entity.aliases.join(", ") : "None"}</p></article>)}</div></section><aside className="border border-white/10 bg-[#0a1827] p-5"><SectionHeading label="Vocabulary source" title="Add entity" /><div className="space-y-4"><div className="space-y-2"><Label>Name</Label><Input value={entityName} onChange={event => setEntityName(event.target.value)} className="border-white/10 bg-white/5" /></div><div className="space-y-2"><Label>Entity type</Label><Select value={entityType} onValueChange={value => setEntityType(value as typeof entityType)}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent>{["party", "attorney", "expert", "organization", "medical_provider", "judge", "other"].map(value => <SelectItem key={value} value={value}>{value.replace("_", " ")}</SelectItem>)}</SelectContent></Select></div><Button className="w-full bg-[#d6b65d] text-[#07111d]" disabled={!entityName || addEntity.isPending} onClick={() => addEntity.mutate({ matterId, entityType, displayName: entityName, aliases: [] })}>Add entity</Button></div></aside></div>
        </TabsContent>

        <TabsContent value="sessions">{data.sessions.length ? <div className="grid gap-3 lg:grid-cols-2">{data.sessions.map(session => <button key={session.id} onClick={() => setLocation(`/sessions/${session.id}`)} className="border border-white/10 bg-[#0a1827] p-5 text-left hover:border-[#d6b65d]/30"><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#d6b65d]">{session.status} · {session.processingMode}</span><strong className="mt-3 block font-display text-xl">{session.title}</strong><p className="mt-2 text-xs text-[#8f9aa7]">{session.wordCount} words · {session.sourceType}</p></button>)}</div> : <EmptyState title="No sessions for this matter" description="Load the synthetic legal demonstration or upload an approved recording." action={{ label: "Load synthetic session", onClick: () => createDemo.mutate({ matterId }) }} />}</TabsContent>
        <TabsContent value="templates"><div className="grid gap-3 lg:grid-cols-2">{data.templates.map(template => <article key={template.id} className="border border-white/10 bg-[#0a1827] p-5"><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#d6b65d]">{template.category}</span><strong className="mt-3 block font-display text-2xl">{template.name}</strong><p className="mt-2 text-sm text-[#909ca9]">{template.description}</p></article>)}</div></TabsContent>
      </Tabs>
    </PageFrame>
  );
}
