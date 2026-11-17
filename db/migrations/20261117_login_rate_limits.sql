CREATE TABLE IF NOT EXISTS login_rate_limits (
 identifier_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin PRIMARY KEY,
 window_started_at DATETIME NOT NULL,
 failed_attempts SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 blocked_until DATETIME NULL,
 updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 INDEX idx_login_rate_limits_updated(updated_at)
) ENGINE=InnoDB;
