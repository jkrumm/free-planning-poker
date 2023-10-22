CREATE TABLE `fpp_feature_flags` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`enabled` integer DEFAULT false NOT NULL
);
