CREATE TABLE IF NOT EXISTS pairs (
  pair_id TEXT PRIMARY KEY,
  read_token_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  last_event_id INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS pairs_expires_at ON pairs (expires_at);

CREATE TABLE IF NOT EXISTS events (
  pair_id TEXT NOT NULL,
  event_id INTEGER NOT NULL,
  lage TEXT NOT NULL,
  received_at TEXT NOT NULL,
  PRIMARY KEY (pair_id, event_id)
);

CREATE INDEX IF NOT EXISTS events_pair_id ON events (pair_id);
