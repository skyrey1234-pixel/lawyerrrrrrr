import { and, asc, desc, eq, inArray, or } from "drizzle-orm";
import {
  audioAssets,
  auditEvents,
  comparisonRuns,
  dictationSessions,
  documentTemplates,
  documentVersions,
  firmMemberships,
  firms,
  glossaryTerms,
  localCompanions,
  matterEntities,
  matters,
  reviewDecisions,
  transcriptSegments,
  users,
  type User,
} from "../drizzle/schema";
import { getDb } from "./db";

export type SegmentInput = {
  sequence: number;
  startMs: number;
  endMs: number;
  sourceText: string;
  normalizedText?: string | null;
  speakerLabel?: string | null;
  confidence?: number | null;
};

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

const DEFAULT_TEMPLATE_BODY = {
  sections: [
    { key: "caption", label: "Matter caption", optional: true },
    { key: "title", label: "Document title", optional: false },
    { key: "body", label: "Reviewed dictation", optional: false },
    { key: "signature", label: "Signature block", optional: true },
  ],
};

const DEFAULT_TEMPLATE_STYLE = {
  font: "Times New Roman",
  fontSizePt: 12,
  lineSpacing: 2,
  marginsInches: { top: 1, right: 1, bottom: 1, left: 1 },
  headingFont: "Times New Roman",
};

export async function getMembership(userId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ membership: firmMemberships, firm: firms })
    .from(firmMemberships)
    .innerJoin(firms, eq(firmMemberships.firmId, firms.id))
    .where(and(eq(firmMemberships.userId, userId), eq(firmMemberships.status, "active")))
    .limit(1);
  return rows[0];
}

export async function ensureWorkspace(user: User) {
  const existing = await getMembership(user.id);
  if (existing) return existing;

  const db = await requireDb();
  const firmSlug = `counselscribe-pilot-${user.id}`;
  const [{ id: firmId }] = await db
    .insert(firms)
    .values({
      name: "CounselScribe Pilot Firm",
      slug: firmSlug,
      createdByUserId: user.id,
      defaultProcessingMode: "hosted",
      retentionDays: 30,
      audioRetention: "delete_after_transcription",
      encryptionStatus: "platform_managed",
    })
    .$returningId();

  await db.insert(firmMemberships).values({
    firmId,
    userId: user.id,
    role: "administrator",
    status: "active",
  });

  const [{ id: templateId }] = await db
    .insert(documentTemplates)
    .values({
      firmId,
      name: "Florida Legal Memorandum",
      category: "memorandum",
      description: "Double-spaced legal memorandum with attorney-review footer.",
      bodyDefinition: DEFAULT_TEMPLATE_BODY,
      styleDefinition: DEFAULT_TEMPLATE_STYLE,
      active: true,
      createdByUserId: user.id,
    })
    .$returningId();

  const [{ id: matterId }] = await db
    .insert(matters)
    .values({
      firmId,
      name: "Hartwell Insurance Group — Synthetic Demo",
      matterNumber: "FL-DEMO-0247",
      clientName: "Hartwell Insurance Group",
      jurisdiction: "Florida",
      practiceArea: "Insurance defense",
      description: "Synthetic demonstration matter. Do not add real client or privileged information.",
      defaultTemplateId: templateId,
      createdByUserId: user.id,
    })
    .$returningId();

  await db.insert(matterEntities).values([
    {
      matterId,
      entityType: "organization",
      displayName: "Hartwell Insurance Group",
      aliases: ["heart well insurance group"],
      notes: "Synthetic demonstration client",
    },
    {
      matterId,
      entityType: "party",
      displayName: "Jones et al.",
      aliases: ["Jones at all"],
      notes: "Synthetic demonstration party",
    },
  ]);

  await db.insert(glossaryTerms).values([
    { firmId, matterId, scope: "matter", heardPhrase: "motion and lemonade", approvedText: "motion in limine", category: "Latin" },
    { firmId, matterId, scope: "matter", heardPhrase: "Florida statute ninety point four zero eight", approvedText: "Florida Statute § 90.408", category: "Florida" },
    { firmId, matterId, scope: "matter", heardPhrase: "record on a peel", approvedText: "record on appeal", category: "Appellate" },
    { firmId, matterId, scope: "matter", heardPhrase: "Jones at all", approvedText: "Jones et al.", category: "Party" },
  ]);

  await db.insert(localCompanions).values({
    firmId,
    name: "Firm Mac mini",
    status: "not_configured",
    enabled: false,
  });

  await appendAudit({
    firmId,
    actorUserId: user.id,
    matterId,
    eventType: "workspace.created",
    resourceType: "firm",
    resourceId: String(firmId),
    metadata: { syntheticMatterCreated: true },
  });

  const created = await getMembership(user.id);
  if (!created) throw new Error("Workspace could not be created");
  return created;
}

