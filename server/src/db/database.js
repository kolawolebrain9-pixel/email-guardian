import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

let db = null;

export function getDb() {
  if (!db) {
    db = new DatabaseSync(config.dbPath);
  }
  return db;
}

export function initDb() {
  const database = getDb();

  // Create tables using synchronous exec
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT,
      picture TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT UNIQUE NOT NULL,
      encrypted_refresh_token TEXT,
      encrypted_access_token TEXT,
      expiry_date INTEGER,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_email TEXT NOT NULL,
      message_id TEXT NOT NULL,
      thread_id TEXT,
      sender_name TEXT,
      sender_address TEXT,
      subject TEXT,
      date TEXT,
      snippet TEXT,
      risk_level TEXT NOT NULL,
      risk_score INTEGER DEFAULT 0,
      reasons TEXT DEFAULT '[]',
      explanation TEXT,
      community_count INTEGER DEFAULT 0,
      fingerprint TEXT,
      action_taken TEXT,
      scanned_at TEXT NOT NULL,
      UNIQUE(user_email, message_id)
    );

    CREATE TABLE IF NOT EXISTS community_fingerprints (
      fingerprint TEXT PRIMARY KEY,
      sender_domain TEXT,
      normalized_subject TEXT,
      report_count INTEGER DEFAULT 1,
      first_seen TEXT NOT NULL,
      last_seen TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT UNIQUE NOT NULL,
      vouched_count INTEGER DEFAULT 0
    );
  `);

  // Seed default daily vouched counter
  const today = new Date().toISOString().slice(0, 10);
  try {
    const insertStat = database.prepare(`INSERT OR IGNORE INTO stats (date, vouched_count) VALUES (?, 0)`);
    insertStat.run(today);
  } catch (err) {
    // Stat already exists
  }
}

// Database helper functions wrapped in async Promises for consistent async API
export async function runQuery(sql, params = []) {
  const stmt = getDb().prepare(sql);
  const result = stmt.run(...params);
  return { lastID: result.lastInsertRowid, changes: result.changes };
}

export async function getRow(sql, params = []) {
  const stmt = getDb().prepare(sql);
  return stmt.get(...params);
}

export async function getAllRows(sql, params = []) {
  const stmt = getDb().prepare(sql);
  return stmt.all(...params);
}
