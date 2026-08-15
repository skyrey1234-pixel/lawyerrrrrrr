import { describe, expect, it, vi } from "vitest";
import { buildLiveUploadMetadata, LiveCaptureSession, type LiveRecorderLike } from "./liveCapture";

describe("authenticated live capture", () => {
  it("captures MediaRecorder chunks, stops microphone tracks, and returns a persistable live result", async () => {
    const stopTrack = vi.fn();
    const onReady = vi.fn();
    let clock = 1_000;
    const recorder: LiveRecorderLike = {
      mimeType: "audio/webm;codecs=opus",
      state: "inactive",
      ondataavailable: null,
      onstop: null,
      start: vi.fn(() => { recorder.state = "recording"; }),
      stop: vi.fn(() => { recorder.state = "inactive"; recorder.onstop?.(); }),
    };
    const capture = new LiveCaptureSession({
      getStream: async () => ({ getTracks: () => [{ stop: stopTrack }] }),
      createRecorder: () => recorder,
      now: () => clock,
      onReady,
    });

    await capture.start();
    recorder.ondataavailable?.({ data: new Blob(["legal audio"], { type: recorder.mimeType }) });
    clock = 4_250;
    capture.stop();

    expect(recorder.start).toHaveBeenCalledWith(500);
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(onReady).toHaveBeenCalledOnce();
    const result = onReady.mock.calls[0][0];
    expect(result.durationMs).toBe(3_250);
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.mimeType).toBe("audio/webm;codecs=opus");
  });

  it("builds an honest hosted live-session persistence payload", () => {
    const metadata = buildLiveUploadMetadata(
      new Blob(["legal audio"], { type: "audio/webm" }),
      7_500,
      new Date("2026-08-15T21:00:00.000Z"),
    );
    expect(metadata).toEqual({
      fileName: "live-dictation-2026-08-15T21-00-00-000Z.webm",
      mimeType: "audio/webm",
      durationMs: 7_500,
      processingMode: "hosted",
      sourceType: "live",
    });
  });
});
