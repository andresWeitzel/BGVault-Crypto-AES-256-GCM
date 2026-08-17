const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { PROJECT_ROOT } = require('../config/env');

const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'bgvault.sqlite');

let db;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  service TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS credential_versions (
  credential_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  ciphertext TEXT NOT NULL,
  wrapped_dek TEXT,
  expires_at TEXT,
  max_reveals INTEGER,
  reveal_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  PRIMARY KEY (credential_id, version),
  FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
  user_id TEXT,
  credential_id TEXT,
  version INTEGER,
  ok INTEGER NOT NULL,
  detail TEXT
);

CREATE INDEX IF NOT EXISTS idx_credentials_type ON credentials(type);
CREATE INDEX IF NOT EXISTS idx_credentials_service ON credentials(service);
CREATE INDEX IF NOT EXISTS idx_audit_at ON audit_events(at);
CREATE INDEX IF NOT EXISTS idx_audit_credential ON audit_events(credential_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_events(action);
`;

function columnNames(conn, table) {
  return conn.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
}

function migrate(conn) {
  const credentialColumns = columnNames(conn, 'credentials');
  if (!credentialColumns.includes('user_id')) {
    conn.exec('ALTER TABLE credentials ADD COLUMN user_id TEXT');
  }

  const auditColumns = columnNames(conn, 'audit_events');
  if (!auditColumns.includes('user_id')) {
    conn.exec('ALTER TABLE audit_events ADD COLUMN user_id TEXT');
  }

  const versionColumns = columnNames(conn, 'credential_versions');
  if (!versionColumns.includes('wrapped_dek')) {
    conn.exec('ALTER TABLE credential_versions ADD COLUMN wrapped_dek TEXT');
  }
  if (!versionColumns.includes('expires_at')) {
    conn.exec('ALTER TABLE credential_versions ADD COLUMN expires_at TEXT');
  }
  if (!versionColumns.includes('max_reveals')) {
    conn.exec('ALTER TABLE credential_versions ADD COLUMN max_reveals INTEGER');
  }
  if (!versionColumns.includes('reveal_count')) {
    conn.exec(
      'ALTER TABLE credential_versions ADD COLUMN reveal_count INTEGER NOT NULL DEFAULT 0',
    );
  }

  conn.exec('CREATE INDEX IF NOT EXISTS idx_credentials_user ON credentials(user_id)');
  conn.exec('CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_events(user_id)');
}

function resolveDbPath() {
  return process.env.SQLITE_PATH || DEFAULT_DB_PATH;
}

function open() {
  if (db) return db;

  const dbPath = resolveDbPath();
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }

  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(SCHEMA);
  migrate(db);
  return db;
}

function getDb() {
  return db || open();
}

function runInTransaction(fn) {
  const conn = getDb();
  conn.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(conn);
    conn.exec('COMMIT');
    return result;
  } catch (error) {
    try {
      conn.exec('ROLLBACK');
    } catch {
      // ignore rollback errors
    }
    throw error;
  }
}

module.exports = {
  open,
  getDb,
  runInTransaction,
  resolveDbPath,
  DATA_DIR,
};
