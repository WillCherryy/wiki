-- D1 schema for the Build backend. Tasks hold the spec including the hidden reference answer: only admin endpoints ever return it.
CREATE TABLE IF NOT EXISTS tasks (
  tenant TEXT NOT NULL, id TEXT NOT NULL, title TEXT NOT NULL, domain TEXT NOT NULL, spec TEXT NOT NULL, created_at INTEGER NOT NULL,
  PRIMARY KEY (tenant, id)
);
CREATE TABLE IF NOT EXISTS trials (
  id TEXT PRIMARY KEY, tenant TEXT NOT NULL, task_id TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS trials_by_task ON trials (tenant, task_id, created_at);
