-- Accounts: people sign in with Google or Microsoft; each belongs to one or more organisations (a private workspace is made at
-- first sign-in; teams join by invitation, never by email domain). Sessions are stored as the SHA-256 of the token only.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, provider TEXT NOT NULL, subject TEXT NOT NULL, email TEXT, name TEXT, created_at INTEGER NOT NULL, last_login INTEGER NOT NULL,
  UNIQUE (provider, subject)
);
CREATE TABLE IF NOT EXISTS orgs (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS memberships (
  org_id TEXT NOT NULL REFERENCES orgs(id), user_id TEXT NOT NULL REFERENCES users(id), role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')), created_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS memberships_by_user ON memberships (user_id);
CREATE TABLE IF NOT EXISTS sessions (token_sha256 TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS sessions_by_expiry ON sessions (expires_at);
