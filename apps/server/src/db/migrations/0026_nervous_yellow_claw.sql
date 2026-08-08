CREATE TABLE `sounds` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`file_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	FOREIGN KEY (`file_id`) REFERENCES `files`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sounds_name_unique` ON `sounds` (`name`);--> statement-breakpoint
CREATE INDEX `sounds_user_idx` ON `sounds` (`user_id`);--> statement-breakpoint
CREATE INDEX `sounds_file_idx` ON `sounds` (`file_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `sounds_name_idx` ON `sounds` (`name`);