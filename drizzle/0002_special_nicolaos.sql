CREATE TABLE `firm_billing_codes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`firmId` int NOT NULL,
	`code` varchar(40) NOT NULL,
	`label` varchar(180) NOT NULL,
	`category` varchar(80) NOT NULL,
	`description` text,
	`defaultNarrative` text,
	`displayOrder` int NOT NULL DEFAULT 0,
	`active` boolean NOT NULL DEFAULT true,
	`createdByUserId` int NOT NULL,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `firm_billing_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `firm_billing_codes_firm_code_unique` UNIQUE(`firmId`,`code`)
);
--> statement-breakpoint
ALTER TABLE `billing_entries` ADD `billingCodeId` int;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD `billingCodeId` int;--> statement-breakpoint
ALTER TABLE `firm_billing_codes` ADD CONSTRAINT `firm_billing_codes_firmId_firms_id_fk` FOREIGN KEY (`firmId`) REFERENCES `firms`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `firm_billing_codes` ADD CONSTRAINT `firm_billing_codes_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `firm_billing_codes` ADD CONSTRAINT `firm_billing_codes_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `firm_billing_codes_firm_active_order_idx` ON `firm_billing_codes` (`firmId`,`active`,`displayOrder`);--> statement-breakpoint
CREATE INDEX `firm_billing_codes_firm_category_idx` ON `firm_billing_codes` (`firmId`,`category`);--> statement-breakpoint
ALTER TABLE `billing_entries` ADD CONSTRAINT `billing_entries_billingCodeId_firm_billing_codes_id_fk` FOREIGN KEY (`billingCodeId`) REFERENCES `firm_billing_codes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `billing_timers` ADD CONSTRAINT `billing_timers_billingCodeId_firm_billing_codes_id_fk` FOREIGN KEY (`billingCodeId`) REFERENCES `firm_billing_codes`(`id`) ON DELETE no action ON UPDATE no action;