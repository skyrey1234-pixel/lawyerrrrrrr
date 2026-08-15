import { EmptyState, MetricCard, PageFrame, PageHeader, PrivacyBoundary, ProcessingBadge, SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { AudioLines, BriefcaseBusiness, CheckSquare2, Clock3, HardDrive, Plus, Scale } from "lucide-react";
import { useLocation } from "wouter";

function formatDate(value: string | Date) {
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function PilotDashboard() {
  const [, setLocation] = useLocation();
  const dashboard = trpc.workspace.dashboard.useQuery();

  if (dashboard.isLoading) {
    return <PageFrame><div className="h-52 animate-pulse bg-white/[0.035]" /></PageFrame>;
  }

  if (!dashboard.data) {
    return <PageFrame><EmptyState title="Workspace unavailable" description={dashboard.error?.message || "CounselScribe could not open the protected pilot workspace."} /></PageFrame>;
  }

  const { firm, matters, sessions, comparisons } = dashboard.data;
  const reviewReady = sessions.filter(item => item.session.status === "review").length;

  return (
    <PageFrame>
      <PageHeader
        eyebrow={`${firm.name} · protected pilot`}
        title="Command center"
        description="A matter-led view of every dictation, attorney decision, output comparison, and privacy boundary. The numbers below are live workspace records—not presentation placeholders."
        actions={
          <>
            <Button variant="outline" className="border-white/15 bg-transparent text-[#d9e0e7]" onClick={() => setLocation("/dictate")}>Browser demo</Button>
            <Button className="bg-[#d6b65d] text-[#07111d] hover:bg-[#e2c46f]" onClick={() => setLocation("/matters")}><Plus className="mr-2 h-4 w-4" /> New matter</Button>
          </>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Active matters" value={matters.filter(item => item.status === "active").length} detail="Firm-isolated legal workspaces" icon={BriefcaseBusiness} />
        <MetricCard label="Dictation sessions" value={sessions.length} detail="Uploaded, live, and synthetic" icon={AudioLines} />
        <MetricCard label="Awaiting review" value={reviewReady} detail="Attorney action required" icon={CheckSquare2} />
        <MetricCard label="Comparison runs" value={comparisons.length} detail="Dragon against CounselScribe" icon={Scale} />
      </section>

      <div className="mt-7 grid gap-7 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,.7fr)]">
        <div className="space-y-7">
          <section>
            <SectionHeading label="Docket" title="Recent matters" action={<button className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#d6b65d]" onClick={() => setLocation("/matters")}>View all</button>} />
            {matters.length ? (
              <div className="divide-y divide-white/8 border-y border-white/10 bg-[#0a1827]">
                {matters.slice(0, 4).map(matter => (
                  <button key={matter.id} onClick={() => setLocation(`/matters/${matter.id}`)} className="grid w-full gap-2 px-5 py-4 text-left transition-colors hover:bg-white/[0.035] sm:grid-cols-[minmax(0,1fr)_150px_120px] sm:items-center">
                    <div className="min-w-0"><strong className="block truncate font-display text-xl text-[#f4eee2]">{matter.name}</strong><span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.14em] text-[#7f8b98]">{matter.matterNumber} · {matter.clientName}</span></div>
                    <span className="text-xs text-[#a7b1bc]">{matter.practiceArea}</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#d6b65d]">{matter.status.replace("_", " ")}</span>
                  </button>
                ))}
              </div>
            ) : <EmptyState title="No matters yet" description="Create the first synthetic or approved pilot matter before capturing audio." action={{ label: "Create matter", onClick: () => setLocation("/matters") }} />}
          </section>

          <section>
            <SectionHeading label="Work product" title="Recent dictation sessions" action={<button className="font-mono text-[10px] uppercase tracking-[0.14em] text-[#d6b65d]" onClick={() => setLocation("/sessions")}>Open session ledger</button>} />
            {sessions.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {sessions.slice(0, 4).map(({ session, matter }) => (
                  <button key={session.id} onClick={() => setLocation(`/sessions/${session.id}`)} className="border border-white/10 bg-white/[0.025] p-5 text-left transition hover:border-[#d6b65d]/30 hover:bg-white/[0.04]">
                    <div className="flex items-start justify-between gap-3"><ProcessingBadge mode={session.processingMode} /><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#8c98a5]">{session.status}</span></div>
                    <strong className="mt-4 block font-display text-xl text-[#f4eee2]">{session.title}</strong>
                    <p className="mt-1 text-xs text-[#8995a2]">{matter.name}</p>
                    <div className="mt-4 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#7f8b98]"><Clock3 className="h-3.5 w-3.5" />{formatDate(session.updatedAt)}</div>
                  </button>
                ))}
              </div>
            ) : <EmptyState title="No sessions yet" description="Load the synthetic legal demo or upload an approved test recording." action={{ label: "Open sessions", onClick: () => setLocation("/sessions") }} />}
          </section>
        </div>

        <aside className="space-y-4">
          <PrivacyBoundary />
          <div className="border border-white/10 bg-white/[0.025] p-5">
            <div className="flex items-center gap-2 text-[#d6b65d]"><HardDrive className="h-4 w-4" /><span className="font-mono text-[10px] font-bold uppercase tracking-[0.16em]">Local companion</span></div>
            <strong className="mt-4 block font-display text-2xl">Not connected</strong>
            <p className="mt-2 text-xs leading-relaxed text-[#909ca9]">The Mac mini service is represented honestly as an integration target until a local folder and device are bound, installed, and verified.</p>
            <Button variant="outline" className="mt-5 w-full border-white/15 bg-transparent" onClick={() => setLocation("/admin")}>View deployment boundary</Button>
          </div>
        </aside>
      </div>
    </PageFrame>
  );
}

