import fs from 'node:fs';
import { config } from './config.js';
import { SqliteDatabase } from './sqlite.js';

/**
 * Open (and create if needed) the SQLite database file and apply the schema.
 * The schema is idempotent, so this is safe on every start.
 */
export function openDatabase(file = config.dbFile) {
  const db = new SqliteDatabase(file);
  applySchema(db);
  return db;
}

export function applySchema(db) {
  const sql = fs.readFileSync(config.schemaFile, 'utf8');
  db.exec(sql);
}

export const nowIso = () => new Date().toISOString();
