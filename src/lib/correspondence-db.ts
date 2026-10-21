import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from './db';
import {validateAttachments} from './attachments';
import {registerSchema,registerTableSql,registerEventSql,normalizeSearch,type RegisterEntry,type RegisterEvent} from './correspondence';
export function registerTables(){db().exec(`CREATE TABLE IF NOT EXISTS correspondence_entries (${registerTableSql});CREATE TABLE IF NOT EXISTS correspondence_events (${registerEventSql});CREATE INDEX IF NOT EXISTS correspondence_history ON correspondence_events(entry_id,at);`);}
function decode(r:Record<string,unknown>):RegisterEntry{return {...registerSchema.parse(JSON.parse(String(r.data))),id:String(r.id),serial:Number(r.serial),year:Number(r.year),version:Number(r.version),createdAt:String(r.created_at),updatedAt:String(r.updated_at),createdBy:String(r.created_by),updatedBy:String(r.updated_by),historyText:String(r.history_text||'')};}
export function listRegister(){registerTables();return db().prepare(`SELECT e.*,(SELECT group_concat(actor||' '||reason,' ') FROM correspondence_events h WHERE h.entry_id=e.id) history_text FROM correspondence_entries e ORDER BY e.year DESC,e.serial DESC,e.created_at DESC`).all().map(decode);}
export function readRegister(id:string){registerTables();const row=db().prepare('SELECT * FROM correspondence_entries WHERE id=?').get(id);if(!row)throw Error('ไม่พบรายการทะเบียน');return decode(row);}
export function registerHistory(id:string):RegisterEvent[]{registerTables();return db().prepare("SELECT * FROM correspondence_events WHERE entry_id=? ORDER BY json_extract(snapshot,'$.version'),at,id").all(id).map(r=>({id:String(r.id),entryId:String(r.entry_id),action:String(r.action),actor:String(r.actor),at:String(r.at),reason:String(r.reason),snapshot:JSON.parse(String(r.snapshot))}));}
// Read fields and history from the same database snapshot, including changes in other windows.
export function registerDetail(id:string){
 registerTables();
 return db().transaction(()=>{
  const entry=readRegister(id),history=registerHistory(id);
  return {entry:{...entry,historyText:history.map(h=>h.actor+' '+h.reason).join(' ')},history};
 })();
}
const command=z.object({input:registerSchema,actor:z.string().trim().min(1,'ระบุชื่อผู้ดำเนินการ').max(200),reason:z.string().trim().max(2000).default(''),id:z.string().uuid().optional(),version:z.number().int().positive().optional(),requestId:z.string().uuid(),startNumber:z.number().int().min(1).max(9999999).default(1)});
export function saveRegister(value:unknown){const c=command.parse(value),input=c.input;registerTables();validateAttachments(input);
 return db().transaction(()=>{
  if(!c.id){const replay=db().prepare('SELECT * FROM correspondence_entries WHERE request_id=?').get(c.requestId);if(replay){const saved=decode(replay);if(JSON.stringify(registerSchema.parse(saved))!==JSON.stringify(input))throw Error('คำขอนี้ถูกบันทึกแล้ว แต่ข้อมูลที่ส่งซ้ำเปลี่ยนไป กรุณาโหลดล่าสุดแล้วแก้ไขรายการเดิม');return saved;}}
  if(input.documentId&&!db().prepare('SELECT id FROM documents WHERE id=? AND deleted_at IS NULL').get(input.documentId))throw Error('ร่างหนังสือที่เชื่อมโยงไม่อยู่ในระบบแล้ว');
  if(input.relatedId&&(input.relatedId===c.id||!db().prepare('SELECT id FROM correspondence_entries WHERE id=?').get(input.relatedId)))throw Error('รายการอ้างอิงไม่ถูกต้อง');
  const old=c.id?readRegister(c.id):null,year=Number(input.registeredDate.slice(0,4));
  const key=normalizeSearch(input.department),now=new Date().toISOString();
  if(old){if(!c.reason)throw Error('ระบุเหตุผลหรือการปฏิบัติที่แก้ไข เพื่อเก็บประวัติ');if(old.version!==c.version)throw Error('รายการถูกแก้ไขแล้ว กรุณาเปิดข้อมูลล่าสุด');if(old.department!==input.department||old.direction!==input.direction||old.year!==year)throw Error('เปลี่ยนกอง ประเภททะเบียน หรือปีของเลขที่ออกแล้วไม่ได้ ให้ยกเลิกและลงรายการใหม่');}
  else if(input.status==='cancelled')throw Error('ลงรายการใหม่ด้วยสถานะปกติก่อน');
  const maximum=Number(db().prepare('SELECT MAX(serial) maximum FROM correspondence_entries WHERE department_key=? AND direction=? AND year=?').get(key,input.direction,year)?.maximum||0);
  const serial=old?.serial||(maximum?maximum+1:c.startNumber);if(serial>9999999)throw Error('เลขทะเบียนเกินช่วงที่รองรับ');
  const id=old?.id||randomUUID(),version=(old?.version||0)+1;
  if(old)db().prepare('UPDATE correspondence_entries SET data=?,version=?,updated_at=?,updated_by=? WHERE id=?').run(JSON.stringify(input),version,now,c.actor,id);
  else db().prepare('INSERT INTO correspondence_entries(id,department_key,direction,year,serial,data,version,created_at,updated_at,created_by,updated_by,request_id) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)').run(id,key,input.direction,year,serial,JSON.stringify(input),version,now,now,c.actor,c.actor,c.requestId);
  const saved=readRegister(id),action=!old?'register':input.status==='cancelled'?'cancel':old.status==='cancelled'?'restore':old.status!==input.status?'status':'update';
  db().prepare('INSERT INTO correspondence_events(id,entry_id,action,actor,at,reason,snapshot) VALUES(?,?,?,?,?,?,?)').run(randomUUID(),id,action,c.actor,now,c.reason,JSON.stringify(saved));
  return saved;
 })();}
