import { createHash } from "node:crypto";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import {
  aiAnalysisItems,
  aiAnalysisRuns,
  billingEntries,
  billingExports,
  billingTimers,
  documentVersions,
  firmBillingCodes,
  matters,
  sourceDocuments,
  users,
} from "../drizzle/schema";
import { normalizedBillingFingerprint } from "@shared/billing";
import type { MatterIntelligenceResult } from "./matterIntelligence";
import { resolveBillingCode } from "./billingCodesDb";
import { appendAudit, assertMatterAccess, assertSessionAccess, getMembership } from "./counselscribeDb";
import { getDb } from "./db";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

export async function createSourceDocument(userId: number, input: {
  matterId: number;
  sessionId?: number;
  title: string;
  sourceType: "pasted_text" | "transcript" | "uploaded_text";
  content: string;
  mimeType?: string;
  originalFileName?: string;
  storageKey?: string;
  storageUrl?: string;
}) {
  const access = await assertMatterAccess(userId, input.matterId);
  if (input.sessionId) {
    const session = await assertSessionAccess(userId, input.sessionId);
    if (session.matter.id !== input.matterId) throw new Error("Transcript session does not belong to this matter");
  }
  const db = await requireDb();
  const [{ id }] = await db.insert(sourceDocuments).values({
    firmId: access.membership.firm.id,
    matterId: input.matterId,
    sessionId: input.sessionId,
    createdByUserId: userId,
    title: input.title,
    sourceType: input.sourceType,
    mimeType: input.mimeType,
    originalFileName: input.originalFileName,
    storageKey: input.storageKey,
    storageUrl: input.storageUrl,
    contentSnapshot: input.content,
    contentHash: sha256(input.content),
    characterCount: input.content.length,
  }).$returningId();
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: input.matterId, sessionId: input.sessionId, eventType: "matter_ai.source_created", resourceType: "source_document", resourceId: String(id), metadata: { sourceType: input.sourceType, characterCount: input.content.length } });
  return id;
}

export async function createTranscriptSource(userId: number, input: { matterId: number; sessionId: number; title: string }) {
  await assertSessionAccess(userId, input.sessionId);
  const db = await requireDb();
  const versions = await db.select().from(documentVersions).where(eq(documentVersions.sessionId, input.sessionId)).orderBy(desc(documentVersions.versionNumber)).limit(1);
  const content = versions[0]?.content;
  if (!content) throw new Error("This session has no transcript version to analyze");
  return createSourceDocument(userId, { ...input, sourceType: "transcript", content });
}

async function getAnalysisAccess(userId: number, analysisRunId: number) {
  const db = await requireDb();
  const rows = await db.select({ run: aiAnalysisRuns, matter: matters }).from(aiAnalysisRuns).innerJoin(matters, eq(aiAnalysisRuns.matterId, matters.id)).where(eq(aiAnalysisRuns.id, analysisRunId)).limit(1);
  if (!rows[0]) throw new Error("Analysis run not found");
  const access = await assertMatterAccess(userId, rows[0].matter.id);
  return { ...rows[0], access };
}

export async function createAnalysisRun(userId: number, input: { matterId: number; sourceDocumentId: number; modelId: string; promptVersion: string }) {
  const access = await assertMatterAccess(userId, input.matterId);
  const db = await requireDb();
  const source = await db.select().from(sourceDocuments).where(and(eq(sourceDocuments.id, input.sourceDocumentId), eq(sourceDocuments.matterId, input.matterId), eq(sourceDocuments.firmId, access.membership.firm.id))).limit(1);
  if (!source[0]) throw new Error("Source document not found or access denied");
  const [{ id }] = await db.insert(aiAnalysisRuns).values({ firmId: access.membership.firm.id, matterId: input.matterId, sourceDocumentId: input.sourceDocumentId, createdByUserId: userId, modelId: input.modelId, promptVersion: input.promptVersion, status: "running" }).$returningId();
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: input.matterId, eventType: "matter_ai.analysis_started", resourceType: "ai_analysis_run", resourceId: String(id), metadata: { modelId: input.modelId, promptVersion: input.promptVersion } });
  return { id, source: source[0] };
}

