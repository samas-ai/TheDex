CREATE TABLE `checklist_entries` (
	`dex_scope` text NOT NULL,
	`pokemon_id` integer NOT NULL,
	`form_id` integer DEFAULT 0 NOT NULL,
	`seen` integer DEFAULT false NOT NULL,
	`caught` integer DEFAULT false NOT NULL,
	`shiny_caught` integer DEFAULT false NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	PRIMARY KEY(`dex_scope`, `pokemon_id`, `form_id`)
);
--> statement-breakpoint
CREATE TABLE `favorites` (
	`entity_type` text NOT NULL,
	`entity_id` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer,
	PRIMARY KEY(`entity_type`, `entity_id`)
);
--> statement-breakpoint
CREATE TABLE `media_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`url` text NOT NULL,
	`local_uri` text NOT NULL,
	`bytes` integer NOT NULL,
	`etag` text,
	`fetched_at` integer NOT NULL,
	`last_access_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `media_cache_access_idx` ON `media_cache` (`last_access_at`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value_json` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`provider` text PRIMARY KEY NOT NULL,
	`device_id` text NOT NULL,
	`last_synced_at` integer
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`format` text,
	`game_id` integer,
	`generation_id` integer NOT NULL,
	`members_json` text NOT NULL,
	`notes` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `teams_sort_idx` ON `teams` (`deleted_at`,`sort_order`);