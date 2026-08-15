import { legalTermAccuracy, wordErrorRate } from "@shared/counselscribe";
import { protectedProcedure, router } from "../_core/trpc";
import {
  createComparison,
  getMatterBundle,
  listComparisons,
} from "../counselscribeDb";
import { z } from "zod";

export const comparisonsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listComparisons(ctx.user.id)),
  create: protectedProcedure
    .input(z.object({
      matterId: z.number().int().positive(),
      sessionId: z.number().int().positive().optional(),
      label: z.string().trim().min(2).max(220),
      dragonTranscript: z.string().trim().min(1).max(100000),
      counselTranscript: z.string().trim().min(1).max(100000),
      referenceTranscript: z.string().trim().min(1).max(100000).optional(),
      correctionMinutesDragon: z.number().min(0).max(10000).optional(),
      correctionMinutesCounsel: z.number().min(0).max(10000).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const bundle = await getMatterBundle(ctx.user.id, input.matterId);
      const reference = input.referenceTranscript;
      const dragonWer = reference ? wordErrorRate(input.dragonTranscript, reference) : undefined;
      const counselWer = reference ? wordErrorRate(input.counselTranscript, reference) : undefined;
      const termAccuracy = reference
        ? legalTermAccuracy(input.counselTranscript, reference, bundle.terms)
        : undefined;
      const timeSavedMinutes = input.correctionMinutesDragon != null && input.correctionMinutesCounsel != null
        ? Math.max(0, input.correctionMinutesDragon - input.correctionMinutesCounsel)
        : undefined;
      const correctionBurden = reference
        ? Number(((counselWer ?? 0) / 100).toFixed(3))
        : undefined;
      const comparisonId = await createComparison(ctx.user.id, {
        matterId: input.matterId,
        sessionId: input.sessionId,
        label: input.label,
        dragonTranscript: input.dragonTranscript,
        counselTranscript: input.counselTranscript,
        referenceTranscript: reference,
        dragonWer,
        counselWer,
        legalTermAccuracy: termAccuracy,
        correctionBurden,
        timeSavedMinutes,
      });
      return { comparisonId, metrics: { dragonWer, counselWer, legalTermAccuracy: termAccuracy, timeSavedMinutes } };
    }),
});

