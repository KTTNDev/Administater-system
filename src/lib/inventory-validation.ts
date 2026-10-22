import {z} from 'zod';
import {inventoryItemSchema,movementSchema,type Movement} from './inventory';
export function validateInventoryBackup(data:Record<string,Record<string,unknown>[]>){
 const items=new Map<string,{balance:number;kind:string}>(),balances=new Map<string,number>();
 for(const r of data.inventory_items){z.string().uuid().parse(r.id);const item=inventoryItemSchema.parse(JSON.parse(String(r.data)));if(item.code!==r.code)throw Error('รหัสพัสดุในชุดสำรองไม่ตรงกัน');z.number().int().nonnegative().parse(r.balance);items.set(String(r.id),{balance:Number(r.balance),kind:item.kind});balances.set(String(r.id),0);}
 const movements=new Set<string>();
 for(const r of data.inventory_movements){z.string().uuid().parse(r.id);const m=JSON.parse(String(r.data)) as Movement;movementSchema.parse(m);z.enum(['draft','posted','returned','cancelled']).parse(m.status);if(m.id!==r.id||m.number!==r.number)throw Error('ใบพัสดุในชุดสำรองไม่ตรงกัน');movements.add(m.id);
 for(const l of m.lines){const i=items.get(l.itemId);if(!i)throw Error('ชุดสำรองขาดทะเบียนพัสดุ');if(i.kind==='asset'&&l.quantity!==1)throw Error('จำนวนครุภัณฑ์ไม่ถูกต้อง');if(m.status==='posted')balances.set(l.itemId,balances.get(l.itemId)!+(m.kind==='receive'?l.quantity:-l.quantity));}
 if(m.status==='returned'&&m.kind!=='loan')throw Error('สถานะคืนไม่ถูกต้อง');
 }
 for(const [id,i] of items)if(i.balance!==balances.get(id)||i.kind==='asset'&&i.balance>1)throw Error('ยอดพัสดุในชุดสำรองไม่ตรงกับประวัติ');
 for(const r of data.inventory_files){z.string().uuid().parse(r.id);z.enum(['item','movement']).parse(r.owner_type);if(!(r.file instanceof Uint8Array)||r.file.byteLength>8*1024*1024||!['image/png','image/jpeg','application/pdf'].includes(String(r.mime)))throw Error('ไฟล์พัสดุในชุดสำรองไม่ถูกต้อง');if(!(r.owner_type==='item'?items.has(String(r.owner_id)):movements.has(String(r.owner_id))))throw Error('ชุดสำรองขาดเจ้าของรูปหรือหลักฐาน');}
 for(const r of data.inventory_events)if(!movements.has(String(r.movement_id)))throw Error('ประวัติพัสดุไม่มีใบอ้างอิง');
}
