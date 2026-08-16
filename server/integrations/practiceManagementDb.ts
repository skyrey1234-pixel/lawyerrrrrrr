import { and, asc, desc, eq } from "drizzle-orm";
import {
  billingEntries,
  billingSyncAttempts,
  externalBillingCodeMappings,
  externalMatterMappings,
  externalUserMappings,
  firmBillingCodes,
  firmMemberships,
  integrationConnections,
  matters,
  users,
} from "../../drizzle/schema";
import type { PracticeProvider } from "@shared/practiceManagement";
import { appendAudit, getMembership } from "../counselscribeDb";
import { getDb } from "../db";
import { decryptIntegrationToken, encryptIntegrationToken } from "./tokenCrypto";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

async function requireAdministrator(userId: number) {
  const membership = await getMembership(userId);
  if (!membership || membership.membership.role !== "administrator") throw new Error("Firm administrator access is required");
  return membership;
}

export async function assertAdministratorInFirm(userId: number, firmId: number) {
  const db = await requireDb();
  const rows = await db.select().from(firmMemberships).where(and(
    eq(firmMemberships.firmId, firmId),
    eq(firmMemberships.userId, userId),
    eq(firmMemberships.status, "active"),
    eq(firmMemberships.role, "administrator"),
  )).limit(1);
  if (!rows[0]) throw new Error("Firm administrator access is required");
  return rows[0];
}

export async function getPracticeManagementSettings(userId: number) {
  const membership = await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  const db = await requireDb();
  const firmId = membership.firm.id;
  const [connections, userMappings, matterMappings, codeMappings, members, matterRows, codes, attempts] = await Promise.all([
    db.select({ id: integrationConnections.id, provider: integrationConnections.provider, status: integrationConnections.status, region: integrationConnections.region, externalFirmId: integrationConnections.externalFirmId, externalFirmName: integrationConnections.externalFirmName, tokenExpiresAt: integrationConnections.tokenExpiresAt, scopes: integrationConnections.scopes, lastValidatedAt: integrationConnections.lastValidatedAt, lastError: integrationConnections.lastError, updatedAt: integrationConnections.updatedAt }).from(integrationConnections).where(eq(integrationConnections.firmId, firmId)),
    db.select().from(externalUserMappings).where(eq(externalUserMappings.firmId, firmId)),
    db.select().from(externalMatterMappings).where(eq(externalMatterMappings.firmId, firmId)),
    db.select().from(externalBillingCodeMappings).where(eq(externalBillingCodeMappings.firmId, firmId)),
    db.select({ membership: firmMemberships, user: users }).from(firmMemberships).innerJoin(users, eq(firmMemberships.userId, users.id)).where(eq(firmMemberships.firmId, firmId)).orderBy(asc(users.name)),
    db.select().from(matters).where(eq(matters.firmId, firmId)).orderBy(asc(matters.matterNumber)),
    db.select().from(firmBillingCodes).where(eq(firmBillingCodes.firmId, firmId)).orderBy(asc(firmBillingCodes.displayOrder), asc(firmBillingCodes.code)),
    db.select().from(billingSyncAttempts).where(eq(billingSyncAttempts.firmId, firmId)).orderBy(desc(billingSyncAttempts.createdAt)).limit(100),
  ]);
  return { firm: membership.firm, membership: membership.membership, connections, userMappings, matterMappings, codeMappings, members, matters: matterRows, codes, attempts };
}

export async function storeOAuthConnection(userId: number, input: {
  firmId: number;
  provider: PracticeProvider;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scopes?: string | null;
  externalFirmId?: string | null;
  externalFirmName?: string | null;
}) {
  await assertAdministratorInFirm(userId, input.firmId);
  const db = await requireDb();
  const values = {
    status: "connected" as const,
    accessTokenCiphertext: encryptIntegrationToken(input.accessToken),
    refreshTokenCiphertext: input.refreshToken ? encryptIntegrationToken(input.refreshToken) : null,
    tokenExpiresAt: input.expiresIn ? new Date(Date.now() + input.expiresIn * 1000) : null,
    scopes: input.scopes ?? null,
    externalFirmId: input.externalFirmId ?? null,
    externalFirmName: input.externalFirmName ?? null,
    lastValidatedAt: new Date(),
    lastError: null,
    connectedByUserId: userId,
  };
  await db.insert(integrationConnections).values({ firmId: input.firmId, provider: input.provider, ...values }).onDuplicateKeyUpdate({ set: values });
  await appendAudit({ firmId: input.firmId, actorUserId: userId, eventType: `integration.${input.provider}_connected`, resourceType: "integration_connection", resourceId: input.provider, metadata: { provider: input.provider, externalFirmId: input.externalFirmId ?? null, scopes: input.scopes ?? null } });
}

