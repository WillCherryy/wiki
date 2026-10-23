// Generated from schema.sql (node tools/gen-schema.js); the Worker applies it once per isolate so no manual D1 step is needed.
export default [
 "CREATE TABLE IF NOT EXISTS players ( pid TEXT PRIMARY KEY, name TEXT NOT NULL, xp INTEGER NOT NULL DEFAULT 0, streak INTEGER NOT NULL DEFAULT 0, last_day TEXT, shield TEXT, created_at INTEGER NOT NULL )",
 "CREATE TABLE IF NOT EXISTS scores ( day TEXT NOT NULL, pid TEXT NOT NULL, clicks INTEGER NOT NULL, secs INTEGER NOT NULL, score INTEGER NOT NULL, purist INTEGER NOT NULL DEFAULT 0, path TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (day, pid) )",
 "CREATE INDEX IF NOT EXISTS scores_day_rank ON scores (day, clicks, secs)",
 "CREATE INDEX IF NOT EXISTS scores_pid ON scores (pid)",
 "CREATE TABLE IF NOT EXISTS leagues ( code TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL )",
 "CREATE TABLE IF NOT EXISTS league_members ( code TEXT NOT NULL, pid TEXT NOT NULL, PRIMARY KEY (code, pid) )",
 "CREATE INDEX IF NOT EXISTS league_members_pid ON league_members (pid)",
 "CREATE TABLE IF NOT EXISTS orders ( id TEXT NOT NULL, provider TEXT NOT NULL, pid TEXT NOT NULL, created_at INTEGER NOT NULL, PRIMARY KEY (provider, id) )",
 "CREATE INDEX IF NOT EXISTS orders_pid ON orders (pid)"
];
