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

-- Beispielwörter (20). Anpassbar/erweiterbar.
INSERT INTO `words` (`word`,`category`,`difficulty`) VALUES
('JAVASCRIPT','Programmierung','medium'),
('PROGRAMMIEREN','Programmierung','medium'),
('COMPUTER','Technologie','easy'),
('INTERNET','Technologie','easy'),
('ENTWICKLER','Beruf','medium'),
('AMAZON','Cloud','easy'),
('CLOUD','Technologie','easy'),
('SERVER','Technologie','easy'),
('DATABASE','Technologie','medium'),
('SOFTWARE','Programmierung','medium'),
('ALGORITHMUS','Programmierung','hard'),
('FUNKTION','Programmierung','medium'),
('VARIABLE','Programmierung','medium'),
('SCHNITTSTELLE','Programmierung','hard'),
('FRAMEWORK','Programmierung','medium'),
('MICROSERVICE','Cloud','hard'),
('KUBERNETES','Cloud','hard'),
('CONTAINER','Cloud','medium'),
('DEPLOYMENT','Cloud','medium'),
('SICHERHEIT','Technologie','medium')
ON DUPLICATE KEY UPDATE `word`=VALUES(`word`);