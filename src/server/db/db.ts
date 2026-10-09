import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = DatabaseSync;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS people (id TEXT PRIMARY KEY, name TEXT NOT NULL, tz TEXT NOT NULL, role TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS items (person TEXT NOT NULL, name TEXT NOT NULL, hhmm TEXT NOT NULL, days TEXT NOT NULL, PRIMARY KEY (person, name, hhmm));
CREATE TABLE IF NOT EXISTS slots (
  person TEXT NOT NULL, item TEXT NOT NULL, local_date TEXT NOT NULL, slot_hhmm TEXT NOT NULL,
  due_ts INTEGER NOT NULL, status TEXT NOT NULL, taken_ts INTEGER, snoozed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (person, item, local_date, slot_hhmm)
);
CREATE TABLE IF NOT EXISTS escalations (
  person TEXT NOT NULL, item TEXT NOT NULL, local_date TEXT NOT NULL, slot_hhmm TEXT NOT NULL,
  status TEXT NOT NULL, created_ts INTEGER NOT NULL, resolved_ts INTEGER, notification_id INTEGER,
  PRIMARY KEY (person, item, local_date, slot_hhmm)
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT, caregiver TEXT NOT NULL, message TEXT NOT NULL, followup TEXT,
  created_ts INTEGER NOT NULL, read INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_log (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, tool TEXT NOT NULL, person TEXT, outcome TEXT NOT NULL);
`;

export function openDb(path: string): Db {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA busy_timeout = 5000;");
  if (path !== ":memory:") db.exec("PRAGMA journal_mode = WAL;");
  db.exec(SCHEMA);
  db.prepare("INSERT OR IGNORE INTO meta(key,value) VALUES('schema_version','1')").run();
  db.prepare("INSERT OR IGNORE INTO meta(key,value) VALUES('schedule_version','0')").run();
  return db;
}

export function resetDb(db: Db): void {
  for (const t of ["items", "slots", "escalations", "notifications", "audit_log", "people"]) db.exec(`DELETE FROM ${t};`);
  db.prepare("UPDATE meta SET value='0' WHERE key='schedule_version'").run();
}

/** Run fn inside BEGIN IMMEDIATE ... COMMIT, retrying twice on a busy database. */
export function tx<T>(db: Db, fn: () => T): T {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      db.exec("BEGIN IMMEDIATE");
      try {
        const r = fn();
        db.exec("COMMIT");
        return r;
      } catch (e) {
        try { db.exec("ROLLBACK"); } catch { /* already rolled back */ }
        throw e;
      }
    } catch (e) {
      lastErr = e;
      const msg = String((e as Error)?.message ?? e);
      if (!/locked|busy/i.test(msg)) throw e;
      const until = Date.now() + 50;
      while (Date.now() < until) { /* short synchronous backoff */ }
    }
  }
  throw lastErr;
}
