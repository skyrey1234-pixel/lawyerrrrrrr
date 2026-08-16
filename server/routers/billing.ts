import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  cancelBillingTimer,
  createBillingEntry,
  getActiveTimer,
  getApprovedEntriesForExport,
  listBillingEntries,
  listBillingExports,
  reviewBillingEntry,
  saveBillingExport,
  startBillingTimer,
  stopBillingTimer,
  updateBillingEntry,
} from "../billingDb";
import { buildBillingCsv } from "../billingCsv";
import { bulkUpsertFirmBillingCodes, createFirmBillingCode, listFirmBillingCodes, updateFirmBillingCode } from "../billingCodesDb";
import { createLawyerRate, listLawyerRates, updateLawyerRate } from "../ratesDb";
import { storagePut } from "../storage";

const activityCode = z.string().trim().min(1).max(80);
const billingCodeFields = z.object({
  code: z.string().trim().min(1).max(40),
  label: z.string().trim().min(2).max(180),
  category: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000).optional(),
  defaultNarrative: z.string().trim().max(2000).optional(),
  displayOrder: z.number().int().min(0).max(10000).default(0),
});

export const billingRouter = router({
  rates: router({
    list: protectedProcedure.input(z.object({ includeInactive: z.boolean().default(true) }).optional()).query(({ ctx, input }) => listLawyerRates(ctx.user.id, input?.includeInactive ?? true)),
    create: protectedProcedure.input(z.object({
      membershipId: z.number().int().positive(),
      hourlyRateCents: z.number().int().min(0).max(10_000_000),
      currency: z.literal("USD").default("USD"),
      effectiveFromMs: z.number().int().positive(),
      effectiveToMs: z.number().int().positive().nullable().optional(),
      notes: z.string().trim().max(2000).optional(),
    })).mutation(async ({ ctx, input }) => ({ id: await createLawyerRate(ctx.user.id, {
      membershipId: input.membershipId,
      hourlyRateCents: input.hourlyRateCents,
      currency: input.currency,
      effectiveFrom: new Date(input.effectiveFromMs),
      effectiveTo: input.effectiveToMs ? new Date(input.effectiveToMs) : null,
      notes: input.notes,
    }) })),
    update: protectedProcedure.input(z.object({
      id: z.number().int().positive(),
      effectiveToMs: z.number().int().positive().nullable().optional(),
      notes: z.string().trim().max(2000).optional(),
      active: z.boolean(),
    })).mutation(async ({ ctx, input }) => {
      await updateLawyerRate(ctx.user.id, {
        id: input.id,
        effectiveTo: input.effectiveToMs ? new Date(input.effectiveToMs) : null,
        notes: input.notes,
        active: input.active,
      });
      return { success: true as const };
    }),
  }),
  codes: router({
    list: protectedProcedure.input(z.object({ includeInactive: z.boolean().default(false) }).optional()).query(({ ctx, input }) => listFirmBillingCodes(ctx.user.id, input?.includeInactive ?? false)),
    create: protectedProcedure.input(billingCodeFields).mutation(async ({ ctx, input }) => ({ id: await createFirmBillingCode(ctx.user.id, input) })),
    update: protectedProcedure.input(billingCodeFields.extend({ id: z.number().int().positive(), active: z.boolean() })).mutation(async ({ ctx, input }) => { await updateFirmBillingCode(ctx.user.id, input); return { success: true as const }; }),
    bulkUpsert: protectedProcedure.input(z.object({ items: z.array(billingCodeFields.extend({ active: z.boolean() })).min(1).max(500) })).mutation(({ ctx, input }) => bulkUpsertFirmBillingCodes(ctx.user.id, input.items)),
  }),
  list: protectedProcedure.input(z.object({ matterId: z.number().int().positive().optional(), status: z.enum(["needs_duration", "draft", "approved", "rejected", "exported"]).optional() }).optional()).query(({ ctx, input }) => listBillingEntries(ctx.user.id, input)),
  activeTimer: protectedProcedure.query(({ ctx }) => getActiveTimer(ctx.user.id)),
  startTimer: protectedProcedure.input(z.object({ matterId: z.number().int().positive(), billingCodeId: z.number().int().positive().optional(), activityCode, narrative: z.string().trim().min(3).max(2000), sessionId: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => ({ timerId: await startBillingTimer(ctx.user.id, input) })),
  stopTimer: protectedProcedure.input(z.object({ timerId: z.number().int().positive() })).mutation(({ ctx, input }) => stopBillingTimer(ctx.user.id, input.timerId)),
  cancelTimer: protectedProcedure.input(z.object({ timerId: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await cancelBillingTimer(ctx.user.id, input.timerId); return { success: true as const }; }),
  createManual: protectedProcedure.input(z.object({ matterId: z.number().int().positive(), billingCodeId: z.number().int().positive().optional(), activityCode, narrative: z.string().trim().min(3).max(2000), durationSeconds: z.number().int().positive().optional(), workDateMs: z.number().int().positive().optional() })).mutation(async ({ ctx, input }) => ({ entryId: await createBillingEntry(ctx.user.id, { matterId: input.matterId, billingCodeId: input.billingCodeId, activityCode: input.activityCode, narrative: input.narrative, durationSeconds: input.durationSeconds, durationSource: input.durationSeconds ? "manual" : "none", sourceType: "manual", sourceIdentifier: `manual:${ctx.user.id}:${Date.now()}`, workDate: input.workDateMs ? new Date(input.workDateMs) : new Date() }) })),
  createFromVoice: protectedProcedure.input(z.object({ matterId: z.number().int().positive(), sessionId: z.number().int().positive().optional(), billingCodeId: z.number().int().positive().optional(), activityCode, narrative: z.string().trim().min(3).max(2000), durationSeconds: z.number().int().positive().nullable(), sourceQuote: z.string().trim().min(3).max(4000) })).mutation(async ({ ctx, input }) => ({ entryId: await createBillingEntry(ctx.user.id, { matterId: input.matterId, sessionId: input.sessionId, billingCodeId: input.billingCodeId, activityCode: input.activityCode, narrative: input.narrative, durationSeconds: input.durationSeconds, durationSource: input.durationSeconds ? "explicit_statement" : "none", sourceType: "voice", sourceIdentifier: `voice:${input.sessionId ?? "standalone"}:${Date.now()}`, sourceQuote: input.sourceQuote }) })),
  update: protectedProcedure.input(z.object({ entryId: z.number().int().positive(), billingCodeId: z.number().int().positive().optional(), activityCode, narrative: z.string().trim().min(3).max(2000), durationSeconds: z.number().int().positive().nullable(), workDateMs: z.number().int().positive() })).mutation(async ({ ctx, input }) => { await updateBillingEntry(ctx.user.id, { entryId: input.entryId, billingCodeId: input.billingCodeId, activityCode: input.activityCode, narrative: input.narrative, durationSeconds: input.durationSeconds, workDate: new Date(input.workDateMs) }); return { success: true as const }; }),
  review: protectedProcedure.input(z.object({ entryId: z.number().int().positive(), decision: z.enum(["approved", "rejected"]) })).mutation(async ({ ctx, input }) => { await reviewBillingEntry(ctx.user.id, input.entryId, input.decision); return { success: true as const }; }),
  exports: protectedProcedure.query(({ ctx }) => listBillingExports(ctx.user.id)),
  exportCsv: protectedProcedure.input(z.object({ entryIds: z.array(z.number().int().positive()).min(1).max(500) })).mutation(async ({ ctx, input }) => {
    const { rows } = await getApprovedEntriesForExport(ctx.user.id, input.entryIds);
    const content = buildBillingCsv(rows);
    const fileName = `counselscribe-billing-${new Date().toISOString().slice(0, 10)}.csv`;
    const stored = await storagePut(`counselscribe/billing/${fileName}`, content, "text/csv; charset=utf-8");
    const exportId = await saveBillingExport(ctx.user.id, { entryIds: input.entryIds, fileName, storageKey: stored.key, storageUrl: stored.url });
    return { exportId, fileName, url: stored.url };
  }),
});
