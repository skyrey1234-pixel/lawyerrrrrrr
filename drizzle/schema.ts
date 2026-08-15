import {
  boolean,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

/**
 * CounselScribe pilot schema.
 * File bytes stay in object storage; the database stores only controlled references and metadata.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const firms = mysqlTable(
  "firms",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 180 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    defaultProcessingMode: mysqlEnum("defaultProcessingMode", ["browser", "hosted", "local"])
      .default("hosted")
      .notNull(),
    retentionDays: int("retentionDays").default(30).notNull(),
    audioRetention: mysqlEnum("audioRetention", ["keep", "delete_after_transcription", "manual"])
      .default("delete_after_transcription")
      .notNull(),
    encryptionStatus: mysqlEnum("encryptionStatus", ["platform_managed", "firm_managed", "not_configured"])
      .default("platform_managed")
      .notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [uniqueIndex("firms_slug_unique").on(table.slug)],
);

export const firmMemberships = mysqlTable(
  "firm_memberships",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    userId: int("userId").notNull().references(() => users.id),
    role: mysqlEnum("role", ["administrator", "attorney", "reviewer"]).default("attorney").notNull(),
    status: mysqlEnum("status", ["invited", "active", "suspended"]).default("active").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("firm_memberships_firm_user_unique").on(table.firmId, table.userId),
    index("firm_memberships_user_idx").on(table.userId),
  ],
);

export const documentTemplates = mysqlTable(
  "document_templates",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    name: varchar("name", { length: 180 }).notNull(),
    category: mysqlEnum("category", ["memorandum", "motion", "letter", "pleading", "note", "custom"])
      .default("memorandum")
      .notNull(),
    description: text("description"),
    bodyDefinition: json("bodyDefinition").$type<Record<string, unknown>>().notNull(),
    styleDefinition: json("styleDefinition").$type<Record<string, unknown>>().notNull(),
    active: boolean("active").default(true).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("document_templates_firm_idx").on(table.firmId)],
);

export const matters = mysqlTable(
  "matters",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    name: varchar("name", { length: 220 }).notNull(),
    matterNumber: varchar("matterNumber", { length: 80 }).notNull(),
    clientName: varchar("clientName", { length: 220 }).notNull(),
    jurisdiction: varchar("jurisdiction", { length: 120 }).default("Florida").notNull(),
    practiceArea: varchar("practiceArea", { length: 160 }).notNull(),
    status: mysqlEnum("status", ["active", "on_hold", "closed"]).default("active").notNull(),
    description: text("description"),
    defaultTemplateId: int("defaultTemplateId").references(() => documentTemplates.id),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("matters_firm_number_unique").on(table.firmId, table.matterNumber),
    index("matters_firm_status_idx").on(table.firmId, table.status),
  ],
);

export const matterEntities = mysqlTable(
  "matter_entities",
  {
    id: int("id").autoincrement().primaryKey(),
    matterId: int("matterId").notNull().references(() => matters.id),
    entityType: mysqlEnum("entityType", [
      "party",
      "attorney",
      "expert",
      "organization",
      "medical_provider",
      "judge",
      "other",
    ]).notNull(),
    displayName: varchar("displayName", { length: 240 }).notNull(),
    aliases: json("aliases").$type<string[]>().notNull(),
    notes: text("notes"),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("matter_entities_matter_idx").on(table.matterId)],
);

export const dictationSessions = mysqlTable(
  "dictation_sessions",
  {
    id: int("id").autoincrement().primaryKey(),
    matterId: int("matterId").notNull().references(() => matters.id),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    title: varchar("title", { length: 240 }).notNull(),
    sourceType: mysqlEnum("sourceType", ["live", "upload", "demo"]).notNull(),
    processingMode: mysqlEnum("processingMode", ["browser", "hosted", "local"]).notNull(),
    status: mysqlEnum("status", ["draft", "uploaded", "transcribing", "review", "complete", "failed"])
      .default("draft")
      .notNull(),
    language: varchar("language", { length: 24 }).default("en-US").notNull(),
    durationMs: int("durationMs").default(0).notNull(),
    wordCount: int("wordCount").default(0).notNull(),
    errorMessage: text("errorMessage"),
    startedAt: timestamp("startedAt"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("dictation_sessions_matter_idx").on(table.matterId),
    index("dictation_sessions_user_status_idx").on(table.createdByUserId, table.status),
  ],
);

export const audioAssets = mysqlTable(
  "audio_assets",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull().references(() => dictationSessions.id),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: text("storageUrl").notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    mimeType: varchar("mimeType", { length: 120 }).notNull(),
    sizeBytes: int("sizeBytes").notNull(),
    durationMs: int("durationMs").default(0).notNull(),
    checksumSha256: varchar("checksumSha256", { length: 64 }),
    retentionStatus: mysqlEnum("retentionStatus", ["retained", "delete_pending", "released"])
      .default("retained")
      .notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [uniqueIndex("audio_assets_session_unique").on(table.sessionId)],
);

export const transcriptSegments = mysqlTable(
  "transcript_segments",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull().references(() => dictationSessions.id),
    sequence: int("sequence").notNull(),
    startMs: int("startMs").notNull(),
    endMs: int("endMs").notNull(),
    sourceText: text("sourceText").notNull(),
    normalizedText: text("normalizedText"),
    speakerLabel: varchar("speakerLabel", { length: 80 }),
    confidence: decimal("confidence", { precision: 5, scale: 4 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("transcript_segments_session_sequence_unique").on(table.sessionId, table.sequence),
    index("transcript_segments_session_time_idx").on(table.sessionId, table.startMs),
  ],
);

export const documentVersions = mysqlTable(
  "document_versions",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull().references(() => dictationSessions.id),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    versionNumber: int("versionNumber").notNull(),
    kind: mysqlEnum("kind", ["raw", "normalized", "reviewed", "exported"]).notNull(),
    content: text("content").notNull(),
    decisionCount: int("decisionCount").default(0).notNull(),
    restoredFromVersionId: int("restoredFromVersionId"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    uniqueIndex("document_versions_session_version_unique").on(table.sessionId, table.versionNumber),
    index("document_versions_session_kind_idx").on(table.sessionId, table.kind),
  ],
);

export const reviewDecisions = mysqlTable(
  "review_decisions",
  {
    id: int("id").autoincrement().primaryKey(),
    sessionId: int("sessionId").notNull().references(() => dictationSessions.id),
    segmentId: int("segmentId").references(() => transcriptSegments.id),
    documentVersionId: int("documentVersionId").references(() => documentVersions.id),
    actorUserId: int("actorUserId").notNull().references(() => users.id),
    decisionType: mysqlEnum("decisionType", ["accept", "reject", "manual_edit", "restore", "teach_term"]).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    originalText: text("originalText").notNull(),
    replacementText: text("replacementText"),
    reason: text("reason"),
    confidence: decimal("confidence", { precision: 5, scale: 4 }),
    audioStartMs: int("audioStartMs"),
    audioEndMs: int("audioEndMs"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("review_decisions_session_idx").on(table.sessionId),
    index("review_decisions_actor_idx").on(table.actorUserId),
  ],
);

export const glossaryTerms = mysqlTable(
  "glossary_terms",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    matterId: int("matterId").references(() => matters.id),
    userId: int("userId").references(() => users.id),
    sourceDecisionId: int("sourceDecisionId").references(() => reviewDecisions.id),
    scope: mysqlEnum("scope", ["firm", "matter", "user"]).notNull(),
    heardPhrase: varchar("heardPhrase", { length: 320 }).notNull(),
    approvedText: varchar("approvedText", { length: 320 }).notNull(),
    category: varchar("category", { length: 100 }).default("Custom").notNull(),
    notes: text("notes"),
    useCount: int("useCount").default(0).notNull(),
    acceptedCount: int("acceptedCount").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("glossary_terms_firm_scope_idx").on(table.firmId, table.scope),
    index("glossary_terms_matter_idx").on(table.matterId),
  ],
);

export const comparisonRuns = mysqlTable(
  "comparison_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    matterId: int("matterId").references(() => matters.id),
    sessionId: int("sessionId").references(() => dictationSessions.id),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    label: varchar("label", { length: 220 }).notNull(),
    dragonTranscript: text("dragonTranscript").notNull(),
    counselTranscript: text("counselTranscript").notNull(),
    referenceTranscript: text("referenceTranscript"),
    dragonWer: decimal("dragonWer", { precision: 6, scale: 3 }),
    counselWer: decimal("counselWer", { precision: 6, scale: 3 }),
    legalTermAccuracy: decimal("legalTermAccuracy", { precision: 6, scale: 3 }),
    correctionBurden: decimal("correctionBurden", { precision: 6, scale: 3 }),
    timeSavedMinutes: decimal("timeSavedMinutes", { precision: 8, scale: 2 }),
    status: mysqlEnum("status", ["draft", "measured", "verified"]).default("draft").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("comparison_runs_firm_idx").on(table.firmId)],
);

export const localCompanions = mysqlTable(
  "local_companions",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    name: varchar("name", { length: 180 }).notNull(),
    status: mysqlEnum("status", ["not_configured", "offline", "online", "degraded"])
      .default("not_configured")
      .notNull(),
    endpointLabel: varchar("endpointLabel", { length: 255 }),
    modelName: varchar("modelName", { length: 160 }),
    modelVersion: varchar("modelVersion", { length: 80 }),
    certificateFingerprint: varchar("certificateFingerprint", { length: 128 }),
    enabled: boolean("enabled").default(false).notNull(),
    lastSeenAt: timestamp("lastSeenAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [index("local_companions_firm_idx").on(table.firmId)],
);

export const sourceDocuments = mysqlTable(
  "source_documents",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    matterId: int("matterId").notNull().references(() => matters.id),
    sessionId: int("sessionId").references(() => dictationSessions.id),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    title: varchar("title", { length: 240 }).notNull(),
    sourceType: mysqlEnum("sourceType", ["pasted_text", "transcript", "uploaded_text"]).notNull(),
    mimeType: varchar("mimeType", { length: 120 }),
    originalFileName: varchar("originalFileName", { length: 255 }),
    storageKey: varchar("storageKey", { length: 512 }),
    storageUrl: text("storageUrl"),
    contentSnapshot: text("contentSnapshot").notNull(),
    contentHash: varchar("contentHash", { length: 64 }).notNull(),
    characterCount: int("characterCount").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("source_documents_matter_created_idx").on(table.matterId, table.createdAt),
    index("source_documents_session_idx").on(table.sessionId),
  ],
);

export const aiAnalysisRuns = mysqlTable(
  "ai_analysis_runs",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    matterId: int("matterId").notNull().references(() => matters.id),
    sourceDocumentId: int("sourceDocumentId").notNull().references(() => sourceDocuments.id),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    modelId: varchar("modelId", { length: 120 }).notNull(),
    promptVersion: varchar("promptVersion", { length: 80 }).notNull(),
    status: mysqlEnum("status", ["running", "completed", "failed"]).default("running").notNull(),
    summary: text("summary"),
    resultJson: json("resultJson").$type<Record<string, unknown>>(),
    inputTokens: int("inputTokens"),
    outputTokens: int("outputTokens"),
    errorMessage: text("errorMessage"),
    completedAt: timestamp("completedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ai_analysis_runs_matter_created_idx").on(table.matterId, table.createdAt)],
);

export const aiAnalysisItems = mysqlTable(
  "ai_analysis_items",
  {
    id: int("id").autoincrement().primaryKey(),
    analysisRunId: int("analysisRunId").notNull().references(() => aiAnalysisRuns.id),
    itemType: mysqlEnum("itemType", ["fact", "entity", "date", "deadline", "action", "vocabulary", "billing"]).notNull(),
    label: varchar("label", { length: 240 }).notNull(),
    value: text("value").notNull(),
    sourceQuote: text("sourceQuote").notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 4 }),
    status: mysqlEnum("status", ["proposed", "accepted", "rejected"]).default("proposed").notNull(),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    reviewedByUserId: int("reviewedByUserId").references(() => users.id),
    reviewedAt: timestamp("reviewedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("ai_analysis_items_run_type_idx").on(table.analysisRunId, table.itemType)],
);

export const firmBillingCodes = mysqlTable(
  "firm_billing_codes",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    code: varchar("code", { length: 40 }).notNull(),
    label: varchar("label", { length: 180 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    description: text("description"),
    defaultNarrative: text("defaultNarrative"),
    displayOrder: int("displayOrder").default(0).notNull(),
    active: boolean("active").default(true).notNull(),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    updatedByUserId: int("updatedByUserId").references(() => users.id),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    uniqueIndex("firm_billing_codes_firm_code_unique").on(table.firmId, table.code),
    index("firm_billing_codes_firm_active_order_idx").on(table.firmId, table.active, table.displayOrder),
    index("firm_billing_codes_firm_category_idx").on(table.firmId, table.category),
  ],
);

export const billingTimers = mysqlTable(
  "billing_timers",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    matterId: int("matterId").notNull().references(() => matters.id),
    userId: int("userId").notNull().references(() => users.id),
    sessionId: int("sessionId").references(() => dictationSessions.id),
    billingCodeId: int("billingCodeId").references(() => firmBillingCodes.id),
    activityCode: varchar("activityCode", { length: 80 }).notNull(),
    narrative: text("narrative").notNull(),
    status: mysqlEnum("status", ["running", "stopped", "cancelled"]).default("running").notNull(),
    startedAt: timestamp("startedAt").defaultNow().notNull(),
    stoppedAt: timestamp("stoppedAt"),
    elapsedSeconds: int("elapsedSeconds"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("billing_timers_user_status_idx").on(table.userId, table.status),
    index("billing_timers_matter_idx").on(table.matterId),
  ],
);

export const billingEntries = mysqlTable(
  "billing_entries",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    matterId: int("matterId").notNull().references(() => matters.id),
    userId: int("userId").notNull().references(() => users.id),
    sessionId: int("sessionId").references(() => dictationSessions.id),
    sourceDocumentId: int("sourceDocumentId").references(() => sourceDocuments.id),
    analysisRunId: int("analysisRunId").references(() => aiAnalysisRuns.id),
    timerId: int("timerId").references(() => billingTimers.id),
    billingCodeId: int("billingCodeId").references(() => firmBillingCodes.id),
    workDate: timestamp("workDate").defaultNow().notNull(),
    activityCode: varchar("activityCode", { length: 80 }).notNull(),
    narrative: text("narrative").notNull(),
    durationSeconds: int("durationSeconds"),
    durationSource: mysqlEnum("durationSource", ["timer", "explicit_statement", "manual", "none"]).default("none").notNull(),
    sourceType: mysqlEnum("sourceType", ["timer", "voice", "transcript", "document", "manual"]).notNull(),
    sourceIdentifier: varchar("sourceIdentifier", { length: 180 }),
    sourceQuote: text("sourceQuote"),
    sourceStartMs: int("sourceStartMs"),
    sourceEndMs: int("sourceEndMs"),
    status: mysqlEnum("status", ["needs_duration", "draft", "approved", "rejected", "exported"]).default("needs_duration").notNull(),
    confidence: decimal("confidence", { precision: 5, scale: 4 }),
    duplicateFingerprint: varchar("duplicateFingerprint", { length: 64 }).notNull(),
    duplicateOfEntryId: int("duplicateOfEntryId"),
    approvedByUserId: int("approvedByUserId").references(() => users.id),
    approvedAt: timestamp("approvedAt"),
    rejectedAt: timestamp("rejectedAt"),
    exportedAt: timestamp("exportedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => [
    index("billing_entries_firm_status_idx").on(table.firmId, table.status),
    index("billing_entries_matter_work_idx").on(table.matterId, table.workDate),
    index("billing_entries_fingerprint_idx").on(table.duplicateFingerprint),
  ],
);

export const billingExports = mysqlTable(
  "billing_exports",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    createdByUserId: int("createdByUserId").notNull().references(() => users.id),
    format: mysqlEnum("format", ["csv"]).default("csv").notNull(),
    fileName: varchar("fileName", { length: 255 }).notNull(),
    storageKey: varchar("storageKey", { length: 512 }).notNull(),
    storageUrl: text("storageUrl").notNull(),
    entryIds: json("entryIds").$type<number[]>().notNull(),
    entryCount: int("entryCount").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [index("billing_exports_firm_created_idx").on(table.firmId, table.createdAt)],
);

export const auditEvents = mysqlTable(
  "audit_events",
  {
    id: int("id").autoincrement().primaryKey(),
    firmId: int("firmId").notNull().references(() => firms.id),
    actorUserId: int("actorUserId").references(() => users.id),
    matterId: int("matterId").references(() => matters.id),
    sessionId: int("sessionId").references(() => dictationSessions.id),
    eventType: varchar("eventType", { length: 120 }).notNull(),
    resourceType: varchar("resourceType", { length: 80 }).notNull(),
    resourceId: varchar("resourceId", { length: 120 }),
    metadata: json("metadata").$type<Record<string, unknown>>(),
    ipHash: varchar("ipHash", { length: 64 }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => [
    index("audit_events_firm_created_idx").on(table.firmId, table.createdAt),
    index("audit_events_session_idx").on(table.sessionId),
  ],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Firm = typeof firms.$inferSelect;
export type Matter = typeof matters.$inferSelect;
export type DictationSession = typeof dictationSessions.$inferSelect;
export type TranscriptSegment = typeof transcriptSegments.$inferSelect;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type GlossaryTerm = typeof glossaryTerms.$inferSelect;
export type AuditEvent = typeof auditEvents.$inferSelect;
export type SourceDocument = typeof sourceDocuments.$inferSelect;
export type AiAnalysisRun = typeof aiAnalysisRuns.$inferSelect;
export type AiAnalysisItem = typeof aiAnalysisItems.$inferSelect;
export type FirmBillingCode = typeof firmBillingCodes.$inferSelect;
export type BillingTimer = typeof billingTimers.$inferSelect;
export type BillingEntry = typeof billingEntries.$inferSelect;
