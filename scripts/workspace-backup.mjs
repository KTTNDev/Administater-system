import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

// Shared by manual exports and the background worker; never include credentials.
export function exportDatabase(databaseFile,localFolder,sourceRoot){
 const tables=['documents','document_numbers','recovery_drafts','budget_transfers','office_items','meeting_rooms','room_bookings','calendar_events','legal_library','document_attachments','document_appendix_images','signed_scans','audit'];
 const source=new DatabaseSync(databaseFile,{readOnly:true});
 let snapshot,definitions;
 try{
  source.exec('PRAGMA busy_timeout=5000; BEGIN');
  definitions=Object.fromEntries(tables.map(table=>[table,{sql:source.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table)?.sql,indexes:source.prepare("SELECT sql FROM sqlite_master WHERE type='index' AND tbl_name=? AND sql IS NOT NULL").all(table)}]));
  snapshot=Object.fromEntries(tables.map(table=>[table,definitions[table].sql?source.prepare(`SELECT * FROM ${table}`).all():[]]));
  source.exec('COMMIT');
 }finally{source.close();}
 const folder=path.join(localFolder,'สำรองข้อมูล',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
 fs.mkdirSync(folder,{recursive:true});
 const files=[],database=path.join(folder,'sarabun.sqlite'),backup=new DatabaseSync(database);
 try{
  backup.exec('BEGIN');
  for(const [table,rows] of Object.entries(snapshot)){
   const definition=definitions[table];if(!definition.sql)continue;backup.exec(definition.sql);
   for(const row of rows){const keys=Object.keys(row),quote=name=>'"'+name.replaceAll('"','""')+'"';backup.prepare(`INSERT INTO ${quote(table)} (${keys.map(quote).join(',')}) VALUES (${keys.map(()=>'?').join(',')})`).run(...keys.map(key=>row[key]));}
   for(const index of definition.indexes)backup.exec(index.sql);
  }
  backup.exec('COMMIT');
  if(backup.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('ฐานข้อมูลสำรองเสียหาย');
 }finally{backup.close();}
 files.push(database);
 const save=(name,bytes)=>{if(path.basename(name)!==name||/[\\/:]/.test(name))throw Error('Invalid backup filename');const file=path.join(folder,name);fs.writeFileSync(file,bytes);files.push(file);};
 for(const [table,rows] of Object.entries(snapshot))save(table+'.json',JSON.stringify(['legal_library','document_attachments','document_appendix_images','signed_scans'].includes(table)?rows.map(({file,original,...rest})=>rest):rows,null,2));
 for(const row of [...snapshot.legal_library,...snapshot.document_attachments]){
  if(row.file)save(row.id+'.pdf',Buffer.from(row.file));
  if(row.original){const extension=path.extname(String(row.original_name||'.bin'));save(row.id+'-original'+extension,Buffer.from(row.original));}
 }
 for(const row of snapshot.document_appendix_images)if(row.file)save(row.id+(row.mime==='image/png'?'.png':'.jpg'),Buffer.from(row.file));
 for(const row of snapshot.signed_scans)if(row.file)save(row.id+'-signed'+(row.mime==='application/pdf'?'.pdf':row.mime==='image/png'?'.png':'.jpg'),Buffer.from(row.file));
 for(const name of ['ict.pdf','ict-2569.pdf','equipment.pdf','classification.pdf']){const file=path.join(sourceRoot,'data','budget-references',name);if(fs.existsSync(file))save('budget-reference-'+name,fs.readFileSync(file));}
 const reference=path.join(sourceRoot,'data/template-references/20170502100402.pdf');if(fs.existsSync(reference))save('template-reference-20170502100402.pdf',fs.readFileSync(reference));
 const manifest={schemaVersion:2,at:new Date().toISOString(),counts:Object.fromEntries(Object.entries(snapshot).map(([table,rows])=>[table,rows.length])),files:files.map(file=>({name:path.basename(file),sha256:createHash('sha256').update(fs.readFileSync(file)).digest('hex')})),note:'ข้อมูลธุรกิจและไฟล์แนบ ไม่รวมการตั้งค่า รหัสผ่าน หรือ Google OAuth'};
 // Only completed exports get a manifest and appear in the restore catalog.
 fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2));
 return {folder,files:files.length+1,counts:manifest.counts};
}
