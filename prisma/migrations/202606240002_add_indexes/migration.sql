-- Migration 002: Performance Indexes
-- Covers the most common query patterns: deal pipeline filters,
-- activity lookups, task assignment, message inbox, and stale detection.

-- deals: primary query axes
CREATE INDEX IF NOT EXISTS idx_deals_assigned_to      ON deals(assigned_to);
CREATE INDEX IF NOT EXISTS idx_deals_stage            ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_temperature      ON deals(temperature);
CREATE INDEX IF NOT EXISTS idx_deals_client_id        ON deals(client_id);
CREATE INDEX IF NOT EXISTS idx_deals_last_contact     ON deals(last_contact_date);
CREATE INDEX IF NOT EXISTS idx_deals_expected_close   ON deals(expected_close_date);

-- deal_activities: always fetched by deal_id, often ordered by created_at
CREATE INDEX IF NOT EXISTS idx_activities_deal_id     ON deal_activities(deal_id);
CREATE INDEX IF NOT EXISTS idx_activities_user_id     ON deal_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_created_at  ON deal_activities(created_at);

-- clients: zone filter and assignment
CREATE INDEX IF NOT EXISTS idx_clients_assigned_to    ON clients(assigned_to);
CREATE INDEX IF NOT EXISTS idx_clients_zone           ON clients(zone);

-- tasks: inbox-style queries by assignee and status
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to      ON tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_status           ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date         ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tasks_deal_id          ON tasks(deal_id);

-- messages: inbox and sent-box queries
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id  ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id     ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_read_at       ON messages(read_at);

-- targets: month+year lookup
CREATE INDEX IF NOT EXISTS idx_targets_user_month     ON targets(user_id, month, year);

-- login_log: security audit queries by user
CREATE INDEX IF NOT EXISTS idx_login_log_user_id      ON login_log(user_id);
CREATE INDEX IF NOT EXISTS idx_login_log_created_at   ON login_log(created_at);
