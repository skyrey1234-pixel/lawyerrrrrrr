import { buildClioTimeEntry, buildMyCaseTimeEntry, buildSyncIdempotencyKey, buildSyncRequestFingerprint, type ExternalSyncMapping, type PracticeProvider, type SyncableBillingEntry } from "@shared/practiceManagement";
import { beginSyncAttempt, finishSyncAttempt, getConnectedProvider, getSyncRecord, markConnectionError } from "./practiceManagementDb";
import { createProviderTimeEntry, ProviderRequestError } from "./providers";

export async function synchronizeBillingEntry(userId: number, provider: PracticeProvider, billingEntryId: number, confirmed: true) {
  if (confirmed !== true) throw new Error("Explicit synchronization confirmation is required");
  const context = await getSyncRecord(userId, provider, billingEntryId);
  const connection = await getConnectedProvider(context.membership.firm.id, provider);
  const entry: SyncableBillingEntry = {
    id: context.record.entry.id,
    revision: context.record.entry.revision,
    workDate: context.record.entry.workDate,
    narrative: context.record.entry.narrative,
    activityName: context.record.billingCode?.label ?? context.record.entry.activityCode,
    durationSeconds: context.record.entry.durationSeconds,
    rateCents: context.record.entry.rateCents,
    feeCents: context.record.entry.feeCents,
    billable: context.record.entry.billable,
  };
  const mapping: ExternalSyncMapping = {
    matterId: context.matterMapping.externalMatterId,
    userId: context.userMapping.externalUserId,
    activityId: context.codeMapping?.externalActivityId,
    activityName: context.codeMapping?.externalActivityName,
    utbmsActivityCode: context.codeMapping?.utbmsActivityCode,
    utbmsTaskCode: context.codeMapping?.utbmsTaskCode,
  };
  const body = provider === "clio" ? buildClioTimeEntry(entry, mapping) : buildMyCaseTimeEntry(entry, mapping);
  const idempotencyKey = buildSyncIdempotencyKey(provider, context.membership.firm.id, entry);
  const requestFingerprint = buildSyncRequestFingerprint(provider, entry, mapping);
  const attemptId = await beginSyncAttempt(userId, { provider, connectionId: connection.id, billingEntryId, billingEntryRevision: entry.revision, idempotencyKey, requestFingerprint });
  try {
    const remote = await createProviderTimeEntry(provider, connection.accessToken, body);
    await finishSyncAttempt(userId, attemptId, { status: "succeeded", externalRecordId: remote.id, responseStatus: remote.status });
    return { success: true as const, attemptId, externalRecordId: remote.id };
  } catch (error) {
    const providerError = error instanceof ProviderRequestError ? error : new ProviderRequestError("The provider request could not be completed");
    await finishSyncAttempt(userId, attemptId, { status: "failed", responseStatus: providerError.status, errorCode: providerError.code, errorMessage: providerError.message.slice(0, 1000) });
    if (providerError.status === 401) await markConnectionError(context.membership.firm.id, provider, "Authorization expired or was revoked. Reconnect the provider.");
    throw providerError;
  }
}
