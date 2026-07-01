-- Migration 001: Initial Schema
-- Creates all core tables for the Sales CRM

CREATE TABLE IF NOT EXISTS users (
  id            SERIAL PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL CHECK(role IN ('director', 'manager')),
  zone          TEXT CHECK(zone IN ('south_west', 'north')),
  last_login    TIMESTAMP,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS clients (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  company     TEXT NOT NULL,
  phone       TEXT,
  email       TEXT,
  address     TEXT,
  zone        TEXT NOT NULL CHECK(zone IN ('south_west', 'north')),
  assigned_to INTEGER REFERENCES users(id),
  created_by  INTEGER NOT NULL REFERENCES users(id),
  notes       TEXT,
  created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS deals (
  id                      SERIAL PRIMARY KEY,
  title                   TEXT NOT NULL,
  client_id               INTEGER NOT NULL REFERENCES clients(id),
  assigned_to             INTEGER NOT NULL REFERENCES users(id),
  created_by              INTEGER NOT NULL REFERENCES users(id),
  value                   DOUBLE PRECISION,
  stage                   TEXT NOT NULL DEFAULT 'lead'
                            CHECK(stage IN ('lead','qualified','proposal','negotiation','closed_won','closed_lost')),
  temperature             TEXT NOT NULL DEFAULT 'warm'
                            CHECK(temperature IN ('hot','warm','cold')),
  expected_close_date     DATE,
  last_contact_date       DATE,
  last_contact_summary    TEXT,
  close_date_change_count INTEGER DEFAULT 0,
  notes                   TEXT,
  loss_reason             TEXT,
  created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Immutable audit trail; application layer must never UPDATE or DELETE rows here.
CREATE TABLE IF NOT EXISTS deal_activities (
  id            SERIAL PRIMARY KEY,
  deal_id       INTEGER NOT NULL REFERENCES deals(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  activity_type TEXT NOT NULL,
  description   TEXT NOT NULL,
  old_value     TEXT,
  new_value     TEXT,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id              SERIAL PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT,
  created_by      INTEGER NOT NULL REFERENCES users(id),
  assigned_to     INTEGER NOT NULL REFERENCES users(id),
  deal_id         INTEGER REFERENCES deals(id),
  client_id       INTEGER REFERENCES clients(id),
  due_date        DATE NOT NULL,
  priority        TEXT DEFAULT 'medium'
                    CHECK(priority IN ('low','medium','high','urgent')),
  status          TEXT DEFAULT 'pending'
                    CHECK(status IN ('pending','in_progress','completed','overdue')),
  completion_note TEXT,
  completed_at    TIMESTAMP,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id           SERIAL PRIMARY KEY,
  sender_id    INTEGER NOT NULL REFERENCES users(id),
  recipient_id INTEGER NOT NULL REFERENCES users(id),
  subject      TEXT,
  content      TEXT NOT NULL,
  deal_id      INTEGER REFERENCES deals(id),
  read_at      TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS targets (
  id                SERIAL PRIMARY KEY,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  month             INTEGER NOT NULL,
  year              INTEGER NOT NULL,
  revenue_target    DOUBLE PRECISION,
  deal_count_target INTEGER,
  created_by        INTEGER NOT NULL REFERENCES users(id),
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, month, year)
);

-- Login audit trail for security monitoring
CREATE TABLE IF NOT EXISTS login_log (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL,
  success    INTEGER NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