export async function completeAnalysisRun(userId: number, input: {
  analysisRunId: number;
  modelId: string;
  result: MatterIntelligenceResult;
  inputTokens?: number;
  outputTokens?: number;
}) {
  const { run, matter, access } = await getAnalysisAccess(userId, input.analysisRunId);
  const db = await requireDb();
  const items: Array<typeof aiAnalysisItems.$inferInsert> = [];
  for (const item of input.result.facts) items.push({ analysisRunId: run.id, itemType: "fact", label: item.label, value: item.value, sourceQuote: item.sourceQuote, confidence: String(item.confidence) });
  for (const item of input.result.entities) items.push({ analysisRunId: run.id, itemType: "entity", label: item.label, value: item.value, sourceQuote: item.sourceQuote, confidence: String(item.confidence) });
  for (const item of input.result.dates) items.push({ analysisRunId: run.id, itemType: item.isDeadline ? "deadline" : "date", label: item.label, value: item.value, sourceQuote: item.sourceQuote, confidence: String(item.confidence), metadata: { isDeadline: item.isDeadline, verified: false } });
  for (const item of input.result.actions) items.push({ analysisRunId: run.id, itemType: "action", label: item.label, value: item.value, sourceQuote: item.sourceQuote, confidence: String(item.confidence) });
  for (const item of input.result.vocabulary) items.push({ analysisRunId: run.id, itemType: "vocabulary", label: item.label, value: item.approvedText, sourceQuote: item.sourceQuote, confidence: String(item.confidence), metadata: { heardPhrase: item.heardPhrase, approvedText: item.approvedText } });
  for (const item of input.result.billing) items.push({ analysisRunId: run.id, itemType: "billing", label: item.activityCode, value: item.narrative, sourceQuote: item.sourceQuote, confidence: String(item.confidence), metadata: { explicitDurationText: item.explicitDurationText, durationSeconds: item.durationSeconds } });
  if (items.length) await db.insert(aiAnalysisItems).values(items);
  await db.update(aiAnalysisRuns).set({ modelId: input.modelId, status: "completed", summary: input.result.summary, resultJson: input.result as unknown as Record<string, unknown>, inputTokens: input.inputTokens, outputTokens: input.outputTokens, completedAt: new Date() }).where(eq(aiAnalysisRuns.id, run.id));

  const stagedBillingCount = input.result.billing.length;
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: matter.id, eventType: "matter_ai.analysis_completed", resourceType: "ai_analysis_run", resourceId: String(run.id), metadata: { itemCount: items.length, stagedBillingCount, billingDraftCount: 0, inputTokens: input.inputTokens, outputTokens: input.outputTokens } });
  return { itemCount: items.length, stagedBillingCount };
}

export async function failAnalysisRun(userId: number, analysisRunId: number, message: string) {
  const { run, matter, access } = await getAnalysisAccess(userId, analysisRunId);
  const db = await requireDb();
  await db.update(aiAnalysisRuns).set({ status: "failed", errorMessage: "Analysis could not be completed. No findings or billing entries were saved.", completedAt: new Date() }).where(eq(aiAnalysisRuns.id, run.id));
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: matter.id, eventType: "matter_ai.analysis_failed", resourceType: "ai_analysis_run", resourceId: String(run.id), metadata: { message: message.slice(0, 240) } });
}

