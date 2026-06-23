-- Migration 001: Initial Schema
-- Creates all core tables for the Sales CRM

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    UNIQUE NOT NULL,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL CHECK(role IN ('director', 'manager')),
  zone          TEXT    CHECK(zone IN ('south_west', 'north')),
  last_login    DATETIME,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  company     TEXT    NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  zone        TEXT    NOT NULL CHECK(zone IN ('south_west', 'north')),
  assigned_to INTEGER REFERENCES users(id),
  created_by  INTEGER NOT NULL REFERENCES users(id),
  notes       TEXT,
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deals (
  id                     INTEGER PRIMARY KEY AUTOINCREMENT,
  title                  TEXT    NOT NULL,
  client_id              INTEGER NOT NULL REFERENCES clients(id),
  assigned_to            INTEGER NOT NULL REFERENCES users(id),
  created_by             INTEGER NOT NULL REFERENCES users(id),
  value                  REAL,
  stage                  TEXT    NOT NULL DEFAULT 'lead'
                           CHECK(stage IN ('lead','qualified','proposal','negotiation','closed_won','closed_lost')),
  temperature            TEXT    NOT NULL DEFAULT 'warm'
                           CHECK(temperature IN ('hot','warm','cold')),
  expected_close_date    DATE,
  last_contact_date      DATE,
  last_contact_summary   TEXT,
  close_date_change_count INTEGER DEFAULT 0,
  notes                  TEXT,
  loss_reason            TEXT,
  created_at             DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at             DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Immutable audit trail — application layer must never UPDATE or DELETE rows here
CREATE TABLE IF NOT EXISTS deal_activities (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  deal_id       INTEGER NOT NULL REFERENCES deals(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  activity_type TEXT    NOT NULL,
  description   TEXT    NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  title           TEXT    NOT NULL,
  description     TEXT,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  assigned_to     INTEGER NOT NULL REFERENCES users(id),
  deal_id         INTEGER REFERENCES deals(id),
  client_id       INTEGER REFERENCES clients(id),
  due_date        DATE    NOT NULL,
  priority        TEXT    DEFAULT 'medium'
                    CHECK(priority IN ('low','medium','high','urgent')),
  status          TEXT    DEFAULT 'pending'
                    CHECK(status IN ('pending','in_progress','completed','overdue')),
  completion_note TEXT,
  completed_at    DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id    INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  subject      TEXT,
  content      TEXT    NOT NULL,
  deal_id      INTEGER REFERENCES deals(id),
  read_at      DATETIME,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS targets (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  month             INTEGER NOT NULL,
  year              INTEGER NOT NULL,
  revenue_target    REAL,
  deal_count_target INTEGER,
  created_by        INTEGER NOT NULL REFERENCES users(id),
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, month, year)
);

-- Login audit trail for security monitoring
CREATE TABLE IF NOT EXISTS login_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL,
  success    INTEGER NOT NULL,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
