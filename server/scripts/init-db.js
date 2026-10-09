// Creates the SQLite database and all tables.
//   npm run db:init            create tables if they don't exist
//   npm run db:init -- --reset delete the database file first, then create it fresh
import fs from 'node:fs';
import { config } from '../src/config.js';
import { openDatabase } from '../src/db.js';

const reset = process.argv.includes('--reset');

if (reset) {
  for (const suffix of ['', '.tmp', '-wal', '-shm']) {
    const f = config.dbFile + suffix;
    if (fs.existsSync(f)) fs.rmSync(f);
  }
  console.log('Removed existing database.');
}

const db = openDatabase();
const tables = db
  .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
  .all()
  .map((t) => t.name);
db.close();

console.log(`Database ready at ${config.dbFile}`);
console.log(`Tables: ${tables.join(', ')}`);
