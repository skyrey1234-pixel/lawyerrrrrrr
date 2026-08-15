import { EmptyState, PageFrame, PageHeader, ProcessingBadge, PrivacyBoundary } from "@/components/PilotUI";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { buildLiveUploadMetadata, LiveCaptureSession, type LiveRecorderLike } from "@/lib/liveCapture";
import { trpc } from "@/lib/trpc";
import { AudioLines, CircleStop, FileAudio, HardDrive, Mic, Plus, ShieldAlert, Sparkles, Upload } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",").at(-1) || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function formatDuration(durationMs: number) {
  const seconds = Math.round(durationMs / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

export default function Sessions() {
  const [, setLocation] = useLocation();
  const queryMatter = Number(new URLSearchParams(window.location.search).get("matter") || 0);
  const sessions = trpc.sessions.list.useQuery();
  const matters = trpc.matters.list.useQuery();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [recordOpen, setRecordOpen] = useState(false);
  const [matterId, setMatterId] = useState(queryMatter || 0);
  const [title, setTitle] = useState("Recorded legal dictation");
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"hosted" | "local">("hosted");
  const [liveTitle, setLiveTitle] = useState("Live attorney dictation");
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordedDurationMs, setRecordedDurationMs] = useState(0);
  const captureRef = useRef<LiveCaptureSession | null>(null);
  const selectedMatterId = useMemo(() => matterId || matters.data?.[0]?.id || 0, [matterId, matters.data]);

  const upload = trpc.sessions.uploadAudio.useMutation({
    onSuccess: data => {
      toast.success(data.localCompanionRequired ? "Audio saved. Local transcription is waiting for the Mac mini companion." : "Audio secured. Open the session to begin hosted transcription.");
      setUploadOpen(false);
      setRecordOpen(false);
      setFile(null);
      setRecordedBlob(null);
      setRecordedDurationMs(0);
      setLocation(`/sessions/${data.sessionId}`);
    },
    onError: error => toast.error(error.message),
  });
  const createDemo = trpc.sessions.createDemo.useMutation({
    onSuccess: data => setLocation(`/sessions/${data.sessionId}`),
    onError: error => toast.error(error.message),
  });

  useEffect(() => () => captureRef.current?.destroy(), []);

  const submitUpload = async () => {
    if (!file || !selectedMatterId) return;
    if (file.size > 16 * 1024 * 1024) {
      toast.error("The hosted transcription limit is 16 MB per audio file.");
      return;
    }
    const base64Data = await fileToBase64(file);
    upload.mutate({ matterId: selectedMatterId, title, fileName: file.name, mimeType: file.type || "audio/mpeg", base64Data, processingMode: mode, sourceType: "upload", durationMs: 0 });
  };

  const startLiveRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("This browser cannot capture a persistent audio session. Use Upload audio or the browser demo.");
      return;
    }
    try {
      const preferredType = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find(type => MediaRecorder.isTypeSupported(type));
      const capture = new LiveCaptureSession({
        getStream: () => navigator.mediaDevices.getUserMedia({ audio: true }),
        createRecorder: stream => new MediaRecorder(stream as MediaStream, preferredType ? { mimeType: preferredType } : undefined) as unknown as LiveRecorderLike,
        onStart: () => setIsRecording(true),
        onReady: result => {
          setRecordedDurationMs(result.durationMs);
          setRecordedBlob(result.blob);
          setIsRecording(false);
        },
      });
      captureRef.current?.destroy();
      captureRef.current = capture;
      setRecordedBlob(null);
      setRecordedDurationMs(0);
      await capture.start();
      toast.success("Live audio capture started. The recording stays in the browser until you save the session.");
    } catch {
      toast.error("Microphone access was blocked. Allow permission or upload an approved audio file.");
    }
  };

  const stopLiveRecording = () => {
    captureRef.current?.stop();
  };

  const saveLiveSession = async () => {
    if (!recordedBlob || !selectedMatterId) return;
    const metadata = buildLiveUploadMetadata(recordedBlob, recordedDurationMs);
    const recordedFile = new File([recordedBlob], metadata.fileName, { type: metadata.mimeType });
    const base64Data = await fileToBase64(recordedFile);
    upload.mutate({
      matterId: selectedMatterId,
      title: liveTitle,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      base64Data,
      processingMode: metadata.processingMode,
      sourceType: metadata.sourceType,
      durationMs: metadata.durationMs,
    });
  };

  return (
    <PageFrame>
      <PageHeader
        eyebrow="Session ledger"
        title="Dictation sessions"
        description="Upload approved audio, capture a live matter-linked recording, create synthetic demonstrations, disclose the processing path, and preserve every transcript state under the correct matter."
        actions={
          <>
            <Button variant="outline" className="border-white/15 bg-transparent" disabled={!selectedMatterId || createDemo.isPending} onClick={() => createDemo.mutate({ matterId: selectedMatterId })}><Sparkles className="mr-2 h-4 w-4" /> Synthetic session</Button>
            <Button variant="outline" className="border-[#d6b65d]/35 bg-[#d6b65d]/5 text-[#e5cf8e]" onClick={() => setRecordOpen(true)}><Mic className="mr-2 h-4 w-4" /> Record live</Button>
            <Button className="bg-[#d6b65d] text-[#07111d]" onClick={() => setUploadOpen(true)}><Upload className="mr-2 h-4 w-4" /> Upload audio</Button>
          </>
        }
      />

      <div className="mb-7 grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="border-l-2 border-[#d6b65d]/55 bg-white/[0.03] p-5"><AudioLines className="h-4 w-4 text-[#d6b65d]" /><strong className="mt-3 block font-display text-3xl">{sessions.data?.length || 0}</strong><span className="text-xs text-[#8d99a6]">Total sessions</span></div>
          <div className="border-l-2 border-[#a4564d]/70 bg-white/[0.03] p-5"><ShieldAlert className="h-4 w-4 text-[#dc978e]" /><strong className="mt-3 block font-display text-3xl">{sessions.data?.filter(item => item.session.status === "review").length || 0}</strong><span className="text-xs text-[#8d99a6]">Awaiting attorney review</span></div>
          <div className="border-l-2 border-[#aeb3a2]/55 bg-white/[0.03] p-5"><HardDrive className="h-4 w-4 text-[#d2d6c8]" /><strong className="mt-3 block font-display text-3xl">0</strong><span className="text-xs text-[#8d99a6]">Local devices connected</span></div>
        </div>
        <PrivacyBoundary />
      </div>

      {sessions.data?.length ? (
        <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
          {sessions.data.map(({ session, matter }) => (
            <button key={session.id} onClick={() => setLocation(`/sessions/${session.id}`)} className="border border-white/10 bg-[#0a1827] p-5 text-left shadow-[0_18px_55px_rgba(0,0,0,.18)] transition hover:border-[#d6b65d]/35">
              <div className="flex items-start justify-between gap-3"><ProcessingBadge mode={session.processingMode} /><span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[#9da8b4]">{session.status}</span></div>
              <h2 className="mt-5 font-display text-2xl font-semibold text-[#f4eee2]">{session.title}</h2>
              <p className="mt-2 text-xs leading-relaxed text-[#909ca9]">{matter.name}</p>
              <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/8 pt-4 font-mono text-[9px] uppercase tracking-[0.11em] text-[#7f8b98]"><span>{session.wordCount} words</span><span>{formatDuration(session.durationMs)}</span><span>{session.sourceType}</span></div>
            </button>
          ))}
        </div>
      ) : <EmptyState title="No dictation sessions" description="Start with the synthetic Florida demonstration, record a live session, or upload a firm-approved test file." action={{ label: "Record live", onClick: () => setRecordOpen(true) }} />}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="border-[#d6b65d]/25 bg-[#0b1725] text-[#f7f1e5] sm:max-w-xl">
          <DialogHeader><DialogTitle className="font-display text-3xl">Add an audio session</DialogTitle><DialogDescription className="text-[#97a2ae]">Supported formats: WebM, MP3, WAV, OGG, M4A. Hosted transcription accepts files up to 16 MB.</DialogDescription></DialogHeader>
          <div className="space-y-5 py-3">
            <div className="space-y-2"><Label>Matter</Label><Select value={selectedMatterId ? String(selectedMatterId) : undefined} onValueChange={value => setMatterId(Number(value))}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue placeholder="Select matter" /></SelectTrigger><SelectContent>{matters.data?.map(matter => <SelectItem key={matter.id} value={String(matter.id)}>{matter.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="session-title">Session title</Label><Input id="session-title" value={title} onChange={event => setTitle(event.target.value)} className="border-white/10 bg-white/5" /></div>
            <div className="space-y-2"><Label htmlFor="audio-file">Audio file</Label><Input id="audio-file" type="file" accept="audio/webm,audio/mpeg,audio/mp3,audio/wav,audio/ogg,audio/m4a,audio/mp4" onChange={event => setFile(event.target.files?.[0] || null)} className="border-white/10 bg-white/5 file:text-[#d6b65d]" />{file ? <p className="text-xs text-[#8f9aa7]"><FileAudio className="mr-1 inline h-3.5 w-3.5" />{file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB</p> : null}</div>
            <div className="space-y-2"><Label>Processing path</Label><Select value={mode} onValueChange={value => setMode(value as typeof mode)}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="hosted">Hosted transcription — available now</SelectItem><SelectItem value="local">Mac mini companion — not connected</SelectItem></SelectContent></Select>{mode === "local" ? <p className="border-l-2 border-[#d6b65d]/60 bg-[#d6b65d]/8 p-3 text-xs leading-relaxed text-[#d7c793]">The file can be saved, but it will not be transcribed until the local service is installed and verified.</p> : <p className="text-xs leading-relaxed text-[#8f9aa7]">Audio is stored in the protected workspace and sent to the managed speech service when you explicitly start transcription.</p>}</div>
          </div>
          <DialogFooter><Button variant="outline" className="border-white/15 bg-transparent" onClick={() => setUploadOpen(false)}>Cancel</Button><Button className="bg-[#d6b65d] text-[#07111d]" disabled={!file || !selectedMatterId || !title || upload.isPending} onClick={submitUpload}>{upload.isPending ? "Securing audio…" : <><Plus className="mr-2 h-4 w-4" /> Create session</>}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={recordOpen} onOpenChange={next => { if (!isRecording) setRecordOpen(next); }}>
        <DialogContent className="border-[#d6b65d]/25 bg-[#0b1725] text-[#f7f1e5] sm:max-w-xl">
          <DialogHeader><DialogTitle className="font-display text-3xl">Capture live dictation</DialogTitle><DialogDescription className="text-[#97a2ae]">The microphone is captured in this browser. Audio is not uploaded until you stop and explicitly save. Saved live sessions use hosted transcription until the Mac mini companion is connected.</DialogDescription></DialogHeader>
          <div className="space-y-5 py-3">
            <div className="space-y-2"><Label>Matter</Label><Select value={selectedMatterId ? String(selectedMatterId) : undefined} onValueChange={value => setMatterId(Number(value))} disabled={isRecording}><SelectTrigger className="border-white/10 bg-white/5"><SelectValue placeholder="Select matter" /></SelectTrigger><SelectContent>{matters.data?.map(matter => <SelectItem key={matter.id} value={String(matter.id)}>{matter.name}</SelectItem>)}</SelectContent></Select></div>
            <div className="space-y-2"><Label htmlFor="live-session-title">Session title</Label><Input id="live-session-title" value={liveTitle} onChange={event => setLiveTitle(event.target.value)} disabled={isRecording} className="border-white/10 bg-white/5" /></div>
            <div className={`border p-6 text-center ${isRecording ? "border-[#a4564d]/60 bg-[#a4564d]/10" : "border-white/12 bg-white/[0.025]"}`}>
              <div className={`mx-auto grid h-16 w-16 place-items-center rounded-full border ${isRecording ? "animate-pulse border-[#e19b92] bg-[#a4564d]/25 text-[#f0b1a9]" : "border-[#d6b65d]/40 bg-[#d6b65d]/10 text-[#d6b65d]"}`}>{isRecording ? <CircleStop className="h-7 w-7" /> : <Mic className="h-7 w-7" />}</div>
              <strong className="mt-4 block font-display text-2xl">{isRecording ? "Listening" : recordedBlob ? "Recording ready" : "Ready to capture"}</strong>
              <p className="mt-2 text-xs text-[#8f9aa7]">{recordedBlob ? `${formatDuration(recordedDurationMs)} captured · browser capture → hosted transcription` : "No audio leaves the browser before you save."}</p>
              <Button className={`mt-5 ${isRecording ? "bg-[#a4564d] text-white hover:bg-[#b6655c]" : "bg-[#d6b65d] text-[#07111d]"}`} onClick={isRecording ? stopLiveRecording : startLiveRecording}>{isRecording ? <><CircleStop className="mr-2 h-4 w-4" /> Stop recording</> : <><Mic className="mr-2 h-4 w-4" /> {recordedBlob ? "Record again" : "Start recording"}</>}</Button>
            </div>
          </div>
          <DialogFooter><Button variant="outline" className="border-white/15 bg-transparent" disabled={isRecording} onClick={() => setRecordOpen(false)}>Cancel</Button><Button className="bg-[#d6b65d] text-[#07111d]" disabled={!recordedBlob || !selectedMatterId || !liveTitle || upload.isPending} onClick={saveLiveSession}>{upload.isPending ? "Securing live audio…" : "Save live session"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </PageFrame>
  );
}
