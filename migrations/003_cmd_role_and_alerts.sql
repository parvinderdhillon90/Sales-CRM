-- Migration 003: CMD role, deal probability, pipeline coverage, alerts

-- SQLite cannot modify CHECK constraints via ALTER TABLE.
-- Recreate users table with 'cmd' added to the role constraint.
PRAGMA legacy_alter_table = ON;
ALTER TABLE users RENAME TO _users_backup;
CREATE TABLE users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    UNIQUE NOT NULL,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK(role IN ('cmd', 'director', 'manager')),
  zone          TEXT    CHECK(zone IN ('south_west', 'north')),
  last_login    DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO users SELECT * FROM _users_backup;
DROP TABLE _users_backup;
PRAGMA legacy_alter_table = OFF;

-- Win probability per deal for weighted pipeline forecasting
ALTER TABLE deals ADD COLUMN probability REAL DEFAULT 0.3;
UPDATE deals SET probability = CASE stage
  WHEN 'lead'        THEN 0.10
  WHEN 'qualified'   THEN 0.25
  WHEN 'proposal'    THEN 0.50
  WHEN 'negotiation' THEN 0.75
  WHEN 'closed_won'  THEN 1.00
  WHEN 'closed_lost' THEN 0.00
  ELSE 0.30
END;

-- Pipeline coverage multiplier target per user per month
ALTER TABLE targets ADD COLUMN pipeline_coverage_target REAL DEFAULT 2.5;

-- Rule-based alert notifications for CMD and director
CREATE TABLE IF NOT EXISTS alerts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  rule_type       TEXT    NOT NULL,
  severity        TEXT    NOT NULL CHECK(severity IN ('critical', 'warning', 'info')),
  message         TEXT    NOT NULL,
  deal_id         INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  about_user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipient_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alerts_recipient ON alerts(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_dedup    ON alerts(rule_type, deal_id, created_at);
