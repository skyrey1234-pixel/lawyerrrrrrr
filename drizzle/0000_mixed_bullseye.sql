CREATE TABLE `audio_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` text NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`sizeBytes` int NOT NULL,
	`durationMs` int NOT NULL DEFAULT 0,
	`checksumSha256` varchar(64),
	`retentionStatus` enum('retained','delete_pending','released') NOT NULL DEFAULT 'retained',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audio_assets_id` PRIMARY KEY(`id`),
	CONSTRAINT `audio_assets_session_unique` UNIQUE(`sessionId`)
);
--> statement-breakpoint
CREATE TABLE `audit_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`actorUserId` int,
	`matterId` int,
	`sessionId` int,
	`eventType` varchar(120) NOT NULL,
	`resourceType` varchar(80) NOT NULL,
	`resourceId` varchar(120),
	`metadata` json,
	`ipHash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `comparison_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`matterId` int,
	`sessionId` int,
	`createdByUserId` int NOT NULL,
	`label` varchar(220) NOT NULL,
	`dragonTranscript` text NOT NULL,
	`counselTranscript` text NOT NULL,
	`referenceTranscript` text,
	`dragonWer` decimal(6,3),
	`counselWer` decimal(6,3),
	`legalTermAccuracy` decimal(6,3),
	`correctionBurden` decimal(6,3),
	`timeSavedMinutes` decimal(8,2),
	`status` enum('draft','measured','verified') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `comparison_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dictation_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matterId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`sourceType` enum('live','upload','demo') NOT NULL,
	`processingMode` enum('browser','hosted','local') NOT NULL,
	`status` enum('draft','uploaded','transcribing','review','complete','failed') NOT NULL DEFAULT 'draft',
	`language` varchar(24) NOT NULL DEFAULT 'en-US',
	`durationMs` int NOT NULL DEFAULT 0,
	`wordCount` int NOT NULL DEFAULT 0,
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dictation_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`category` enum('memorandum','motion','letter','pleading','note','custom') NOT NULL DEFAULT 'memorandum',
	`description` text,
	`bodyDefinition` json NOT NULL,
	`styleDefinition` json NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `document_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `document_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`kind` enum('raw','normalized','reviewed','exported') NOT NULL,
	`content` text NOT NULL,
	`decisionCount` int NOT NULL DEFAULT 0,
	`restoredFromVersionId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `document_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `document_versions_session_version_unique` UNIQUE(`sessionId`,`versionNumber`)
);
--> statement-breakpoint
CREATE TABLE `firm_memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('administrator','attorney','reviewer') NOT NULL DEFAULT 'attorney',
	`status` enum('invited','active','suspended') NOT NULL DEFAULT 'active',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_memberships_id` PRIMARY KEY(`id`),
	CONSTRAINT `firm_memberships_firm_user_unique` UNIQUE(`firmId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `firms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(180) NOT NULL,
	`slug` varchar(120) NOT NULL,
	`defaultProcessingMode` enum('browser','hosted','local') NOT NULL DEFAULT 'hosted',
	`retentionDays` int NOT NULL DEFAULT 30,
	`audioRetention` enum('keep','delete_after_transcription','manual') NOT NULL DEFAULT 'delete_after_transcription',
	`encryptionStatus` enum('platform_managed','firm_managed','not_configured') NOT NULL DEFAULT 'platform_managed',
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firms_id` PRIMARY KEY(`id`),
	CONSTRAINT `firms_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `glossary_terms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`matterId` int,
	`userId` int,
	`sourceDecisionId` int,
	`scope` enum('firm','matter','user') NOT NULL,
	`heardPhrase` varchar(320) NOT NULL,
	`approvedText` varchar(320) NOT NULL,
	`category` varchar(100) NOT NULL DEFAULT 'Custom',
	`notes` text,
	`useCount` int NOT NULL DEFAULT 0,
	`acceptedCount` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `glossary_terms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `local_companions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`status` enum('not_configured','offline','online','degraded') NOT NULL DEFAULT 'not_configured',
	`endpointLabel` varchar(255),
	`modelName` varchar(160),
	`modelVersion` varchar(80),
	`certificateFingerprint` varchar(128),
	`enabled` boolean NOT NULL DEFAULT false,
	`lastSeenAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `local_companions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matter_entities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`matterId` int NOT NULL,
	`entityType` enum('party','attorney','expert','organization','medical_provider','judge','other') NOT NULL,
	`displayName` varchar(240) NOT NULL,
	`aliases` json NOT NULL,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matter_entities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `matters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`name` varchar(220) NOT NULL,
	`matterNumber` varchar(80) NOT NULL,
	`clientName` varchar(220) NOT NULL,
	`jurisdiction` varchar(120) NOT NULL DEFAULT 'Florida',
	`practiceArea` varchar(160) NOT NULL,
	`status` enum('active','on_hold','closed') NOT NULL DEFAULT 'active',
	`description` text,
	`defaultTemplateId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `matters_id` PRIMARY KEY(`id`),
	CONSTRAINT `matters_firm_number_unique` UNIQUE(`firmId`,`matterNumber`)
);
--> statement-breakpoint
CREATE TABLE `review_decisions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`segmentId` int,
	`documentVersionId` int,
	`actorUserId` int NOT NULL,
	`decisionType` enum('accept','reject','manual_edit','restore','teach_term') NOT NULL,
	`category` varchar(80) NOT NULL,
	`originalText` text NOT NULL,
	`replacementText` text,
	`reason` text,
	`confidence` decimal(5,4),
	`audioStartMs` int,
	`audioEndMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `review_decisions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transcript_segments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`sequence` int NOT NULL,
	`startMs` int NOT NULL,
	`endMs` int NOT NULL,
	`sourceText` text NOT NULL,
	`normalizedText` text,
	`speakerLabel` varchar(80),
	`confidence` decimal(5,4),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `transcript_segments_id` PRIMARY KEY(`id`),
	CONSTRAINT `transcript_segments_session_sequence_unique` UNIQUE(`sessionId`,`sequence`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `audio_assets` ADD CONSTRAINT `audio_assets_sessionId_dictation_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `dictation_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_sessionId_dictation_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `dictation_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comparison_runs` ADD CONSTRAINT `comparison_runs_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comparison_runs` ADD CONSTRAINT `comparison_runs_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comparison_runs` ADD CONSTRAINT `comparison_runs_sessionId_dictation_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `dictation_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `comparison_runs` ADD CONSTRAINT `comparison_runs_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictation_sessions` ADD CONSTRAINT `dictation_sessions_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `dictation_sessions` ADD CONSTRAINT `dictation_sessions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_templates` ADD CONSTRAINT `document_templates_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_sessionId_dictation_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `dictation_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `document_versions` ADD CONSTRAINT `document_versions_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `firm_memberships` ADD CONSTRAINT `firm_memberships_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `firm_memberships` ADD CONSTRAINT `firm_memberships_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `firms` ADD CONSTRAINT `firms_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `glossary_terms` ADD CONSTRAINT `glossary_terms_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `glossary_terms` ADD CONSTRAINT `glossary_terms_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `glossary_terms` ADD CONSTRAINT `glossary_terms_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `glossary_terms` ADD CONSTRAINT `glossary_terms_sourceDecisionId_review_decisions_id_fk` FOREIGN KEY (`sourceDecisionId`) REFERENCES `review_decisions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `local_companions` ADD CONSTRAINT `local_companions_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matter_entities` ADD CONSTRAINT `matter_entities_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matters` ADD CONSTRAINT `matters_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matters` ADD CONSTRAINT `matters_defaultTemplateId_document_templates_id_fk` FOREIGN KEY (`defaultTemplateId`) REFERENCES `document_templates`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `matters` ADD CONSTRAINT `matters_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_decisions` ADD CONSTRAINT `review_decisions_sessionId_dictation_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `dictation_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_decisions` ADD CONSTRAINT `review_decisions_segmentId_transcript_segments_id_fk` FOREIGN KEY (`segmentId`) REFERENCES `transcript_segments`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_decisions` ADD CONSTRAINT `review_decisions_documentVersionId_document_versions_id_fk` FOREIGN KEY (`documentVersionId`) REFERENCES `document_versions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `review_decisions` ADD CONSTRAINT `review_decisions_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `transcript_segments` ADD CONSTRAINT `transcript_segments_sessionId_dictation_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `dictation_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `audit_events_firm_created_idx` ON `audit_events` (`firmId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `audit_events_session_idx` ON `audit_events` (`sessionId`);--> statement-breakpoint
CREATE INDEX `comparison_runs_firm_idx` ON `comparison_runs` (`firmId`);--> statement-breakpoint
CREATE INDEX `dictation_sessions_matter_idx` ON `dictation_sessions` (`matterId`);--> statement-breakpoint
CREATE INDEX `dictation_sessions_user_status_idx` ON `dictation_sessions` (`createdByUserId`,`status`);--> statement-breakpoint
CREATE INDEX `document_templates_firm_idx` ON `document_templates` (`firmId`);--> statement-breakpoint
CREATE INDEX `document_versions_session_kind_idx` ON `document_versions` (`sessionId`,`kind`);--> statement-breakpoint
CREATE INDEX `firm_memberships_user_idx` ON `firm_memberships` (`userId`);--> statement-breakpoint
CREATE INDEX `glossary_terms_firm_scope_idx` ON `glossary_terms` (`firmId`,`scope`);--> statement-breakpoint
CREATE INDEX `glossary_terms_matter_idx` ON `glossary_terms` (`matterId`);--> statement-breakpoint
CREATE INDEX `local_companions_firm_idx` ON `local_companions` (`firmId`);--> statement-breakpoint
CREATE INDEX `matter_entities_matter_idx` ON `matter_entities` (`matterId`);--> statement-breakpoint
CREATE INDEX `matters_firm_status_idx` ON `matters` (`firmId`,`status`);--> statement-breakpoint
CREATE INDEX `review_decisions_session_idx` ON `review_decisions` (`sessionId`);--> statement-breakpoint
CREATE INDEX `review_decisions_actor_idx` ON `review_decisions` (`actorUserId`);--> statement-breakpoint
CREATE INDEX `transcript_segments_session_time_idx` ON `transcript_segments` (`sessionId`,`startMs`);