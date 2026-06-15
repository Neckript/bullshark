ALTER TABLE `settings` ADD `owner_claim_token_hash` text;
--> statement-breakpoint
UPDATE `settings` SET `owner_claim_token_hash` = `secret_token` WHERE `owner_claim_token_hash` IS NULL;