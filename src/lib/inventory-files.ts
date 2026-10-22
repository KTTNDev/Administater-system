import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {z} from 'zod';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {inventoryDb,readInventoryItem,readMovement,inventoryFileMeta} from './inventory-db';
import {storageConfig} from './storage';
import {uploadInventoryFile} from './drive';
export function readInventoryFile(id:string){z.string().uuid().parse(id);const r=inventoryDb().prepare('SELECT *,length(file) size FROM inventory_files WHERE id=?').get(id);if(!r)throw Error('ไม่พบไฟล์');return {...inventoryFileMeta(r),file:Buffer.from(r.file as Uint8Array)};}
export function localInventoryFile(id:string){const f=readInventoryFile(id);const folder=path.join(storageConfig().localFolder,'พัสดุและครุภัณฑ์',f.ownerType==='item'?'รูปประจำรายการ':'หลักฐานเบิกจ่าย',f.ownerId);fs.mkdirSync(folder,{recursive:true});const target=path.join(folder,f.id+(f.mime==='application/pdf'?'.pdf':f.mime==='image/png'?'.png':'.jpg'));fs.writeFileSync(target,f.file);return target;}
export async function addInventoryFile(ownerId:string,ownerType:'item'|'movement',file:File){
 z.string().uuid().parse(ownerId);z.enum(['item','movement']).parse(ownerType);
 if(ownerType==='item')readInventoryItem(ownerId);else readMovement(ownerId);
 if(!file.size||file.size>8*1024*1024)throw Error('ไฟล์ต้องมีขนาดไม่เกิน 8 MB');
 const bytes=Buffer.from(await file.arrayBuffer());let mime='';
 if(bytes.subarray(0,5).toString()==='%PDF-'&&ownerType==='movement'){const pdf=await PDFDocument.load(bytes);if(pdf.getPageCount()>30)throw Error('หลักฐาน PDF ต้องไม่เกิน 30 หน้า');mime='application/pdf';}
 else{const image=sharp(bytes,{limitInputPixels:20000000});const m=await image.metadata();if(!['png','jpeg'].includes(m.format||''))throw Error('รองรับรูป PNG หรือ JPEG เท่านั้น');await image.stats();mime=m.format==='png'?'image/png':'image/jpeg';}
 const c=inventoryDb(),id=randomUUID();
 c.transaction(()=>{const count=c.prepare('SELECT COUNT(*) n,coalesce(SUM(length(file)),0) bytes FROM inventory_files WHERE owner_id=? AND owner_type=?').get(ownerId,ownerType)!;
 if(Number(count.n)>=8||Number(count.bytes)+bytes.length>32*1024*1024)throw Error('เก็บได้สูงสุด 8 ไฟล์ รวมไม่เกิน 32 MB ต่อรายการ');
 const name=path.basename(file.name.replaceAll('\\','/')).replace(/[\x00-\x1f]/g,'').slice(0,200)||'รูปภาพ';
 c.prepare('INSERT INTO inventory_files VALUES(?,?,?,?,?,?,?,?)').run(id,ownerId,ownerType,name,mime,bytes,'',new Date().toISOString());
 c.prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(ownerId,'inventory_file_add:'+id,null,new Date().toISOString());
 })();
 let warning='';try{localInventoryFile(id);}catch{warning='บันทึกในฐานข้อมูลเครื่องแล้ว แต่เขียนสำเนาในโฟลเดอร์ไม่สำเร็จ ตรวจพื้นที่จัดเก็บในตั้งค่า';}
 return {id,warning};
}
export function deleteInventoryFile(id:string){const f=readInventoryFile(id);const folder=path.resolve(storageConfig().localFolder,'พัสดุและครุภัณฑ์',f.ownerType==='item'?'รูปประจำรายการ':'หลักฐานเบิกจ่าย',f.ownerId);
 const target=path.resolve(folder,f.id+(f.mime==='application/pdf'?'.pdf':f.mime==='image/png'?'.png':'.jpg'));
 if(path.dirname(target)!==folder)throw Error('พาธไฟล์ไม่ถูกต้อง');
 if(fs.existsSync(target))fs.unlinkSync(target);
 inventoryDb().transaction(()=>{inventoryDb().prepare('DELETE FROM inventory_files WHERE id=?').run(id);inventoryDb().prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(f.ownerId,'inventory_file_delete:'+id,null,new Date().toISOString());})();
}
export async function syncInventoryFile(id:string){const f=readInventoryFile(id),owner=f.ownerType==='item'?readInventoryItem(f.ownerId):readMovement(f.ownerId);
 const folder=f.ownerType==='item'?('code' in owner?owner.code:''):('number' in owner?owner.number:'');
 const kind=f.ownerType==='item'?('kind' in owner&&owner.kind==='asset'?'ครุภัณฑ์':'วัสดุสำนักงาน'):'หลักฐานเบิกจ่าย';
 const fileId=await uploadInventoryFile({id:f.id,ownerId:f.ownerId,folder:folder+' '+f.ownerId.slice(0,8),kind,name:f.name,mime:f.mime,bytes:f.file,hash:createHash('sha256').update(f.file).digest('hex')});
 inventoryDb().prepare('UPDATE inventory_files SET drive_id=? WHERE id=?').run(fileId,id);return fileId;
}
