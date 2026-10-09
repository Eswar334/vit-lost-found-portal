// A small SQLite wrapper built on sql.js (SQLite compiled to WebAssembly).
//
// Why not a native driver? Native modules such as better-sqlite3 need a
// matching prebuilt binary or C++ build tools, which often fails on Windows
// laptops. sql.js is pure JavaScript + WebAssembly, so `npm install` works on
// any OS and any Node version >= 20 with nothing extra installed.
//
// The API mirrors the parts of better-sqlite3 this app uses:
//   db.prepare(sql).get(...params) / .all(...params) / .run(...params)
//   db.exec(sql), db.pragma(str), db.transaction(fn), db.close()
//
// Persistence: the whole database lives in memory and is written to disk
// after every change (atomically, via a temp file). If another process
// (e.g. `npm run db:seed`) rewrites the file while the server is running,
// the server notices the new file and reloads it before the next query.

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import initSqlJs from 'sql.js';

const require = createRequire(import.meta.url);
const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
const SQL = await initSqlJs({ locateFile: () => wasmPath });

const clean = (params) => params.map((p) => (p === undefined ? null : typeof p === 'boolean' ? Number(p) : p));

class Statement {
  constructor(conn, sql) {
    this.conn = conn;
    this.sql = sql;
  }

  #each(params, onRow) {
    this.conn.syncFromDisk();
    const stmt = this.conn.raw.prepare(this.sql);
    try {
      stmt.bind(clean(params));
      while (stmt.step()) {
        if (onRow(stmt.getAsObject()) === false) break;
      }
    } finally {
      stmt.free();
    }
  }

  get(...params) {
    let row;
    this.#each(params, (r) => {
      row = r;
      return false;
    });
    return row;
  }

  all(...params) {
    const rows = [];
    this.#each(params, (r) => {
      rows.push(r);
    });
    return rows;
  }

  run(...params) {
    this.conn.syncFromDisk();
    const raw = this.conn.raw;
    const stmt = raw.prepare(this.sql);
    try {
      stmt.run(clean(params));
    } finally {
      stmt.free();
    }
    const changes = raw.getRowsModified();
    const lastInsertRowid = raw.exec('SELECT last_insert_rowid() AS id')[0]?.values[0][0] ?? 0;
    this.conn.persist();
    return { changes, lastInsertRowid };
  }
}

export class SqliteDatabase {
  constructor(file) {
    this.file = file === ':memory:' ? null : path.resolve(file);
    this.inTransaction = false;
    this.lastMtime = 0;
    if (this.file) fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.raw = this.#load();
    this.#applyPragmas();
    this.persist();
  }

  #load() {
    if (this.file && fs.existsSync(this.file)) {
      this.lastMtime = fs.statSync(this.file).mtimeMs;
      return new SQL.Database(fs.readFileSync(this.file));
    }
    return new SQL.Database();
  }

  #applyPragmas() {
    this.raw.exec('PRAGMA foreign_keys = ON;');
  }

  /** Reload if another process replaced the database file. */
  syncFromDisk() {
    if (!this.file || this.inTransaction) return;
    let mtime;
    try {
      mtime = fs.statSync(this.file).mtimeMs;
    } catch {
      return; // file temporarily missing (e.g. during a reset) — keep memory copy
    }
    if (mtime !== this.lastMtime) {
      this.raw.close();
      this.raw = this.#load();
      this.#applyPragmas();
    }
  }

  /** Write the database to disk (skipped inside a transaction). */
  persist() {
    if (!this.file || this.inTransaction) return;
    const data = this.raw.export();
    // export() resets connection pragmas in sql.js, so re-apply them.
    this.#applyPragmas();
    const tmp = `${this.file}.tmp`;
    try {
      fs.writeFileSync(tmp, data);
      fs.renameSync(tmp, this.file);
    } catch {
      // Windows can refuse the rename if something (antivirus, an editor)
      // has the file open. Fall back to writing in place.
      fs.writeFileSync(this.file, data);
      try {
        fs.rmSync(tmp, { force: true });
      } catch {
        /* ignore */
      }
    }
    this.lastMtime = fs.statSync(this.file).mtimeMs;
  }

  prepare(sql) {
    return new Statement(this, sql);
  }

  exec(sql) {
    this.syncFromDisk();
    this.raw.exec(sql);
    this.persist();
  }

  pragma(str) {
    this.raw.exec(`PRAGMA ${str};`);
  }

  /** Same contract as better-sqlite3: returns a function that runs fn atomically. */
  transaction(fn) {
    return (...args) => {
      this.syncFromDisk();
      this.raw.exec('BEGIN');
      this.inTransaction = true;
      try {
        const result = fn(...args);
        this.raw.exec('COMMIT');
        this.inTransaction = false;
        this.persist();
        return result;
      } catch (err) {
        this.inTransaction = false;
        try {
          this.raw.exec('ROLLBACK');
        } catch {
          /* already rolled back */
        }
        throw err;
      }
    };
  }

  close() {
    this.raw.close();
  }
}
