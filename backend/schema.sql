-- CareMate database schema (SQLite). Created automatically by db.js on first start.

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL,            -- scrypt, never the plain password
  salt          TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Login sessions. Only a SHA-256 of the token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,               -- unix ms
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

-- One health profile per user (the answers from the profile form).
CREATE TABLE IF NOT EXISTS profiles (
  user_id    INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data       TEXT    NOT NULL,               -- JSON
  updated_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- The care areas the user chose (diet, yoga, meditation ...).
CREATE TABLE IF NOT EXISTS plans (
  user_id  INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  goals    TEXT    NOT NULL,                 -- JSON array
  saved_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- One row per user per day: powers Today's goals, streaks and reports.
CREATE TABLE IF NOT EXISTS daily_log (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day     TEXT    NOT NULL,                  -- YYYY-MM-DD
  water   INTEGER NOT NULL DEFAULT 0,        -- glasses
  meals   INTEGER NOT NULL DEFAULT 0,        -- meals ticked
  yoga    INTEGER NOT NULL DEFAULT 0,        -- 0 / 1
  calm    INTEGER NOT NULL DEFAULT 0,        -- 0 / 1
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, day)
);

CREATE TABLE IF NOT EXISTS reminders (
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data    TEXT    NOT NULL,                  -- JSON array
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Small per-user settings (current diet week, ...).
CREATE TABLE IF NOT EXISTS user_kv (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key     TEXT    NOT NULL,
  value   TEXT    NOT NULL,
  PRIMARY KEY (user_id, key)
);
