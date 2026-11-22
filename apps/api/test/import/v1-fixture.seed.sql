-- The v1 fixture of the importer's tests (apps/api/test/import), as v1's MariaDB holds it: v1's schema from
-- origin/v1:packages/db/drizzle, synthetic rows. v1-fixture.sql is this database written by a real mariadb-dump 11.4:
--   factory slot run -- make v1-mariadb SQL=apps/api/test/import/v1-fixture.seed.sql DB=v1 OUT=apps/api/test/import/v1-fixture.sql
-- MARKER values stand where v1 kept a device, a place or a referrer: the tests prove none of them reaches Postgres.
SET NAMES utf8mb4;
SET time_zone = '+00:00';
CREATE DATABASE v1 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE v1;

CREATE TABLE `fpp_estimations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(21) NOT NULL,
	`room_id` int NOT NULL,
	`estimation` smallint,
	`spectator` boolean NOT NULL DEFAULT false,
	`estimated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fpp_estimations_id` PRIMARY KEY(`id`)
);
CREATE TABLE `fpp_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(21) NOT NULL,
	`event` enum('CONTACT_FORM_SUBMISSION','ENTERED_RANDOM_ROOM','ENTERED_NEW_ROOM','ENTERED_EXISTING_ROOM','ENTERED_RECENT_ROOM','LEFT_ROOM','COPIED_ROOM_LINK','CHANGED_ROOM_NAME') NOT NULL,
	`event_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fpp_events_id` PRIMARY KEY(`id`)
);
CREATE TABLE `fpp_feature_flags` (
	`name` enum('CONTACT_FORM') NOT NULL,
	`enabled` boolean NOT NULL DEFAULT false,
	CONSTRAINT `feature_flags_name_unique_idx` UNIQUE(`name`)
);
CREATE TABLE `fpp_page_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` varchar(21) NOT NULL,
	`route` enum('HOME','CONTACT','IMPRINT','GUIDE','ROOM','ANALYTICS','ROADMAP') NOT NULL,
	`room_id` int,
	`source` varchar(255),
	`viewed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fpp_page_views_id` PRIMARY KEY(`id`)
);
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

INSERT INTO fpp_rooms VALUES
  (1, 123456, '123456', '2024-03-04 09:00:00', '2024-03-05 10:00:00'),
  (2, 234567, 'team-alpha', '2024-03-04 08:00:00', '2026-11-01 08:00:00'),
  (3, 345678, 'my team', '2024-03-05 10:00:00', '2026-10-15 09:00:00'),
  (4, 456789, 'ab', '2025-11-02 10:00:00', '2025-11-02 11:00:00'),
  (5, 42, '42', '2024-03-05 11:00:00', '2026-11-19 08:30:00'),
  (6, 567890, 'müller', '2025-11-03 09:00:00', '2025-11-03 10:00:00'),
  (7, 678901, 'my_team', '2025-11-03 09:30:00', '2025-12-01 10:00:00'),
  (8, 789012, '999999', '2025-11-03 12:00:00', '2025-11-03 12:30:00'),
  (9, 890123, '!!!', '2025-11-03 13:00:00', '2025-11-03 13:30:00'),
  (10, 901234, 'team alpha', '2025-11-03 14:00:00', '2025-11-03 14:30:00'),
  (11, 112233, 'o''neil\\x', '2026-11-19 07:00:00', '2026-11-19 07:30:00'),
  (12, 223344, '🚀 rockets', '2026-11-19 07:10:00', '2026-11-19 07:40:00'),
  (13, 334455, '1234', '2026-11-19 07:20:00', '2026-11-19 07:50:00');

INSERT INTO fpp_votes VALUES
  (1, 1, 5.00, 5, 5, 3, 0, 60, 0, '2024-03-04 09:10:00'),
  (2, 1, 4.33, 8, 2, 3, 1, 125, 1, '2024-03-04 09:20:00'),
  (3, 2, 8.00, 8, 8, 2, 0, 30, 0, '2024-03-05 23:59:59'),
  (4, 2, 0.00, 1, 21, 0, 2, 15, 0, '2025-11-02 10:30:00'),
  (5, 3, 3.50, 5, 2, 2, 0, 45, 1, '2025-11-03 14:00:00'),
  (6, 99, 2.00, 2, 2, 1, 0, 10, 0, '2025-11-03 15:00:00'),
  (7, 5, 13.00, 13, 13, 1, 0, 20, 0, '2026-11-19 08:00:00');