export async function getMatterIntelligence(userId: number, matterId: number) {
  await assertMatterAccess(userId, matterId);
  const db = await requireDb();
  const documents = await db.select().from(sourceDocuments).where(eq(sourceDocuments.matterId, matterId)).orderBy(desc(sourceDocuments.createdAt));
  const runs = await db.select().from(aiAnalysisRuns).where(eq(aiAnalysisRuns.matterId, matterId)).orderBy(desc(aiAnalysisRuns.createdAt));
  const items = runs.length ? await db.select().from(aiAnalysisItems).where(inArray(aiAnalysisItems.analysisRunId, runs.map(run => run.id))).orderBy(desc(aiAnalysisItems.createdAt)) : [];
  return { documents, runs, items };
}

export async function reviewAnalysisItem(userId: number, input: { itemId: number; status: "accepted" | "rejected"; billingCodeId?: number }) {
  const db = await requireDb();
  const rows = await db.select({ item: aiAnalysisItems, run: aiAnalysisRuns, matter: matters }).from(aiAnalysisItems).innerJoin(aiAnalysisRuns, eq(aiAnalysisItems.analysisRunId, aiAnalysisRuns.id)).innerJoin(matters, eq(aiAnalysisRuns.matterId, matters.id)).where(eq(aiAnalysisItems.id, input.itemId)).limit(1);
  if (!rows[0]) throw new Error("AI item not found");
  const access = await assertMatterAccess(userId, rows[0].matter.id);
  if (rows[0].item.status !== "proposed") throw new Error("This AI item has already been reviewed");
  let billingEntryId: number | null = null;
  if (input.status === "accepted" && rows[0].item.itemType === "billing") {
    const metadata = (rows[0].item.metadata || {}) as { durationSeconds?: number | null };
    const source = await db.select().from(sourceDocuments).where(eq(sourceDocuments.id, rows[0].run.sourceDocumentId)).limit(1);
    if (!source[0]) throw new Error("The billing candidate source could not be loaded");
    const firmCode = await resolveBillingCode(userId, { billingCodeId: input.billingCodeId, category: rows[0].item.label });
    billingEntryId = await createBillingEntry(userId, {
      matterId: rows[0].matter.id,
      sessionId: source[0].sessionId ?? undefined,
      sourceDocumentId: source[0].id,
      analysisRunId: rows[0].run.id,
      billingCodeId: firmCode?.id,
      activityCode: firmCode?.code ?? rows[0].item.label,
      narrative: rows[0].item.value,
      durationSeconds: metadata.durationSeconds ?? null,
      durationSource: metadata.durationSeconds == null ? "none" : "explicit_statement",
      sourceType: source[0].sourceType === "transcript" ? "transcript" : "document",
      sourceIdentifier: `analysis_item:${rows[0].item.id}`,
      sourceQuote: rows[0].item.sourceQuote,
      confidence: rows[0].item.confidence == null ? undefined : Number(rows[0].item.confidence),
    });
  }
  await db.update(aiAnalysisItems).set({ status: input.status, reviewedByUserId: userId, reviewedAt: new Date() }).where(eq(aiAnalysisItems.id, input.itemId));
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: rows[0].matter.id, eventType: `matter_ai.item_${input.status}`, resourceType: "ai_analysis_item", resourceId: String(input.itemId), metadata: { itemType: rows[0].item.itemType, billingEntryId, billingCodeId: input.billingCodeId } });
  return { success: true as const, status: input.status, billingEntryId };
}

