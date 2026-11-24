import {z} from 'zod';
import type {ProcurementInput} from './procurement';
import {emptyDocumentConfig} from './procurement-workflow-model';

export const registerKinds={internal:'หนังสือภายใน',external:'หนังสือภายนอก',order:'คำสั่ง',announcement:'ประกาศ',purchase_order:'ใบสั่งซื้อ / จ้าง',other:'ทะเบียนอื่น'} as const;
const text=z.string().trim().max(120).regex(/^[^\x00-\x1f\x7f]*$/);
const date=z.string().refine(v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'วันที่ไม่ถูกต้อง');
export const reservationSchema=z.object({
 id:z.string().uuid(),code:z.string().regex(/^[A-Z]\d{2}$/),register:z.enum(['internal','external','order','announcement','purchase_order','other']),
 owner:text,prefix:text,year:z.number().int().min(2400).max(3000),number:text,plannedDate:date,confirmedDate:date,
 status:z.enum(['reserved','used','cancelled']),printNumber:z.boolean(),recordedAt:z.string().default(''),note:z.string().max(1000).default(''),
}).strict();
export const registerSchema=z.object({fiscalYear:z.string().regex(/^$|^\d{4}$/).default(''),entries:z.array(reservationSchema).max(300).default([])}).strict().default(()=>({fiscalYear:'',entries:[]}));
export type Reservation=z.infer<typeof reservationSchema>;
export const arabicDigits=(value:string)=>value.replace(/[๐-๙]/g,c=>String(c.charCodeAt(0)-0x0e50));
const normalized=(value:string)=>arabicDigits(value).normalize('NFKC').replace(/\s+/g,'').replace(/^0+(?=\d+$)/,'').toLowerCase();
export const reservationKey=(entry:Reservation)=>JSON.stringify([entry.register,normalized(entry.owner),normalized(entry.prefix),entry.year,normalized(entry.number)]);
export const printedReservationNumber=(entry:Reservation)=>!entry.number?'':['order','announcement'].includes(entry.register)?entry.number.trim():[entry.prefix.trim(),entry.number.trim()].filter(Boolean).join(entry.register==='purchase_order'?' ':entry.prefix.trim().endsWith('/')?'':'/');
/** Only explicitly changed ledger rows alter document fields. Reservation is never an approval. */
export function applyReservation(data:ProcurementInput,entry:Reservation,clearReview=true):ProcurementInput{
 if(entry.status==='cancelled')return applyReservation(data,{...entry,status:'reserved',number:'',plannedDate:'',confirmedDate:''});
 const code=entry.code as keyof ProcurementInput['documents'],config=data.documents[code]||emptyDocumentConfig(),number=printedReservationNumber(entry),iso=entry.confirmedDate||entry.plannedDate;
 const documents={...data.documents,[code]:{...config,...entry.printNumber?{number}:{},date:iso,reviewedHash:clearReview?'':config.reviewedHash}};
 let next={...data,documents};
 if(code==='D01'||code==='D07'){
  const fields:Record<string,string>={};if(entry.printNumber)fields.number=number;
  const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
  if(iso){const [y,m,d]=iso.split('-').map(Number);Object.assign(fields,{day:String(d),month:months[m-1],year:String(y+543)});}else Object.assign(fields,{day:'',month:'',year:''});
  const overrides={...(code==='D01'?data.d01Overrides:data.d07Overrides)};for(const key of Object.keys(fields))delete overrides[key];
  next=code==='D01'?{...next,d01:{...data.d01,...fields},d01Overrides:overrides}:{...next,common:{...data.common,...fields},d07Overrides:overrides};
 }
 return next;
}
export function validateReservations(data:ProcurementInput,previous?:ProcurementInput){
 const ids=new Set<string>(),active=new Set<string>(),keys=new Set<string>();
 for(const entry of data.register.entries){
  if(ids.has(entry.id))throw Error('รายการลายแทงซ้ำ');ids.add(entry.id);
  if(!Object.hasOwn(data.documentTypes,entry.code))throw Error('ไม่พบชนิดเอกสารในลายแทง');
  if(entry.status!=='cancelled'){if(active.has(entry.code))throw Error('เอกสารหนึ่งฉบับมีเลขที่ใช้งานได้เพียงรายการเดียว');active.add(entry.code);}
  if(entry.number){if(!entry.owner||!entry.prefix)throw Error('ระบุหน่วยงานและชุดเลขของทะเบียนก่อนบันทึกเลขจอง');const key=reservationKey(entry);if(keys.has(key))throw Error('เลขทะเบียนซ้ำในงานเดียวกัน');keys.add(key);}
  if(entry.status==='used'&&(!entry.number||!entry.confirmedDate))throw Error('ยืนยันใช้เลขเมื่อมีเลขและวันที่เอกสารจริงแล้ว');
  if(entry.status==='used'&&Number(entry.confirmedDate.slice(0,4))+543!==entry.year)throw Error('ปีทะเบียนต้องตรงกับวันที่เอกสารที่ยืนยัน');
  const old=previous?.register.entries.find(row=>row.id===entry.id);
  if(old?.recordedAt&&old.recordedAt!==entry.recordedAt)throw Error('แก้เวลาบันทึกเลขเดิมไม่ได้');
  if(old?.number&&(reservationKey(old)!==reservationKey(entry)||old.printNumber!==entry.printNumber))throw Error('เลขที่บันทึกแล้วให้ยกเลิกพร้อมเหตุผลและเพิ่มรายการใหม่ เพื่อคงประวัติ');
  if(old?.status==='cancelled'&&JSON.stringify(old)!==JSON.stringify(entry))throw Error('รายการยกเลิกคงไว้เป็นประวัติ');
  if(entry.status==='cancelled'&&!entry.note.trim())throw Error('ระบุเหตุผลยกเลิกเลขจอง');
 }
 for(const old of previous?.register.entries||[])if(!ids.has(old.id))throw Error('ห้ามลบประวัติลายแทง ให้ยกเลิกพร้อมเหตุผล');
}
