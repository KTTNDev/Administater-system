import "server-only";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { documentSchema, type Draft, type SavedDraft } from "./document";
class SQLiteDatabase {
  private readonly connection: DatabaseSync;
  constructor(file: string) { this.connection = new DatabaseSync(file); }
  prepare(sql: string) { return this.connection.prepare(sql); }
  exec(sql: string) { this.connection.exec(sql); }
  pragma(statement: string) { this.connection.exec(`PRAGMA ${statement}`); }
  close() { this.connection.close(); }
  transaction<T>(operation: () => T): () => T {
    return () => {
      this.connection.exec("BEGIN IMMEDIATE");
      try { const result = operation(); this.connection.exec("COMMIT"); return result; }
      catch (error) { this.connection.exec("ROLLBACK"); throw error; }
    };
  }
}
const globalDb = globalThis as unknown as { sarabunDb?: SQLiteDatabase };
export function db() {
  if (globalDb.sarabunDb) return globalDb.sarabunDb;
  const file = path.resolve(process.env.SARABUN_SOURCE_DIR || process.cwd(), process.env.DATABASE_PATH || "data/sarabun.sqlite");
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const conn = new SQLiteDatabase(file);
  conn.pragma("journal_mode = WAL"); conn.pragma("busy_timeout = 5000");
  conn.exec(`CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, drive_file_id TEXT, synced_version INTEGER
  );
  CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL, action TEXT NOT NULL, version INTEGER, at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS documents_updated ON documents(updated_at DESC);`);
  globalDb.sarabunDb = conn; return conn;
}
type Row = { id: string; data: string; version: number; created_at: string; updated_at: string; drive_file_id: string | null; synced_version: number | null };
function decode(row: Row): SavedDraft { return { ...documentSchema.parse(JSON.parse(row.data)), id: row.id, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, driveFileId: row.drive_file_id, syncedVersion: row.synced_version }; }
export function listDrafts(): SavedDraft[] { return (db().prepare("SELECT * FROM documents ORDER BY updated_at DESC").all() as Row[]).map(decode); }
export function readDraft(id: string) { const row = db().prepare("SELECT * FROM documents WHERE id = ?").get(id) as Row | undefined; if (!row) throw new Error("ไม่พบร่างหนังสือ"); return decode(row); }
export function writeDraft(input: Draft, id?: string, version?: number) {
  const data = JSON.stringify(documentSchema.parse(input)); const now = new Date().toISOString();
  return db().transaction(() => {
    const key = id || randomUUID();
    if (id) {
      const result = db().prepare("UPDATE documents SET data=?, version=version+1, updated_at=? WHERE id=? AND version=?").run(data, now, id, version ?? -1);
      if (!result.changes) throw new Error("ร่างนี้ถูกแก้ไขหรือลบจากหน้าต่างอื่นแล้ว กรุณาเปิดร่างล่าสุดก่อนบันทึก");
    } else db().prepare("INSERT INTO documents(id,data,created_at,updated_at) VALUES(?,?,?,?)").run(key, data, now, now);
    const saved = readDraft(key);
    db().prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(key, id ? "update" : "create", saved.version, now);
    return saved;
  })();
}
export function removeDraft(id: string, version: number) {
  db().transaction(() => {
    const result = db().prepare("DELETE FROM documents WHERE id=? AND version=?").run(id, version);
    if (!result.changes) throw new Error("ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดรายการใหม่");
    db().prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(id,"delete", version, new Date().toISOString());
  })();
}
export function getSetting(key: string) { return (db().prepare("SELECT value FROM settings WHERE key=?").get(key) as {value:string} | undefined)?.value; }
export function setSetting(key: string, value: string) { db().prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,value); }
export function auditHistory(id: string) { return db().prepare("SELECT action,version,at FROM audit WHERE document_id=? ORDER BY id DESC LIMIT 40").all(id) as {action:string;version:number;at:string}[]; }
