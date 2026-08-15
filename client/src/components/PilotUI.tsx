import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowLeft, Cloud, HardDrive, LockKeyhole, ShieldCheck } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "./ui/button";

export function PageFrame({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen min-w-0 overflow-x-hidden bg-[radial-gradient(circle_at_top_right,rgba(214,182,93,0.08),transparent_32%),#08131f] px-4 py-5 sm:px-7 sm:py-7 xl:px-10">{children}</div>;
}

export function PageHeader({ eyebrow, title, description, actions, backTo }: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
  backTo?: string;
}) {
  const [, setLocation] = useLocation();
  return (
    <header className="mb-7 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {backTo ? (
          <button onClick={() => setLocation(backTo)} className="mb-3 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.17em] text-[#9da8b5] hover:text-[#d6b65d]">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
        ) : null}
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#d6b65d]">{eyebrow}</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-[#f7f1e5] sm:text-5xl">{title}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-relaxed text-[#9da8b5]">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function MetricCard({ label, value, detail, icon: Icon }: {
  label: string;
  value: string | number;
  detail: string;
  icon: LucideIcon;
}) {
  return (
    <article className="border-l-2 border-[#d6b65d]/55 bg-white/[0.035] p-5 shadow-[0_18px_45px_rgba(0,0,0,0.16)]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-[#84909e]">{label}</span>
        <Icon className="h-4 w-4 text-[#d6b65d]" />
      </div>
      <strong className="mt-3 block font-display text-4xl font-semibold text-[#f7f1e5]">{value}</strong>
      <p className="mt-1 text-xs text-[#8995a2]">{detail}</p>
    </article>
  );
}

export function SectionHeading({ label, title, action }: { label: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-[#84909e]">{label}</p>
        <h2 className="mt-1 font-display text-2xl font-semibold text-[#f7f1e5]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function ProcessingBadge({ mode }: { mode: "browser" | "hosted" | "local" }) {
  const config = {
    browser: { icon: AlertTriangle, label: "Browser demo", classes: "border-[#b66b5d]/35 bg-[#b66b5d]/10 text-[#e7afa4]" },
    hosted: { icon: Cloud, label: "Hosted transcription", classes: "border-[#d6b65d]/35 bg-[#d6b65d]/10 text-[#edd898]" },
    local: { icon: HardDrive, label: "Local companion", classes: "border-[#aeb3a2]/30 bg-[#aeb3a2]/10 text-[#d9dccc]" },
  }[mode];
  const Icon = config.icon;
  return <span className={`inline-flex items-center gap-1.5 border px-2 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.13em] ${config.classes}`}><Icon className="h-3 w-3" />{config.label}</span>;
}

export function PrivacyBoundary() {
  return (
    <div className="border border-[#d6b65d]/20 bg-[#0a1827] p-5">
      <div className="flex items-center gap-2 text-[#e7cf8d]"><LockKeyhole className="h-4 w-4" /><strong className="font-mono text-[10px] uppercase tracking-[0.16em]">Processing boundary</strong></div>
      <p className="mt-3 text-xs leading-relaxed text-[#97a2af]">Hosted audio uses the managed speech service. “Local” remains disabled until the Mac mini companion is installed, authenticated, and verified at the firm.</p>
    </div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="border border-dashed border-white/15 bg-white/[0.02] px-6 py-12 text-center">
      <ShieldCheck className="mx-auto h-8 w-8 text-[#d6b65d]" />
      <h3 className="mt-4 font-display text-2xl font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-[#929eaa]">{description}</p>
      {action ? <Button className="mt-5 bg-[#d6b65d] text-[#07111d] hover:bg-[#e2c46f]" onClick={action.onClick}>{action.label}</Button> : null}
    </div>
  );
}
