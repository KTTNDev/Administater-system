import {z} from 'zod';
const text=z.string().trim().max(300);
export const inventoryItemSchema=z.object({
 code:text.min(1,'ระบุรหัสวัสดุ / เลขครุภัณฑ์'),name:text.min(1,'ระบุชื่อรายการ'),kind:z.enum(['supply','asset']),
 unit:text.min(1,'ระบุหน่วยนับ'),category:text.default(''),location:text.default(''),serial:text.default(''),
 minimum:z.number().int().min(0).max(1000000).default(0),notes:z.string().max(3000).default(''),active:z.boolean().default(true)
});
export type InventoryInput=z.infer<typeof inventoryItemSchema>;
export type InventoryItem=InventoryInput&{id:string;version:number;balance:number;updatedAt:string};
export const daySchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'วันที่ไม่ถูกต้อง');
export const movementSchema=z.object({
 kind:z.enum(['receive','issue','loan']),date:daySchema,actor:text.min(1,'ระบุผู้บันทึก / ผู้จ่าย'),requester:text.min(1,'ระบุผู้ส่งมอบ / ผู้เบิก'),
 department:text.min(1,'ระบุหน่วยงาน'),purpose:z.string().trim().min(1,'ระบุเหตุผล / รายละเอียด').max(2000),reference:text.default(''),
 approver:text.default(''),approvalPosition:text.default(''),due:z.union([z.literal(''),daySchema]).default(''),
 place:z.enum(['inside','outside','agency']).default('inside'),
 lines:z.array(z.object({itemId:z.string().uuid(),quantity:z.number().int().positive().max(1000000),unitCost:z.number().finite().min(0).max(1000000000).default(0)})).min(1,'เลือกรายการก่อน').max(100)
}).superRefine((v,c)=>{
 if(new Set(v.lines.map(l=>l.itemId)).size!==v.lines.length)c.addIssue({code:'custom',message:'มีรายการซ้ำในใบเดียวกัน',path:['lines']});
 if(v.kind==='loan'&&(!v.due||v.due<v.date))c.addIssue({code:'custom',message:'กำหนดวันคืนตั้งแต่วันที่ยืมเป็นต้นไป',path:['due']});
 if(v.kind==='receive'&&!v.reference)c.addIssue({code:'custom',message:'ระบุหลักฐานรับเข้า / เลขที่เอกสาร',path:['reference']});
});
export type MovementInput=z.infer<typeof movementSchema>;
export type MovementLine=MovementInput['lines'][number]&{code:string;name:string;unit:string;kind:'supply'|'asset'};
export type Movement=Omit<MovementInput,'lines'>&{id:string;number:string;version:number;status:'draft'|'posted'|'cancelled'|'returned';lines:MovementLine[];createdAt:string;postedAt?:string;returnedAt?:string;returnActor?:string;returnCondition?:string;cancelReason?:string};
export type InventoryFile={id:string;ownerId:string;ownerType:'item'|'movement';name:string;mime:string;size:number;driveId:string;createdAt:string};
export type InventorySnapshot={items:InventoryItem[];movements:Movement[];files:InventoryFile[]};
export const movementLabels={receive:'รับเข้า',issue:'เบิกจ่าย',loan:'ยืมครุภัณฑ์'};
export const movementStatuses={draft:'รอจ่าย / ตรวจสอบ',posted:'บันทึกแล้ว',cancelled:'ยกเลิก',returned:'คืนแล้ว'};
export const emptyInventoryItem=():InventoryInput=>({code:'',name:'',kind:'supply',unit:'ชิ้น',category:'',location:'',serial:'',minimum:0,notes:'',active:true});
export const inventorySchemas={
 inventory_items:'id TEXT PRIMARY KEY,code TEXT NOT NULL UNIQUE,data TEXT NOT NULL,version INTEGER NOT NULL,balance INTEGER NOT NULL DEFAULT 0,updated_at TEXT NOT NULL',
 inventory_movements:'id TEXT PRIMARY KEY,number TEXT NOT NULL UNIQUE,data TEXT NOT NULL,version INTEGER NOT NULL',
 inventory_files:'id TEXT PRIMARY KEY,owner_id TEXT NOT NULL,owner_type TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,file BLOB NOT NULL,drive_id TEXT NOT NULL DEFAULT \'\',created_at TEXT NOT NULL',
 inventory_events:'id TEXT PRIMARY KEY,movement_id TEXT NOT NULL,action TEXT NOT NULL,actor TEXT NOT NULL,at TEXT NOT NULL,snapshot TEXT NOT NULL'
} as const;
export function inventoryPeriod(fiscalYear:number){return {start:String(fiscalYear-544)+'-10-01',end:String(fiscalYear-543)+'-09-30'};}
export function filterMovements(movements:Movement[],start:string,end:string,query=''){const q=query.trim().toLocaleLowerCase();return movements.filter(m=>(!start||m.date>=start)&&(!end||m.date<=end)&&(!q||[m.number,m.requester,m.department,m.reference,m.purpose,...m.lines.map(l=>l.code+' '+l.name)].join(' ').toLocaleLowerCase().includes(q)));}
