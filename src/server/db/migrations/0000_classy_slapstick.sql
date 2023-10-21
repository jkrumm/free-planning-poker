CREATE TABLE `fpp_estimations` (
	`id` integer PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`room` text NOT NULL,
	`estimation` integer,
	`spectator` integer DEFAULT false NOT NULL,
	`estimated_at` integer NOT NULL,
	FOREIGN KEY (`visitor_id`) REFERENCES `fpp_visitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fpp_events` (
	`id` integer PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`event` text NOT NULL,
	FOREIGN KEY (`visitor_id`) REFERENCES `fpp_visitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fpp_page_views` (
	`id` integer PRIMARY KEY NOT NULL,
	`visitor_id` text NOT NULL,
	`route` text NOT NULL,
	`room` text,
	`viewed_at` integer,
	FOREIGN KEY (`visitor_id`) REFERENCES `fpp_visitors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `fpp_rooms` (
	`name` text PRIMARY KEY NOT NULL,
	`last_used_at` integer NOT NULL,
	`first_used_at` integer
);
--> statement-breakpoint
CREATE TABLE `fpp_visitors` (
	`id` text PRIMARY KEY NOT NULL,
	`device` text,
	`os` text,
	`browser` text,
	`country` text,
	`region` text,
	`city` text,
	`first_visited_at` integer
);
--> statement-breakpoint
CREATE TABLE `fpp_votes` (
	`id` integer PRIMARY KEY NOT NULL,
	`room` text NOT NULL,
	`avg_estimation` integer NOT NULL,
	`max_estimation` integer NOT NULL,
	`min_estimation` integer NOT NULL,
	`final_estimation` integer,
	`amount_of_estimation` integer NOT NULL,
	`amount_of_spectators` integer NOT NULL,
	`duration` integer NOT NULL,
	`voted_at` integer,
	FOREIGN KEY (`room`) REFERENCES `fpp_rooms`(`name`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `estimations_visitor_idx` ON `fpp_estimations` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `events_visitor_idx` ON `fpp_events` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `page_views_visitor_idx` ON `fpp_page_views` (`visitor_id`);--> statement-breakpoint
CREATE INDEX `votes_room_idx` ON `fpp_votes` (`room`);