export async function createBillingEntry(userId: number, input: {
  matterId: number;
  sessionId?: number;
  sourceDocumentId?: number;
  analysisRunId?: number;
  timerId?: number;
  billingCodeId?: number;
  workDate?: Date;
  activityCode: string;
  narrative: string;
  durationSeconds?: number | null;
  durationSource: "timer" | "explicit_statement" | "manual" | "none";
  sourceType: "timer" | "voice" | "transcript" | "document" | "manual";
  sourceIdentifier?: string;
  sourceQuote?: string;
  sourceStartMs?: number;
  sourceEndMs?: number;
  confidence?: number;
}) {
  const access = await assertMatterAccess(userId, input.matterId);
  const db = await requireDb();
  const firmCode = input.billingCodeId ? await resolveBillingCode(userId, { billingCodeId: input.billingCodeId }) : null;
  const activityCode = firmCode?.code ?? input.activityCode;
  const workDate = input.workDate ?? new Date();
  const fingerprint = sha256(normalizedBillingFingerprint({ firmId: access.membership.firm.id, matterId: input.matterId, activityCode, narrative: input.narrative, workDate, durationSeconds: input.durationSeconds ?? null, sourceIdentifier: input.sourceIdentifier }));
  const duplicate = await db.select({ id: billingEntries.id }).from(billingEntries).where(and(eq(billingEntries.firmId, access.membership.firm.id), eq(billingEntries.duplicateFingerprint, fingerprint), ne(billingEntries.status, "rejected"))).limit(1);
  const status = input.durationSeconds && input.durationSeconds > 0 ? "draft" : "needs_duration";
  const [{ id }] = await db.insert(billingEntries).values({
    firmId: access.membership.firm.id,
    matterId: input.matterId,
    userId,
    sessionId: input.sessionId,
    sourceDocumentId: input.sourceDocumentId,
    analysisRunId: input.analysisRunId,
    timerId: input.timerId,
    billingCodeId: firmCode?.id,
    workDate,
    activityCode,
    narrative: input.narrative,
    durationSeconds: input.durationSeconds,
    durationSource: input.durationSource,
    sourceType: input.sourceType,
    sourceIdentifier: input.sourceIdentifier,
    sourceQuote: input.sourceQuote,
    sourceStartMs: input.sourceStartMs,
    sourceEndMs: input.sourceEndMs,
    status,
    confidence: input.confidence == null ? null : String(input.confidence),
    duplicateFingerprint: fingerprint,
    duplicateOfEntryId: duplicate[0]?.id,
  }).$returningId();
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: input.matterId, sessionId: input.sessionId, eventType: "billing.entry_created", resourceType: "billing_entry", resourceId: String(id), metadata: { status, durationSource: input.durationSource, duplicateOfEntryId: duplicate[0]?.id } });
  return id;
}

export async function listBillingEntries(userId: number, input?: { matterId?: number; status?: typeof billingEntries.$inferSelect.status }) {
  const membership = await getMembership(userId);
  if (!membership) return [];
  const db = await requireDb();
  const conditions = [eq(billingEntries.firmId, membership.firm.id)];
  if (input?.matterId) conditions.push(eq(billingEntries.matterId, input.matterId));
  if (input?.status) conditions.push(eq(billingEntries.status, input.status));
  return db.select({ entry: billingEntries, matter: matters, attorney: users, billingCode: firmBillingCodes }).from(billingEntries).innerJoin(matters, eq(billingEntries.matterId, matters.id)).innerJoin(users, eq(billingEntries.userId, users.id)).leftJoin(firmBillingCodes, eq(billingEntries.billingCodeId, firmBillingCodes.id)).where(and(...conditions)).orderBy(desc(billingEntries.workDate), desc(billingEntries.createdAt));
}

async function getBillingEntryAccess(userId: number, entryId: number) {
  const db = await requireDb();
  const rows = await db.select({ entry: billingEntries, matter: matters }).from(billingEntries).innerJoin(matters, eq(billingEntries.matterId, matters.id)).where(eq(billingEntries.id, entryId)).limit(1);
  if (!rows[0]) throw new Error("Billing entry not found");
  const access = await assertMatterAccess(userId, rows[0].matter.id);
  return { ...rows[0], access };
}

