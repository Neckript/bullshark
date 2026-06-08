PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`position` integer DEFAULT 0 NOT NULL,
	`is_persistent` integer NOT NULL,
	`is_default` integer NOT NULL,
	`storage_quota_override_enabled` integer DEFAULT false NOT NULL,
	`storage_space_quota` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
INSERT INTO `__new_roles`("id", "name", "color", "is_persistent", "is_default", "storage_quota_override_enabled", "storage_space_quota", "created_at", "updated_at") SELECT "id", "name", "color", "is_persistent", "is_default", "storage_quota_override_enabled", "storage_space_quota", "created_at", "updated_at" FROM `roles`;--> statement-breakpoint
DROP TABLE `roles`;--> statement-breakpoint
ALTER TABLE `__new_roles` RENAME TO `roles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `roles_is_default_idx` ON `roles` (`is_default`);--> statement-breakpoint
CREATE INDEX `roles_is_persistent_idx` ON `roles` (`is_persistent`);--> statement-breakpoint
CREATE INDEX `roles_position_idx` ON `roles` (`position`);--> statement-breakpoint
UPDATE `roles` SET `color` = NULL WHERE `color` IN ('#ffffff', '#FFFFFF');--> statement-breakpoint
UPDATE `roles` SET `position` = 0 WHERE `is_default` = 1;--> statement-breakpoint
UPDATE `roles` SET `position` = (
	SELECT COUNT(*) FROM `roles` r2
	WHERE r2.`id` <= `roles`.`id` AND r2.`is_default` = 0 AND r2.`id` != 1
) WHERE `is_default` = 0 AND `id` != 1;--> statement-breakpoint
UPDATE `roles` SET `position` = 1000000 WHERE `id` = 1;
