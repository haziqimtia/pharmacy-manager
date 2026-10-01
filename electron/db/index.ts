import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { hashPassword } from '../auth/password';

const SCHEMA_VERSION = 1;

let db: Database.Database | null = null;

function getDbPath(): string {
  const userDataPath = app.getPath('userData');
  if (!fs.existsSync(userDataPath)) {
    fs.mkdirSync(userDataPath, { recursive: true });
  }
  return path.join(userDataPath, 'pharmacy.db');
}

function seedDefaults(database: Database.Database) {
  const settingsCount = database.prepare('SELECT COUNT(*) as c FROM settings').get() as { c: number };
  if (settingsCount.c === 0) {
    const defaults: Record<string, string> = {
      pharmacy_name: 'My Pharmacy',
      pharmacy_address: '',
      pharmacy_phone: '',
      pharmacy_email: '',
      pharmacy_logo_path: '',
      currency_symbol: '₹',
      low_stock_default_threshold: '10',
      near_expiry_days: '90',
      receipt_footer_note: 'Thank you for visiting!',
      invoice_prefix: 'INV',
    };
    const insert = database.prepare('INSERT INTO settings (key, value) VALUES (?, ?)');
    const tx = database.transaction((entries: [string, string][]) => {
      for (const [k, v] of entries) insert.run(k, v);
    });
    tx(Object.entries(defaults));
  }

  const userCount = database.prepare('SELECT COUNT(*) as c FROM users').get() as { c: number };
  if (userCount.c === 0) {
    // Default admin user: username "admin", password "admin123" (hashed).
    // Shown on first run so the pharmacy owner can log in immediately and change it later.
    database
      .prepare('INSERT INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)')
      .run('admin', hashPassword('admin123'), 'Administrator', 'admin');
  }
}

export function initDatabase(): Database.Database {
  if (db) return db;

  const dbPath = getDbPath();
  const database = new Database(dbPath);
  database.pragma('journal_mode = WAL');
  database.pragma('foreign_keys = ON');

  const schemaPath = path.join(__dirname, 'schema.sql');
  const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
  database.exec(schemaSql);

  const versionRow = database.prepare('SELECT value FROM schema_meta WHERE key = ?').get('schema_version') as
    | { value: string }
    | undefined;
  if (!versionRow) {
    database
      .prepare('INSERT INTO schema_meta (key, value) VALUES (?, ?)')
      .run('schema_version', String(SCHEMA_VERSION));
  }

  seedDefaults(database);

  db = database;
  return db;
}

export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export function getDbFilePath(): string {
  return getDbPath();
}
