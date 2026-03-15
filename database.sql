-- ================================================================
--  Animal Merge Solver — MySQL Database Schema
--  HOW TO USE:
--   1. Open phpMyAdmin
--   2. Create a new database (e.g. "animal_merge")
--   3. Click the database, then click "SQL" tab
--   4. Paste this entire file and click "Go"
-- ================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ── users table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`          INT          NOT NULL AUTO_INCREMENT,
  `username`    VARCHAR(64)  NOT NULL,
  `password`    VARCHAR(256) NOT NULL,
  `fingerprint` VARCHAR(128) DEFAULT NULL,
  `is_approved` TINYINT(1)   NOT NULL DEFAULT 0,
  `is_admin`    TINYINT(1)   NOT NULL DEFAULT 0,
  `solve_count` INT          NOT NULL DEFAULT 0,
  `last_login`  DATETIME     DEFAULT NULL,
  `created_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── solve_logs table ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `solve_logs` (
  `id`           INT          NOT NULL AUTO_INCREMENT,
  `user_id`      INT          NOT NULL,
  `board_state`  TEXT         NOT NULL,
  `best_move`    VARCHAR(16)  NOT NULL,
  `score`        FLOAT        DEFAULT NULL,
  `created_at`   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `fk_solve_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ── default admin account ────────────────────────────────────
-- Password is: admin123  (bcrypt hash, cost 10)
INSERT INTO `users` (`username`, `password`, `is_approved`, `is_admin`)
VALUES (
  'admin',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lHHi',
  1,
  1
)
ON DUPLICATE KEY UPDATE `is_admin` = 1, `is_approved` = 1;

SET FOREIGN_KEY_CHECKS = 1;

-- ================================================================
--  After running this SQL:
--   Admin login:  username = admin   password = admin123
--   IMPORTANT: Change admin password after first login!
-- ================================================================
