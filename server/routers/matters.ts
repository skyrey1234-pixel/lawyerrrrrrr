import { protectedProcedure, router } from "../_core/trpc";
import {
  addGlossaryTerm,
  addMatterEntity,
  createMatter,
  ensureWorkspace,
  getMatterBundle,
  listMattersForUser,
  listTemplates,
} from "../counselscribeDb";
import { z } from "zod";

export const mattersRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    await ensureWorkspace(ctx.user);
    return listMattersForUser(ctx.user.id);
  }),
  get: protectedProcedure.input(z.object({ matterId: z.number().int().positive() })).query(({ ctx, input }) => getMatterBundle(ctx.user.id, input.matterId)),
  create: protectedProcedure
    .input(z.object({
      name: z.string().trim().min(2).max(220),
      matterNumber: z.string().trim().min(1).max(80),
      clientName: z.string().trim().min(2).max(220),
      jurisdiction: z.string().trim().min(2).max(120),
      practiceArea: z.string().trim().min(2).max(160),
      description: z.string().trim().max(4000).optional(),
    }))
    .mutation(async ({ ctx, input }) => ({ matterId: await createMatter(ctx.user, input) })),
  addEntity: protectedProcedure
    .input(z.object({
      matterId: z.number().int().positive(),
      entityType: z.enum(["party", "attorney", "expert", "organization", "medical_provider", "judge", "other"]),
      displayName: z.string().trim().min(2).max(240),
      aliases: z.array(z.string().trim().min(1).max(240)).max(25).default([]),
      notes: z.string().trim().max(2000).optional(),
    }))
    .mutation(async ({ ctx, input }) => ({ entityId: await addMatterEntity(ctx.user.id, input) })),
  addTerm: protectedProcedure
    .input(z.object({
      matterId: z.number().int().positive().optional(),
      scope: z.enum(["firm", "matter", "user"]),
      heardPhrase: z.string().trim().min(1).max(320),
      approvedText: z.string().trim().min(1).max(320),
      category: z.string().trim().min(1).max(100).default("Custom"),
      notes: z.string().trim().max(2000).optional(),
      sourceDecisionId: z.number().int().positive().optional(),
    }))
    .mutation(async ({ ctx, input }) => ({ termId: await addGlossaryTerm(ctx.user.id, input) })),
  templates: protectedProcedure.query(async ({ ctx }) => {
    await ensureWorkspace(ctx.user);
    return listTemplates(ctx.user.id);
  }),
});

