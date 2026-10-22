import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync,type SQLInputValue} from 'node:sqlite';
import {db,setSetting} from './db';
import {exportWorkspace} from './storage';
import {restoreCatalogBackup} from './backup-catalog';
import {documentSchema} from './document';
import {budgetSchema} from './budget';
import {registerSchema,registerTableSql,registerEventSql} from './correspondence';
import {organizationInputSchema,organizationDirectorySql} from './organization-directory';
import {inventorySchemas,inventoryItemSchema,movementSchema} from './inventory';
import {validateInventoryBackup} from './inventory-validation';
import {officeSchema} from './office';
import {roomSchema,bookingSchema} from './booking';
import {calendarSchema} from './calendar';

// Trusted schemas belong to the application, never to an uploaded backup.
const schemas = {
 ...inventorySchemas,
 organization_directory:organizationDirectorySql,
 correspondence_entries:registerTableSql,
 correspondence_events:registerEventSql,
 documents:'id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,drive_file_id TEXT,synced_version INTEGER,deleted_at TEXT',
 document_numbers:'id TEXT PRIMARY KEY,year INTEGER NOT NULL,number TEXT NOT NULL,document_id TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(year,number)',
 recovery_drafts:'id TEXT PRIMARY KEY,scope TEXT NOT NULL,sequence INTEGER NOT NULL,data TEXT NOT NULL,updated_at TEXT NOT NULL',
 budget_transfers:'id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL,document_id TEXT,generated_version INTEGER',
 office_items:'id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL',
 meeting_rooms:'id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL',
 room_bookings:'id TEXT PRIMARY KEY,room_id TEXT NOT NULL,day TEXT NOT NULL,start_min INTEGER NOT NULL,end_min INTEGER NOT NULL,status TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL',
 calendar_events:'id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL',
 legal_library:'id TEXT PRIMARY KEY,data TEXT NOT NULL,file BLOB,file_name TEXT,updated_at TEXT NOT NULL',
 document_attachments:'id TEXT PRIMARY KEY,name TEXT NOT NULL,pages INTEGER NOT NULL,file BLOB NOT NULL,created_at TEXT NOT NULL,original BLOB,original_name TEXT',
 document_appendix_images:'id TEXT PRIMARY KEY,name TEXT NOT NULL,mime TEXT NOT NULL,width INTEGER NOT NULL,height INTEGER NOT NULL,file BLOB NOT NULL,created_at TEXT NOT NULL',
 signed_scans:'id TEXT PRIMARY KEY,document_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,file BLOB NOT NULL,uploaded_at TEXT NOT NULL',
 audit:'id INTEGER PRIMARY KEY AUTOINCREMENT,document_id TEXT NOT NULL,action TEXT NOT NULL,version INTEGER,at TEXT NOT NULL',
} as const;
type Table=keyof typeof schemas;
const tables=Object.keys(schemas) as Table[];
type Row=Record<string,SQLInputValue>;
type Connection=Pick<ReturnType<typeof db>,'prepare'>;
const exists=(connection:Connection,table:Table)=>!!connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
const rows=(connection:Connection,table:Table)=>exists(connection,table)?connection.prepare(`SELECT * FROM "${table}" ORDER BY id`).all() as Row[]:[];
function fingerprint(connection:Connection){
 const hash=createHash('sha256');
 for(const table of tables){hash.update(table);for(const row of rows(connection,table))for(const key of Object.keys(row).sort()){hash.update(key);const value=row[key];hash.update(value instanceof Uint8Array?value:JSON.stringify(value));hash.update('\0');}}
 return hash.digest('hex');
}
function inspect(file:string){
 const connection=new DatabaseSync(file,{readOnly:true});
 try{
  connection.exec('PRAGMA trusted_schema=OFF');
  if(connection.prepare('PRAGMA integrity_check').get()?.integrity_check!=='ok')throw new Error('ฐานข้อมูลสำรองเสียหาย');
  for(const item of connection.prepare("SELECT name,type,sql FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'").all()){
   if(item.type==='table'&&(!tables.includes(String(item.name) as Table)||/VIRTUAL\s+TABLE/i.test(String(item.sql))))throw new Error('ชุดสำรองมีตารางที่ระบบรุ่นนี้ไม่รองรับ');
   if(item.type==='trigger'||item.type==='view')throw new Error('ชุดสำรองมีคำสั่งฐานข้อมูลที่ไม่รองรับ');
  }
  const data=Object.fromEntries(tables.map(table=>[table,rows(connection,table)])) as Record<Table,Row[]>;
  const models={inventory_items:inventoryItemSchema,inventory_movements:movementSchema,organization_directory:organizationInputSchema,correspondence_entries:registerSchema,documents:documentSchema,budget_transfers:budgetSchema,office_items:officeSchema,meeting_rooms:roomSchema,room_bookings:bookingSchema,calendar_events:calendarSchema};
  for(const [table,model] of Object.entries(models))for(const row of data[table as Table])model.parse(JSON.parse(String(row.data)));
  validateInventoryBackup(data);
  // Restored references must resolve within the same snapshot.
  const documents=new Set(data.documents.map(row=>String(row.id)));
  for(const row of data.document_numbers)if(!documents.has(String(row.document_id)))throw new Error('ชุดสำรองมีเลขทะเบียนที่ไม่ตรงกับเอกสาร');
  const attachments=new Set(data.document_attachments.map(row=>String(row.id)));
  const images=new Set(data.document_appendix_images.map(row=>String(row.id)));
  for(const row of data.documents){const doc=documentSchema.parse(JSON.parse(String(row.data)));if(doc.attachmentFiles.some(item=>!attachments.has(item.id))||doc.appendixImages.some(item=>!images.has(item.id))||doc.floatingItems.some(item=>item.kind==='image'&&!images.has(item.image.id)))throw new Error('ชุดสำรองขาดไฟล์แนบที่หนังสืออ้างถึง');}
  for(const row of data.signed_scans)if(!documents.has(String(row.document_id))||Number(row.bytes)!==(row.file as Uint8Array).byteLength)throw new Error('ชุดสำรองมีไฟล์สแกนที่ไม่ตรงกับรายการเอกสาร');
  const registerIds=new Set(data.correspondence_entries.map(r=>String(r.id)));
  for(const row of data.correspondence_entries){const entry=registerSchema.parse(JSON.parse(String(row.data)));if(entry.attachmentFiles.some(a=>!attachments.has(a.id))||entry.relatedId&&!registerIds.has(entry.relatedId))throw Error('ชุดสำรองขาดรายการหรือไฟล์ที่ทะเบียนอ้างถึง');}
  for(const row of data.correspondence_events){const entry=registerSchema.parse(JSON.parse(String(row.snapshot)));if(!registerIds.has(String(row.entry_id))||entry.attachmentFiles.some(a=>!attachments.has(a.id)))throw Error('ชุดสำรองมีประวัติทะเบียนไม่ครบ');}
  // Older versions kept links to deleted generated letters. Preserve the budget and detach that link.
  for(const row of data.budget_transfers)if(row.document_id&&!documents.has(String(row.document_id))){row.document_id=null;row.generated_version=null;}
  return data;
 }finally{connection.close();}
}
type Preview={database:string;folder:string;hash:string;active:string;expires:number};
const state=globalThis as unknown as {sarabunRestorePreviews?:Map<string,Preview>};
const previews=()=>state.sarabunRestorePreviews??=new Map();
export async function prepareBackupRestore(name:string){
 const restored=await restoreCatalogBackup(name),data=inspect(restored.database);
 for(const [key,value] of previews())if(value.expires<Date.now())previews().delete(key);
 if(previews().size>=10)previews().delete(previews().keys().next().value!);
 const token=randomUUID();previews().set(token,{...restored,hash:createHash('sha256').update(fs.readFileSync(restored.database)).digest('hex'),active:fingerprint(db()),expires:Date.now()+10*60*1000});
 return {...restored,token,counts:Object.fromEntries(tables.map(table=>[table,data[table].length])),currentCounts:Object.fromEntries(tables.map(table=>[table,rows(db(),table).length]))};
}
export function activateBackupRestore(token:string,confirmation:string){
 const preview=previews().get(token);
 if(confirmation!=='กู้คืนข้อมูล')throw new Error('พิมพ์ กู้คืนข้อมูล เพื่อยืนยันก่อนดำเนินการ');
 if(!preview||preview.expires<Date.now())throw new Error('การตรวจชุดสำรองหมดอายุ กรุณาตรวจและกู้สำเนาอีกครั้ง');
 if(fingerprint(db())!==preview.active)throw new Error('ข้อมูลใช้งานเปลี่ยนหลังจากตรวจชุดสำรอง กรุณาตรวจชุดสำรองใหม่ก่อนกู้คืน');
 if(createHash('sha256').update(fs.readFileSync(preview.database)).digest('hex')!==preview.hash)throw new Error('ไฟล์สำรองเปลี่ยนหลังตรวจ กรุณาตรวจชุดสำรองใหม่');
 const data=inspect(preview.database);
 const safety=exportWorkspace(); // Fail before replacing any records if the safety backup cannot be written.
 const connection=db();
 connection.transaction(()=>{
  if(fingerprint(connection)!==preview.active)throw new Error('มีการแก้ไขข้อมูลจากหน้าต่างอื่น กรุณาตรวจชุดสำรองใหม่');
  const floor=Object.fromEntries(tables.map(table=>[table,rows(connection,table).reduce((max,row)=>Math.max(max,Number(row.version)||0),0)]));
  for(const table of tables){
   connection.exec(`CREATE TABLE IF NOT EXISTS "${table}" (${schemas[table]})`);
   if(table==='document_attachments'){
    const columns=connection.prepare('PRAGMA table_info(document_attachments)').all().map(row=>String(row.name));
    if(!columns.includes('original'))connection.exec('ALTER TABLE document_attachments ADD COLUMN original BLOB');
    if(!columns.includes('original_name'))connection.exec('ALTER TABLE document_attachments ADD COLUMN original_name TEXT');
   }
   const allowed=new Set(connection.prepare(`PRAGMA table_info("${table}")`).all().map(row=>String(row.name)));
   for(const row of data[table])if(Object.keys(row).some(key=>!allowed.has(key)))throw new Error('คอลัมน์ในชุดสำรองใหม่กว่าระบบนี้ กรุณาอัปเดตโปรแกรมก่อน');
   connection.exec(`DELETE FROM "${table}"`);
   for(const input of data[table]){
    const row={...input};
    // Keep stale editor tabs from matching a restored record's old version (ABA).
    if(table!=='audit'&&typeof row.version==='number')row.version=Math.max(row.version,floor[table])+1;
    if(table==='inventory_files')row.drive_id='';
    if(table==='documents'){row.drive_file_id=null;row.synced_version=null;}
    if(table==='budget_transfers')row.generated_version=null;
    const keys=Object.keys(row);
    connection.prepare(`INSERT INTO "${table}" (${keys.map(key=>'"'+key+'"').join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(key=>row[key]));
   }
  }
  connection.prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run('workspace','workspace_restore',null,new Date().toISOString());
  setSetting('workspace:lastRestore',JSON.stringify({at:new Date().toISOString(),safetyBackup:safety.folder}));
 })();
 previews().delete(token);
 // Existing reference editions stay intact; restore only missing reference files.
 const root=process.env.SARABUN_SOURCE_DIR||process.cwd();
 const warnings:string[]=[];
 for(const [directory,names] of [['budget-references',['ict.pdf','ict-2569.pdf','equipment.pdf','classification.pdf']],['template-references',['20170502100402.pdf']]] as const){
  for(const name of names){const source=path.join(preview.folder,'data',directory,name),target=path.join(root,'data',directory,name);try{if(fs.existsSync(source)&&!fs.existsSync(target)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);}}catch{warnings.push(name);}}
 }
 return {safetyBackup:safety.folder,documents:data.documents.length,warnings};
}
