-- schema.sql
-- Initiales Schema für Hangman Multiplayer Game
-- MySQL 8.0+, UTF8MB4, InnoDB

CREATE DATABASE IF NOT EXISTS `hangman_game` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `hangman_game`;

-- Tabelle: lobbies
CREATE TABLE IF NOT EXISTS `lobbies` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `lobby_code` VARCHAR(6) NOT NULL UNIQUE,
  `host_player_id` VARCHAR(36),
  `word` VARCHAR(100) NOT NULL,
  `status` ENUM('waiting','playing','finished') DEFAULT 'waiting',
  `current_turn_index` INT DEFAULT 0,
  `attempts_left` INT DEFAULT 6,
  `max_attempts` INT DEFAULT 6,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `started_at` TIMESTAMP NULL,
  `finished_at` TIMESTAMP NULL,
  INDEX `idx_lobby_code` (`lobby_code`),
  INDEX `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle: players
CREATE TABLE IF NOT EXISTS `players` (
  `id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `lobby_id` VARCHAR(36) NOT NULL,
  `player_name` VARCHAR(50) NOT NULL,
  `session_id` VARCHAR(100) NOT NULL,
  `turn_order` INT NOT NULL,
  `is_host` BOOLEAN DEFAULT FALSE,
  `is_connected` BOOLEAN DEFAULT TRUE,
  `joined_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `last_seen` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`lobby_id`) REFERENCES `lobbies`(`id`) ON DELETE CASCADE,
  INDEX `idx_lobby_id` (`lobby_id`),
  INDEX `idx_session_id` (`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle: game_state (1:1 zu lobbies)
CREATE TABLE IF NOT EXISTS `game_state` (
  `lobby_id` VARCHAR(36) NOT NULL PRIMARY KEY,
  `guessed_letters` TEXT,
  `revealed_positions` TEXT,
  `incorrect_guesses` TEXT,
  `word_progress` VARCHAR(200),
  `last_guess_player_id` VARCHAR(36),
  `last_guess_letter` CHAR(1),
  `last_guess_correct` BOOLEAN,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`lobby_id`) REFERENCES `lobbies`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle: chat_messages
