import pg from 'pg';
import { DatabaseSync } from 'node:sqlite';
import { config } from '../config.js';

const { Pool } = pg;

let pgPool = null;
let sqliteDb = null;
let usePostgres = Boolean(config.databaseUrl);

export function getDb() {
  if (usePostgres) {
    if (!pgPool) {
      pgPool = new Pool({
        connectionString: config.databaseUrl,
        ssl: { rejectUnauthorized: false }
      });
    }
    return pgPool;
  }

  if (!sqliteDb) {
    sqliteDb = new DatabaseSync(config.dbPath);
  }
  return sqliteDb;
}

export async function initDb() {
  if (usePostgres) {
    try {
      const pool = getDb();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          id SERIAL PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          name TEXT,
          picture TEXT,
          created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tokens (
          id SERIAL PRIMARY KEY,
          user_email TEXT UNIQUE NOT NULL,
          encrypted_refresh_token TEXT,
          encrypted_access_token TEXT,
          expiry_date BIGINT,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS scans (
          id SERIAL PRIMARY KEY,
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
          id SERIAL PRIMARY KEY,
          date TEXT UNIQUE NOT NULL,
          vouched_count INTEGER DEFAULT 0
        );
      `);

      const today = new Date().toISOString().slice(0, 10);
      try {
        await pool.query(
          `INSERT INTO stats (date, vouched_count) VALUES ($1, 0) ON CONFLICT (date) DO NOTHING`,
          [today]
        );
      } catch (err) {}
      return;
    } catch (err) {
      console.warn('⚠️ Cloud PostgreSQL unavailable, falling back to local SQLite:', err.message);
      usePostgres = false;
    }
  }

  const database = getDb();

  // Create tables using synchronous exec for SQLite
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

function toPgSql(sql) {
  let idx = 1;
  return sql.replace(/\?/g, () => `$${idx++}`);
}

// Database helper functions wrapped in async Promises for consistent async API
export async function runQuery(sql, params = []) {
  if (usePostgres) {
    const pool = getDb();
    const pgSql = toPgSql(sql);
    const result = await pool.query(pgSql, params);
    return { lastID: null, changes: result.rowCount };
  }
  const stmt = getDb().prepare(sql);
  const result = stmt.run(...params);
  return { lastID: result.lastInsertRowid, changes: result.changes };
}

export async function getRow(sql, params = []) {
  if (usePostgres) {
    const pool = getDb();
    const pgSql = toPgSql(sql);
    const result = await pool.query(pgSql, params);
    return result.rows[0] || null;
  }
  const stmt = getDb().prepare(sql);
  return stmt.get(...params);
}

export async function getAllRows(sql, params = []) {
  if (usePostgres) {
    const pool = getDb();
    const pgSql = toPgSql(sql);
    const result = await pool.query(pgSql, params);
    return result.rows;
  }
  const stmt = getDb().prepare(sql);
  return stmt.all(...params);
}
