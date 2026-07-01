-- Migration 003: CMD role, deal probability, pipeline coverage, alerts

-- Add cmd to role CHECK constraint (drop and recreate the constraint)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
  CHECK (role IN ('cmd', 'director', 'manager'));

-- Win probability per deal for weighted pipeline forecasting
ALTER TABLE deals ADD COLUMN IF NOT EXISTS probability DOUBLE PRECISION DEFAULT 0.3;
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
ALTER TABLE targets ADD COLUMN IF NOT EXISTS pipeline_coverage_target DOUBLE PRECISION DEFAULT 2.5;

-- Rule-based alert notifications for CMD and director
CREATE TABLE IF NOT EXISTS alerts (
  id              SERIAL PRIMARY KEY,
  rule_type       TEXT    NOT NULL,
  severity        TEXT    NOT NULL CHECK(severity IN ('critical', 'warning', 'info')),
  message         TEXT    NOT NULL,
  deal_id         INTEGER REFERENCES deals(id) ON DELETE CASCADE,
  about_user_id   INTEGER REFERENCES users(id) ON DELETE CASCADE,
  recipient_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alerts_recipient ON alerts(recipient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_dedup    ON alerts(rule_type, deal_id, created_at);