INSERT INTO fpp_estimations (user_id, room_id, estimation, spectator, estimated_at) VALUES
  ('v1userAAAAAAAAAAAAAA1', 1, 5, 0, '2024-03-04 09:10:00'),
  ('v1userAAAAAAAAAAAAAA2', 1, 5, 0, '2024-03-04 09:10:00'),
  ('v1userAAAAAAAAAAAAAA3', 1, 5, 0, '2024-03-04 09:10:00'),
  ('v1userAAAAAAAAAAAAAA1', 1, 2, 0, '2024-03-04 09:20:00'),
  ('v1userAAAAAAAAAAAAAA2', 1, 8, 0, '2024-03-04 09:20:00'),
  ('v1userAAAAAAAAAAAAAA3', 1, 3, 0, '2024-03-04 09:20:00'),
  ('v1userAAAAAAAAAAAAAA4', 1, NULL, 1, '2024-03-04 09:20:00'),
  ('v1userAAAAAAAAAAAAAA1', 2, 8, 0, '2024-03-05 23:59:59'),
  ('v1userAAAAAAAAAAAAAA2', 2, 8, 0, '2024-03-05 23:59:59'),
  ('v1userAAAAAAAAAAAAAA3', 2, NULL, 1, '2025-11-02 10:30:00'),
  ('v1userAAAAAAAAAAAAAA4', 2, NULL, 1, '2025-11-02 10:30:00'),
  ('v1userAAAAAAAAAAAAAA1', 2, NULL, 0, '2025-11-02 10:30:00'),
  ('v1userAAAAAAAAAAAAAA1', 3, 2, 0, '2025-11-03 14:00:00'),
  ('v1userAAAAAAAAAAAAAA2', 3, 5, 0, '2025-11-03 14:00:00'),
  ('v1userAAAAAAAAAAAAAA3', 3, 34, 0, '2025-11-03 14:00:00'),
  ('v1userAAAAAAAAAAAAAA4', 99, 2, 0, '2025-11-03 15:00:00'),
  ('v1userAAAAAAAAAAAAAA1', 5, 13, 0, '2026-11-19 08:00:00');

INSERT INTO fpp_page_views (user_id, route, room_id, source, viewed_at) VALUES
  ('v1userAAAAAAAAAAAAAA1', 'HOME', NULL, 'MARKER-SOURCE', '2024-03-04 08:55:00'),
  ('v1userAAAAAAAAAAAAAA2', 'HOME', NULL, NULL, '2024-03-04 08:58:00'),
  ('v1userAAAAAAAAAAAAAA1', 'ROOM', 1, NULL, '2024-03-04 09:00:00'),
  ('v1userAAAAAAAAAAAAAA3', 'GUIDE', NULL, 'MARKER-SOURCE', '2025-11-03 13:50:00'),
  ('v1userAAAAAAAAAAAAAA1', 'HOME', NULL, NULL, '2026-11-20 06:00:00');

INSERT INTO fpp_events (user_id, event, event_at) VALUES
  ('v1userAAAAAAAAAAAAAA1', 'ENTERED_NEW_ROOM', '2024-03-04 09:00:00'),
  ('v1userAAAAAAAAAAAAAA1', 'COPIED_ROOM_LINK', '2025-11-03 14:01:00'),
  ('v1userAAAAAAAAAAAAAA2', 'COPIED_ROOM_LINK', '2025-11-03 14:02:00'),
  ('v1userAAAAAAAAAAAAAA2', 'CHANGED_ROOM_NAME', '2025-11-03 14:03:00');

INSERT INTO fpp_users VALUES
  ('v1userAAAAAAAAAAAAAA1', 'MARKER-DEVICE', 'MARKER-OS', 'MARKER-BROWSER', 'DE', 'MARKER-REGION', 'MARKER-CITY', '2024-03-04 08:55:00'),
  ('v1userAAAAAAAAAAAAAA2', 'MARKER-DEVICE', 'MARKER-OS', 'MARKER-BROWSER', 'DE', 'MARKER-REGION', 'MARKER-CITY', '2024-03-04 08:58:00'),
  ('v1userAAAAAAAAAAAAAA3', 'MARKER-DEVICE', 'MARKER-OS', 'MARKER-BROWSER', 'DE', 'MARKER-REGION', 'MARKER-CITY', '2024-03-04 09:05:00'),
  ('v1userAAAAAAAAAAAAAA4', 'MARKER-DEVICE', 'MARKER-OS', 'MARKER-BROWSER', 'DE', 'MARKER-REGION', 'MARKER-CITY', '2024-03-04 09:15:00');

INSERT INTO fpp_feature_flags VALUES ('CONTACT_FORM', 1);
