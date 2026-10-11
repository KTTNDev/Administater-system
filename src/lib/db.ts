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
  CREATE TABLE IF NOT EXISTS signed_scans (id TEXT PRIMARY KEY, document_id TEXT NOT NULL, name TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, file BLOB NOT NULL, uploaded_at TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS signed_scans_document ON signed_scans(document_id);
  CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, document_id TEXT NOT NULL, action TEXT NOT NULL, version INTEGER, at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS documents_updated ON documents(updated_at DESC);`);
  if(!conn.prepare('PRAGMA table_info(documents)').all().some(column=>column.name==='deleted_at'))conn.exec('ALTER TABLE documents ADD COLUMN deleted_at TEXT');
  conn.exec(`CREATE TABLE IF NOT EXISTS document_numbers (id TEXT PRIMARY KEY,year INTEGER NOT NULL,number TEXT NOT NULL,document_id TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(year,number));`);
  globalDb.sarabunDb = conn; return conn;
}
type Row = { id: string; data: string; version: number; created_at: string; updated_at: string; drive_file_id: string | null; synced_version: number | null; signed_scan_count: number };
function decode(row: Row): SavedDraft { return { ...documentSchema.parse(JSON.parse(row.data)), id: row.id, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, driveFileId: row.drive_file_id, syncedVersion: row.synced_version, signedScanCount: row.signed_scan_count }; }
export function listDrafts(): SavedDraft[] { return (db().prepare("SELECT d.*, (SELECT COUNT(*) FROM signed_scans s WHERE s.document_id=d.id) signed_scan_count FROM documents d WHERE d.deleted_at IS NULL ORDER BY d.updated_at DESC").all() as Row[]).map(decode); }
export function readDraft(id: string) { const row = db().prepare("SELECT d.*, (SELECT COUNT(*) FROM signed_scans s WHERE s.document_id=d.id) signed_scan_count FROM documents d WHERE d.id = ? AND d.deleted_at IS NULL").get(id) as Row | undefined; if (!row) throw new Error("ไม่พบร่างหนังสือ หรืออยู่ในถังขยะ"); return decode(row); }
export const normalizeNumber=(value:string)=>value.normalize('NFKC').replace(/[๐-๙]/g,digit=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit))).replace(/\s+/g,'').replace(/\/0+(?=\d+$)/,'/').toLocaleLowerCase('th-TH');
// Call inside the same write transaction as the insert/update.
export function checkNumber(input:Draft,id:string){
  const number=normalizeNumber(input.number),year=Number(input.date.slice(0,4));
  if(!number)return;
  const reservation=db().prepare('SELECT document_id FROM document_numbers WHERE year=? AND number=?').get(year,number);
  if(reservation&&reservation.document_id!==id)throw new Error('เลขที่หนังสือนี้ถูกจองแล้วในปีเดียวกัน');
  for(const row of db().prepare('SELECT id,data FROM documents WHERE id<>?').all(id)){
    const other=JSON.parse(String(row.data));
    if(Number(String(other.date).slice(0,4))===year&&normalizeNumber(other.number||'')===number)throw new Error('เลขที่หนังสือซ้ำในปีเดียวกัน (รวมเอกสารในถังขยะ) กรุณาตรวจทะเบียน');
  }
}
export function writeDraft(input: Draft, id?: string, version?: number) {
  const data = JSON.stringify(documentSchema.parse(input)); const now = new Date().toISOString();
  return db().transaction(() => {
    const key = id || randomUUID();
    const previous=id?readDraft(id):null;
    if(!previous||normalizeNumber(previous.number)!==normalizeNumber(input.number)||previous.date.slice(0,4)!==input.date.slice(0,4))checkNumber(input,key);
    if (id) {
      const result = db().prepare("UPDATE documents SET data=?, version=version+1, updated_at=? WHERE id=? AND version=? AND deleted_at IS NULL").run(data, now, id, version ?? -1);
      if (!result.changes) throw new Error("ร่างนี้ถูกแก้ไขหรือลบจากหน้าต่างอื่นแล้ว กรุณาเปิดร่างล่าสุดก่อนบันทึก");
    } else db().prepare("INSERT INTO documents(id,data,created_at,updated_at) VALUES(?,?,?,?)").run(key, data, now, now);
    const saved = readDraft(key);
    db().prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(key, id ? "update" : "create", saved.version, now);
    return saved;
  })();
}
export function removeDraft(id: string, version: number) {
  db().transaction(() => {
    const result = db().prepare("UPDATE documents SET deleted_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS NULL").run(new Date().toISOString(),id, version);
    if (!result.changes) throw new Error("ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดรายการใหม่");
    if(db().prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='budget_transfers'").get()) db().prepare("UPDATE budget_transfers SET document_id=NULL,generated_version=NULL,version=version+1,updated_at=? WHERE document_id=?").run(new Date().toISOString(),id);
    db().prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(id,"delete", version, new Date().toISOString());
  })();
}
export function listTrash(){return (db().prepare('SELECT id,data,version,deleted_at FROM documents WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all()).map(row=>({id:String(row.id),subject:String(JSON.parse(String(row.data)).subject||'ไม่ระบุเรื่อง'),version:Number(row.version),deletedAt:String(row.deleted_at)}));}
export function restoreDraft(id:string,version:number){return db().transaction(()=>{
  const now=new Date().toISOString();
  const result=db().prepare('UPDATE documents SET deleted_at=NULL,version=version+1,updated_at=? WHERE id=? AND version=? AND deleted_at IS NOT NULL').run(now,id,version);
  if(!result.changes)throw new Error('รายการเปลี่ยนแล้ว กรุณาโหลดถังขยะใหม่');
  db().prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(id,'restore',version+1,now);
  return readDraft(id);
})();}
export function reserveDraftNumber(id:string,version:number,prefix:string,start:number){return db().transaction(()=>{
  const draft=readDraft(id);
  if(draft.version!==version)throw new Error('ร่างถูกแก้ไขแล้ว กรุณาโหลดล่าสุด');
  if(draft.number.trim())throw new Error('ร่างนี้มีเลขที่แล้ว กรุณาใช้ทะเบียนตรวจสอบแทนการจองซ้ำ');
  const clean=prefix.trim().replace(/\/+$/,'');
  if(!clean||clean.length>100||!Number.isSafeInteger(start)||start<1||start>9999999)throw new Error('ระบุรหัสหน่วยงานและเลขเริ่มต้น 1–9999999');
  const year=Number(draft.date.slice(0,4)),normalized=normalizeNumber(clean)+'/';
  let serial=start;
  const numbers=db().prepare('SELECT number FROM document_numbers WHERE year=?').all(year).map(row=>String(row.number));
  for(const row of db().prepare('SELECT data FROM documents').all()){const doc=JSON.parse(String(row.data));if(Number(String(doc.date).slice(0,4))===year)numbers.push(normalizeNumber(doc.number||''));}
  for(const number of numbers)if(number.startsWith(normalized)&&/^\d+$/.test(number.slice(normalized.length)))serial=Math.max(serial,Number(number.slice(normalized.length))+1);
  if(serial>9999999)throw new Error('เลขทะเบียนเกินช่วงที่รองรับ');
  const number=`${clean}/${serial}`,now=new Date().toISOString(),data={...draft,number};
  checkNumber(data,id);
  db().prepare('INSERT INTO document_numbers(id,year,number,document_id,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),year,normalizeNumber(number),id,now);
  db().prepare('UPDATE documents SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(JSON.stringify(documentSchema.parse(data)),now,id,version);
  db().prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(id,'number_reserved',version+1,now);
  return readDraft(id);
})();}
export function numberHistory(){return db().prepare('SELECT n.*,json_extract(d.data,\'$.subject\') subject FROM document_numbers n LEFT JOIN documents d ON d.id=n.document_id ORDER BY n.created_at DESC LIMIT 100').all().map(row=>({number:String(row.number),year:Number(row.year)+543,subject:String(row.subject||''),at:String(row.created_at)}));}
export function getSetting(key: string) { return (db().prepare("SELECT value FROM settings WHERE key=?").get(key) as {value:string} | undefined)?.value; }
export function setSetting(key: string, value: string) { db().prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,value); }
export function auditHistory(id: string) { return db().prepare("SELECT action,version,at FROM audit WHERE document_id=? ORDER BY id DESC LIMIT 40").all(id) as {action:string;version:number;at:string}[]; }
