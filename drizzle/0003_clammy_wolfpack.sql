CREATE TABLE `billing_sync_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`provider` enum('clio','mycase') NOT NULL,
	`connectionId` int NOT NULL,
	`billingEntryId` int NOT NULL,
	`billingEntryRevision` int NOT NULL,
	`idempotencyKey` varchar(96) NOT NULL,
	`requestFingerprint` varchar(64) NOT NULL,
	`status` enum('pending','succeeded','failed','skipped') NOT NULL DEFAULT 'pending',
	`externalRecordId` varchar(180),
	`responseStatus` int,
	`errorCode` varchar(100),
	`errorMessage` text,
	`confirmedByUserId` int NOT NULL,
	`confirmedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `billing_sync_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `billing_sync_attempts_provider_idempotency_unique` UNIQUE(`provider`,`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `external_billing_code_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`provider` enum('clio','mycase') NOT NULL,
	`billingCodeId` int NOT NULL,
	`externalActivityId` varchar(160),
	`externalActivityName` varchar(240),
	`utbmsActivityCode` varchar(40),
	`utbmsTaskCode` varchar(40),
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `external_billing_code_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_billing_code_mappings_provider_code_unique` UNIQUE(`provider`,`billingCodeId`)
);
--> statement-breakpoint
CREATE TABLE `external_matter_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`provider` enum('clio','mycase') NOT NULL,
	`matterId` int NOT NULL,
	`externalMatterId` varchar(160) NOT NULL,
	`externalMatterNumber` varchar(160),
	`externalMatterName` varchar(240),
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `external_matter_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_matter_mappings_provider_matter_unique` UNIQUE(`provider`,`matterId`)
);
--> statement-breakpoint
CREATE TABLE `external_user_mappings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`provider` enum('clio','mycase') NOT NULL,
	`membershipId` int NOT NULL,
	`externalUserId` varchar(160) NOT NULL,
	`externalUserName` varchar(240),
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `external_user_mappings_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_user_mappings_provider_membership_unique` UNIQUE(`provider`,`membershipId`)
);
--> statement-breakpoint
CREATE TABLE `integration_connections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`provider` enum('clio','mycase') NOT NULL,
	`status` enum('not_configured','pending','connected','error','disconnected') NOT NULL DEFAULT 'not_configured',
	`region` varchar(24),
	`externalFirmId` varchar(160),
	`externalFirmName` varchar(240),
	`accessTokenCiphertext` text,
	`refreshTokenCiphertext` text,
	`tokenExpiresAt` timestamp,
	`scopes` text,
	`lastValidatedAt` timestamp,
	`lastError` text,
	`connectedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `integration_connections_id` PRIMARY KEY(`id`),
	CONSTRAINT `integration_connections_firm_provider_unique` UNIQUE(`firmId`,`provider`)
);
--> statement-breakpoint
CREATE TABLE `lawyer_rate_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`membershipId` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`hourlyRateCents` int NOT NULL,
	`effectiveFrom` timestamp NOT NULL,
	`effectiveTo` timestamp,
	`notes` text,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lawyer_rate_cards_id` PRIMARY KEY(`id`),
	CONSTRAINT `lawyer_rate_cards_membership_effective_unique` UNIQUE(`membershipId`,`effectiveFrom`)
);
--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `rateCardId` int;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `billable` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `currency` varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `rateCents` int;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `feeCents` int;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `rateSource` enum('lawyer_rate','manual_override','none') DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `rateEffectiveFrom` timestamp;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `rateSnapshotAt` timestamp;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `rateOverrideReason` text;--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `revision` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD `rateCardId` int;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD `rateCentsSnapshot` int;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD `currency` varchar(3) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `billing_sync_attempts` ADD CONSTRAINT `billing_sync_attempts_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_sync_attempts` ADD CONSTRAINT `billing_sync_attempts_connectionId_integration_connections_id_fk` FOREIGN KEY (`connectionId`) REFERENCES `integration_connections`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_sync_attempts` ADD CONSTRAINT `billing_sync_attempts_billingEntryId_billing_entries_id_fk` FOREIGN KEY (`billingEntryId`) REFERENCES `billing_entries`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_sync_attempts` ADD CONSTRAINT `billing_sync_attempts_confirmedByUserId_users_id_fk` FOREIGN KEY (`confirmedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_billing_code_mappings` ADD CONSTRAINT `external_billing_code_mappings_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_billing_code_mappings` ADD CONSTRAINT `ext_code_map_billing_code_fk` FOREIGN KEY (`billingCodeId`) REFERENCES `firm_billing_codes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_billing_code_mappings` ADD CONSTRAINT `external_billing_code_mappings_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_matter_mappings` ADD CONSTRAINT `external_matter_mappings_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_matter_mappings` ADD CONSTRAINT `external_matter_mappings_matterId_matters_id_fk` FOREIGN KEY (`matterId`) REFERENCES `matters`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_matter_mappings` ADD CONSTRAINT `external_matter_mappings_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_user_mappings` ADD CONSTRAINT `external_user_mappings_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_user_mappings` ADD CONSTRAINT `external_user_mappings_membershipId_firm_memberships_id_fk` FOREIGN KEY (`membershipId`) REFERENCES `firm_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_user_mappings` ADD CONSTRAINT `external_user_mappings_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_connections` ADD CONSTRAINT `integration_connections_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_connections` ADD CONSTRAINT `integration_connections_connectedByUserId_users_id_fk` FOREIGN KEY (`connectedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lawyer_rate_cards` ADD CONSTRAINT `lawyer_rate_cards_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lawyer_rate_cards` ADD CONSTRAINT `lawyer_rate_cards_membershipId_firm_memberships_id_fk` FOREIGN KEY (`membershipId`) REFERENCES `firm_memberships`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lawyer_rate_cards` ADD CONSTRAINT `lawyer_rate_cards_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `lawyer_rate_cards` ADD CONSTRAINT `lawyer_rate_cards_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `billing_sync_attempts_entry_provider_idx` ON `billing_sync_attempts` (`billingEntryId`,`provider`);--> statement-breakpoint
CREATE INDEX `billing_sync_attempts_firm_created_idx` ON `billing_sync_attempts` (`firmId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `external_billing_code_mappings_firm_provider_idx` ON `external_billing_code_mappings` (`firmId`,`provider`);--> statement-breakpoint
CREATE INDEX `external_matter_mappings_firm_provider_idx` ON `external_matter_mappings` (`firmId`,`provider`);--> statement-breakpoint
CREATE INDEX `external_user_mappings_firm_provider_idx` ON `external_user_mappings` (`firmId`,`provider`);--> statement-breakpoint
CREATE INDEX `integration_connections_status_idx` ON `integration_connections` (`status`);--> statement-breakpoint
CREATE INDEX `lawyer_rate_cards_firm_active_idx` ON `lawyer_rate_cards` (`firmId`,`active`);--> statement-breakpoint
CREATE INDEX `lawyer_rate_cards_membership_period_idx` ON `lawyer_rate_cards` (`membershipId`,`effectiveFrom`,`effectiveTo`);--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_rateCardId_lawyer_rate_cards_id_fk` FOREIGN KEY (`rateCardId`) REFERENCES `lawyer_rate_cards`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD CONSTRAINT `billing_timers_rateCardId_lawyer_rate_cards_id_fk` FOREIGN KEY (`rateCardId`) REFERENCES `lawyer_rate_cards`(`id`) ON DELETE no action ON UPDATE no action;