export async function appendAudit(input: typeof auditEvents.$inferInsert) {
  const db = await requireDb();
  await db.insert(auditEvents).values(input);
}

export async function listMattersForUser(userId: number) {
  const membership = await getMembership(userId);
  if (!membership) return [];
  const db = await requireDb();
  return db
    .select()
    .from(matters)
    .where(eq(matters.firmId, membership.firm.id))
    .orderBy(desc(matters.updatedAt));
}

export async function assertMatterAccess(userId: number, matterId: number) {
  const membership = await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  const db = await requireDb();
  const rows = await db
    .select()
    .from(matters)
    .where(and(eq(matters.id, matterId), eq(matters.firmId, membership.firm.id)))
    .limit(1);
  if (!rows[0]) throw new Error("Matter not found or access denied");
  return { membership, matter: rows[0] };
}

export async function getMatterBundle(userId: number, matterId: number) {
  const { membership, matter } = await assertMatterAccess(userId, matterId);
  const db = await requireDb();
  const [entities, terms, templates, sessions] = await Promise.all([
    db.select().from(matterEntities).where(and(eq(matterEntities.matterId, matterId), eq(matterEntities.active, true))).orderBy(asc(matterEntities.displayName)),
    db.select().from(glossaryTerms).where(and(eq(glossaryTerms.firmId, membership.firm.id), eq(glossaryTerms.active, true), or(eq(glossaryTerms.matterId, matterId), eq(glossaryTerms.scope, "firm")))).orderBy(desc(glossaryTerms.updatedAt)),
    db.select().from(documentTemplates).where(and(eq(documentTemplates.firmId, membership.firm.id), eq(documentTemplates.active, true))).orderBy(asc(documentTemplates.name)),
    db.select().from(dictationSessions).where(eq(dictationSessions.matterId, matterId)).orderBy(desc(dictationSessions.updatedAt)),
  ]);
  return { firm: membership.firm, membership: membership.membership, matter, entities, terms, templates, sessions };
}

export async function createMatter(user: User, input: {
  name: string;
  matterNumber: string;
  clientName: string;
  jurisdiction: string;
  practiceArea: string;
  description?: string;
}) {
  const workspace = await ensureWorkspace(user);
  const db = await requireDb();
  const [{ id }] = await db
    .insert(matters)
    .values({ ...input, firmId: workspace.firm.id, createdByUserId: user.id })
    .$returningId();
  await appendAudit({ firmId: workspace.firm.id, actorUserId: user.id, matterId: id, eventType: "matter.created", resourceType: "matter", resourceId: String(id) });
  return id;
}

export async function addMatterEntity(userId: number, input: {
  matterId: number;
  entityType: typeof matterEntities.$inferInsert.entityType;
  displayName: string;
  aliases: string[];
  notes?: string;
}) {
  const { membership } = await assertMatterAccess(userId, input.matterId);
  const db = await requireDb();
  const [{ id }] = await db.insert(matterEntities).values(input).$returningId();
  await appendAudit({ firmId: membership.firm.id, actorUserId: userId, matterId: input.matterId, eventType: "matter.entity_added", resourceType: "matter_entity", resourceId: String(id), metadata: { entityType: input.entityType } });
  return id;
}