export async function disconnectPracticeProvider(userId: number, provider: PracticeProvider) {
  const administrator = await requireAdministrator(userId);
  const db = await requireDb();
  await db.update(integrationConnections).set({ status: "disconnected", accessTokenCiphertext: null, refreshTokenCiphertext: null, tokenExpiresAt: null, lastError: null }).where(and(eq(integrationConnections.firmId, administrator.firm.id), eq(integrationConnections.provider, provider)));
  await appendAudit({ firmId: administrator.firm.id, actorUserId: userId, eventType: `integration.${provider}_disconnected`, resourceType: "integration_connection", resourceId: provider, metadata: { provider } });
}

const requireExternalNumericId = (value: string, label: string) => {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) throw new Error(`${label} must be a numeric provider ID`);
  return normalized;
};

export async function saveExternalMatterMapping(userId: number, input: { provider: PracticeProvider; matterId: number; externalMatterId: string; externalMatterNumber?: string; externalMatterName?: string; active: boolean }) {
  const administrator = await requireAdministrator(userId);
  const db = await requireDb();
  const matter = await db.select().from(matters).where(and(eq(matters.id, input.matterId), eq(matters.firmId, administrator.firm.id))).limit(1);
  if (!matter[0]) throw new Error("Matter not found");
  const values = { externalMatterId: requireExternalNumericId(input.externalMatterId, "External matter"), externalMatterNumber: input.externalMatterNumber, externalMatterName: input.externalMatterName, active: input.active, createdByUserId: userId };
  await db.insert(externalMatterMappings).values({ firmId: administrator.firm.id, provider: input.provider, matterId: input.matterId, ...values }).onDuplicateKeyUpdate({ set: values });
  await appendAudit({ firmId: administrator.firm.id, actorUserId: userId, matterId: input.matterId, eventType: `integration.${input.provider}_matter_mapped`, resourceType: "external_matter_mapping", resourceId: String(input.matterId), metadata: { provider: input.provider, externalMatterId: values.externalMatterId } });
}

export async function saveExternalUserMapping(userId: number, input: { provider: PracticeProvider; membershipId: number; externalUserId: string; externalUserName?: string; active: boolean }) {
  const administrator = await requireAdministrator(userId);
  const db = await requireDb();
  const member = await db.select().from(firmMemberships).where(and(eq(firmMemberships.id, input.membershipId), eq(firmMemberships.firmId, administrator.firm.id))).limit(1);
  if (!member[0]) throw new Error("Firm member not found");
  const values = { externalUserId: requireExternalNumericId(input.externalUserId, "External user"), externalUserName: input.externalUserName, active: input.active, createdByUserId: userId };
  await db.insert(externalUserMappings).values({ firmId: administrator.firm.id, provider: input.provider, membershipId: input.membershipId, ...values }).onDuplicateKeyUpdate({ set: values });
  await appendAudit({ firmId: administrator.firm.id, actorUserId: userId, eventType: `integration.${input.provider}_user_mapped`, resourceType: "external_user_mapping", resourceId: String(input.membershipId), metadata: { provider: input.provider, externalUserId: values.externalUserId } });
}

export async function saveExternalBillingCodeMapping(userId: number, input: { provider: PracticeProvider; billingCodeId: number; externalActivityId?: string; externalActivityName?: string; utbmsActivityCode?: string; utbmsTaskCode?: string; active: boolean }) {
  const administrator = await requireAdministrator(userId);
  const db = await requireDb();
  const code = await db.select().from(firmBillingCodes).where(and(eq(firmBillingCodes.id, input.billingCodeId), eq(firmBillingCodes.firmId, administrator.firm.id))).limit(1);
  if (!code[0]) throw new Error("Firm billing code not found");
  const values = { externalActivityId: input.externalActivityId ? requireExternalNumericId(input.externalActivityId, "External activity") : null, externalActivityName: input.externalActivityName, utbmsActivityCode: input.utbmsActivityCode, utbmsTaskCode: input.utbmsTaskCode, active: input.active, createdByUserId: userId };
  await db.insert(externalBillingCodeMappings).values({ firmId: administrator.firm.id, provider: input.provider, billingCodeId: input.billingCodeId, ...values }).onDuplicateKeyUpdate({ set: values });
  await appendAudit({ firmId: administrator.firm.id, actorUserId: userId, eventType: `integration.${input.provider}_billing_code_mapped`, resourceType: "external_billing_code_mapping", resourceId: String(input.billingCodeId), metadata: { provider: input.provider, externalActivityId: values.externalActivityId, utbmsActivityCode: input.utbmsActivityCode ?? null, utbmsTaskCode: input.utbmsTaskCode ?? null } });
}

export async function getConnectedProvider(firmId: number, provider: PracticeProvider) {
  const db = await requireDb();
  const rows = await db.select().from(integrationConnections).where(and(eq(integrationConnections.firmId, firmId), eq(integrationConnections.provider, provider), eq(integrationConnections.status, "connected"))).limit(1);
  if (!rows[0]?.accessTokenCiphertext) throw new Error(`${provider === "clio" ? "Clio" : "MyCase"} is not connected`);
  return { ...rows[0], accessToken: decryptIntegrationToken(rows[0].accessTokenCiphertext), refreshToken: rows[0].refreshTokenCiphertext ? decryptIntegrationToken(rows[0].refreshTokenCiphertext) : null };
}

