CREATE TABLE `category_role_permissions` (
	`category_id` integer NOT NULL,
	`role_id` integer NOT NULL,
	`permission` text NOT NULL,
	`allow` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`category_id`, `role_id`, `permission`),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `category_role_permissions_category_idx` ON `category_role_permissions` (`category_id`);--> statement-breakpoint
CREATE INDEX `category_role_permissions_role_idx` ON `category_role_permissions` (`role_id`);--> statement-breakpoint
CREATE TABLE `category_user_permissions` (
	`category_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`permission` text NOT NULL,
	`allow` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer,
	PRIMARY KEY(`category_id`, `user_id`, `permission`),
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `category_user_permissions_category_idx` ON `category_user_permissions` (`category_id`);--> statement-breakpoint
CREATE INDEX `category_user_permissions_user_idx` ON `category_user_permissions` (`user_id`);