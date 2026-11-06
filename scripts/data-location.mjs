import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';

// A retired database remains readable and points to its verified successor.
// This also lets older launch/configuration paths discover the current data.
export function resolveDatabaseFile(root,configured='data/sarabun.sqlite',requireExisting=false){
 let file=path.resolve(root,configured);const seen=new Set();
 for(let hop=0;hop<12;hop++){
  if(seen.has(file))throw Error('พบการอ้างตำแหน่งฐานข้อมูลวนซ้ำ');seen.add(file);
  if(!fs.existsSync(file)){if(hop||requireExisting)throw Error('ไม่พบฐานข้อมูลในพื้นที่ใหม่ กรุณาเชื่อมต่อไดรฟ์ที่เลือก');return file;}
  const conn=new DatabaseSync(file,{readOnly:true});let next;
  try{if(conn.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='settings'").get())next=conn.prepare("SELECT value FROM settings WHERE key='storage:relocatedTo'").get()?.value;}finally{conn.close();}
  if(!next)return file;if(!path.isAbsolute(next))throw Error('ตำแหน่งฐานข้อมูลใหม่ไม่ถูกต้อง');file=path.resolve(next);
 }
 throw Error('การย้ายฐานข้อมูลมีลำดับมากเกินไป กรุณาปรับ DATABASE_PATH ให้เป็นตำแหน่งล่าสุด');
}
