import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db} from './db';
import {inventorySchemas,inventoryItemSchema,movementSchema,type InventoryItem,type InventorySnapshot,type Movement,type InventoryFile} from './inventory';
export function inventoryDb(){const c=db();for(const [name,sql] of Object.entries(inventorySchemas))c.exec('CREATE TABLE IF NOT EXISTS '+name+' ('+sql+')');return c;}
export function readInventoryItem(id:string):InventoryItem{const r=inventoryDb().prepare('SELECT * FROM inventory_items WHERE id=?').get(z.string().uuid().parse(id));if(!r)throw Error('ไม่พบรายการ');return {...inventoryItemSchema.parse(JSON.parse(String(r.data))),id:String(r.id),version:Number(r.version),balance:Number(r.balance),updatedAt:String(r.updated_at)};}
export function readMovement(id:string):Movement{const r=inventoryDb().prepare('SELECT data,version FROM inventory_movements WHERE id=?').get(z.string().uuid().parse(id));if(!r)throw Error('ไม่พบใบรายการ');return {...JSON.parse(String(r.data)),version:Number(r.version)};}
export function inventoryFileMeta(r:Record<string,unknown>):InventoryFile{return {id:String(r.id),ownerId:String(r.owner_id),ownerType:r.owner_type as 'item'|'movement',name:String(r.name),mime:String(r.mime),size:Number(r.size),driveId:String(r.drive_id||''),createdAt:String(r.created_at)};}
export function inventorySnapshot():InventorySnapshot{const c=inventoryDb();return {items:c.prepare('SELECT id FROM inventory_items ORDER BY code').all().map(r=>readInventoryItem(String(r.id))),movements:c.prepare("SELECT id FROM inventory_movements ORDER BY json_extract(data,'$.createdAt') DESC,id DESC").all().map(r=>readMovement(String(r.id))),files:c.prepare('SELECT id,owner_id,owner_type,name,mime,length(file) size,drive_id,created_at FROM inventory_files ORDER BY created_at,id').all().map(inventoryFileMeta)};}
export function saveInventoryItem(input:unknown,id:string,version:number){
 const d=inventoryItemSchema.parse(input);z.string().uuid().parse(id);z.number().int().nonnegative().parse(version);const c=inventoryDb();
 return c.transaction(()=>{
 const old=c.prepare('SELECT * FROM inventory_items WHERE id=?').get(id);
 if(old&&version===0&&String(old.data)===JSON.stringify(d))return readInventoryItem(id);
 if(c.prepare('SELECT id FROM inventory_items WHERE lower(code)=lower(?) AND id<>?').get(d.code,id))throw Error('รหัสนี้มีอยู่แล้ว');
 if(old){const previous=readInventoryItem(id);if(previous.kind!==d.kind||previous.unit!==d.unit){if(c.prepare('SELECT id FROM inventory_movements WHERE data LIKE ? LIMIT 1').get('%'+id+'%'))throw Error('รายการที่มีประวัติแล้วเปลี่ยนประเภทหรือหน่วยนับไม่ได้');}
 if(!d.active&&(previous.balance||c.prepare("SELECT id FROM inventory_movements WHERE data LIKE ? AND json_extract(data,'$.status') IN ('draft','posted') AND json_extract(data,'$.kind')='loan'").get('%'+id+'%')))throw Error('ต้องเคลียร์ยอดคงเหลือและการยืมก่อนเลิกใช้');
 if(!c.prepare('UPDATE inventory_items SET code=?,data=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(d.code,JSON.stringify(d),new Date().toISOString(),id,version).changes)throw Error('ข้อมูลเปลี่ยนแล้ว กรุณาโหลดใหม่');
 }else{if(version!==0)throw Error('ไม่พบรายการเดิม');c.prepare('INSERT INTO inventory_items VALUES(?,?,?,1,0,?)').run(id,d.code,JSON.stringify(d),new Date().toISOString());}
 c.prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(id,'inventory_item_save',version+1,new Date().toISOString());
 return readInventoryItem(id);
 })();
}
function event(m:Movement,action:string,actor:string){inventoryDb().prepare('INSERT INTO inventory_events VALUES(?,?,?,?,?,?)').run(randomUUID(),m.id,action,actor,new Date().toISOString(),JSON.stringify(m));}
function persist(m:Movement){inventoryDb().prepare('UPDATE inventory_movements SET data=?,version=? WHERE id=?').run(JSON.stringify(m),m.version,m.id);}
export function createMovement(input:unknown,id:string){const d=movementSchema.parse(input);z.string().uuid().parse(id);const c=inventoryDb();return c.transaction(()=>{
 const old=c.prepare('SELECT id FROM inventory_movements WHERE id=?').get(id);if(old){const m=readMovement(id);if(JSON.stringify(movementSchema.parse(m))!==JSON.stringify(d))throw Error('รหัสคำขอนี้ใช้กับข้อมูลอื่นแล้ว กรุณาโหลดใหม่');return m;}
 const lines=d.lines.map(l=>{const i=readInventoryItem(l.itemId);if(!i.active)throw Error(i.name+' เลิกใช้แล้ว');if(d.kind==='issue'&&i.kind!=='supply')throw Error('ครุภัณฑ์ใช้ใบยืมเพื่อติดตามการคืน');if(d.kind==='loan'&&i.kind!=='asset')throw Error('ใบยืมนี้ใช้สำหรับครุภัณฑ์รายชิ้น');if(i.kind==='asset'&&l.quantity!==1)throw Error('ครุภัณฑ์ต้องลงทะเบียนแยกชิ้น จำนวน 1');return {...l,code:i.code,name:i.name,unit:i.unit,kind:i.kind};});
 const year=d.date.slice(0,4),prefix=(d.kind==='receive'?'รับ':d.kind==='issue'?'เบิก':'ยืม')+'-'+(Number(year)+543)+'-';
 const latest=c.prepare('SELECT number FROM inventory_movements WHERE number LIKE ? ORDER BY number DESC LIMIT 1').get(prefix+'%');
 const sequence=latest?Number(String(latest.number).slice(prefix.length))+1:1;
 if(sequence>999999)throw Error('เลขรายการเต็มแล้ว');
 const m:Movement={...d,id,lines,number:prefix+String(sequence).padStart(6,'0'),version:1,status:'draft',createdAt:new Date().toISOString()};
 c.prepare('INSERT INTO inventory_movements VALUES(?,?,?,1)').run(id,m.number,JSON.stringify(m));event(m,'create',d.actor);return m;
 })();}
export function transitionMovement(input:unknown){const p=z.object({id:z.string().uuid(),version:z.number().int().positive(),action:z.enum(['post','cancel','return']),actor:z.string().trim().min(1).max(300),approver:z.string().trim().max(300).default(''),approvalPosition:z.string().trim().max(300).default(''),reference:z.string().trim().max(300).default(''),reason:z.string().trim().max(2000).default('')}).parse(input);const c=inventoryDb();
 return c.transaction(()=>{
 const m=readMovement(p.id);
 // A repeated confirmation after a lost response is harmless.
 if((p.action==='post'&&m.status==='posted')||(p.action==='cancel'&&m.status==='cancelled')||(p.action==='return'&&m.status==='returned'))return m;
 if(m.version!==p.version)throw Error('ใบรายการเปลี่ยนแล้ว กรุณาโหลดใหม่');
 if(p.action==='post'){
 if(m.status!=='draft')throw Error('ใบรายการนี้ยืนยันไม่ได้');
 if(m.kind!=='receive'&&(!p.approver||!p.approvalPosition||!p.reference))throw Error('ระบุผู้สั่งจ่าย / ผู้อนุมัติ ตำแหน่ง และหลักฐานอนุมัติก่อนจ่าย');
 for(const l of m.lines){const i=readInventoryItem(l.itemId);if(!i.active)throw Error(i.name+' เลิกใช้แล้ว');
 if(m.kind==='receive'&&i.kind==='asset'&&c.prepare("SELECT id FROM inventory_movements WHERE id<>? AND json_extract(data,'$.kind')='receive' AND json_extract(data,'$.status')='posted' AND data LIKE ?").get(m.id,'%'+i.id+'%'))throw Error('ครุภัณฑ์ชิ้นนี้รับเข้าแล้ว');
 const delta=m.kind==='receive'?l.quantity:-l.quantity;if(i.balance+delta<0)throw Error(i.name+' คงเหลือไม่พอ');
 c.prepare('UPDATE inventory_items SET balance=balance+?,version=version+1,updated_at=? WHERE id=?').run(delta,new Date().toISOString(),i.id);
 }m.status='posted';m.postedAt=new Date().toISOString();m.actor=p.actor;if(m.kind!=='receive'){m.approver=p.approver;m.approvalPosition=p.approvalPosition;m.reference=p.reference;}
 }else if(p.action==='return'){
 if(m.kind!=='loan'||m.status!=='posted')throw Error('คืนได้เฉพาะครุภัณฑ์ที่กำลังยืม');if(!p.reason)throw Error('ระบุสภาพครุภัณฑ์เมื่อคืน');
 for(const l of m.lines)c.prepare('UPDATE inventory_items SET balance=balance+?,version=version+1,updated_at=? WHERE id=?').run(l.quantity,new Date().toISOString(),l.itemId);
 m.status='returned';m.returnActor=p.actor;m.returnCondition=p.reason;m.returnedAt=new Date().toISOString();
 }else{
 if(!p.reason)throw Error('ระบุเหตุผลยกเลิก');
 if(m.status!=='draft')throw Error('ยกเลิกได้เฉพาะใบที่ยังไม่ลงบัญชี รายการจ่ายจริงเก็บไว้เป็นหลักฐาน');
 m.status='cancelled';m.cancelReason=p.reason;
 }
 m.version++;persist(m);event(m,p.action,p.actor);return m;
 })();
}
