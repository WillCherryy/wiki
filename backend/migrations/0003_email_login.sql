-- Sign-in by emailed link: single-use tokens, stored as SHA-256 only, with the hashed client for rate limiting.
CREATE TABLE IF NOT EXISTS login_tokens (
  token_sha256 TEXT PRIMARY KEY, email TEXT NOT NULL, client_sha256 TEXT NOT NULL, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS login_tokens_recent ON login_tokens (created_at);
