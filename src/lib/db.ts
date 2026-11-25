import {mirrorLocalOwner} from "./local-dossiers";
import "server-only";
import {documentSourcesSql} from "./word-import-model";
import {formatDocumentNumbers,MEMO_TRACK} from './procurement/numbering';
import {StoredCaseSchema} from './procurement/workspace/model';
import { resolveDatabaseFile } from "../../scripts/data-location.mjs";
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
const globalDb = globalThis as unknown as { sarabunDb?: SQLiteDatabase; sarabunDbFile?:string; sarabunDbRequested?:string };
export function db() {
  const root=process.env.SARABUN_SOURCE_DIR||process.cwd(),requested=path.resolve(root,process.env.DATABASE_PATH||'data/sarabun.sqlite');
  if(globalDb.sarabunDb&&globalDb.sarabunDbRequested===requested){
    const moved=globalDb.sarabunDb.prepare("SELECT value FROM settings WHERE key='storage:relocatedTo'").get()?.value;
    if(!moved){if(process.env.DATABASE_REQUIRE_EXISTING==='true'&&!fs.existsSync(globalDb.sarabunDbFile!))throw Error('ไม่พบพื้นที่ฐานข้อมูล กรุณาเชื่อมต่อไดรฟ์เดิม');return globalDb.sarabunDb;}
  }
  const file=resolveDatabaseFile(root,requested,process.env.DATABASE_REQUIRE_EXISTING==='true');
  if(globalDb.sarabunDb){globalDb.sarabunDb.close();globalDb.sarabunDb=undefined;}
  globalDb.sarabunDbFile=file;globalDb.sarabunDbRequested=requested;
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
  conn.exec('CREATE TABLE IF NOT EXISTS document_sources ('+documentSourcesSql+'); CREATE INDEX IF NOT EXISTS document_sources_document ON document_sources(document_id);');
  globalDb.sarabunDb = conn; return conn;
}
type Row = { id: string; data: string; version: number; created_at: string; updated_at: string; drive_file_id: string | null; synced_version: number | null; signed_scan_count: number };
function decode(row: Row): SavedDraft { return { ...documentSchema.parse(JSON.parse(row.data)), id: row.id, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, driveFileId: row.drive_file_id, syncedVersion: row.synced_version, signedScanCount: row.signed_scan_count }; }
export function listDrafts(): SavedDraft[] { return (db().prepare("SELECT d.*, (SELECT COUNT(*) FROM signed_scans s WHERE s.document_id=d.id) signed_scan_count FROM documents d WHERE d.deleted_at IS NULL ORDER BY d.updated_at DESC").all() as Row[]).map(decode); }
export function readDraft(id: string) { const row = db().prepare("SELECT d.*, (SELECT COUNT(*) FROM signed_scans s WHERE s.document_id=d.id) signed_scan_count FROM documents d WHERE d.id = ? AND d.deleted_at IS NULL").get(id) as Row | undefined; if (!row) throw new Error("ไม่พบร่างหนังสือ หรืออยู่ในถังขยะ"); return decode(row); }
export const normalizeNumber=(value:string)=>value.normalize('NFKC').replace(/[๐-๙]/g,digit=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(digit))).replace(/\s+/g,'').replace(/\/0+(?=\d+$)/,'/').toLocaleLowerCase('th-TH');
const isSampleDomainCase=(inputCase:{projectTitleShort?:string;vendor?:{id?:string}})=>!!inputCase.projectTitleShort?.trim().startsWith('[ตัวอย่าง]')||inputCase.vendor?.id==='sample-vendor';
// Call inside the same write transaction as the insert/update.
export function checkNumber(input:Draft,id:string,reservationOwner?:{caseId:string;docId:string}){
  const number=normalizeNumber(input.number),year=Number(input.date.slice(0,4));
  if(!number)return;
  const c=db();
  const exists=(table:string)=>!!c.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table);
  const link=exists('procurement_core_drafts')?c.prepare('SELECT case_id,doc_id FROM procurement_core_drafts WHERE draft_id=?').get(id):undefined;
  const owner=reservationOwner??(link?{caseId:String(link.case_id),docId:String(link.doc_id)}:undefined);
  const domainCases=exists('procurement_domain_cases')?c.prepare('SELECT data FROM procurement_domain_cases').all().map(row=>StoredCaseSchema.parse(JSON.parse(String(row.data)))):[];
  const sampleCaseIds=new Set<string>(domainCases.filter(r=>isSampleDomainCase(r.caseInput)).map(r=>r.caseInput.id));
  const ownerIsRealCase=!!owner&&domainCases.some(r=>r.caseInput.id===owner.caseId&&!isSampleDomainCase(r.caseInput));
  for(const record of domainCases){
    const inputCase=record.caseInput;
    if(ownerIsRealCase&&isSampleDomainCase(inputCase)&&inputCase.id!==owner!.caseId)continue;
    const numbers=formatDocumentNumbers(inputCase.docs,record.agency);
    const ids=['1','2','3','6.1','7','11.1','12','13'];
    const entries=[...MEMO_TRACK.map((key,index)=>({docId:ids[index],number:numbers[key],date:inputCase.docs[key].date})),{docId:'6.2',number:numbers.doc6_2_inspectorOrder,date:inputCase.docs.doc6_2_inspectorOrder.date},{docId:'9',number:numbers.doc9_contractNotice,date:inputCase.docs.doc9_contractNotice.date},{docId:'10',number:numbers.doc10_purchaseOrder,date:inputCase.docs.doc10_purchaseOrder.date}];
    for(const entry of entries){
      if(owner?.caseId===inputCase.id&&owner.docId===entry.docId)continue;
      if(entry.number&&normalizeNumber(entry.number)===number&&(entry.docId==='10'||entry.date&&Number(entry.date.slice(0,4))===year))throw Error('เลขที่หนังสือซ้ำ: ถูกจองในงานจัดซื้อจัดจ้างชุดใหม่แล้ว');
    }
  }
  if(db().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='procurement_cases'").get())for(const row of db().prepare('SELECT data FROM procurement_cases').all()){
    const other=JSON.parse(String(row.data));if(other.sample)continue;
    if(other.register?.entries?.some((entry:{register:string;owner:string;year:number;prefix:string;number:string})=>['internal','external'].includes(entry.register)&&entry.register===input.type&&entry.owner.trim()===input.organization.trim()&&entry.year===year+543&&entry.number&&normalizeNumber(entry.prefix+'/'+entry.number)===number))throw new Error('เลขที่หนังสือนี้อยู่ในลายแทงจัดซื้อจัดจ้างแล้ว (รวมเลขยกเลิก)');
  }
  const reservation=db().prepare('SELECT document_id FROM document_numbers WHERE year=? AND number=?').get(year,number);
  if(reservation&&reservation.document_id!==id)throw new Error('เลขที่หนังสือนี้ถูกจองแล้วในปีเดียวกัน');
  for(const row of db().prepare('SELECT id,data FROM documents WHERE id<>?').all(id)){
    const other=JSON.parse(String(row.data));
    const otherCaseId=other.procurementSource?.caseId?String(other.procurementSource.caseId):'';
    if(ownerIsRealCase&&otherCaseId&&sampleCaseIds.has(otherCaseId)&&otherCaseId!==owner!.caseId)continue;
    const fiscalOrder=input.layout==='procurement-po'||input.procurementSource?.docId==='10'||other.layout==='procurement-po'||other.procurementSource?.docId==='10';
    if((fiscalOrder||Number(String(other.date).slice(0,4))===year)&&normalizeNumber(other.number||'')===number)throw new Error('เลขที่หนังสือซ้ำในปีเดียวกัน (รวมเอกสารในถังขยะ) กรุณาตรวจทะเบียน');
  }
}
export type DraftWrite = {input:Draft;id?:string;version?:number;reservationOwner?:{caseId:string;docId:string}};
/** All document writes and relationship changes commit together; mirrors run only after commit. */
export function writeDraftBatch(writes:readonly DraftWrite[], onSaved?:(saved:SavedDraft[])=>void) {
  const parsed=writes.map(write=>({...write,input:documentSchema.parse(write.input)}));
  const now = new Date().toISOString();
  const saved = db().transaction(() => {
    const results=parsed.map(({input,id,version,reservationOwner})=>{
    const data=JSON.stringify(input);
    const key = id || randomUUID();
    const previous=id?readDraft(id):null;
    if(!previous||normalizeNumber(previous.number)!==normalizeNumber(input.number)||previous.date.slice(0,4)!==input.date.slice(0,4))checkNumber(input,key,reservationOwner);
    if (id) {
      const result = db().prepare("UPDATE documents SET data=?, version=version+1, updated_at=? WHERE id=? AND version=? AND deleted_at IS NULL").run(data, now, id, version ?? -1);
      if (!result.changes) throw new Error("ร่างนี้ถูกแก้ไขหรือลบจากหน้าต่างอื่นแล้ว กรุณาเปิดร่างล่าสุดก่อนบันทึก");
    } else db().prepare("INSERT INTO documents(id,data,created_at,updated_at) VALUES(?,?,?,?)").run(key, data, now, now);
    const saved = readDraft(key);
    db().prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(key, id ? "update" : "create", saved.version, now);
    return saved;
    });
    onSaved?.(results);
    return results;
  })();
  return saved.map(draft=>({...draft,localFileWarning:mirrorLocalOwner('document',draft.id)}));
}
export function writeDraft(input: Draft, id?: string, version?: number) {
  return writeDraftBatch([{input,id,version}])[0];
}
export function removeDraft(id: string, version: number) {
  db().transaction(() => {
    const result = db().prepare("UPDATE documents SET deleted_at=?,version=version+1 WHERE id=? AND version=? AND deleted_at IS NULL").run(new Date().toISOString(),id, version);
    if (!result.changes) throw new Error("ข้อมูลเปลี่ยนแปลงแล้ว กรุณาโหลดรายการใหม่");
    if(db().prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='budget_transfers'").get()) db().prepare("UPDATE budget_transfers SET document_id=NULL,generated_version=NULL,version=version+1,updated_at=? WHERE document_id=?").run(new Date().toISOString(),id);
    db().prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(id,"delete", version, new Date().toISOString());
  })();
  mirrorLocalOwner('document',id);
}
export function listTrash(){return (db().prepare('SELECT id,data,version,deleted_at FROM documents WHERE deleted_at IS NOT NULL ORDER BY deleted_at DESC').all()).map(row=>({id:String(row.id),subject:String(JSON.parse(String(row.data)).subject||'ไม่ระบุเรื่อง'),version:Number(row.version),deletedAt:String(row.deleted_at)}));}
export function restoreDraft(id:string,version:number){const saved=db().transaction(()=>{
  const now=new Date().toISOString();
  const result=db().prepare('UPDATE documents SET deleted_at=NULL,version=version+1,updated_at=? WHERE id=? AND version=? AND deleted_at IS NOT NULL').run(now,id,version);
  if(!result.changes)throw new Error('รายการเปลี่ยนแล้ว กรุณาโหลดถังขยะใหม่');
  db().prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(id,'restore',version+1,now);
  return readDraft(id);
})();mirrorLocalOwner('document',id);return saved;}
export function reserveDraftNumber(id:string,version:number,prefix:string,start:number){const saved=db().transaction(()=>{
  const draft=readDraft(id);
  if(draft.version!==version)throw new Error('ร่างถูกแก้ไขแล้ว กรุณาโหลดล่าสุด');
  if(draft.number.trim())throw new Error('ร่างนี้มีเลขที่แล้ว กรุณาใช้ทะเบียนตรวจสอบแทนการจองซ้ำ');
  const clean=prefix.trim().replace(/\/+$/,'');
  if(!clean||clean.length>100||!Number.isSafeInteger(start)||start<1||start>9999999)throw new Error('ระบุรหัสหน่วยงานและเลขเริ่มต้น 1–9999999');
  const year=Number(draft.date.slice(0,4)),normalized=normalizeNumber(clean)+'/';
  let serial=start;
  const numbers=db().prepare('SELECT number FROM document_numbers WHERE year=?').all(year).map(row=>String(row.number));
  if(db().prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='procurement_domain_cases'").get())for(const row of db().prepare('SELECT data FROM procurement_domain_cases').all()){
    const record=StoredCaseSchema.parse(JSON.parse(String(row.data)));
    if(isSampleDomainCase(record.caseInput))continue;
    const entries=formatDocumentNumbers(record.caseInput.docs,record.agency);
    for(const key of MEMO_TRACK)if(record.caseInput.docs[key].date?.startsWith(String(year)))numbers.push(normalizeNumber(entries[key]));
    if(record.caseInput.docs.doc9_contractNotice.date?.startsWith(String(year)))numbers.push(normalizeNumber(entries.doc9_contractNotice));
    if(record.caseInput.docs.doc6_2_inspectorOrder.date?.startsWith(String(year)))numbers.push(normalizeNumber(entries.doc6_2_inspectorOrder));
  }
  if(db().prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='procurement_domain_registry'").get()){
    const track=draft.type==='internal'?'INTERNAL_MEMO':draft.type==='external'?'EXTERNAL_LETTER':draft.type==='order'?'MUNICIPAL_ORDER':null;
    if(track)for(const row of db().prepare('SELECT running_no FROM procurement_domain_registry WHERE track=? AND year_be=?').all(track,year+543)){const last=Number(row.running_no);if(Number.isSafeInteger(last))numbers.push(normalized+last);}
  }
  if(db().prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='procurement_cases'").get())for(const row of db().prepare('SELECT data FROM procurement_cases').all()){
    const other=JSON.parse(String(row.data));if(other.sample)continue;
    for(const entry of other.register?.entries||[])if(['internal','external'].includes(entry.register)&&entry.year===year+543&&entry.number)numbers.push(normalizeNumber(entry.prefix+'/'+entry.number));
  }
  for(const row of db().prepare('SELECT data FROM documents').all()){const doc=JSON.parse(String(row.data));if(Number(String(doc.date).slice(0,4))===year)numbers.push(normalizeNumber(doc.number||''));}
  for(const number of numbers)if(number.startsWith(normalized)&&/^\d+$/.test(number.slice(normalized.length)))serial=Math.max(serial,Number(number.slice(normalized.length))+1);
  if(serial>9999999)throw new Error('เลขทะเบียนเกินช่วงที่รองรับ');
  const number=`${clean}/${serial}`,now=new Date().toISOString(),data={...draft,number};
  checkNumber(data,id);
  db().prepare('INSERT INTO document_numbers(id,year,number,document_id,created_at) VALUES(?,?,?,?,?)').run(randomUUID(),year,normalizeNumber(number),id,now);
  db().prepare('UPDATE documents SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(JSON.stringify(documentSchema.parse(data)),now,id,version);
  db().prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(id,'number_reserved',version+1,now);
  return readDraft(id);
})();mirrorLocalOwner('document',id);return saved;}
export function numberHistory(){return db().prepare('SELECT n.*,json_extract(d.data,\'$.subject\') subject FROM document_numbers n LEFT JOIN documents d ON d.id=n.document_id ORDER BY n.created_at DESC LIMIT 100').all().map(row=>({number:String(row.number),year:Number(row.year)+543,subject:String(row.subject||''),at:String(row.created_at)}));}
export function databaseFile(){db();return globalDb.sarabunDbFile!;}
export function getSetting(key: string) { return (db().prepare("SELECT value FROM settings WHERE key=?").get(key) as {value:string} | undefined)?.value; }
export function setSetting(key: string, value: string) { db().prepare("INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(key,value); }
export function auditHistory(id: string) { return db().prepare("SELECT action,version,at FROM audit WHERE document_id=? ORDER BY id DESC LIMIT 40").all(id) as {action:string;version:number;at:string}[]; }