export async function addGlossaryTerm(userId: number, input: {
  matterId?: number;
  scope: "firm" | "matter" | "user";
  heardPhrase: string;
  approvedText: string;
  category: string;
  notes?: string;
  sourceDecisionId?: number;
}) {
  const membership = input.matterId
    ? (await assertMatterAccess(userId, input.matterId)).membership
    : await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  const db = await requireDb();
  const [{ id }] = await db
    .insert(glossaryTerms)
    .values({
      firmId: membership.firm.id,
      matterId: input.scope === "matter" ? input.matterId : null,
      userId: input.scope === "user" ? userId : null,
      sourceDecisionId: input.sourceDecisionId ?? null,
      scope: input.scope,
      heardPhrase: input.heardPhrase,
      approvedText: input.approvedText,
      category: input.category,
      notes: input.notes,
      acceptedCount: input.sourceDecisionId ? 1 : 0,
    })
    .$returningId();
  await appendAudit({ firmId: membership.firm.id, actorUserId: userId, matterId: input.matterId, eventType: "glossary.term_added", resourceType: "glossary_term", resourceId: String(id), metadata: { scope: input.scope } });
  return id;
}

export async function createSession(userId: number, input: {
  matterId: number;
  title: string;
  sourceType: "live" | "upload" | "demo";
  processingMode: "browser" | "hosted" | "local";
  status?: "draft" | "uploaded" | "transcribing" | "review" | "complete" | "failed";
  durationMs?: number;
}) {
  const { membership } = await assertMatterAccess(userId, input.matterId);
  const db = await requireDb();
  const [{ id }] = await db
    .insert(dictationSessions)
    .values({ ...input, createdByUserId: userId })
    .$returningId();
  await appendAudit({ firmId: membership.firm.id, actorUserId: userId, matterId: input.matterId, sessionId: id, eventType: "session.created", resourceType: "session", resourceId: String(id), metadata: { sourceType: input.sourceType, processingMode: input.processingMode } });
  return id;
}

export async function attachAudioAsset(userId: number, input: {
  sessionId: number;
  storageKey: string;
  storageUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  checksumSha256?: string;
  durationMs?: number;
}) {
  const sessionAccess = await assertSessionAccess(userId, input.sessionId);
  const db = await requireDb();
  const [{ id }] = await db.insert(audioAssets).values(input).$returningId();
  await appendAudit({ firmId: sessionAccess.membership.firm.id, actorUserId: userId, matterId: sessionAccess.matter.id, sessionId: input.sessionId, eventType: "audio.uploaded", resourceType: "audio_asset", resourceId: String(id), metadata: { fileName: input.fileName, sizeBytes: input.sizeBytes } });
  return id;
}

export async function assertSessionAccess(userId: number, sessionId: number) {
  const db = await requireDb();
  const rows = await db
    .select({ session: dictationSessions, matter: matters })
    .from(dictationSessions)
    .innerJoin(matters, eq(dictationSessions.matterId, matters.id))
    .where(eq(dictationSessions.id, sessionId))
    .limit(1);
  if (!rows[0]) throw new Error("Session not found");
  const membership = await getMembership(userId);
  if (!membership || membership.firm.id !== rows[0].matter.firmId) throw new Error("Session access denied");
  return { ...rows[0], membership };
}

export async function updateSession(userId: number, sessionId: number, values: Partial<typeof dictationSessions.$inferInsert>) {
  await assertSessionAccess(userId, sessionId);
  const db = await requireDb();
  await db.update(dictationSessions).set(values).where(eq(dictationSessions.id, sessionId));
}

export async function replaceTranscriptSegments(userId: number, sessionId: number, segments: SegmentInput[]) {
  await assertSessionAccess(userId, sessionId);
  const db = await requireDb();
  await db.delete(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId));
  if (segments.length) {
    await db.insert(transcriptSegments).values(segments.map(segment => ({
      sessionId,
      ...segment,
      confidence: segment.confidence == null ? null : String(segment.confidence),
    })));
  }
}

