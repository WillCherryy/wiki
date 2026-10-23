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
 "CREATE INDEX IF NOT EXISTS orders_pid ON orders (pid)",
 "CREATE TABLE IF NOT EXISTS reports ( id INTEGER PRIMARY KEY AUTOINCREMENT, created_at INTEGER NOT NULL, day TEXT, mode TEXT NOT NULL, from_title TEXT NOT NULL, to_title TEXT NOT NULL, reason TEXT NOT NULL, note TEXT NOT NULL, pid TEXT )",
 "CREATE TABLE IF NOT EXISTS activity ( day TEXT NOT NULL, pid TEXT NOT NULL, started INTEGER NOT NULL DEFAULT 0, finished INTEGER NOT NULL DEFAULT 0, daily_started INTEGER NOT NULL DEFAULT 0, daily_won INTEGER NOT NULL DEFAULT 0, shared INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, pid) )",
 "CREATE INDEX IF NOT EXISTS activity_pid ON activity (pid)",
 "CREATE TABLE IF NOT EXISTS counters ( day TEXT NOT NULL, k TEXT NOT NULL, n INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (day, k) )",
 "CREATE TABLE IF NOT EXISTS daily_override ( day TEXT PRIMARY KEY, from_title TEXT NOT NULL, to_title TEXT NOT NULL, par INTEGER NOT NULL, route TEXT NOT NULL, alts TEXT NOT NULL DEFAULT '[]', created_at INTEGER NOT NULL )"
];
