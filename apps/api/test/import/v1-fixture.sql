/*M!999999\- enable the sandbox mode */ 
-- MariaDB dump 10.19-11.4.12-MariaDB, for debian-linux-gnu (aarch64)
--
-- Host: localhost    Database: v1
-- ------------------------------------------------------
-- Server version	11.4.12-MariaDB-ubu2404

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*M!100616 SET @OLD_NOTE_VERBOSITY=@@NOTE_VERBOSITY, NOTE_VERBOSITY=0 */;

--
-- Current Database: `v1`
--

CREATE DATABASE /*!32312 IF NOT EXISTS*/ `v1` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci */;

USE `v1`;

--
-- Table structure for table `fpp_estimations`
--

DROP TABLE IF EXISTS `fpp_estimations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fpp_estimations` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(21) NOT NULL,
  `room_id` int(11) NOT NULL,
  `estimation` smallint(6) DEFAULT NULL,
  `spectator` tinyint(1) NOT NULL DEFAULT 0,
  `estimated_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=18 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fpp_estimations`
--

LOCK TABLES `fpp_estimations` WRITE;
/*!40000 ALTER TABLE `fpp_estimations` DISABLE KEYS */;
INSERT INTO `fpp_estimations` VALUES
(1,'v1userAAAAAAAAAAAAAA1',1,5,0,'2024-03-04 09:10:00'),
(2,'v1userAAAAAAAAAAAAAA2',1,5,0,'2024-03-04 09:10:00'),
(3,'v1userAAAAAAAAAAAAAA3',1,5,0,'2024-03-04 09:10:00'),
(4,'v1userAAAAAAAAAAAAAA1',1,2,0,'2024-03-04 09:20:00'),
(5,'v1userAAAAAAAAAAAAAA2',1,8,0,'2024-03-04 09:20:00'),
(6,'v1userAAAAAAAAAAAAAA3',1,3,0,'2024-03-04 09:20:00'),
(7,'v1userAAAAAAAAAAAAAA4',1,NULL,1,'2024-03-04 09:20:00'),
(8,'v1userAAAAAAAAAAAAAA1',2,8,0,'2024-03-05 23:59:59'),
(9,'v1userAAAAAAAAAAAAAA2',2,8,0,'2024-03-05 23:59:59'),
(10,'v1userAAAAAAAAAAAAAA3',2,NULL,1,'2025-11-02 10:30:00'),
(11,'v1userAAAAAAAAAAAAAA4',2,NULL,1,'2025-11-02 10:30:00'),
(12,'v1userAAAAAAAAAAAAAA1',2,NULL,0,'2025-11-02 10:30:00'),
(13,'v1userAAAAAAAAAAAAAA1',3,2,0,'2025-11-03 14:00:00'),
(14,'v1userAAAAAAAAAAAAAA2',3,5,0,'2025-11-03 14:00:00'),
(15,'v1userAAAAAAAAAAAAAA3',3,34,0,'2025-11-03 14:00:00'),
(16,'v1userAAAAAAAAAAAAAA4',99,2,0,'2025-11-03 15:00:00'),
(17,'v1userAAAAAAAAAAAAAA1',5,13,0,'2026-11-19 08:00:00');
/*!40000 ALTER TABLE `fpp_estimations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fpp_events`
--

DROP TABLE IF EXISTS `fpp_events`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fpp_events` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(21) NOT NULL,
  `event` enum('CONTACT_FORM_SUBMISSION','ENTERED_RANDOM_ROOM','ENTERED_NEW_ROOM','ENTERED_EXISTING_ROOM','ENTERED_RECENT_ROOM','LEFT_ROOM','COPIED_ROOM_LINK','CHANGED_ROOM_NAME') NOT NULL,
  `event_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fpp_events`
--

LOCK TABLES `fpp_events` WRITE;
/*!40000 ALTER TABLE `fpp_events` DISABLE KEYS */;
INSERT INTO `fpp_events` VALUES
(1,'v1userAAAAAAAAAAAAAA1','ENTERED_NEW_ROOM','2024-03-04 09:00:00'),
(2,'v1userAAAAAAAAAAAAAA1','COPIED_ROOM_LINK','2025-11-03 14:01:00'),
(3,'v1userAAAAAAAAAAAAAA2','COPIED_ROOM_LINK','2025-11-03 14:02:00'),
(4,'v1userAAAAAAAAAAAAAA2','CHANGED_ROOM_NAME','2025-11-03 14:03:00');
/*!40000 ALTER TABLE `fpp_events` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fpp_feature_flags`
--

DROP TABLE IF EXISTS `fpp_feature_flags`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fpp_feature_flags` (
  `name` enum('CONTACT_FORM') NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT 0,
  UNIQUE KEY `feature_flags_name_unique_idx` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fpp_feature_flags`
--

LOCK TABLES `fpp_feature_flags` WRITE;
/*!40000 ALTER TABLE `fpp_feature_flags` DISABLE KEYS */;
INSERT INTO `fpp_feature_flags` VALUES
('CONTACT_FORM',1);
/*!40000 ALTER TABLE `fpp_feature_flags` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fpp_page_views`
--

DROP TABLE IF EXISTS `fpp_page_views`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fpp_page_views` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` varchar(21) NOT NULL,
  `route` enum('HOME','CONTACT','IMPRINT','GUIDE','ROOM','ANALYTICS','ROADMAP') NOT NULL,
  `room_id` int(11) DEFAULT NULL,
  `source` varchar(255) DEFAULT NULL,
  `viewed_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fpp_page_views`
--

LOCK TABLES `fpp_page_views` WRITE;
/*!40000 ALTER TABLE `fpp_page_views` DISABLE KEYS */;
INSERT INTO `fpp_page_views` VALUES
(1,'v1userAAAAAAAAAAAAAA1','HOME',NULL,'MARKER-SOURCE','2024-03-04 08:55:00'),
(2,'v1userAAAAAAAAAAAAAA2','HOME',NULL,NULL,'2024-03-04 08:58:00'),
(3,'v1userAAAAAAAAAAAAAA1','ROOM',1,NULL,'2024-03-04 09:00:00'),
(4,'v1userAAAAAAAAAAAAAA3','GUIDE',NULL,'MARKER-SOURCE','2025-11-03 13:50:00'),
(5,'v1userAAAAAAAAAAAAAA1','HOME',NULL,NULL,'2026-11-20 06:00:00');
/*!40000 ALTER TABLE `fpp_page_views` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fpp_rooms`
--

DROP TABLE IF EXISTS `fpp_rooms`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fpp_rooms` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `number` mediumint(9) NOT NULL,
  `name` varchar(15) NOT NULL,
  `first_used_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `last_used_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `rooms_number_unique_idx` (`number`),
  UNIQUE KEY `rooms_name_unique_idx` (`name`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fpp_rooms`
--

LOCK TABLES `fpp_rooms` WRITE;
/*!40000 ALTER TABLE `fpp_rooms` DISABLE KEYS */;
INSERT INTO `fpp_rooms` VALUES
(1,123456,'123456','2024-03-04 09:00:00','2024-03-05 10:00:00'),
(2,234567,'team-alpha','2024-03-04 08:00:00','2026-11-01 08:00:00'),
(3,345678,'my team','2024-03-05 10:00:00','2026-10-15 09:00:00'),
(4,456789,'ab','2025-11-02 10:00:00','2025-11-02 11:00:00'),
(5,42,'42','2024-03-05 11:00:00','2026-11-19 08:30:00'),
(6,567890,'müller','2025-11-03 09:00:00','2025-11-03 10:00:00'),
(7,678901,'my_team','2025-11-03 09:30:00','2025-12-01 10:00:00'),
(8,789012,'999999','2025-11-03 12:00:00','2025-11-03 12:30:00'),
(9,890123,'!!!','2025-11-03 13:00:00','2025-11-03 13:30:00'),
(10,901234,'team alpha','2025-11-03 14:00:00','2025-11-03 14:30:00'),
(11,112233,'o\'neil\\x','2026-11-19 07:00:00','2026-11-19 07:30:00'),
(12,223344,'🚀 rockets','2026-11-19 07:10:00','2026-11-19 07:40:00'),
(13,334455,'1234','2026-11-19 07:20:00','2026-11-19 07:50:00');
/*!40000 ALTER TABLE `fpp_rooms` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fpp_users`
--

DROP TABLE IF EXISTS `fpp_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fpp_users` (
  `id` varchar(21) NOT NULL,
  `device` varchar(50) DEFAULT NULL,
  `os` varchar(50) DEFAULT NULL,
  `browser` varchar(50) DEFAULT NULL,
  `country` varchar(5) DEFAULT NULL,
  `region` varchar(100) DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fpp_users`
--

LOCK TABLES `fpp_users` WRITE;
/*!40000 ALTER TABLE `fpp_users` DISABLE KEYS */;
INSERT INTO `fpp_users` VALUES
('v1userAAAAAAAAAAAAAA1','MARKER-DEVICE','MARKER-OS','MARKER-BROWSER','DE','MARKER-REGION','MARKER-CITY','2024-03-04 08:55:00'),
('v1userAAAAAAAAAAAAAA2','MARKER-DEVICE','MARKER-OS','MARKER-BROWSER','DE','MARKER-REGION','MARKER-CITY','2024-03-04 08:58:00'),
('v1userAAAAAAAAAAAAAA3','MARKER-DEVICE','MARKER-OS','MARKER-BROWSER','DE','MARKER-REGION','MARKER-CITY','2024-03-04 09:05:00'),
('v1userAAAAAAAAAAAAAA4','MARKER-DEVICE','MARKER-OS','MARKER-BROWSER','DE','MARKER-REGION','MARKER-CITY','2024-03-04 09:15:00');
/*!40000 ALTER TABLE `fpp_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `fpp_votes`
--

DROP TABLE IF EXISTS `fpp_votes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!40101 SET character_set_client = utf8mb4 */;
CREATE TABLE `fpp_votes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `room_id` int(11) NOT NULL,
  `avg_estimation` decimal(4,2) NOT NULL,
  `max_estimation` smallint(6) NOT NULL,
  `min_estimation` smallint(6) NOT NULL,
  `amount_of_estimations` smallint(6) NOT NULL,
  `amount_of_spectators` smallint(6) NOT NULL,
  `duration` smallint(6) NOT NULL,
  `was_auto_flip` tinyint(1) NOT NULL,
  `voted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `fpp_votes`
--

LOCK TABLES `fpp_votes` WRITE;
/*!40000 ALTER TABLE `fpp_votes` DISABLE KEYS */;
INSERT INTO `fpp_votes` VALUES
(1,1,5.00,5,5,3,0,60,0,'2024-03-04 09:10:00'),
(2,1,4.33,8,2,3,1,125,1,'2024-03-04 09:20:00'),
(3,2,8.00,8,8,2,0,30,0,'2024-03-05 23:59:59'),
(4,2,0.00,1,21,0,2,15,0,'2025-11-02 10:30:00'),
(5,3,3.50,5,2,2,0,45,1,'2025-11-03 14:00:00'),
(6,99,2.00,2,2,1,0,10,0,'2025-11-03 15:00:00'),
(7,5,13.00,13,13,1,0,20,0,'2026-11-19 08:00:00');
/*!40000 ALTER TABLE `fpp_votes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping events for database 'v1'
--

--
-- Dumping routines for database 'v1'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*M!100616 SET NOTE_VERBOSITY=@OLD_NOTE_VERBOSITY */;

-- Dump completed on 2026-11-22 17:32:34
