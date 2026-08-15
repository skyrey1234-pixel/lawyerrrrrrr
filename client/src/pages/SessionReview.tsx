import { PageFrame, PageHeader, ProcessingBadge, SectionHeading } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { applyCleanupRule, buildCleanupSuggestions } from "@/lib/legalEngine";
import { trpc } from "@/lib/trpc";
import { parseReviewVoiceCommand } from "@shared/counselscribe";
import { Check, Clock3, FileClock, FileDown, History, Mic2, Play, RotateCcw, Save, ShieldAlert, Sparkles, Square, Undo2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

function timecode(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: { length: number; [index: number]: { isFinal: boolean; 0: { transcript: string } } };
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: ((event: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function SessionReview({ sessionId }: { sessionId: number }) {
  const utils = trpc.useUtils();
  const session = trpc.sessions.get.useQuery({ sessionId });
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const editorRef = useRef<HTMLTextAreaElement | null>(null);
  const [reviewed, setReviewed] = useState("");
  const [initializedVersionId, setInitializedVersionId] = useState<number | null>(null);
  const [decisionState, setDecisionState] = useState<Record<string, "accepted" | "kept">>({});
  const [heardPhrase, setHeardPhrase] = useState("");
  const [approvedText, setApprovedText] = useState("");
  const [teachScope, setTeachScope] = useState<"matter" | "user" | "firm">("matter");
  const [documentTitle, setDocumentTitle] = useState("Attorney Memorandum");
  const [isVoiceReviewing, setIsVoiceReviewing] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState("");
  const [voiceSuggestionIndex, setVoiceSuggestionIndex] = useState(0);
  const voiceRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const voiceCommandHandlerRef = useRef<(transcript: string) => void>(() => undefined);

  const currentSource = useMemo(() => {
    const versions = session.data?.versions || [];
    return versions.find(version => version.kind === "reviewed") ?? versions.find(version => version.kind === "normalized") ?? versions.find(version => version.kind === "raw");
  }, [session.data?.versions]);

  useEffect(() => {
    if (currentSource && currentSource.id !== initializedVersionId) {
      setReviewed(currentSource.content);
      setInitializedVersionId(currentSource.id);
    }
  }, [currentSource, initializedVersionId]);

  const suggestions = useMemo(() => buildCleanupSuggestions(reviewed), [reviewed]);
  const openSuggestions = useMemo(() => suggestions.filter(item => !decisionState[item.id]), [decisionState, suggestions]);
  const transcribe = trpc.sessions.transcribeHosted.useMutation({ onSuccess: async () => { await utils.sessions.get.invalidate({ sessionId }); toast.success("Timestamped transcription is ready for attorney review."); }, onError: error => toast.error(error.message) });
  const recordDecision = trpc.sessions.recordDecision.useMutation({ onSuccess: async () => { await utils.sessions.get.invalidate({ sessionId }); }, onError: error => toast.error(error.message) });
  const saveReviewed = trpc.sessions.saveReviewed.useMutation({ onSuccess: async () => { await utils.sessions.get.invalidate({ sessionId }); toast.success("Reviewed version saved."); }, onError: error => toast.error(error.message) });
  const restoreVersion = trpc.sessions.restoreVersion.useMutation({ onSuccess: async result => { await utils.sessions.get.invalidate({ sessionId }); setInitializedVersionId(result.id); toast.success(`Version ${result.versionNumber} created from the selected history.`); }, onError: error => toast.error(error.message) });
  const exportDocx = trpc.sessions.exportDocx.useMutation({ onSuccess: async data => { const link = document.createElement("a"); link.href = data.url; link.download = data.fileName; link.click(); await utils.sessions.get.invalidate({ sessionId }); toast.success("Word-ready attorney draft generated."); }, onError: error => toast.error(error.message) });

  useEffect(() => {
    setVoiceSuggestionIndex(current => Math.min(current, Math.max(0, openSuggestions.length - 1)));
  }, [openSuggestions.length]);

  useEffect(() => () => voiceRecognitionRef.current?.abort(), []);

  const playSegment = (startMs: number) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = startMs / 1000;
    void audioRef.current.play();
  };

  const acceptSuggestion = (id: string) => {
    const suggestion = suggestions.find(item => item.id === id);
    if (!suggestion) return;
    const sourceSegment = session.data?.segments.find(segment =>
      `${segment.sourceText} ${segment.normalizedText}`.toLowerCase().includes(suggestion.original.toLowerCase()),
    );
    const next = applyCleanupRule(reviewed, id);
    setReviewed(next);
    setDecisionState(current => ({ ...current, [id]: "accepted" }));
    recordDecision.mutate({ sessionId, decisionType: "accept", category: suggestion.kind, originalText: suggestion.original, replacementText: next, reason: suggestion.reason, confidence: suggestion.confidence / 100, audioStartMs: sourceSegment?.startMs, audioEndMs: sourceSegment?.endMs, reviewedContent: next });
  };

  const keepOriginal = (id: string) => {
    const suggestion = suggestions.find(item => item.id === id);
    if (!suggestion) return;
    const sourceSegment = session.data?.segments.find(segment =>
      `${segment.sourceText} ${segment.normalizedText}`.toLowerCase().includes(suggestion.original.toLowerCase()),
    );
    setDecisionState(current => ({ ...current, [id]: "kept" }));
    recordDecision.mutate({ sessionId, decisionType: "reject", category: suggestion.kind, originalText: suggestion.original, reason: "Attorney retained original language", confidence: suggestion.confidence / 100, audioStartMs: sourceSegment?.startMs, audioEndMs: sourceSegment?.endMs });
  };

  const teachCorrection = () => {
    if (!heardPhrase || !approvedText || !session.data) return;
    const next = reviewed.replace(new RegExp(heardPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), approvedText);
    setReviewed(next);
    recordDecision.mutate({ sessionId, decisionType: "teach_term", category: "Attorney approved", originalText: heardPhrase, replacementText: approvedText, reviewedContent: next, teachScope });
    setHeardPhrase("");
    setApprovedText("");
    toast.success(`CounselScribe learned “${approvedText}” for ${teachScope === "matter" ? "this matter" : teachScope === "user" ? "this attorney" : "the firm"}.`);
  };

  function handleVoiceReviewCommand(transcript: string) {
    const action = parseReviewVoiceCommand(transcript);
    setLastVoiceCommand(transcript);
    if (!action) {
      toast.error("Voice command not recognized. Use the exact commands shown in the panel.");
      return;
    }
    if (action.type === "next") {
      setVoiceSuggestionIndex(current => Math.min(current + 1, Math.max(0, openSuggestions.length - 1)));
      return;
    }
    if (action.type === "previous") {
      setVoiceSuggestionIndex(current => Math.max(0, current - 1));
      return;
    }
    if (action.type === "format") {
      const editor = editorRef.current;
      const start = editor?.selectionStart ?? reviewed.length;
      const end = editor?.selectionEnd ?? start;
      const next = `${reviewed.slice(0, start)}${action.value}${reviewed.slice(end)}`;
      setReviewed(next);
      recordDecision.mutate({ sessionId, decisionType: "manual_edit", category: "Voice formatting", originalText: reviewed, replacementText: next, reason: `Explicit spoken command: ${action.label}`, reviewedContent: next });
      requestAnimationFrame(() => {
        editor?.focus();
        editor?.setSelectionRange(start + action.value.length, start + action.value.length);
      });
      return;
    }
    if (action.type === "correct") {
      const next = reviewed.replace(new RegExp(action.heardPhrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), action.approvedText);
      if (next === reviewed) {
        toast.error(`“${action.heardPhrase}” was not found in the reviewed draft.`);
        return;
      }
      setReviewed(next);
      recordDecision.mutate({ sessionId, decisionType: "teach_term", category: "Spoken correction", originalText: action.heardPhrase, replacementText: action.approvedText, reviewedContent: next, teachScope: "matter" });
      toast.success(`Spoken correction learned for this matter: “${action.approvedText}”.`);
      return;
    }
    const activeSuggestion = openSuggestions[voiceSuggestionIndex] ?? openSuggestions[0];
    if (!activeSuggestion) {
      toast.error("There is no open review suggestion for that command.");
      return;
    }
    if (action.type === "accept") acceptSuggestion(activeSuggestion.id);
    if (action.type === "keep") keepOriginal(activeSuggestion.id);
    if (action.type === "play") {
      const source = session.data?.segments.find(segment => `${segment.sourceText} ${segment.normalizedText}`.toLowerCase().includes(activeSuggestion.original.toLowerCase()));
      if (source && session.data?.audio) playSegment(source.startMs);
      else toast.error("No playable source audio is linked to this suggestion.");
    }
  }

  voiceCommandHandlerRef.current = handleVoiceReviewCommand;

  const startVoiceReview = () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      toast.error("Voice review commands are unavailable in this browser. The visible controls remain fully functional.");
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = event => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) voiceCommandHandlerRef.current(result[0].transcript.trim());
      }
    };
    recognition.onerror = event => {
      setIsVoiceReviewing(false);
      toast.error(event.error === "not-allowed" ? "Microphone permission was blocked." : "Voice review paused. Manual review controls remain available.");
    };
    recognition.onend = () => setIsVoiceReviewing(false);
    voiceRecognitionRef.current = recognition;
    setLastVoiceCommand("");
    setIsVoiceReviewing(true);
    recognition.start();
  };

  const stopVoiceReview = () => {
    voiceRecognitionRef.current?.stop();
    setIsVoiceReviewing(false);
  };

  if (session.isLoading) return <PageFrame><div className="h-80 animate-pulse bg-white/[0.035]" /></PageFrame>;
  if (!session.data) return <PageFrame><PageHeader eyebrow="Session" title="Not available" description={session.error?.message || "This session could not be opened."} backTo="/sessions" /></PageFrame>;
  const data = session.data;
  const hasSource = Boolean(currentSource);

  return (
    <PageFrame>
      <PageHeader eyebrow={`${data.matter.matterNumber} · ${data.session.sourceType} session`} title={data.session.title} description={`${data.matter.name}. Every proposed cleanup remains attorney-controlled and every saved state becomes a separate version.`} backTo="/sessions" actions={<><ProcessingBadge mode={data.session.processingMode} />{data.audio && data.session.processingMode === "hosted" && ["uploaded", "failed"].includes(data.session.status) ? <Button className="bg-[#d6b65d] text-[#07111d]" disabled={transcribe.isPending} onClick={() => transcribe.mutate({ sessionId })}>{transcribe.isPending ? "Transcribing…" : <><Sparkles className="mr-2 h-4 w-4" /> Start hosted transcription</>}</Button> : null}</>} />

      {data.session.processingMode === "local" && data.session.status === "uploaded" ? <div className="mb-6 flex items-start gap-3 border-l-2 border-[#d6b65d] bg-[#d6b65d]/8 p-4 text-sm text-[#d8ca9f]"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Waiting for local companion.</strong> The audio is stored, but no transcription request will be sent until the Mac mini service is installed and verified.</p></div> : null}
      {data.session.status === "failed" ? <div className="mb-6 border-l-2 border-[#a4564d] bg-[#a4564d]/10 p-4 text-sm text-[#e2aaa3]">{data.session.errorMessage}</div> : null}

      <div className="grid gap-6 2xl:grid-cols-[330px_minmax(0,1fr)_360px]">
        <aside className="space-y-5">
          <section className="border border-white/10 bg-[#0a1827] p-5">
            <SectionHeading label="Source record" title="Audio & segments" />
            {data.audio ? <audio ref={audioRef} src={data.audio.storageUrl} controls className="mb-4 w-full" preload="metadata" /> : <div className="mb-4 border border-dashed border-white/15 p-4 text-xs leading-relaxed text-[#8e9aa7]">Synthetic session: timestamp navigation is available, but no audio file is attached.</div>}
            <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
              {data.segments.map(segment => <button key={segment.id} onClick={() => playSegment(segment.startMs)} disabled={!data.audio} className="w-full border-l-2 border-white/10 bg-white/[0.025] p-3 text-left transition enabled:hover:border-[#d6b65d] enabled:hover:bg-white/[0.045] disabled:cursor-default"><span className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#d6b65d]">{data.audio ? <Play className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}{timecode(segment.startMs)}–{timecode(segment.endMs)}</span><p className="mt-2 text-xs leading-relaxed text-[#a9b3be]">{segment.sourceText}</p></button>)}
            </div>
          </section>
          <section className="border border-white/10 bg-[#0a1827] p-5">
            <SectionHeading label="Voice review grammar" title="Explicit commands" />
            <div className="space-y-2 font-mono text-[9px] uppercase tracking-[0.11em] text-[#9da8b5]">{["next issue", "previous issue", "accept change", "keep original", "play source", "correct X to Y", "new paragraph", "new line", "comma", "period", "open quote", "close quote"].map(command => <p key={command} className="border-b border-white/7 pb-2">“{command}”</p>)}</div>
            <Button className={`mt-4 w-full ${isVoiceReviewing ? "bg-[#a4564d] text-white hover:bg-[#b6655c]" : "bg-[#d6b65d] text-[#07111d]"}`} onClick={isVoiceReviewing ? stopVoiceReview : startVoiceReview}>{isVoiceReviewing ? <><Square className="mr-2 h-4 w-4 fill-current" /> Stop voice review</> : <><Mic2 className="mr-2 h-4 w-4" /> Start voice review</>}</Button>
            <p className="mt-3 min-h-8 text-xs leading-relaxed text-[#85919e]">{lastVoiceCommand ? <>Last command: “{lastVoiceCommand}”</> : openSuggestions.length ? `Focused issue ${voiceSuggestionIndex + 1} of ${openSuggestions.length}.` : "No open issue is focused; spoken correction commands still work."}</p>
          </section>
        </aside>

        <section className="min-w-0 border border-[#d6b65d]/18 bg-[#eee9dd] text-[#25231f] shadow-[0_26px_80px_rgba(0,0,0,.28)]">
          <div className="flex flex-col gap-3 border-b border-[#b7aa8c]/45 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><span className="font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-[#756b55]">Attorney work product</span><h2 className="font-display text-2xl font-semibold">Reviewed draft</h2></div><div className="flex gap-2"><Button variant="outline" className="border-[#8f8267]/40 bg-transparent text-[#332f27]" disabled={!reviewed || saveReviewed.isPending} onClick={() => saveReviewed.mutate({ sessionId, content: reviewed })}><Save className="mr-2 h-4 w-4" /> Save version</Button><Button className="bg-[#172b40] text-white hover:bg-[#213d5b]" disabled={!hasSource || exportDocx.isPending} onClick={() => exportDocx.mutate({ sessionId, documentTitle })}><FileDown className="mr-2 h-4 w-4" /> Word</Button></div></div>
          <div className="border-b border-[#b7aa8c]/35 px-5 py-3"><Label htmlFor="document-title" className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#756b55]">Document title</Label><Input id="document-title" value={documentTitle} onChange={event => setDocumentTitle(event.target.value)} className="mt-2 border-[#8f8267]/35 bg-white/35 font-display text-xl" /></div>
          <div className="relative min-h-[720px] bg-[linear-gradient(90deg,transparent_72px,rgba(153,124,91,.18)_73px,transparent_74px),repeating-linear-gradient(transparent,transparent_31px,rgba(97,84,62,.08)_32px)] p-6 pl-24">
            <Textarea ref={editorRef} value={reviewed} onChange={event => setReviewed(event.target.value)} placeholder={data.session.status === "uploaded" ? "Start transcription to create the timestamped draft." : "No transcript content yet."} className="min-h-[650px] resize-none border-0 bg-transparent p-0 font-serif text-[17px] leading-8 text-[#2a2721] shadow-none focus-visible:ring-0" />
          </div>
        </section>

        <aside className="space-y-5">
          <Tabs defaultValue="review">
            <TabsList className="grid h-auto grid-cols-3 border border-white/10 bg-[#0a1827] p-1"><TabsTrigger value="review">Review</TabsTrigger><TabsTrigger value="learn">Learn</TabsTrigger><TabsTrigger value="history">History</TabsTrigger></TabsList>
            <TabsContent value="review" className="mt-4 space-y-3">
              <div className="flex items-center justify-between"><SectionHeading label="Review docket" title={`${suggestions.filter(item => !decisionState[item.id]).length} open`} /></div>
              {suggestions.length ? suggestions.map(suggestion => {
                const sourceSegment = data.segments.find(segment =>
                  `${segment.sourceText} ${segment.normalizedText}`.toLowerCase().includes(suggestion.original.toLowerCase()),
                );
                return (
                  <article key={suggestion.id} className="border border-white/10 bg-[#0a1827] p-4">
                    <div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#d6b65d]">{suggestion.kind}</span><span className="text-[10px] text-[#7f8b98]">{suggestion.confidence}%</span></div>
                    <strong className="mt-3 block text-sm">{suggestion.title}</strong>
                    <p className="mt-2 text-xs italic text-[#aab4bf]">“{suggestion.original}”</p>
                    <p className="mt-2 text-xs leading-relaxed text-[#85919e]">{suggestion.reason}</p>
                    {sourceSegment ? (
                      <button
                        onClick={() => playSegment(sourceSegment.startMs)}
                        disabled={!data.audio}
                        className="mt-3 inline-flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-[#d6b65d] disabled:text-[#788491]"
                      >
                        {data.audio ? <Play className="h-3 w-3" /> : <Clock3 className="h-3 w-3" />}
                        {data.audio ? "Play source" : "Source"} · {timecode(sourceSegment.startMs)}
                      </button>
                    ) : null}
                    {!decisionState[suggestion.id] ? <div className="mt-4 grid grid-cols-2 gap-2"><button onClick={() => acceptSuggestion(suggestion.id)} className="inline-flex items-center justify-center gap-2 bg-[#d6b65d] px-3 py-2 text-xs font-semibold text-[#07111d]"><Check className="h-3.5 w-3.5" /> Accept</button><button onClick={() => keepOriginal(suggestion.id)} className="inline-flex items-center justify-center gap-2 border border-white/12 px-3 py-2 text-xs text-[#c2cad2]"><X className="h-3.5 w-3.5" /> Keep</button></div> : <div className="mt-4 flex items-center gap-2 border-l-2 border-[#aeb3a2] bg-white/[0.03] p-2 text-xs text-[#c3c8bd]">{decisionState[suggestion.id] === "accepted" ? <Check className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />}{decisionState[suggestion.id] === "accepted" ? "Approved" : "Original retained"}</div>}
                  </article>
                );
              }) : <div className="border border-dashed border-white/15 p-6 text-center"><Check className="mx-auto h-6 w-6 text-[#d6b65d]" /><p className="mt-3 text-sm">No deterministic cleanups are queued.</p></div>}
            </TabsContent>
            <TabsContent value="learn" className="mt-4"><section className="border border-[#d6b65d]/20 bg-[#0a1827] p-5"><SectionHeading label="Approved correction" title="Teach CounselScribe" /><div className="space-y-4"><div className="space-y-2"><Label>What was heard</Label><Input value={heardPhrase} onChange={event => setHeardPhrase(event.target.value)} className="border-white/10 bg-white/5" /></div><div className="space-y-2"><Label>Approved legal text</Label><Input value={approvedText} onChange={event => setApprovedText(event.target.value)} className="border-white/10 bg-white/5" /></div><div className="space-y-2"><Label>Scope</Label><Select value={teachScope} onValueChange={value => setTeachScope(value as typeof teachScope)}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="matter">This matter</SelectItem><SelectItem value="user">This attorney</SelectItem><SelectItem value="firm">Entire firm</SelectItem></SelectContent></Select></div><Button className="w-full bg-[#d6b65d] text-[#07111d]" disabled={!heardPhrase || !approvedText || recordDecision.isPending} onClick={teachCorrection}>Save approved correction</Button></div></section><div className="mt-4 border-y border-white/10 bg-white/[0.025]">{data.terms.slice(0, 12).map(term => <div key={term.id} className="grid grid-cols-[1fr_24px_1fr] gap-2 border-b border-white/7 px-3 py-3 text-xs"><span className="text-[#9da8b5]">{term.heardPhrase}</span><span className="text-[#d6b65d]">→</span><strong>{term.approvedText}</strong></div>)}</div></TabsContent>
            <TabsContent value="history" className="mt-4 space-y-3"><SectionHeading label="Version ledger" title={`${data.versions.length} preserved states`} />{data.versions.map(version => <article key={version.id} className="border border-white/10 bg-[#0a1827] p-4"><div className="flex items-center justify-between"><span className="font-mono text-[9px] uppercase tracking-[0.13em] text-[#d6b65d]">Version {version.versionNumber} · {version.kind}</span><FileClock className="h-4 w-4 text-[#8894a1]" /></div><p className="mt-2 line-clamp-3 text-xs leading-relaxed text-[#9da8b5]">{version.content}</p><Button variant="outline" className="mt-3 h-8 border-white/12 bg-transparent text-xs" disabled={restoreVersion.isPending} onClick={() => restoreVersion.mutate({ sessionId, versionId: version.id })}><RotateCcw className="mr-2 h-3.5 w-3.5" /> Restore as new version</Button></article>)}</TabsContent>
          </Tabs>
          <div className="border border-white/10 bg-white/[0.025] p-4"><div className="flex items-center gap-2 text-[#d6b65d]"><History className="h-4 w-4" /><span className="font-mono text-[9px] uppercase tracking-[0.14em]">Audit summary</span></div><p className="mt-3 text-xs leading-relaxed text-[#8f9aa7]">{data.decisions.length} review decisions preserved. Raw audio, transcript segments, versions, decisions, and exports remain separate records.</p></div>
        </aside>
      </div>
    </PageFrame>
  );
}
