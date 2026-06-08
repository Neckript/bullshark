ALTER TABLE `roles` ADD `position` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX `roles_position_idx` ON `roles` (`position`);--> statement-breakpoint
UPDATE `roles` SET `position` = 0 WHERE `is_default` = 1;--> statement-breakpoint
UPDATE `roles` SET `position` = (
	SELECT COUNT(*) FROM `roles` r2
	WHERE r2.`id` <= `roles`.`id` AND r2.`is_default` = 0 AND r2.`id` != 1
) WHERE `is_default` = 0 AND `id` != 1;--> statement-breakpoint
UPDATE `roles` SET `position` = 1000000 WHERE `id` = 1;