export async function saveVersion(userId: number, input: {
  sessionId: number;
  kind: "raw" | "normalized" | "reviewed" | "exported";
  content: string;
  decisionCount?: number;
  restoredFromVersionId?: number;
}) {
  const access = await assertSessionAccess(userId, input.sessionId);
  const db = await requireDb();
  const existing = await db.select({ id: documentVersions.id }).from(documentVersions).where(eq(documentVersions.sessionId, input.sessionId));
  const versionNumber = existing.length + 1;
  const [{ id }] = await db.insert(documentVersions).values({ ...input, createdByUserId: userId, versionNumber }).$returningId();
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: access.matter.id, sessionId: input.sessionId, eventType: input.restoredFromVersionId ? "version.restored" : "version.created", resourceType: "document_version", resourceId: String(id), metadata: { kind: input.kind, versionNumber, restoredFromVersionId: input.restoredFromVersionId } });
  return { id, versionNumber };
}

export async function saveReviewDecision(userId: number, input: {
  sessionId: number;
  segmentId?: number;
  documentVersionId?: number;
  decisionType: "accept" | "reject" | "manual_edit" | "restore" | "teach_term";
  category: string;
  originalText: string;
  replacementText?: string;
  reason?: string;
  confidence?: number;
  audioStartMs?: number;
  audioEndMs?: number;
}) {
  const access = await assertSessionAccess(userId, input.sessionId);
  const db = await requireDb();
  const [{ id }] = await db.insert(reviewDecisions).values({
    ...input,
    actorUserId: userId,
    confidence: input.confidence == null ? null : String(input.confidence),
  }).$returningId();
  await appendAudit({ firmId: access.membership.firm.id, actorUserId: userId, matterId: access.matter.id, sessionId: input.sessionId, eventType: `review.${input.decisionType}`, resourceType: "review_decision", resourceId: String(id), metadata: { category: input.category } });
  return id;
}

export async function getSessionBundle(userId: number, sessionId: number) {
  const access = await assertSessionAccess(userId, sessionId);
  const db = await requireDb();
  const [audio, segments, versions, decisions, terms] = await Promise.all([
    db.select().from(audioAssets).where(eq(audioAssets.sessionId, sessionId)).limit(1),
    db.select().from(transcriptSegments).where(eq(transcriptSegments.sessionId, sessionId)).orderBy(asc(transcriptSegments.sequence)),
    db.select().from(documentVersions).where(eq(documentVersions.sessionId, sessionId)).orderBy(desc(documentVersions.versionNumber)),
    db.select().from(reviewDecisions).where(eq(reviewDecisions.sessionId, sessionId)).orderBy(desc(reviewDecisions.createdAt)),
    db.select().from(glossaryTerms).where(and(eq(glossaryTerms.firmId, access.membership.firm.id), eq(glossaryTerms.active, true), or(eq(glossaryTerms.scope, "firm"), eq(glossaryTerms.matterId, access.matter.id), and(eq(glossaryTerms.scope, "user"), eq(glossaryTerms.userId, userId))))).orderBy(desc(glossaryTerms.updatedAt)),
  ]);
  return { firm: access.membership.firm, membership: access.membership.membership, matter: access.matter, session: access.session, audio: audio[0] ?? null, segments, versions, decisions, terms };
}

export async function listSessionsForUser(userId: number) {
  const membership = await getMembership(userId);
  if (!membership) return [];
  const db = await requireDb();
  return db
    .select({ session: dictationSessions, matter: matters })
    .from(dictationSessions)
    .innerJoin(matters, eq(dictationSessions.matterId, matters.id))
    .where(eq(matters.firmId, membership.firm.id))
    .orderBy(desc(dictationSessions.updatedAt));
}

export async function listAuditForUser(userId: number, limit = 100) {
  const membership = await getMembership(userId);
  if (!membership) return [];
  const db = await requireDb();
  return db.select().from(auditEvents).where(eq(auditEvents.firmId, membership.firm.id)).orderBy(desc(auditEvents.createdAt)).limit(limit);
}