export async function getSyncRecord(userId: number, provider: PracticeProvider, billingEntryId: number) {
  const membership = await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  const db = await requireDb();
  const rows = await db.select({ entry: billingEntries, matter: matters, attorney: users, billingCode: firmBillingCodes, attorneyMembership: firmMemberships })
    .from(billingEntries)
    .innerJoin(matters, eq(billingEntries.matterId, matters.id))
    .innerJoin(users, eq(billingEntries.userId, users.id))
    .innerJoin(firmMemberships, and(eq(firmMemberships.userId, billingEntries.userId), eq(firmMemberships.firmId, billingEntries.firmId)))
    .leftJoin(firmBillingCodes, eq(billingEntries.billingCodeId, firmBillingCodes.id))
    .where(and(eq(billingEntries.id, billingEntryId), eq(billingEntries.firmId, membership.firm.id)))
    .limit(1);
  if (!rows[0]) throw new Error("Billing entry not found");
  if (!['approved', 'exported'].includes(rows[0].entry.status)) throw new Error("Only attorney-approved entries can be synchronized");
  const [matterMapping, userMapping, codeMapping] = await Promise.all([
    db.select().from(externalMatterMappings).where(and(eq(externalMatterMappings.provider, provider), eq(externalMatterMappings.matterId, rows[0].matter.id), eq(externalMatterMappings.active, true))).limit(1),
    db.select().from(externalUserMappings).where(and(eq(externalUserMappings.provider, provider), eq(externalUserMappings.membershipId, rows[0].attorneyMembership.id), eq(externalUserMappings.active, true))).limit(1),
    rows[0].billingCode ? db.select().from(externalBillingCodeMappings).where(and(eq(externalBillingCodeMappings.provider, provider), eq(externalBillingCodeMappings.billingCodeId, rows[0].billingCode.id), eq(externalBillingCodeMappings.active, true))).limit(1) : Promise.resolve([]),
  ]);
  if (!matterMapping[0]) throw new Error(`Map this matter to ${provider === "clio" ? "Clio" : "MyCase"} before synchronization`);
  if (!userMapping[0]) throw new Error(`Map this lawyer to ${provider === "clio" ? "Clio" : "MyCase"} before synchronization`);
  return { membership, record: rows[0], matterMapping: matterMapping[0], userMapping: userMapping[0], codeMapping: codeMapping[0] ?? null };
}

export async function beginSyncAttempt(userId: number, input: { provider: PracticeProvider; connectionId: number; billingEntryId: number; billingEntryRevision: number; idempotencyKey: string; requestFingerprint: string }) {
  const membership = await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  const db = await requireDb();
  const prior = await db.select().from(billingSyncAttempts).where(and(eq(billingSyncAttempts.provider, input.provider), eq(billingSyncAttempts.idempotencyKey, input.idempotencyKey))).limit(1);
  if (prior[0]) {
    if (prior[0].status === "succeeded") throw new Error("This billing-entry revision has already been synchronized");
    throw new Error("A synchronization attempt already exists for this billing-entry revision");
  }
  const [{ id }] = await db.insert(billingSyncAttempts).values({ firmId: membership.firm.id, confirmedByUserId: userId, status: "pending", ...input }).$returningId();
  return id;
}

export async function finishSyncAttempt(userId: number, attemptId: number, input: { status: "succeeded" | "failed"; externalRecordId?: string; responseStatus?: number; errorCode?: string; errorMessage?: string }) {
  const membership = await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  const db = await requireDb();
  await db.update(billingSyncAttempts).set({ ...input, completedAt: new Date() }).where(and(eq(billingSyncAttempts.id, attemptId), eq(billingSyncAttempts.firmId, membership.firm.id)));
  const attempt = await db.select().from(billingSyncAttempts).where(eq(billingSyncAttempts.id, attemptId)).limit(1);
  await appendAudit({ firmId: membership.firm.id, actorUserId: userId, eventType: `billing.sync_${input.status}`, resourceType: "billing_sync_attempt", resourceId: String(attemptId), metadata: { provider: attempt[0]?.provider, billingEntryId: attempt[0]?.billingEntryId, externalRecordId: input.externalRecordId ?? null, responseStatus: input.responseStatus ?? null, errorCode: input.errorCode ?? null } });
}

export async function markConnectionError(firmId: number, provider: PracticeProvider, message: string) {
  const db = await requireDb();
  await db.update(integrationConnections).set({ status: "error", lastError: message.slice(0, 1000) }).where(and(eq(integrationConnections.firmId, firmId), eq(integrationConnections.provider, provider)));
}