export async function updateBillingEntry(userId: number, input: { entryId: number; billingCodeId?: number; activityCode: string; narrative: string; durationSeconds: number | null; workDate: Date }) {
  const { entry, matter, access } = await getBillingEntryAccess(userId, input.entryId);
  if (entry.status === "exported") throw new Error("Exported billing entries cannot be edited");
  const db = await requireDb();
  const firmCode = input.billingCodeId ? await resolveBillingCode(userId, { billingCodeId: input.billingCodeId }) : null;
  const activityCode = firmCode?.code ?? input.activityCode;
  const fingerprint = sha256(normalizedBillingFingerprint({ firmId: access.membership.firm.id, matterId: matter.id, activityCode, narrative: input.narrative, workDate: input.workDate, durationSeconds: input.durationSeconds, sourceIdentifier: entry.sourceIdentifier }));
  const duplicate = await db.select({ id: billingEntries.id }).from(billingEntries).where(and(eq(billingEntries.firmId, access.membership.firm.id), eq(billingEntries.duplicateFingerprint, fingerprint), ne(billingEntries.id, entry.id), ne(billingEntries.status, "rejected"))).limit(1);
  await db.update(billingEntries).set({ billingCodeId: firmCode?.id ?? null, activityCode, narrative: input.narrative, durationSeconds: input.durationSeconds, durationSource: input.durationSeconds == null ? "none" : entry.durationSource === "none" ? "manual" : entry.durationSource, workDate: input.workDate, status: input.durationSeconds && input.durationSeconds > 0 ? "draft" : "needs_duration", approvedByUserId: null, approvedAt: null, duplicateFingerprint: fingerprint, duplicateOfEntryId: duplicate[0]?.id ?? null }).where(eq(billingEntries.id, entry.id));
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: matter.id, eventType: "billing.entry_updated", resourceType: "billing_entry", resourceId: String(entry.id), metadata: { durationSeconds: input.durationSeconds, duplicateOfEntryId: duplicate[0]?.id } });
}

export async function reviewBillingEntry(userId: number, entryId: number, decision: "approved" | "rejected") {
  const { entry, matter, access } = await getBillingEntryAccess(userId, entryId);
  if (entry.status === "exported") throw new Error("Exported billing entries cannot be changed");
  if (decision === "approved" && (!entry.durationSeconds || entry.durationSeconds <= 0)) throw new Error("Add verified time before approval");
  const db = await requireDb();
  await db.update(billingEntries).set(decision === "approved" ? { status: "approved", approvedByUserId: userId, approvedAt: new Date(), rejectedAt: null } : { status: "rejected", rejectedAt: new Date(), approvedByUserId: null, approvedAt: null }).where(eq(billingEntries.id, entry.id));
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: matter.id, eventType: `billing.entry_${decision}`, resourceType: "billing_entry", resourceId: String(entry.id) });
}

export async function getActiveTimer(userId: number) {
  const membership = await getMembership(userId);
  if (!membership) return null;
  const db = await requireDb();
  const rows = await db.select({ timer: billingTimers, matter: matters, billingCode: firmBillingCodes }).from(billingTimers).innerJoin(matters, eq(billingTimers.matterId, matters.id)).leftJoin(firmBillingCodes, eq(billingTimers.billingCodeId, firmBillingCodes.id)).where(and(eq(billingTimers.userId, userId), eq(billingTimers.firmId, membership.firm.id), eq(billingTimers.status, "running"))).orderBy(desc(billingTimers.startedAt)).limit(1);
  return rows[0] ?? null;
}

export async function startBillingTimer(userId: number, input: { matterId: number; billingCodeId?: number; activityCode: string; narrative: string; sessionId?: number }) {
  const access = await assertMatterAccess(userId, input.matterId);
  if (await getActiveTimer(userId)) throw new Error("Stop the active timer before starting another matter");
  const db = await requireDb();
  const firmCode = input.billingCodeId ? await resolveBillingCode(userId, { billingCodeId: input.billingCodeId }) : null;
  const activityCode = firmCode?.code ?? input.activityCode;
  const [{ id }] = await db.insert(billingTimers).values({ firmId: access.membership.firm.id, matterId: input.matterId, userId, sessionId: input.sessionId, billingCodeId: firmCode?.id, activityCode, narrative: input.narrative, status: "running", startedAt: new Date() }).$returningId();
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: input.matterId, sessionId: input.sessionId, eventType: "billing.timer_started", resourceType: "billing_timer", resourceId: String(id), metadata: { activityCode, billingCodeId: firmCode?.id } });
  return id;
}