CREATE TABLE IF NOT EXISTS `chat_messages` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `lobby_id` VARCHAR(36) NOT NULL,
  `player_id` VARCHAR(36),
  `player_name` VARCHAR(50) NOT NULL,
  `message` TEXT NOT NULL,
  `message_type` ENUM('player','system') DEFAULT 'player',
  `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`lobby_id`) REFERENCES `lobbies`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON DELETE SET NULL,
  INDEX `idx_lobby_id` (`lobby_id`),
  INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Tabelle: words (optional)
CREATE TABLE IF NOT EXISTS `words` (
  `id` INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `word` VARCHAR(100) NOT NULL UNIQUE,
  `category` VARCHAR(50),
  `difficulty` ENUM('easy','medium','hard') DEFAULT 'medium',
  `language` CHAR(2) DEFAULT 'de',
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_category` (`category`),
  INDEX `idx_difficulty` (`difficulty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Beispielwörter (100). Anpassbar/erweiterbar.
INSERT INTO `words` (`word`,`category`,`difficulty`) VALUES
('BACKEND','Programmierung','easy'),
('FRONTEND','Programmierung','easy'),
('DATENBANK','Technologie','medium'),
('API','Programmierung','easy'),
('REDIS','Technologie','medium'),
('GIT','Technologie','easy'),
('GITHUB','Technologie','easy'),
('VERSIONCONTROL','Technologie','hard'),
('HTML','Programmierung','easy'),
('CSS','Programmierung','easy'),
('TYPESCRIPT','Programmierung','medium'),
('NODEJS','Programmierung','medium'),
('REACT','Programmierung','medium'),
('VUEJS','Programmierung','medium'),
('ANGULAR','Programmierung','medium'),
('BROWSER','Technologie','easy'),
('JQUERY','Programmierung','easy'),
('RUNTIME','Technologie','medium'),
('WEBSOCKET','Technologie','medium'),
('LATENZ','Technologie','medium'),
('BANDWIDTH','Technologie','medium'),
('CACHING','Technologie','medium'),
('LOADBALANCER','Cloud','hard'),
('HIGHAVAILABILITY','Cloud','hard'),
('FAILOVER','Cloud','medium'),
('SCALING','Cloud','medium'),
('PROXY','Technologie','easy'),
('NAMESPACE','Programmierung','hard'),
('PARSER','Programmierung','medium'),
('COMPILER','Programmierung','medium'),
('DEBUGGER','Programmierung','medium'),
('INTEGRATION','Technologie','medium'),
('PIPELINE','Cloud','medium'),
('AUTOMATION','Cloud','medium'),
('ENCRYPTION','Sicherheit','hard'),
('AUTHENTIFIZIERUNG','Sicherheit','hard'),
('AUTHENTIFIKATION','Sicherheit','hard'),
('Berechtigung','Sicherheit','medium'),
('PASSWORTMANAGER','Sicherheit','medium'),
('FIREWALL','Sicherheit','easy'),
('LOADTEST','Technologie','medium'),
('SIMULATION','Technologie','medium'),
('BENCHMARK','Technologie','medium'),
('OPTIMIERUNG','Programmierung','medium'),
('THREAD','Programmierung','medium'),
('PROZESS','Technologie','easy'),
('MULTITHREADING','Programmierung','hard'),
('ASYNC','Programmierung','medium'),
('PROMISE','Programmierung','medium'),
('EVENTLOOP','Programmierung','hard'),
('ARCHITEKTUR','Technologie','medium'),
('UML','Programmierung','easy'),
('KONZEPTION','Beruf','medium'),
('DESIGNPATTERN','Programmierung','hard'),
('REFACTORING','Programmierung','medium'),
('TESTING','Programmierung','easy'),
('UNITTEST','Programmierung','medium'),
('INTEGRATIONSTEST','Programmierung','hard'),
('ENDTOENDTEST','Programmierung','hard'),
('CLOUDNATIVE','Cloud','hard'),
('VIRTUALISIERUNG','Cloud','hard'),
('IDENTITYMANAGEMENT','Sicherheit','hard'),
('DEVOPS','Beruf','medium'),
('SOFTWAREARCHITEKT','Beruf','hard'),
('ENGINEER','Beruf','easy'),
('SCRUMMASTER','Beruf','medium'),
('PRODUCTOWNER','Beruf','medium'),
('SPRINT','Beruf','easy'),
('KANBAN','Beruf','medium'),
('AGILITAET','Beruf','medium'),
('MINDSET','Beruf','easy'),
('MEETING','Beruf','easy'),
('MONOREPO','Programmierung','hard'),
('DISTRIBUTEDSYSTEM','Technologie','hard'),
('LATENCYOPTIMIZATION','Technologie','hard'),
('THROUGHPUT','Technologie','hard'),
('WEBASSEMBLY','Technologie','hard'),
('CONCURRENCY','Programmierung','hard'),
('TRANSAKTION','Technologie','medium'),
('REPLICATION','Technologie','hard'),
('INDEX','Datenbank','medium'),
('FOREIGNKEY','Datenbank','medium'),
('PRIMARYKEY','Datenbank','easy'),
('JOINTABLE','Datenbank','medium'),
('QUERYOPTIMIZER','Datenbank','hard'),
('CLOUDSTORAGE','Cloud','easy'),
('OBJECTSTORAGE','Cloud','medium'),
('SIMPLEQUEUE','Cloud','medium'),
('SERVERLESS','Cloud','medium'),
('LAMBDAFUNCTION','Cloud','medium'),
('CONNECTIONPOOL','Technologie','hard'),
('PACKAGEMANAGER','Programmierung','medium'),
('DOCKERFILE','Cloud','medium'),
('CONTAINERIMAGE','Cloud','medium'),
('ORCHESTRATION','Cloud','hard'),
('SESSIONSERVICE','Technologie','medium'),
('MESSAGING','Technologie','medium'),
('EVENTDRIVEN','Technologie','hard'),
('DISTRIBUTEDCACHE','Technologie','hard')
ON DUPLICATE KEY UPDATE `word`=VALUES(`word`);