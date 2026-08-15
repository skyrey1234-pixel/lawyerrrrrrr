import { protectedProcedure, router } from "../_core/trpc";
import {
  ensureWorkspace,
  getFirmAdminBundle,
  listAuditForUser,
  listComparisons,
  listMattersForUser,
  listSessionsForUser,
  updateFirmSettings,
} from "../counselscribeDb";
import { z } from "zod";

export const workspaceRouter = router({
  bootstrap: protectedProcedure.mutation(({ ctx }) => ensureWorkspace(ctx.user)),
  dashboard: protectedProcedure.query(async ({ ctx }) => {
    await ensureWorkspace(ctx.user);
    const [matters, sessions, comparisons, administration] = await Promise.all([
      listMattersForUser(ctx.user.id),
      listSessionsForUser(ctx.user.id),
      listComparisons(ctx.user.id),
      getFirmAdminBundle(ctx.user.id),
    ]);
    return { matters, sessions, comparisons, firm: administration.firm, membership: administration.membership };
  }),
  audit: protectedProcedure
    .input(z.object({ limit: z.number().int().min(1).max(250).default(100) }))
    .query(({ ctx, input }) => listAuditForUser(ctx.user.id, input.limit)),
  administration: protectedProcedure.query(({ ctx }) => getFirmAdminBundle(ctx.user.id)),
  updateSettings: protectedProcedure
    .input(z.object({
      defaultProcessingMode: z.enum(["browser", "hosted", "local"]),
      retentionDays: z.number().int().min(1).max(3650),
      audioRetention: z.enum(["keep", "delete_after_transcription", "manual"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await updateFirmSettings(ctx.user.id, input);
      return { success: true };
    }),
});

