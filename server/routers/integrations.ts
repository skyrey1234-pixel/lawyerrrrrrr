import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getMembership } from "../counselscribeDb";
import { createIntegrationState } from "../integrations/oauthState";
import { buildProviderAuthorizationUrl, providerReadiness } from "../integrations/providers";
import { disconnectPracticeProvider, getPracticeManagementSettings, saveExternalBillingCodeMapping, saveExternalMatterMapping, saveExternalUserMapping } from "../integrations/practiceManagementDb";
import { requestOrigin } from "../integrations/routes";
import { synchronizeBillingEntry } from "../integrations/syncService";

const provider = z.enum(["clio", "mycase"]);

export const integrationsRouter = router({
  settings: protectedProcedure.query(({ ctx }) => getPracticeManagementSettings(ctx.user.id)),
  readiness: protectedProcedure.query(() => providerReadiness()),
  authorizationUrl: protectedProcedure.input(z.object({ provider })).mutation(async ({ ctx, input }) => {
    const membership = await getMembership(ctx.user.id);
    if (!membership || membership.membership.role !== "administrator") throw new Error("Firm administrator access is required");
    const redirectUri = `${requestOrigin(ctx.req)}/api/integrations/${input.provider}/callback`;
    const state = createIntegrationState({ provider: input.provider, firmId: membership.firm.id, userId: ctx.user.id, redirectUri });
    return { url: buildProviderAuthorizationUrl(input.provider, redirectUri, state), redirectUri };
  }),
  disconnect: protectedProcedure.input(z.object({ provider })).mutation(async ({ ctx, input }) => { await disconnectPracticeProvider(ctx.user.id, input.provider); return { success: true as const }; }),
  mapMatter: protectedProcedure.input(z.object({ provider, matterId: z.number().int().positive(), externalMatterId: z.string().trim().min(1).max(160), externalMatterNumber: z.string().trim().max(160).optional(), externalMatterName: z.string().trim().max(240).optional(), active: z.boolean().default(true) })).mutation(async ({ ctx, input }) => { await saveExternalMatterMapping(ctx.user.id, input); return { success: true as const }; }),
  mapUser: protectedProcedure.input(z.object({ provider, membershipId: z.number().int().positive(), externalUserId: z.string().trim().min(1).max(160), externalUserName: z.string().trim().max(240).optional(), active: z.boolean().default(true) })).mutation(async ({ ctx, input }) => { await saveExternalUserMapping(ctx.user.id, input); return { success: true as const }; }),
  mapBillingCode: protectedProcedure.input(z.object({ provider, billingCodeId: z.number().int().positive(), externalActivityId: z.string().trim().max(160).optional(), externalActivityName: z.string().trim().max(240).optional(), utbmsActivityCode: z.string().trim().max(40).optional(), utbmsTaskCode: z.string().trim().max(40).optional(), active: z.boolean().default(true) })).mutation(async ({ ctx, input }) => { await saveExternalBillingCodeMapping(ctx.user.id, input); return { success: true as const }; }),
  syncEntry: protectedProcedure.input(z.object({ provider, billingEntryId: z.number().int().positive(), confirmed: z.literal(true) })).mutation(({ ctx, input }) => synchronizeBillingEntry(ctx.user.id, input.provider, input.billingEntryId, input.confirmed)),
});
