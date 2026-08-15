import { createHash } from "node:crypto";
import { normalizeLegalDictation } from "@shared/counselscribe";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { transcribeAudio } from "../_core/voiceTranscription";
import {
  addGlossaryTerm,
  appendAudit,
  attachAudioAsset,
  createSession,
  getAudioForSession,
  getSessionBundle,
  listSessionsForUser,
  replaceTranscriptSegments,
  saveReviewDecision,
  saveVersion,
  updateSession,
} from "../counselscribeDb";
import { storageGetSignedUrl, storagePut } from "../storage";
import { generateLegalDocx } from "../wordExport";

const MAX_AUDIO_BYTES = 16 * 1024 * 1024;
const ALLOWED_AUDIO = new Set(["audio/webm", "audio/mpeg", "audio/mp3", "audio/wav", "audio/wave", "audio/ogg", "audio/m4a", "audio/mp4"]);

const DEMO_SEGMENTS = [
  { sequence: 0, startMs: 0, endMs: 5200, sourceText: "um please prepare a motion and lemonade regarding settlement negotiations comma", confidence: 0.91 },
  { sequence: 1, startMs: 5200, endMs: 11100, sourceText: "strike that the motion should cite Florida statute ninety point four zero eight period", confidence: 0.88 },
  { sequence: 2, startMs: 11100, endMs: 16800, sourceText: "the record on a peel in Jones at all supports exclusion of the offer period", confidence: 0.86 },
];