export async function stopBillingTimer(userId: number, timerId: number) {
  const active = await getActiveTimer(userId);
  if (!active || active.timer.id !== timerId) throw new Error("Active timer not found");
  const elapsedSeconds = Math.max(1, Math.round((Date.now() - active.timer.startedAt.getTime()) / 1000));
  const db = await requireDb();
  await db.update(billingTimers).set({ status: "stopped", stoppedAt: new Date(), elapsedSeconds }).where(eq(billingTimers.id, timerId));
  const entryId = await createBillingEntry(userId, { matterId: active.timer.matterId, sessionId: active.timer.sessionId ?? undefined, timerId, billingCodeId: active.timer.billingCodeId ?? undefined, activityCode: active.timer.activityCode, narrative: active.timer.narrative, durationSeconds: elapsedSeconds, durationSource: "timer", sourceType: "timer", sourceIdentifier: `timer:${timerId}` });
  return { entryId, elapsedSeconds };
}

export async function cancelBillingTimer(userId: number, timerId: number) {
  const active = await getActiveTimer(userId);
  if (!active || active.timer.id !== timerId) throw new Error("Active timer not found");
  const db = await requireDb();
  await db.update(billingTimers).set({ status: "cancelled", stoppedAt: new Date() }).where(eq(billingTimers.id, timerId));
  const membership = await getMembership(userId);
  if (membership) await appendAudit({ firmId: membership.firm.id, actorUserId: userId, matterId: active.timer.matterId, eventType: "billing.timer_cancelled", resourceType: "billing_timer", resourceId: String(timerId) });
}

export async function getApprovedEntriesForExport(userId: number, entryIds: number[]) {
  const membership = await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  if (!entryIds.length) throw new Error("Select at least one approved entry");
  const db = await requireDb();
  const rows = await db.select({ entry: billingEntries, matter: matters, attorney: users, billingCode: firmBillingCodes }).from(billingEntries).innerJoin(matters, eq(billingEntries.matterId, matters.id)).innerJoin(users, eq(billingEntries.userId, users.id)).leftJoin(firmBillingCodes, eq(billingEntries.billingCodeId, firmBillingCodes.id)).where(and(eq(billingEntries.firmId, membership.firm.id), eq(billingEntries.status, "approved"), inArray(billingEntries.id, entryIds)));
  if (rows.length !== entryIds.length) throw new Error("Every selected billing entry must be approved and belong to this firm");
  return { membership, rows };
}

export async function saveBillingExport(userId: number, input: { entryIds: number[]; fileName: string; storageKey: string; storageUrl: string }) {
  const { membership } = await getApprovedEntriesForExport(userId, input.entryIds);
  const db = await requireDb();
  const [{ id }] = await db.insert(billingExports).values({ firmId: membership.firm.id, createdByUserId: userId, fileName: input.fileName, storageKey: input.storageKey, storageUrl: input.storageUrl, entryIds: input.entryIds, entryCount: input.entryIds.length }).$returningId();
  await db.update(billingEntries).set({ status: "exported", exportedAt: new Date() }).where(inArray(billingEntries.id, input.entryIds));
  await appendAudit({ firmId: membership.firm.id, actorUserId: userId, eventType: "billing.export_created", resourceType: "billing_export", resourceId: String(id), metadata: { entryCount: input.entryIds.length, format: "csv" } });
  return id;
}

export async function listBillingExports(userId: number) {
  const membership = await getMembership(userId);
  if (!membership) return [];
  const db = await requireDb();
  return db.select().from(billingExports).where(eq(billingExports.firmId, membership.firm.id)).orderBy(desc(billingExports.createdAt));
}
