-- Warmer API schema (Cloudflare D1 / SQLite). Apply with:
--   wrangler d1 execute warmer --remote --file=worker/schema.sql
CREATE TABLE IF NOT EXISTS players (
  pid TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  xp INTEGER NOT NULL DEFAULT 0,
  streak INTEGER NOT NULL DEFAULT 0,
  last_day TEXT,
  shield TEXT,                       -- month (YYYY-MM) in which a supporter's streak shield was last used
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS scores (
  day TEXT NOT NULL,
  pid TEXT NOT NULL,
  clicks INTEGER NOT NULL,
  secs INTEGER NOT NULL,
  score INTEGER NOT NULL,
  purist INTEGER NOT NULL DEFAULT 0,
  path TEXT NOT NULL,                -- JSON array of article titles
  created_at INTEGER NOT NULL,
  PRIMARY KEY (day, pid)
);
CREATE INDEX IF NOT EXISTS scores_day_rank ON scores (day, clicks, secs);
CREATE INDEX IF NOT EXISTS scores_pid ON scores (pid);
CREATE TABLE IF NOT EXISTS leagues (
  code TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS league_members (
  code TEXT NOT NULL,
  pid TEXT NOT NULL,
  PRIMARY KEY (code, pid)
);
CREATE INDEX IF NOT EXISTS league_members_pid ON league_members (pid);
-- Paid supporter packs. Kept when a player deletes their online data (payment records must be retained),
-- so a restored backup code is still recognised as a supporter.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT NOT NULL,
  provider TEXT NOT NULL,
  pid TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (provider, id)
);
CREATE INDEX IF NOT EXISTS orders_pid ON orders (pid);
-- Player reports about puzzles (unsolvable, offensive, broken). Read with: wrangler d1 execute warmer --remote --command "SELECT * FROM reports ORDER BY id DESC LIMIT 50"
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at INTEGER NOT NULL,
  day TEXT,
  mode TEXT NOT NULL,
  from_title TEXT NOT NULL,
  to_title TEXT NOT NULL,
  reason TEXT NOT NULL,
  note TEXT NOT NULL,
  pid TEXT
);
-- Anonymous product analytics, only when the player leaves "Anonymous usage statistics" on. One row per player per day;
-- no names, no IP addresses. Deleted with the rest of a player's data. Counters hold aggregate numbers (visits, countries, lobbies).
CREATE TABLE IF NOT EXISTS activity (
  day TEXT NOT NULL,
  pid TEXT NOT NULL,
  started INTEGER NOT NULL DEFAULT 0,
  finished INTEGER NOT NULL DEFAULT 0,
  daily_started INTEGER NOT NULL DEFAULT 0,
  daily_won INTEGER NOT NULL DEFAULT 0,
  shared INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, pid)
);
CREATE INDEX IF NOT EXISTS activity_pid ON activity (pid);
CREATE TABLE IF NOT EXISTS counters (
  day TEXT NOT NULL,
  k TEXT NOT NULL,
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, k)
);
