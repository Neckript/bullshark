ALTER TABLE `channels` ADD `slow_mode_seconds` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `muted_until` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `muted_by` integer REFERENCES users(id);--> statement-breakpoint
ALTER TABLE `users` ADD `mute_reason` text;--> statement-breakpoint
ALTER TABLE `users` ADD `voice_muted` integer DEFAULT false NOT NULL;