export const sessionsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listSessionsForUser(ctx.user.id)),
  get: protectedProcedure.input(z.object({ sessionId: z.number().int().positive() })).query(({ ctx, input }) => getSessionBundle(ctx.user.id, input.sessionId)),
  create: protectedProcedure
    .input(z.object({
      matterId: z.number().int().positive(),
      title: z.string().trim().min(2).max(240),
      sourceType: z.enum(["live", "upload"]),
      processingMode: z.enum(["browser", "hosted", "local"]),
    }))
    .mutation(async ({ ctx, input }) => ({ sessionId: await createSession(ctx.user.id, input) })),
  createDemo: protectedProcedure
    .input(z.object({ matterId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const sessionId = await createSession(ctx.user.id, {
        matterId: input.matterId,
        title: "Synthetic Florida motion dictation",
        sourceType: "demo",
        processingMode: "browser",
        status: "review",
        durationMs: DEMO_SEGMENTS.at(-1)?.endMs ?? 0,
      });
      const bundle = await getSessionBundle(ctx.user.id, sessionId);
      const segments = DEMO_SEGMENTS.map(segment => ({
        ...segment,
        normalizedText: normalizeLegalDictation(segment.sourceText, bundle.terms),
      }));
      await replaceTranscriptSegments(ctx.user.id, sessionId, segments);
      const raw = segments.map(segment => segment.sourceText).join(" ");
      const normalized = segments.map(segment => segment.normalizedText).join(" ");
      await saveVersion(ctx.user.id, { sessionId, kind: "raw", content: raw });
      await saveVersion(ctx.user.id, { sessionId, kind: "normalized", content: normalized });
      await updateSession(ctx.user.id, sessionId, { wordCount: normalized.split(/\s+/).filter(Boolean).length });
      return { sessionId };
    }),
  uploadAudio: protectedProcedure
    .input(z.object({
      matterId: z.number().int().positive(),
      title: z.string().trim().min(2).max(240),
      fileName: z.string().trim().min(1).max(255),
      mimeType: z.string().trim().min(1).max(120),
      base64Data: z.string().min(1),
      durationMs: z.number().int().min(0).max(24 * 60 * 60 * 1000).default(0),
      processingMode: z.enum(["hosted", "local"]).default("hosted"),
      sourceType: z.enum(["upload", "live"]).default("upload"),
    }))
    .mutation(async ({ ctx, input }) => {
      if (!ALLOWED_AUDIO.has(input.mimeType)) throw new TRPCError({ code: "BAD_REQUEST", message: "Unsupported audio format" });
      const bytes = Buffer.from(input.base64Data.replace(/^data:[^;]+;base64,/, ""), "base64");
      if (!bytes.length || bytes.length > MAX_AUDIO_BYTES) throw new TRPCError({ code: "BAD_REQUEST", message: "Audio must be between 1 byte and 16 MB" });
      const sessionId = await createSession(ctx.user.id, {
        matterId: input.matterId,
        title: input.title,
        sourceType: input.sourceType,
        processingMode: input.processingMode,
        status: input.processingMode === "local" ? "uploaded" : "uploaded",
        durationMs: input.durationMs,
      });
      const safeName = input.fileName.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const object = await storagePut(`counselscribe/sessions/${sessionId}/audio/${safeName}`, bytes, input.mimeType);
      await attachAudioAsset(ctx.user.id, {
        sessionId,
        storageKey: object.key,
        storageUrl: object.url,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: bytes.length,
        durationMs: input.durationMs,
        checksumSha256: createHash("sha256").update(bytes).digest("hex"),
      });
      return { sessionId, processingMode: input.processingMode, localCompanionRequired: input.processingMode === "local" };
    }),
  transcribeHosted: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const bundle = await getSessionBundle(ctx.user.id, input.sessionId);
      if (bundle.session.processingMode === "local") {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "The Mac mini companion is not connected. Switch this session to hosted processing or connect the local service." });
      }
      const audio = await getAudioForSession(ctx.user.id, input.sessionId);
      if (!audio) throw new TRPCError({ code: "NOT_FOUND", message: "Audio file not found" });
      await updateSession(ctx.user.id, input.sessionId, { status: "transcribing", startedAt: new Date(), errorMessage: null });
      try {
        const signedUrl = await storageGetSignedUrl(audio.storageKey);
        const termPrompt = bundle.terms.slice(0, 80).map(term => term.approvedText).join(", ");
        const result = await transcribeAudio({
          audioUrl: signedUrl,
          language: "en",
          prompt: `Florida legal dictation. Preserve meaning and use exact terminology when spoken: ${termPrompt}`,
        });
        if ("error" in result) throw new Error(`${result.error}${result.details ? `: ${result.details}` : ""}`);
        const segments = result.segments.map((segment, sequence) => ({
          sequence,
          startMs: Math.round(segment.start * 1000),
          endMs: Math.round(segment.end * 1000),
          sourceText: segment.text.trim(),
          normalizedText: normalizeLegalDictation(segment.text.trim(), bundle.terms),
          confidence: Math.max(0, Math.min(1, Math.exp(segment.avg_logprob))),
        }));
        await replaceTranscriptSegments(ctx.user.id, input.sessionId, segments);
        await saveVersion(ctx.user.id, { sessionId: input.sessionId, kind: "raw", content: result.text.trim() });
        const normalized = segments.map(segment => segment.normalizedText).join(" ");
        await saveVersion(ctx.user.id, { sessionId: input.sessionId, kind: "normalized", content: normalized });
        await updateSession(ctx.user.id, input.sessionId, {
          status: "review",
          durationMs: Math.round(result.duration * 1000),
          wordCount: normalized.split(/\s+/).filter(Boolean).length,
          completedAt: new Date(),
        });
        return { text: normalized, segmentCount: segments.length, durationMs: Math.round(result.duration * 1000) };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Transcription failed";
        await updateSession(ctx.user.id, input.sessionId, { status: "failed", errorMessage: message });
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message });
      }
    }),
  recordDecision: protectedProcedure
    .input(z.object({
      sessionId: z.number().int().positive(),
      segmentId: z.number().int().positive().optional(),
      documentVersionId: z.number().int().positive().optional(),
      decisionType: z.enum(["accept", "reject", "manual_edit", "restore", "teach_term"]),
      category: z.string().trim().min(1).max(80),
      originalText: z.string().max(100000),
      replacementText: z.string().max(100000).optional(),
      reason: z.string().max(4000).optional(),
      confidence: z.number().min(0).max(1).optional(),
      audioStartMs: z.number().int().min(0).optional(),
      audioEndMs: z.number().int().min(0).optional(),
      reviewedContent: z.string().max(200000).optional(),
      teachScope: z.enum(["firm", "matter", "user"]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const bundle = await getSessionBundle(ctx.user.id, input.sessionId);
      const decisionId = await saveReviewDecision(ctx.user.id, input);
      if (input.decisionType === "teach_term" && input.replacementText && input.teachScope) {
        await addGlossaryTerm(ctx.user.id, {
          matterId: bundle.matter.id,
          scope: input.teachScope,
          heardPhrase: input.originalText,
          approvedText: input.replacementText,
          category: input.category,
          sourceDecisionId: decisionId,
        });
      }
      const version = input.reviewedContent
        ? await saveVersion(ctx.user.id, { sessionId: input.sessionId, kind: "reviewed", content: input.reviewedContent, decisionCount: bundle.decisions.length + 1 })
        : null;
      return { decisionId, version };
    }),
  saveReviewed: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive(), content: z.string().trim().min(1).max(200000) }))
    .mutation(async ({ ctx, input }) => saveVersion(ctx.user.id, { sessionId: input.sessionId, kind: "reviewed", content: input.content })),
  restoreVersion: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive(), versionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const bundle = await getSessionBundle(ctx.user.id, input.sessionId);
      const source = bundle.versions.find(version => version.id === input.versionId);
      if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Version not found" });
      await saveReviewDecision(ctx.user.id, { sessionId: input.sessionId, documentVersionId: source.id, decisionType: "restore", category: "Version", originalText: source.content, replacementText: source.content });
      return saveVersion(ctx.user.id, { sessionId: input.sessionId, kind: "reviewed", content: source.content, restoredFromVersionId: source.id });
    }),
  exportDocx: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive(), documentTitle: z.string().trim().min(2).max(240).default("Attorney Memorandum") }))
    .mutation(async ({ ctx, input }) => {
      const bundle = await getSessionBundle(ctx.user.id, input.sessionId);
      const source = bundle.versions.find(version => version.kind === "reviewed") ?? bundle.versions.find(version => version.kind === "normalized");
      if (!source) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Review or normalize the transcript before exporting" });
      const bytes = await generateLegalDocx({
        firmName: bundle.firm.name,
        matterName: bundle.matter.name,
        matterNumber: bundle.matter.matterNumber,
        jurisdiction: bundle.matter.jurisdiction,
        documentTitle: input.documentTitle,
        content: source.content,
        authorName: ctx.user.name,
      });
      const safeTitle = input.documentTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
      const object = await storagePut(`counselscribe/sessions/${input.sessionId}/exports/${safeTitle}.docx`, bytes, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      await saveVersion(ctx.user.id, { sessionId: input.sessionId, kind: "exported", content: source.content });
      await appendAudit({ firmId: bundle.firm.id, actorUserId: ctx.user.id, matterId: bundle.matter.id, sessionId: input.sessionId, eventType: "document.exported", resourceType: "docx", resourceId: object.key, metadata: { documentTitle: input.documentTitle } });
      return { url: object.url, fileName: `${safeTitle}.docx` };
    }),
});
