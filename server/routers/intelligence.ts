import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  completeAnalysisRun,
  createAnalysisRun,
  createSourceDocument,
  createTranscriptSource,
  failAnalysisRun,
  getMatterIntelligence,
  reviewAnalysisItem,
} from "../billingDb";
import { assertMatterAccess } from "../counselscribeDb";
import { analyzeMatterText, MATTER_AI_MODEL, MATTER_AI_PROMPT_VERSION } from "../matterIntelligence";

async function runAnalysis(userId: number, input: { matterId: number; sourceDocumentId: number; content: string }) {
  const access = await assertMatterAccess(userId, input.matterId);
  const run = await createAnalysisRun(userId, { matterId: input.matterId, sourceDocumentId: input.sourceDocumentId, modelId: MATTER_AI_MODEL, promptVersion: MATTER_AI_PROMPT_VERSION });
  try {
    const analyzed = await analyzeMatterText({ matterName: access.matter.name, matterNumber: access.matter.matterNumber, clientName: access.matter.clientName, jurisdiction: access.matter.jurisdiction, content: input.content });
    const completed = await completeAnalysisRun(userId, { analysisRunId: run.id, modelId: analyzed.modelId, result: analyzed.result, inputTokens: analyzed.inputTokens, outputTokens: analyzed.outputTokens });
    return { analysisRunId: run.id, ...completed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Matter AI analysis failed";
    await failAnalysisRun(userId, run.id, message);
    throw error;
  }
}

export const intelligenceRouter = router({
  get: protectedProcedure.input(z.object({ matterId: z.number().int().positive() })).query(({ ctx, input }) => getMatterIntelligence(ctx.user.id, input.matterId)),
  analyzeText: protectedProcedure.input(z.object({ matterId: z.number().int().positive(), title: z.string().trim().min(2).max(240), content: z.string().trim().min(20).max(60_000) })).mutation(async ({ ctx, input }) => {
    const sourceDocumentId = await createSourceDocument(ctx.user.id, { matterId: input.matterId, title: input.title, sourceType: "pasted_text", content: input.content, mimeType: "text/plain" });
    return runAnalysis(ctx.user.id, { matterId: input.matterId, sourceDocumentId, content: input.content });
  }),
  analyzeTranscript: protectedProcedure.input(z.object({ matterId: z.number().int().positive(), sessionId: z.number().int().positive(), title: z.string().trim().min(2).max(240) })).mutation(async ({ ctx, input }) => {
    const sourceDocumentId = await createTranscriptSource(ctx.user.id, input);
    const bundle = await getMatterIntelligence(ctx.user.id, input.matterId);
    const source = bundle.documents.find(document => document.id === sourceDocumentId);
    if (!source) throw new Error("Transcript source could not be loaded");
    return runAnalysis(ctx.user.id, { matterId: input.matterId, sourceDocumentId, content: source.contentSnapshot });
  }),
  reviewItem: protectedProcedure.input(z.object({ itemId: z.number().int().positive(), status: z.enum(["accepted", "rejected"]), billingCodeId: z.number().int().positive().optional() })).mutation(({ ctx, input }) => reviewAnalysisItem(ctx.user.id, input)),
});
