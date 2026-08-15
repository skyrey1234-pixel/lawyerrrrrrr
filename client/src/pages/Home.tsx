/**
 * The Litigator's Desk: a three-zone, review-first legal dictation workspace.
 * Deep ink architecture surrounds a parchment transcript and a visible Review Docket.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BookOpenText,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clipboard,
  Download,
  FileDown,
  FileText,
  Info,
  Keyboard,
  LockKeyhole,
  Mic,
  Mic2,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Scale,
  ShieldCheck,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  applyCleanupRule,
  applyLegalTerms,
  buildCleanupSuggestions,
  DEMO_TRANSCRIPT,
  type LegalTerm,
} from "@/lib/legalEngine";

const PRODUCT_MARK = "/manus-storage/counselscribe_mark_7e796ba2.png";
const TFG_MONOGRAM = "/manus-storage/tfg_circle_monogram_6189f21b.png";

type ViewMode = "raw" | "reviewed" | "export";
type SuggestionState = "open" | "accepted" | "kept";

type BrowserSpeechRecognitionEvent = Event & {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      0: { transcript: string };
    };
  };
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

const PERSONAL_TERMS_KEY = "counselscribe.personalTerms.v1";

function loadPersonalTerms(): LegalTerm[] {
  try {
    const stored = window.localStorage.getItem(PERSONAL_TERMS_KEY);
    return stored ? (JSON.parse(stored) as LegalTerm[]) : [];
  } catch {
    return [];
  }
}

function formatTimer(seconds: number) {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function Waveform({ active }: { active: boolean }) {
  const bars = [9, 14, 21, 12, 30, 18, 36, 24, 14, 32, 21, 40, 26, 17, 33, 22, 13, 28, 19, 11];
  return (
    <div className="waveform" aria-hidden="true">
      {bars.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={active ? "waveform-bar is-active" : "waveform-bar"}
          style={{ height, animationDelay: `${index * 45}ms` }}
        />
      ))}
    </div>
  );
}

function DocketLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#a7b0bd]">{children}</span>;
}

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "gold" | "green" | "red" }) {
  const tones = {
    neutral: "border-white/10 bg-white/5 text-[#cbd1d8]",
    gold: "border-[#d6b65d]/35 bg-[#d6b65d]/10 text-[#e7cc82]",
    green: "border-[#a9ad9f]/20 bg-[#a9ad9f]/7 text-[#c6c9bd]",
    red: "border-[#a4564d]/35 bg-[#a4564d]/10 text-[#e6aaa2]",
  };
  return <span className={`inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[9px] font-bold uppercase tracking-[0.16em] ${tones[tone]}`}>{children}</span>;
}

export default function Home() {
  const [rawText, setRawText] = useState("");
  const [reviewedText, setReviewedText] = useState("");
  const [interimText, setInterimText] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("raw");
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [personalTerms, setPersonalTerms] = useState<LegalTerm[]>(loadPersonalTerms);
  const [suggestionStates, setSuggestionStates] = useState<Record<string, SuggestionState>>({});
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [teachOpen, setTeachOpen] = useState(false);
  const [spokenTerm, setSpokenTerm] = useState("");
  const [correctTerm, setCorrectTerm] = useState("");
  const [documentTitle, setDocumentTitle] = useState("Pretrial Evidence Memorandum");
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const shouldRecordRef = useRef(false);

  const recognitionSupported = useMemo(
    () => Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    [],
  );

  const legalResult = useMemo(
    () => applyLegalTerms(rawText, personalTerms),
    [rawText, personalTerms],
  );
  const suggestions = useMemo(
    () => buildCleanupSuggestions(legalResult.text),
    [legalResult.text],
  );

  useEffect(() => {
    let next = legalResult.text;
    Object.entries(suggestionStates).forEach(([ruleId, state]) => {
      if (state === "accepted") next = applyCleanupRule(next, ruleId);
    });
    setReviewedText(next);
  }, [legalResult.text, suggestionStates]);

  useEffect(() => {
    window.localStorage.setItem(PERSONAL_TERMS_KEY, JSON.stringify(personalTerms));
  }, [personalTerms]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "r") {
        event.preventDefault();
        if (isRecording) stopRecording();
        else startRecording();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const startRecording = () => {
    if (!recognitionSupported) {
      toast.error("Live browser dictation is not available here. Use the scripted demo to test the full review workflow.");
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) return;

    try {
      const recognition = new Recognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.onresult = (event) => {
        let finalChunk = "";
        let interimChunk = "";
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const result = event.results[index];
          if (result.isFinal) finalChunk += result[0].transcript;
          else interimChunk += result[0].transcript;
        }
        setInterimText(interimChunk.trim());
        if (finalChunk.trim()) {
          setRawText((current) => `${current}${current ? " " : ""}${finalChunk.trim()}`);
          setInterimText("");
        }
      };
      recognition.onerror = (event) => {
        shouldRecordRef.current = false;
        setIsRecording(false);
        if (event.error === "not-allowed") toast.error("Microphone access was blocked. Allow microphone permission or use the scripted demo.");
        else toast.error("Dictation paused. Your draft is preserved.");
      };
      recognition.onend = () => {
        if (shouldRecordRef.current) {
          try {
            recognition.start();
          } catch {
            shouldRecordRef.current = false;
            setIsRecording(false);
          }
        } else {
          setIsRecording(false);
        }
      };
      recognitionRef.current = recognition;
      shouldRecordRef.current = true;
      setElapsed(0);
      setViewMode("raw");
      setIsRecording(true);
      recognition.start();
      toast.success("Dictation started. This proof of concept uses your browser speech service.");
    } catch {
      setIsRecording(false);
      toast.error("The microphone could not start. Try the scripted demo instead.");
    }
  };

  const stopRecording = (silent = false) => {
    const wasRecording = shouldRecordRef.current || isRecording;
    shouldRecordRef.current = false;
    recognitionRef.current?.stop();
    setIsRecording(false);
    setInterimText("");
    if (wasRecording && !silent) toast.success("Dictation stopped. Review suggestions before export.");
  };

  const loadDemo = () => {
    stopRecording(true);
    setSuggestionStates({});
    setRawText(DEMO_TRANSCRIPT);
    setViewMode("raw");
    setElapsed(74);
    toast.success("Synthetic Florida legal demo loaded.");
  };

  const clearDraft = () => {
    stopRecording(true);
    setRawText("");
    setReviewedText("");
    setInterimText("");
    setElapsed(0);
    setSuggestionStates({});
    setViewMode("raw");
  };

  const acceptSuggestion = (id: string) => {
    setSuggestionStates((current) => ({ ...current, [id]: "accepted" }));
    toast.success("Change accepted and added to the review record.");
  };

  const keepOriginal = (id: string) => {
    setSuggestionStates((current) => ({ ...current, [id]: "kept" }));
    toast("Original language retained.");
  };

  const addPersonalTerm = () => {
    if (!spokenTerm.trim() || !correctTerm.trim()) {
      toast.error("Add both the heard phrase and the approved legal term.");
      return;
    }
    const term: LegalTerm = {
      id: `personal-${Date.now()}`,
      spoken: spokenTerm.trim(),
      replacement: correctTerm.trim(),
      category: "Personal",
      note: "Approved in this browser profile",
    };
    setPersonalTerms((current) => [term, ...current]);
    setSpokenTerm("");
    setCorrectTerm("");
    setTeachOpen(false);
    toast.success(`CounselScribe will now write “${term.replacement}”.`);
  };

  const copyDraft = async () => {
    if (!reviewedText.trim()) {
      toast.error("There is no reviewed draft to copy.");
      return;
    }
    await navigator.clipboard.writeText(reviewedText);
    toast.success("Reviewed draft copied.");
  };

  const downloadDraft = () => {
    if (!reviewedText.trim()) {
      toast.error("There is no reviewed draft to download.");
      return;
    }
    const header = `${documentTitle}\nMatter: Hartwell Insurance Group — Demo\nJurisdiction: Florida\n\n`;
    const file = new Blob([header, reviewedText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = "CounselScribe-reviewed-draft.txt";
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Reviewed draft downloaded.");
  };

  const acceptedCount = Object.values(suggestionStates).filter((state) => state === "accepted").length;
  const openSuggestions = suggestions.filter((item) => !suggestionStates[item.id]);
  const displayedText = viewMode === "raw" ? rawText : reviewedText;

  return (
    <div className="min-h-screen bg-[#06101d] text-[#f6f1e7]">
      <div className="workspace-atmosphere fixed inset-0" />

      <div className="relative z-10 min-h-screen">
        <header className="app-header">
          <div className="flex items-center gap-3">
            <img src={PRODUCT_MARK} alt="CounselScribe mark" className="h-11 w-11 object-contain" />
            <div>
              <div className="flex items-baseline gap-2">
                <span className="wordmark"><span className="wordmark-counsel">Counsel</span><span className="wordmark-scribe">Scribe</span></span>
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.2em] text-[#d6b65d]">AI · POC</span>
              </div>
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#8692a0]">Florida legal dictation workspace</p>
            </div>
          </div>

          <div className="hidden items-center gap-3 md:flex">
            <button className="header-chip" onClick={() => setPrivacyOpen(true)}>
              <ShieldCheck className="h-3.5 w-3.5 text-[#c7c1b0]" />
              Demo-safe mode
            </button>
            <div className="h-7 w-px bg-white/10" />
            <div className="flex items-center gap-2 text-right">
              <div>
                <p className="font-mono text-[8px] uppercase tracking-[0.17em] text-[#758190]">Built by</p>
                <p className="text-[11px] font-semibold text-[#d6b65d]">The Finnese Group LLC</p>
              </div>
              <img src={TFG_MONOGRAM} alt="The Finnese Group LLC" className="h-8 w-8 object-contain" />
            </div>
          </div>
        </header>

        <main className="workspace-grid">
          <aside className="matter-rail">
            <div>
              <DocketLabel>Active matter</DocketLabel>
              <h2 className="mt-3 font-display text-[24px] font-semibold leading-[1.05]">Hartwell Insurance Group</h2>
              <p className="mt-2 text-[12px] leading-relaxed text-[#8f9aa8]">Synthetic demonstration matter. No client or privileged data.</p>
            </div>

            <div className="double-rule" />

            <div className="matter-facts">
              <div>
                <DocketLabel>Jurisdiction</DocketLabel>
                <p>Florida</p>
              </div>
              <div>
                <DocketLabel>Practice area</DocketLabel>
                <p>Insurance defense</p>
              </div>
              <div>
                <DocketLabel>Matter ID</DocketLabel>
                <p className="font-mono">FL-ID-0247</p>
              </div>
            </div>

            <div className="double-rule" />

            <nav className="space-y-1" aria-label="Matter tools">
              <button className="rail-action is-active"><FileText className="h-4 w-4" /> Dictation desk <ChevronRight className="ml-auto h-3.5 w-3.5" /></button>
              <button className="rail-action" onClick={() => setTeachOpen(true)}><BookOpenText className="h-4 w-4" /> Personal terms <span className="ml-auto font-mono text-[9px] text-[#d6b65d]">{personalTerms.length}</span></button>
              <button className="rail-action" onClick={() => setPrivacyOpen(true)}><LockKeyhole className="h-4 w-4" /> Privacy note</button>
            </nav>

            <div className="mt-auto space-y-3">
              <div className="privacy-card">
                <div className="flex items-center gap-2 text-[#c9c2b0]">
                  <CircleDot className="h-3.5 w-3.5" />
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.16em]">POC guardrail</span>
                </div>
                <p>This browser demo is not approved for real client or privileged information.</p>
                <button onClick={() => setPrivacyOpen(true)}>View boundaries <ChevronRight className="h-3 w-3" /></button>
              </div>
              <button className="rail-action text-[#aeb7c2]" onClick={loadDemo}><Sparkles className="h-4 w-4 text-[#d6b65d]" /> Load scripted demo</button>
            </div>
          </aside>

          <section className="dictation-desk">
            <div className="desk-heading">
              <div className="min-w-0 flex-1">
                <DocketLabel>Document 01 · Work product draft</DocketLabel>
                <input
                  value={documentTitle}
                  onChange={(event) => setDocumentTitle(event.target.value)}
                  className="document-title"
                  aria-label="Document title"
                />
              </div>
              <div className="flex items-center gap-2">
                {isRecording ? <StatusPill tone="red"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#e6aaa2]" /> Recording</StatusPill> : <StatusPill tone="green"><ShieldCheck className="h-3 w-3" /> Draft preserved</StatusPill>}
                <button className="icon-button" onClick={clearDraft} aria-label="Clear draft"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>

            <div className="document-shell">
              <div className="document-tabs" role="tablist" aria-label="Transcript states">
                {(["raw", "reviewed", "export"] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    role="tab"
                    aria-selected={viewMode === mode}
                    className={viewMode === mode ? "document-tab is-active" : "document-tab"}
                    onClick={() => setViewMode(mode)}
                  >
                    {mode}
                    {mode === "reviewed" && acceptedCount > 0 && <span>{acceptedCount}</span>}
                  </button>
                ))}
                <div className="ml-auto hidden items-center gap-2 px-4 text-[#8f99a5] sm:flex">
                  <Keyboard className="h-3.5 w-3.5" />
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em]">⌘/Ctrl + R</span>
                </div>
              </div>

              <div className="paper-document">
                {!displayedText && !interimText ? (
                  <div className="empty-state">
                    <div className="brief-folio"><span>WORK PRODUCT · DRAFT</span><span>PAGE 01</span></div>
                    <div className="brief-margin-note"><span>ATTORNEY</span><span>REVIEW</span><span>REQUIRED</span></div>
                    <div className="empty-copy">
                      <img src={PRODUCT_MARK} alt="" className="mx-auto h-16 w-16 object-contain opacity-80" />
                      <DocketLabel>Ready for the record</DocketLabel>
                      <h3>Say the argument.<br />Keep the authority.</h3>
                      <p>Begin a live dictation, or load the synthetic Florida demonstration to inspect the complete review workflow.</p>
                      <div className="mt-6 flex flex-wrap justify-center gap-2">
                        <Button className="bg-[#13263b] text-white hover:bg-[#1b334d]" onClick={startRecording}><Mic className="mr-2 h-4 w-4" /> Begin dictation</Button>
                        <Button variant="outline" className="border-[#bda45d]/50 bg-transparent text-[#4c4432] hover:bg-[#d6b65d]/10" onClick={loadDemo}><Sparkles className="mr-2 h-4 w-4" /> Load demo</Button>
                      </div>
                    </div>
                  </div>
                ) : viewMode === "export" ? (
                  <div className="export-view">
                    <div className="export-letterhead">
                      <div>
                        <span className="font-display text-[22px] font-semibold">CounselScribe Draft</span>
                        <p>Attorney review required before use</p>
                      </div>
                      <img src={PRODUCT_MARK} alt="" className="h-10 w-10 object-contain" />
                    </div>
                    <DocketLabel>{documentTitle}</DocketLabel>
                    <p className="export-body">{reviewedText || "Review the transcript before export."}</p>
                    <div className="mt-8 flex flex-wrap gap-2">
                      <Button className="bg-[#13263b] text-white hover:bg-[#1b334d]" onClick={copyDraft}><Clipboard className="mr-2 h-4 w-4" /> Copy draft</Button>
                      <Button variant="outline" className="border-[#8d7b4b]/40 text-[#3d382d] hover:bg-[#d6b65d]/10" onClick={downloadDraft}><FileDown className="mr-2 h-4 w-4" /> Download .txt</Button>
                    </div>
                  </div>
                ) : (
                  <div className="transcript-editor-wrap">
                    <Textarea
                      value={displayedText}
                      onChange={(event) => viewMode === "raw" ? setRawText(event.target.value) : setReviewedText(event.target.value)}
                      className="transcript-editor"
                      aria-label={viewMode === "raw" ? "Raw transcript" : "Reviewed transcript"}
                    />
                    {viewMode === "raw" && interimText && <p className="interim-text">{interimText}</p>}
                  </div>
                )}
              </div>

              <div className="record-dock">
                <div className="hidden min-w-0 flex-1 items-center gap-3 md:flex">
                  <div className={isRecording ? "audio-status is-live" : "audio-status"}><Volume2 className="h-4 w-4" /></div>
                  <div className="min-w-0">
                    <DocketLabel>{isRecording ? "Listening · en-US" : recognitionSupported ? "Microphone ready" : "Scripted demo available"}</DocketLabel>
                    <Waveform active={isRecording} />
                  </div>
                </div>

                <button
                  className={isRecording ? "record-button is-recording" : "record-button"}
                  onClick={() => isRecording ? stopRecording() : startRecording()}
                  aria-label={isRecording ? "Stop dictation" : "Start dictation"}
                >
                  {isRecording ? <Square className="h-5 w-5 fill-current" /> : <img src={PRODUCT_MARK} alt="" className="record-seal" />}
                </button>

                <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
                  <div className="text-right">
                    <DocketLabel>Session</DocketLabel>
                    <p className="font-mono text-[15px] font-bold tracking-[0.1em] text-[#f6f1e7]">{formatTimer(elapsed)}</p>
                  </div>
                  <button className="icon-button hidden sm:grid" onClick={loadDemo} aria-label="Reset with scripted demo"><RotateCcw className="h-4 w-4" /></button>
                </div>
              </div>
            </div>
          </section>

          <aside className="review-docket">
            <div className="docket-heading">
              <div>
                <DocketLabel>Review docket</DocketLabel>
                <h2>Proposed changes</h2>
              </div>
              <StatusPill tone={openSuggestions.length ? "gold" : "green"}>{openSuggestions.length} open</StatusPill>
            </div>

            <div className="docket-summary">
              <div><strong>{legalResult.hits.reduce((total, hit) => total + hit.count, 0)}</strong><span>Legal terms</span></div>
              <div><strong>{suggestions.reduce((total, suggestion) => total + suggestion.count, 0)}</strong><span>Cleanups</span></div>
              <div><strong>{acceptedCount}</strong><span>Approved</span></div>
            </div>

            <div className="docket-scroll">
              {suggestions.length === 0 && legalResult.hits.length === 0 ? (
                <div className="docket-empty">
                  <CheckCircle2 className="h-8 w-8 text-[#d6b65d]" />
                  <h3>No changes queued</h3>
                  <p>Dictate or load the scripted demo. Legal matches and cleanup proposals will appear here.</p>
                </div>
              ) : (
                <>
                  {suggestions.map((suggestion) => {
                    const state = suggestionStates[suggestion.id] || "open";
                    return (
                      <article key={suggestion.id} className={`suggestion-card is-${state}`}>
                        <div className="suggestion-topline">
                          <span className="suggestion-kind">{suggestion.kind}</span>
                          <span className="font-mono text-[9px] text-[#8894a2]">{suggestion.confidence}%</span>
                        </div>
                        <h3>{suggestion.title}</h3>
                        <p className="suggestion-original">“{suggestion.original}”</p>
                        <p className="suggestion-reason">{suggestion.reason}</p>
                        {state === "open" ? (
                          <div className="suggestion-actions">
                            <button onClick={() => acceptSuggestion(suggestion.id)}><Check className="h-3.5 w-3.5" /> Accept</button>
                            <button onClick={() => keepOriginal(suggestion.id)}><Undo2 className="h-3.5 w-3.5" /> Keep original</button>
                          </div>
                        ) : (
                          <div className={state === "accepted" ? "decision-note accepted" : "decision-note kept"}>
                            {state === "accepted" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Undo2 className="h-3.5 w-3.5" />}
                            {state === "accepted" ? "Approved for reviewed draft" : "Original retained"}
                            <button onClick={() => setSuggestionStates((current) => ({ ...current, [suggestion.id]: "open" }))}>Undo</button>
                          </div>
                        )}
                      </article>
                    );
                  })}

                  {legalResult.hits.length > 0 && (
                    <div className="legal-hits-section">
                      <div className="flex items-center justify-between">
                        <DocketLabel>Legal glossary matches</DocketLabel>
                        <Scale className="h-4 w-4 text-[#d6b65d]" />
                      </div>
                      {legalResult.hits.map((hit) => (
                        <div key={hit.id} className="legal-hit">
                          <div className="min-w-0">
                            <p>{hit.replacement}</p>
                            <span>Heard “{hit.spoken}” · {hit.note}</span>
                          </div>
                          <StatusPill tone="gold">{hit.count}×</StatusPill>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="docket-footer">
              <Button variant="outline" className="w-full border-[#d6b65d]/30 bg-[#d6b65d]/5 text-[#e8d49d] hover:bg-[#d6b65d]/10" onClick={() => setTeachOpen(true)}><Plus className="mr-2 h-4 w-4" /> Teach a legal term</Button>
              <Button className="w-full bg-[#d6b65d] text-[#0b1521] hover:bg-[#e2c46f]" onClick={() => setViewMode("export")} disabled={!rawText.trim()}><FileDown className="mr-2 h-4 w-4" /> Prepare export</Button>
            </div>
          </aside>
        </main>
      </div>

      <Dialog open={teachOpen} onOpenChange={setTeachOpen}>
        <DialogContent className="border-[#d6b65d]/25 bg-[#0b1725] text-[#f7f1e5] sm:max-w-lg">
          <DialogHeader>
            <DocketLabel>Personal dictionary</DocketLabel>
            <DialogTitle className="font-display text-3xl">Teach CounselScribe a term</DialogTitle>
            <DialogDescription className="text-[#97a2ae]">The approved mapping stays in this browser profile and is applied before the shared Florida glossary.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-3">
            <div className="space-y-2"><Label htmlFor="heard" className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#c3a956]">What the system heard</Label><Input id="heard" value={spokenTerm} onChange={(event) => setSpokenTerm(event.target.value)} placeholder="e.g. and her son" className="border-white/10 bg-white/5" /></div>
            <div className="space-y-2"><Label htmlFor="correct" className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#c3a956]">Approved term or name</Label><Input id="correct" value={correctTerm} onChange={(event) => setCorrectTerm(event.target.value)} placeholder="e.g. Anderson" className="border-white/10 bg-white/5" /></div>
            {personalTerms.length > 0 && (
              <div className="border-l-2 border-[#d6b65d]/50 bg-white/[0.035] p-3">
                <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#8793a1]">Saved in this browser</p>
                <p className="mt-1 text-sm text-[#d8dde3]">{personalTerms.slice(0, 3).map((term) => term.replacement).join(" · ")}</p>
              </div>
            )}
          </div>
          <DialogFooter><Button variant="outline" className="border-white/10 bg-transparent" onClick={() => setTeachOpen(false)}>Cancel</Button><Button className="bg-[#d6b65d] text-[#0a1420] hover:bg-[#e2c46f]" onClick={addPersonalTerm}>Save approved term</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={privacyOpen} onOpenChange={setPrivacyOpen}>
        <DialogContent className="overflow-hidden border-[#d6b65d]/25 bg-[#0b1725] p-0 text-[#f7f1e5] sm:max-w-2xl">
          <DialogTitle className="sr-only">CounselScribe prototype privacy boundary</DialogTitle>
          <DialogDescription className="sr-only">Explains the privacy limits of browser speech processing and prohibits real client or privileged information in this proof of concept.</DialogDescription>
          <div className="privacy-visual relative min-h-52">
            <img src={PRODUCT_MARK} alt="" className="absolute right-8 top-1/2 h-32 w-32 -translate-y-1/2 object-contain opacity-35" />
            <div className="absolute inset-0 p-7 sm:p-9">
              <DocketLabel>Prototype boundary</DocketLabel>
              <h2 className="mt-3 max-w-sm font-display text-4xl font-semibold leading-none">Private by design.<br /><span className="text-[#d6b65d]">Not private yet.</span></h2>
            </div>
          </div>
          <div className="space-y-4 p-7 sm:p-9">
            <p className="leading-relaxed text-[#b9c1ca]">This proof of concept demonstrates the attorney review workflow. Live dictation may use the speech service built into your browser. Do not enter real client, privileged, confidential, or protected information.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="boundary-item"><CheckCircle2 className="h-4 w-4 text-[#c8c3b3]" /><span>Local browser dictionary</span></div>
              <div className="boundary-item"><CheckCircle2 className="h-4 w-4 text-[#c8c3b3]" /><span>No audio files stored by this app</span></div>
              <div className="boundary-item"><AlertTriangle className="h-4 w-4 text-[#d6b65d]" /><span>Browser speech service may process audio</span></div>
              <div className="boundary-item"><AlertTriangle className="h-4 w-4 text-[#d6b65d]" /><span>Not a production law-firm system</span></div>
            </div>
          </div>
          <DialogFooter className="border-t border-white/10 px-7 py-5 sm:px-9"><Button className="bg-[#d6b65d] text-[#0a1420] hover:bg-[#e2c46f]" onClick={() => setPrivacyOpen(false)}>I understand the demo boundary</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
