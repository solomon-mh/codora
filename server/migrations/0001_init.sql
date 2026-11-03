-- Codora usage counts. One row per event from an opted-in install.
-- `props` holds only the allow-listed enum/boolean/bucket fields (see src/validate.ts).
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  install_id TEXT NOT NULL,
  name TEXT NOT NULL,
  props TEXT NOT NULL,
  at INTEGER NOT NULL,
  received_at INTEGER NOT NULL,
  extension_version TEXT NOT NULL,
  vscode_version TEXT NOT NULL,
  platform TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS events_name_at ON events (name, at);
CREATE INDEX IF NOT EXISTS events_install_at ON events (install_id, at);
CREATE INDEX IF NOT EXISTS events_install_received ON events (install_id, received_at);
