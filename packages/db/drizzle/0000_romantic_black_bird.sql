CREATE TABLE `fpp_estimations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(21) NOT NULL,
	`room_id` int NOT NULL,
	`estimation` smallint,
	`spectator` boolean NOT NULL DEFAULT false,
	`estimated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fpp_estimations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fpp_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(21) NOT NULL,
	`event` enum('CONTACT_FORM_SUBMISSION','ENTERED_RANDOM_ROOM','ENTERED_NEW_ROOM','ENTERED_EXISTING_ROOM','ENTERED_RECENT_ROOM','LEFT_ROOM','COPIED_ROOM_LINK') NOT NULL,
	`event_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fpp_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fpp_feature_flags` (
	`name` enum('CONTACT_FORM') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	CONSTRAINT `feature_flags_name_unique_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `fpp_page_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(21) NOT NULL,
	`route` enum('HOME','CONTACT','IMPRINT','GUIDE','ROOM','ANALYTICS','ROADMAP') NOT NULL,
	`room_id` int,
	`source` varchar(255),
	`viewed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fpp_page_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fpp_rooms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`number` mediumint NOT NULL,
	`name` varchar(15) NOT NULL,
	`first_used_at` timestamp NOT NULL DEFAULT (now()),
	`last_used_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fpp_rooms_id` PRIMARY KEY(`id`),
	CONSTRAINT `rooms_number_unique_idx` UNIQUE(`number`),
	CONSTRAINT `rooms_name_unique_idx` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `fpp_users` (
	`id` varchar(21) NOT NULL,
	`device` varchar(50),
	`os` varchar(50),
	`browser` varchar(50),
	`country` varchar(5),
	`region` varchar(100),
	`city` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fpp_users_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fpp_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`room_id` int NOT NULL,
	`avg_estimation` decimal(4,2) NOT NULL,
	`max_estimation` smallint NOT NULL,
	`min_estimation` smallint NOT NULL,
	`amount_of_estimations` smallint NOT NULL,
	`amount_of_spectators` smallint NOT NULL,
	`duration` smallint NOT NULL,
	`was_auto_flip` boolean NOT NULL,
	`voted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fpp_votes_id` PRIMARY KEY(`id`)
);
