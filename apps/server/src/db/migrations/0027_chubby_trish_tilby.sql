ALTER TABLE `settings` ADD `banner_id` integer REFERENCES files(id);--> statement-breakpoint
ALTER TABLE `settings` ADD `storage_max_server_banner_size` integer DEFAULT 4194304 NOT NULL;