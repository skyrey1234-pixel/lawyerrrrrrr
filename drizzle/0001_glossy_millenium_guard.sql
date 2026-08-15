CREATE TABLE `ai_analysis_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisRunId` int NOT NULL,
	`itemType` enum('fact','entity','date','deadline','action','vocabulary','billing') NOT NULL,
	`label` varchar(240) NOT NULL,
	`value` text NOT NULL,
	`sourceQuote` text NOT NULL,
	`confidence` decimal(5,4),
	`status` enum('proposed','accepted','rejected') NOT NULL DEFAULT 'proposed',
	`metadata` json,
	`reviewedByUserId` int,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_analysis_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_analysis_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`matterId` int NOT NULL,
	`sourceDocumentId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`modelId` varchar(120) NOT NULL,
	`promptVersion` varchar(80) NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`summary` text,
	`resultJson` json,
	`inputTokens` int,
	`outputTokens` int,
	`errorMessage` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_analysis_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`matterId` int NOT NULL,
	`userId` int NOT NULL,
	`sessionId` int,
	`sourceDocumentId` int,
	`analysisRunId` int,
	`timerId` int,
	`workDate` timestamp NOT NULL DEFAULT (now()),
	`activityCode` varchar(80) NOT NULL,
	`narrative` text NOT NULL,
	`durationSeconds` int,
	`durationSource` enum('timer','explicit_statement','manual','none') NOT NULL DEFAULT 'none',
	`sourceType` enum('timer','voice','transcript','document','manual') NOT NULL,
	`sourceIdentifier` varchar(180),
	`sourceQuote` text,
	`sourceStartMs` int,
	`sourceEndMs` int,
	`status` enum('needs_duration','draft','approved','rejected','exported') NOT NULL DEFAULT 'needs_duration',
	`confidence` decimal(5,4),
	`duplicateFingerprint` varchar(64) NOT NULL,
	`duplicateOfEntryId` int,
	`approvedByUserId` int,
	`approvedAt` timestamp,
	`rejectedAt` timestamp,
	`exportedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`createdByUserId` int NOT NULL,
	`format` enum('csv') NOT NULL DEFAULT 'csv',
	`fileName` varchar(255) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` text NOT NULL,
	`entryIds` json NOT NULL,
	`entryCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `billing_timers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`matterId` int NOT NULL,
	`userId` int NOT NULL,
	`sessionId` int,
	`activityCode` varchar(80) NOT NULL,
	`narrative` text NOT NULL,
	`status` enum('running','stopped','cancelled') NOT NULL DEFAULT 'running',
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`stoppedAt` timestamp,
	`elapsedSeconds` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `billing_timers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `source_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`matterId` int NOT NULL,
	`sessionId` int,
	`createdByUserId` int NOT NULL,
	`title` varchar(240) NOT NULL,
	`sourceType` enum('pasted_text','transcript','uploaded_text') NOT NULL,
	`mimeType` varchar(120),
	`originalFileName` varchar(255),
	`storageKey` varchar(512),
	`storageUrl` text,
	`contentSnapshot` text NOT NULL,
	`contentHash` varchar(64) NOT NULL,
	`characterCount` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `source_documents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `ai_analysis_items` ADD CONSTRAINT `ai_analysis_items_analysisRunId_ai_analysis_runs_id_fk` FOREIGN KEY (`analysisRunId`) REFERENCES `ai_analysis_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_analysis_items` ADD CONSTRAINT `ai_analysis_items_reviewedByUserId_users_id_fk` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_analysis_runs` ADD CONSTRAINT `ai_analysis_runs_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_analysis_runs` ADD CONSTRAINT `ai_analysis_runs_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_analysis_runs` ADD CONSTRAINT `ai_analysis_runs_sourceDocumentId_source_documents_id_fk` FOREIGN KEY (`sourceDocumentId`) REFERENCES `source_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ai_analysis_runs` ADD CONSTRAINT `ai_analysis_runs_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_sessionId_dictation_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `dictation_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_sourceDocumentId_source_documents_id_fk` FOREIGN KEY (`sourceDocumentId`) REFERENCES `source_documents`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_analysisRunId_ai_analysis_runs_id_fk` FOREIGN KEY (`analysisRunId`) REFERENCES `ai_analysis_runs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_timerId_billing_timers_id_fk` FOREIGN KEY (`timerId`) REFERENCES `billing_timers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_approvedByUserId_users_id_fk` FOREIGN KEY (`approvedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_exports` ADD CONSTRAINT `billing_exports_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_exports` ADD CONSTRAINT `billing_exports_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD CONSTRAINT `billing_timers_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD CONSTRAINT `billing_timers_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD CONSTRAINT `billing_timers_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD CONSTRAINT `billing_timers_sessionId_dictation_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `dictation_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_documents` ADD CONSTRAINT `source_documents_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_documents` ADD CONSTRAINT `source_documents_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_documents` ADD CONSTRAINT `source_documents_sessionId_dictation_sessions_id_fk` FOREIGN KEY (`sessionId`) REFERENCES `dictation_sessions`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `source_documents` ADD CONSTRAINT `source_documents_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_analysis_items_run_type_idx` ON `ai_analysis_items` (`analysisRunId`,`itemType`);--> statement-breakpoint
CREATE INDEX `ai_analysis_runs_matter_created_idx` ON `ai_analysis_runs` (`matterId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `billing_entries_firm_status_idx` ON `billing_entries` (`firmId`,`status`);--> statement-breakpoint
CREATE INDEX `billing_entries_matter_work_idx` ON `billing_entries` (`matterId`,`workDate`);--> statement-breakpoint
CREATE INDEX `billing_entries_fingerprint_idx` ON `billing_entries` (`duplicateFingerprint`);--> statement-breakpoint
CREATE INDEX `billing_exports_firm_created_idx` ON `billing_exports` (`firmId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `billing_timers_user_status_idx` ON `billing_timers` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `billing_timers_matter_idx` ON `billing_timers` (`matterId`);--> statement-breakpoint
CREATE INDEX `source_documents_matter_created_idx` ON `source_documents` (`matterId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `source_documents_session_idx` ON `source_documents` (`sessionId`);