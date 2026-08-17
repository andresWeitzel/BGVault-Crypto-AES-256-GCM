const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const { PROJECT_ROOT } = require('../config/env');

const DATA_DIR = path.join(PROJECT_ROOT, 'data');
const DEFAULT_DB_PATH = path.join(DATA_DIR, 'bgvault.sqlite');

let db;

const SCHEMA = `
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS credentials (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  service TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  current_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credential_versions (
  credential_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  ciphertext TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (credential_id, version),
  FOREIGN KEY (credential_id) REFERENCES credentials(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  action TEXT NOT NULL,
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
