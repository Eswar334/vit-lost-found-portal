-- VIT Campus Lost & Found Recovery Portal — database schema (SQLite)
-- Safe to run repeatedly: every statement uses IF NOT EXISTS.

PRAGMA foreign_keys = ON;

-- Registered students. Contact fields (reg_no, email, phone) are never
-- returned by public endpoints; other students only ever see `alias`.
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  reg_no        TEXT    NOT NULL UNIQUE,          -- e.g. 24BCE2353
  email         TEXT    NOT NULL UNIQUE,          -- @vitstudent.ac.in
  phone         TEXT,                             -- optional, private
  password_hash TEXT    NOT NULL,
  alias         TEXT    NOT NULL UNIQUE,          -- public pseudonym, e.g. "Teal Heron 42"
  created_at    TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Lost and found reports.
CREATE TABLE IF NOT EXISTS items (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  type                  TEXT    NOT NULL CHECK (type IN ('lost', 'found')),
  title                 TEXT    NOT NULL,
  description           TEXT    NOT NULL,
  category              TEXT    NOT NULL,
  venue                 TEXT    NOT NULL,
  venue_detail          TEXT,
  event_date            TEXT    NOT NULL,         -- YYYY-MM-DD the item was lost/found
  verification_question TEXT    NOT NULL,         -- challenge every claimant must answer
  private_answer        TEXT,                     -- expected answer, visible only to the reporter
  status                TEXT    NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'in_handoff', 'resolved')),
  reporter_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resolved_at           TEXT,
  resolved_by           INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at            TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS ix_items_board    ON items (type, status, created_at DESC);
CREATE INDEX IF NOT EXISTS ix_items_category ON items (category);
CREATE INDEX IF NOT EXISTS ix_items_venue    ON items (venue);
CREATE INDEX IF NOT EXISTS ix_items_reporter ON items (reporter_id);

-- Claim Verification Requests (for found items) and "I found it" responses
-- (for lost items). The reporter reviews them privately.
CREATE TABLE IF NOT EXISTS claims (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id            INTEGER NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  claimant_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  answer             TEXT    NOT NULL,            -- answer to the verification question
  note               TEXT,                        -- optional extra detail
  status             TEXT    NOT NULL DEFAULT 'pending'
                             CHECK (status IN ('pending', 'approved', 'rejected',
                                               'withdrawn', 'cancelled', 'completed')),
  decision_note      TEXT,
  meetup_checkpoint  TEXT,
  meetup_time        TEXT,
  meetup_proposed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  meetup_confirmed   INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  decided_at         TEXT,
  updated_at         TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- A student can have only one live claim per item.
CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_live
  ON claims (item_id, claimant_id) WHERE status IN ('pending', 'approved');

-- An item can have only one approved claim at a time.
CREATE UNIQUE INDEX IF NOT EXISTS ux_claims_one_approved
  ON claims (item_id) WHERE status = 'approved';

CREATE INDEX IF NOT EXISTS ix_claims_claimant ON claims (claimant_id);

-- Private handoff thread between reporter and approved claimant.
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id   INTEGER NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  sender_id  INTEGER REFERENCES users(id) ON DELETE SET NULL,  -- NULL for system notes
  kind       TEXT    NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'system')),
  body       TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX IF NOT EXISTS ix_messages_claim ON messages (claim_id, id);
