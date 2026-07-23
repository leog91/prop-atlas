CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`name` text DEFAULT 'Extension' NOT NULL,
	`last_used_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_keys_key_unique` ON `api_keys` (`key`);--> statement-breakpoint
CREATE INDEX `api_keys_user_id_idx` ON `api_keys` (`user_id`);--> statement-breakpoint
CREATE INDEX `api_keys_key_idx` ON `api_keys` (`key`);--> statement-breakpoint
CREATE TABLE `geocode_cache` (
	`query` text PRIMARY KEY NOT NULL,
	`latitude` real NOT NULL,
	`longitude` real NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page_snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`provider` text NOT NULL,
	`url` text NOT NULL,
	`snapshot` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `page_snapshots_user_id_idx` ON `page_snapshots` (`user_id`);--> statement-breakpoint
CREATE INDEX `page_snapshots_provider_idx` ON `page_snapshots` (`provider`);--> statement-breakpoint
CREATE INDEX `page_snapshots_created_at_idx` ON `page_snapshots` (`created_at`);--> statement-breakpoint
CREATE TABLE `properties` (
	`id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`provider_listing_id` text NOT NULL,
	`listing_type` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`price` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`expenses` real,
	`expenses_currency` text,
	`property_type` text NOT NULL,
	`bedrooms` integer,
	`bathrooms` integer,
	`area` real,
	`area_unit` text,
	`address` text,
	`city` text,
	`country` text,
	`postal_code` text,
	`latitude` real,
	`longitude` real,
	`url` text NOT NULL,
	`listed_at` integer,
	`views` integer,
	`deposit` real,
	`deposit_currency` text,
	`floor` text,
	`has_elevator` integer,
	`has_parking` integer,
	`is_furnished` integer,
	`raw_payload` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `properties_provider_listing_idx` ON `properties` (`provider`,`provider_listing_id`);--> statement-breakpoint
CREATE INDEX `properties_listing_type_idx` ON `properties` (`listing_type`);--> statement-breakpoint
CREATE INDEX `properties_city_idx` ON `properties` (`city`);--> statement-breakpoint
CREATE INDEX `properties_country_idx` ON `properties` (`country`);--> statement-breakpoint
CREATE INDEX `properties_price_idx` ON `properties` (`price`);--> statement-breakpoint
CREATE INDEX `properties_property_type_idx` ON `properties` (`property_type`);--> statement-breakpoint
CREATE INDEX `properties_created_at_idx` ON `properties` (`created_at`);--> statement-breakpoint
CREATE TABLE `property_images` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`url` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `property_images_property_id_idx` ON `property_images` (`property_id`);--> statement-breakpoint
CREATE TABLE `property_price_history` (
	`id` text PRIMARY KEY NOT NULL,
	`property_id` text NOT NULL,
	`price` real NOT NULL,
	`currency` text DEFAULT 'EUR' NOT NULL,
	`recorded_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `property_price_history_property_id_idx` ON `property_price_history` (`property_id`);--> statement-breakpoint
CREATE INDEX `property_price_history_recorded_at_idx` ON `property_price_history` (`recorded_at`);--> statement-breakpoint
CREATE TABLE `saved_properties` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`property_id` text NOT NULL,
	`notes` text,
	`is_favorite` integer DEFAULT false NOT NULL,
	`deleted_at` integer,
	`saved_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`property_id`) REFERENCES `properties`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `saved_properties_user_property_idx` ON `saved_properties` (`user_id`,`property_id`);--> statement-breakpoint
CREATE INDEX `saved_properties_user_id_idx` ON `saved_properties` (`user_id`);--> statement-breakpoint
CREATE INDEX `saved_properties_is_favorite_idx` ON `saved_properties` (`is_favorite`);--> statement-breakpoint
CREATE INDEX `saved_properties_deleted_at_idx` ON `saved_properties` (`deleted_at`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
