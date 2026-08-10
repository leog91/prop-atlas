DROP INDEX `api_keys_key_idx`;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `key_hash` text;--> statement-breakpoint
ALTER TABLE `api_keys` ADD `key_prefix` text;--> statement-breakpoint
CREATE INDEX `api_keys_key_hash_idx` ON `api_keys` (`key_hash`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_geocode_cache` (
	`query` text PRIMARY KEY NOT NULL,
	`latitude` real,
	`longitude` real,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_geocode_cache`("query", "latitude", "longitude", "created_at") SELECT "query", "latitude", "longitude", "created_at" FROM `geocode_cache`;--> statement-breakpoint
DROP TABLE `geocode_cache`;--> statement-breakpoint
ALTER TABLE `__new_geocode_cache` RENAME TO `geocode_cache`;--> statement-breakpoint
PRAGMA foreign_keys=ON;