export async function createComparison(userId: number, input: {
  matterId?: number;
  sessionId?: number;
  label: string;
  dragonTranscript: string;
  counselTranscript: string;
  referenceTranscript?: string;
  dragonWer?: number;
  counselWer?: number;
  legalTermAccuracy?: number;
  correctionBurden?: number;
  timeSavedMinutes?: number;
}) {
  const membership = input.matterId ? (await assertMatterAccess(userId, input.matterId)).membership : await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  const db = await requireDb();
  const [{ id }] = await db.insert(comparisonRuns).values({
    firmId: membership.firm.id,
    matterId: input.matterId,
    sessionId: input.sessionId,
    createdByUserId: userId,
    label: input.label,
    dragonTranscript: input.dragonTranscript,
    counselTranscript: input.counselTranscript,
    referenceTranscript: input.referenceTranscript,
    dragonWer: input.dragonWer == null ? null : String(input.dragonWer),
    counselWer: input.counselWer == null ? null : String(input.counselWer),
    legalTermAccuracy: input.legalTermAccuracy == null ? null : String(input.legalTermAccuracy),
    correctionBurden: input.correctionBurden == null ? null : String(input.correctionBurden),
    timeSavedMinutes: input.timeSavedMinutes == null ? null : String(input.timeSavedMinutes),
    status: input.referenceTranscript ? "measured" : "draft",
  }).$returningId();
  await appendAudit({ firmId: membership.firm.id, actorUserId: userId, matterId: input.matterId, sessionId: input.sessionId, eventType: "comparison.created", resourceType: "comparison", resourceId: String(id) });
  return id;
}

export async function listComparisons(userId: number) {
  const membership = await getMembership(userId);
  if (!membership) return [];
  const db = await requireDb();
  return db.select().from(comparisonRuns).where(eq(comparisonRuns.firmId, membership.firm.id)).orderBy(desc(comparisonRuns.updatedAt));
}

export async function listTemplates(userId: number) {
  const membership = await getMembership(userId);
  if (!membership) return [];
  const db = await requireDb();
  return db.select().from(documentTemplates).where(and(eq(documentTemplates.firmId, membership.firm.id), eq(documentTemplates.active, true))).orderBy(asc(documentTemplates.name));
}

export async function getFirmAdminBundle(userId: number) {
  const membership = await getMembership(userId);
  if (!membership) throw new Error("Firm membership is required");
  const db = await requireDb();
  const [members, companions] = await Promise.all([
    db
      .select({ membership: firmMemberships, user: users })
      .from(firmMemberships)
      .innerJoin(users, eq(firmMemberships.userId, users.id))
      .where(eq(firmMemberships.firmId, membership.firm.id))
      .orderBy(asc(users.name)),
    db.select().from(localCompanions).where(eq(localCompanions.firmId, membership.firm.id)),
  ]);
  return { firm: membership.firm, membership: membership.membership, members, companions };
}

export async function updateFirmSettings(userId: number, input: {
  defaultProcessingMode: "browser" | "hosted" | "local";
  retentionDays: number;
  audioRetention: "keep" | "delete_after_transcription" | "manual";
}) {
  const membership = await getMembership(userId);
  if (!membership || membership.membership.role !== "administrator") throw new Error("Firm administrator access is required");
  const db = await requireDb();
  await db.update(firms).set(input).where(eq(firms.id, membership.firm.id));
  await appendAudit({ firmId: membership.firm.id, actorUserId: userId, eventType: "firm.settings_updated", resourceType: "firm", resourceId: String(membership.firm.id), metadata: input });
}

export async function getAudioForSession(userId: number, sessionId: number) {
  await assertSessionAccess(userId, sessionId);
  const db = await requireDb();
  const rows = await db.select().from(audioAssets).where(eq(audioAssets.sessionId, sessionId)).limit(1);
  return rows[0] ?? null;
}
