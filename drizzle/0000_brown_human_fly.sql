CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`date` text NOT NULL,
	`competition` text NOT NULL,
	`round` text DEFAULT '' NOT NULL,
	`home` text NOT NULL,
	`away` text NOT NULL,
	`stadium` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`county` text DEFAULT '' NOT NULL,
	`county_code` text DEFAULT '' NOT NULL,
	`status` text DEFAULT '' NOT NULL,
	`score` text,
	`delegates_json` text DEFAULT '[]' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `matches_date_idx` ON `matches` (`date`);--> statement-breakpoint
CREATE INDEX `matches_competition_idx` ON `matches` (`competition`);--> statement-breakpoint
CREATE INDEX `matches_county_idx` ON `matches` (`county`);--> statement-breakpoint
CREATE TABLE `notices` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text DEFAULT '' NOT NULL,
	`url` text NOT NULL,
	`attachment` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `officials` (
	`id` text PRIMARY KEY NOT NULL,
	`profile_id` text,
	`name` text NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`county` text DEFAULT '' NOT NULL,
	`role` text NOT NULL,
	`league` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `officials_name_idx` ON `officials` (`name`);--> statement-breakpoint
CREATE INDEX `officials_county_idx` ON `officials` (`county`);--> statement-breakpoint
CREATE TABLE `profiles` (
	`profile_id` text PRIMARY KEY NOT NULL,
	`payload_json` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sync_state` (
	`scope` text PRIMARY KEY NOT NULL,
	`synced_at` text NOT NULL,
	`status` text NOT NULL,
	`message` text DEFAULT '' NOT NULL
);
