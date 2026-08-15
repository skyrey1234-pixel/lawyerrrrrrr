export type LiveCaptureStream = {
  getTracks: () => Array<{ stop: () => void }>;
};

export type LiveRecorderLike = {
  mimeType: string;
  state: string;
  ondataavailable: ((event: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
  start: (timeslice?: number) => void;
  stop: () => void;
};

export type LiveCaptureResult = {
  blob: Blob;
  durationMs: number;
  mimeType: string;
};

type LiveCaptureDependencies = {
  getStream: () => Promise<LiveCaptureStream>;
  createRecorder: (stream: LiveCaptureStream) => LiveRecorderLike;
  now?: () => number;
  onStart?: () => void;
  onReady: (result: LiveCaptureResult) => void;
};

export class LiveCaptureSession {
  private readonly now: () => number;
  private stream: LiveCaptureStream | null = null;
  private recorder: LiveRecorderLike | null = null;
  private chunks: Blob[] = [];
  private startedAt = 0;

  constructor(private readonly dependencies: LiveCaptureDependencies) {
    this.now = dependencies.now ?? Date.now;
  }

  async start() {
    this.stream = await this.dependencies.getStream();
    this.recorder = this.dependencies.createRecorder(this.stream);
    this.chunks = [];
    this.recorder.ondataavailable = event => {
      if (event.data.size) this.chunks.push(event.data);
    };
    this.recorder.onstop = () => {
      const mimeType = this.recorder?.mimeType || "audio/webm";
      const result = {
        blob: new Blob(this.chunks, { type: mimeType }),
        durationMs: Math.max(0, this.now() - this.startedAt),
        mimeType,
      };
      this.stopTracks();
      this.dependencies.onReady(result);
    };
    this.startedAt = this.now();
    this.recorder.start(500);
    this.dependencies.onStart?.();
  }

  stop() {
    if (this.recorder?.state === "recording") this.recorder.stop();
  }

  destroy() {
    this.stop();
    this.stopTracks();
  }

  private stopTracks() {
    this.stream?.getTracks().forEach(track => track.stop());
    this.stream = null;
  }
}

export function buildLiveUploadMetadata(blob: Blob, durationMs: number, now = new Date()) {
  const extension = blob.type.includes("mp4") ? "m4a" : "webm";
  return {
    fileName: `live-dictation-${now.toISOString().replace(/[:.]/g, "-")}.${extension}`,
    mimeType: blob.type || "audio/webm",
    durationMs,
    processingMode: "hosted" as const,
    sourceType: "live" as const,
  };
}
