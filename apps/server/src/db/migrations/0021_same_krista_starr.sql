ALTER TABLE `roles` ADD `hoist` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `roles` ADD `icon_file_id` integer REFERENCES files(id);--> statement-breakpoint
ALTER TABLE `roles` ADD `is_mentionable` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `roles_hoist_idx` ON `roles` (`hoist`);