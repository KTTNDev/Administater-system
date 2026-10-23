import {z} from 'zod';
import {daySchema,type InventorySnapshot,type Movement} from './inventory';
import {thaiDay} from './correspondence';

export type FormField={key:string;label:string;multiline?:boolean;numeric?:boolean;calculated?:boolean};
const field=(key:string,label:string,multiline=false):FormField=>({key,label,multiline});
const numeric=(key:string,label:string,calculated=false):FormField=>({key,label,numeric:true,calculated});
const assetFields=[field('category','ประเภททรัพย์สิน'),field('code','รหัสทรัพย์สิน'),field('name','ชื่อทรัพย์สิน'),field('spec','ยี่ห้อ / รุ่น / คุณลักษณะ'),field('location','สถานที่ตั้ง / ผู้รับผิดชอบ'),field('vendor','ผู้ขายหรือผู้บริจาค'),field('vendorAddress','ที่อยู่ผู้ขาย / ผู้บริจาค',true),field('funding','ประเภทเงิน / แหล่งเงิน'),field('method','วิธีได้มา')];
const acquisition=[field('date','วันที่ได้มา'),field('reference','หลักฐาน / เลขที่เอกสาร'),field('description','รายการ'),numeric('quantity','จำนวน'),numeric('unitCost','ราคาต่อหน่วย'),numeric('total','มูลค่าได้มา',true)];
export const inventoryForms=[
 {id:1,name:'บัญชีวัสดุ',description:'รับ จ่าย และคงเหลือรายรายการ',landscape:true,fields:[field('category','ประเภทวัสดุ'),field('code','รหัสวัสดุ'),field('name','ชื่อวัสดุ'),field('spec','ขนาด / ลักษณะ'),field('unit','หน่วยนับ'),field('location','สถานที่เก็บ'),field('minimum','จำนวนขั้นต่ำ'),field('maximum','จำนวนขั้นสูง')],columns:[field('date','วัน เดือน ปี'),field('party','รับจาก / จ่ายให้'),field('reference','เลขที่เอกสาร'),numeric('unitCost','ราคาต่อหน่วย'),numeric('received','รับ'),numeric('issued','จ่าย'),numeric('balance','คงเหลือ'),field('remark','หมายเหตุ')],roles:['ผู้จัดทำ']},
 {id:2,name:'ทะเบียนคุมทรัพย์สิน',description:'มูลค่าได้มาและค่าเสื่อมราคา',landscape:true,fields:assetFields,columns:[...acquisition,numeric('life','อายุใช้งาน (ปี)'),numeric('rate','อัตรา (%)'),numeric('depreciation','ค่าเสื่อมปีนี้'),numeric('accumulated','ค่าเสื่อมสะสม'),numeric('netValue','มูลค่าสุทธิ'),field('remark','หมายเหตุ')],roles:['ผู้บันทึกทะเบียน']},
 {id:3,name:'ทะเบียนคุมทรัพย์สินต่ำกว่าเกณฑ์',description:'ทะเบียนรายชิ้นและหลักฐานการได้มา',landscape:true,fields:assetFields,columns:[...acquisition,field('remark','หมายเหตุ')],roles:['ผู้บันทึกทะเบียน']},
 {id:4,name:'ใบเบิกพัสดุ',description:'ผู้เบิก ผู้สั่งจ่าย ผู้จ่าย และผู้รับ',landscape:false,fields:[field('book','เล่มที่'),field('number','เลขที่ใบเบิก'),field('purpose','วัตถุประสงค์การเบิก',true),field('delegation','การมอบหมายให้รับแทน (ถ้ามี)',true)],columns:[field('description','รายการ / รหัส'),field('unit','หน่วยนับ'),numeric('requested','จำนวนขอเบิก'),numeric('issued','จำนวนจ่ายจริง'),field('remark','หมายเหตุ')],roles:['ผู้เบิก','ผู้สั่งจ่าย','ผู้จ่ายพัสดุ','ผู้รับพัสดุ']},
 {id:5,name:'รายการวัสดุคงเหลือ',description:'จำนวน ราคา และมูลค่าคงเหลือ',landscape:false,fields:[],columns:[field('description','รายการวัสดุ'),numeric('quantity','จำนวน'),field('unit','หน่วย'),numeric('unitCost','ราคาต่อหน่วย (รวมภาษี)'),numeric('total','จำนวนเงิน',true)],roles:['ประธานกรรมการ','กรรมการ','กรรมการ']},
 {id:6,name:'รายงานสินทรัพย์คงเหลือ',description:'ทรัพย์สินและผลตรวจสภาพ',landscape:true,fields:[],columns:[field('code','รหัสทรัพย์สิน'),field('description','ชื่อทรัพย์สิน'),numeric('quantity','จำนวน'),field('unit','หน่วย'),field('date','วันที่ได้มา'),numeric('total','มูลค่าได้มา'),field('funding','แหล่งเงิน'),field('condition','สภาพที่ตรวจพบ'),field('remark','หมายเหตุ')],roles:['ประธานกรรมการ','กรรมการ','กรรมการ']},
 {id:7,name:'รายงานพัสดุชำรุดหรือไม่จำเป็นต้องใช้',description:'ผลสำรวจ สาเหตุ และแหล่งเงิน',landscape:true,fields:[field('fiscalYear','ปีงบประมาณ พ.ศ.')],columns:[field('code','รหัสพัสดุ'),field('description','รายการ'),field('condition','สภาพ / เหตุที่ไม่ใช้'),field('reason','สาเหตุ'),field('date','วันที่ได้มา'),field('funding','แหล่งเงิน'),field('remark','หมายเหตุ')],roles:['ประธานกรรมการ','กรรมการ','กรรมการ']},
 {id:8,name:'รายงานการตรวจสอบพัสดุประจำปี',description:'ผลตรวจ ความเห็น และผู้ตรวจสอบ',landscape:false,fields:[field('number','ที่'),field('recipient','เรียน'),field('fiscalYear','ปีงบประมาณ พ.ศ.'),field('appointment','คำสั่งแต่งตั้ง / วันที่'),field('background','เรื่องเดิม',true),field('receiptFinding','ผลตรวจการรับ–จ่ายพัสดุ',true),field('countFinding','ผลตรวจนับวัสดุและครุภัณฑ์',true),field('conditionFinding','ผลตรวจสภาพพัสดุ',true),field('proposal','ข้อพิจารณา / ข้อเสนอ',true),field('supervisorOpinion','ความเห็นหัวหน้าเจ้าหน้าที่',true)],columns:[],roles:['ประธานกรรมการ','กรรมการ','กรรมการ','หัวหน้าเจ้าหน้าที่']}
] satisfies {id:number;name:string;description:string;landscape:boolean;fields:FormField[];columns:FormField[];roles:string[]}[];
export const formDefinition=(id:number)=>{const d=inventoryForms.find(f=>f.id===id);if(!d)throw Error('ไม่พบแบบฟอร์ม');return d;};
const values=z.record(z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,39}$/),z.string().max(12000));
export const inventoryFormSchema=z.object({
 templateId:z.number().int().min(1).max(8),title:z.string().trim().min(1).max(200),
 organization:z.string().max(300),department:z.string().max(300).default(''),
 fields:values,rows:z.array(values).max(500),signers:z.array(z.object({role:z.string().max(100),name:z.string().max(200),position:z.string().max(300)})).max(8),
 asOf:daySchema,sourceId:z.string().max(100).default(''),notes:z.string().max(4000).default(''),footer:z.string().max(8000).default('')
}).superRefine((d,ctx)=>{
 const def=formDefinition(d.templateId),fields=new Set(def.fields.map(f=>f.key)),columns=new Set(def.columns.map(f=>f.key));
 if(Object.keys(d.fields).some(k=>!fields.has(k))||d.rows.some(r=>Object.keys(r).some(k=>!columns.has(k))))ctx.addIssue({code:'custom',message:'ช่องข้อมูลไม่ตรงกับแบบฟอร์ม'});
 for(const r of d.rows)for(const c of def.columns as FormField[])if(c.numeric&&!c.calculated&&r[c.key]?.trim()&&(!/^\d+(?:\.\d{1,4})?$/.test(r[c.key].trim())||!Number.isFinite(Number(r[c.key]))||Number(r[c.key])>1e12))ctx.addIssue({code:'custom',message:c.label+' ต้องเป็นจำนวนตั้งแต่ศูนย์ขึ้นไป (ทศนิยมไม่เกิน 4 ตำแหน่ง)'});
 if(JSON.stringify(d).length>2000000)ctx.addIssue({code:'custom',message:'เอกสารมีข้อมูลมากเกินขนาดที่รองรับ'});
});
export type InventoryFormInput=z.infer<typeof inventoryFormSchema>;
export type InventoryFormDraft=InventoryFormInput&{id:string;version:number;updatedAt:string};
export const inventoryFormSql='id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL';
export const formOptionsSchema=z.object({templateId:z.number().int().min(1).max(8),asOf:daySchema,sourceId:z.string().max(100).default(''),organization:z.string().max(300),department:z.string().max(300).default('')});
export type FormOptions=z.infer<typeof formOptionsSchema>;
export const committed=(m:Movement)=>m.status==='posted'||m.status==='returned';
// Loans affect availability, never ownership in an annual asset register.
export function stockAt(data:InventorySnapshot,id:string,date:string){return data.movements.filter(m=>committed(m)&&m.date<=date).reduce((sum,m)=>sum+m.lines.filter(l=>l.itemId===id).reduce((n,l)=>n+(m.kind==='receive'?l.quantity:m.kind==='issue'?-l.quantity:0),0),0);}
const money=(n:number)=>String(Math.round((n+Number.EPSILON)*100)/100);
export function calculatedRows(d:InventoryFormInput){return d.rows.map(r=>{const row={...r};if([2,3,5].includes(d.templateId))row.total=r.quantity?.trim()&&r.unitCost?.trim()&&Number.isFinite(Number(r.quantity))&&Number.isFinite(Number(r.unitCost))?money(Number(r.quantity)*Number(r.unitCost)):'';return row;});}
export function seedInventoryForm(data:InventorySnapshot,options:FormOptions):InventoryFormInput{
 const o=formOptionsSchema.parse(options),t=o.templateId,def=formDefinition(t);
 const d:InventoryFormInput={...o,title:def.name,fields:{},rows:[],signers:def.roles.map(role=>({role,name:'',position:''})),notes:'',footer:''};
 const item=data.items.find(i=>i.id===o.sourceId),movement=data.movements.find(m=>m.id===o.sourceId);
 const ledger=data.movements.filter(m=>committed(m)&&m.date<=o.asOf).sort((a,b)=>a.date.localeCompare(b.date)||a.createdAt.localeCompare(b.createdAt)||(a.kind==='receive'?0:1)-(b.kind==='receive'?0:1)||a.id.localeCompare(b.id));
 const receipts=(id:string)=>ledger.filter(m=>m.kind==='receive').flatMap(m=>m.lines.filter(l=>l.itemId===id).map(l=>({m,l})));
 if(t<=3){
  if(!item||item.kind!==(t===1?'supply':'asset'))throw Error('เลือกรายการให้ตรงกับประเภทแบบฟอร์มก่อน');
  d.title+=' · '+item.name;d.fields={category:item.category,code:item.code,name:item.name,spec:item.serial||item.notes,location:item.location};
  if(t===1){Object.assign(d.fields,{unit:item.unit,minimum:String(item.minimum),maximum:''});let balance=0;
   d.rows=ledger.filter(m=>m.kind!=='loan').flatMap(m=>m.lines.filter(l=>l.itemId===item.id).map(l=>{balance+=m.kind==='receive'?l.quantity:-l.quantity;return {date:thaiDay(m.date),party:m.requester,reference:m.reference||m.number,unitCost:m.kind==='receive'?money(l.unitCost):'',received:m.kind==='receive'?String(l.quantity):'',issued:m.kind==='issue'?String(l.quantity):'',balance:String(balance),remark:''};}));
  }else{d.rows=receipts(item.id).map(({m,l})=>({date:thaiDay(m.date),reference:m.reference,description:item.name,quantity:String(l.quantity),unitCost:money(l.unitCost)}));d.notes='ตรวจหลักฐานผู้ขาย แหล่งเงิน วิธีได้มา และค่าเสื่อมจากทะเบียนที่หน่วยงานรับรอง';}
 }else if(t===4){
  if(!movement||movement.kind!=='issue')throw Error('เลือกใบเบิกวัสดุก่อน');
  d.title+=' · '+movement.number;d.asOf=movement.date;d.department=movement.department;d.fields={number:movement.number,purpose:movement.purpose};
  d.rows=movement.lines.map(l=>({description:l.name+' ('+l.code+')',unit:l.unit,requested:String(l.quantity),issued:movement.status==='posted'?String(l.quantity):'',remark:''}));
  d.signers[0].name=movement.requester;d.signers[1].name=movement.approver;d.signers[1].position=movement.approvalPosition;d.signers[2].name=movement.status==='posted'?movement.actor:'';
  d.notes='จำนวนจ่ายจริงเติมเฉพาะใบที่ยืนยันจ่ายแล้ว การแก้เอกสารนี้ไม่เปลี่ยนสต็อก';
 }else if(t===5){
  d.rows=data.items.filter(i=>i.kind==='supply'&&stockAt(data,i.id,o.asOf)>0).map(i=>({description:i.name,quantity:String(stockAt(data,i.id,o.asOf)),unit:i.unit,unitCost:''}));
  d.notes='กรอกราคาต่อหน่วยตามวิธีตีราคาของหน่วยงาน จำนวนเงินจะคำนวณหลังใส่ราคา';
 }else if(t===6||t===7){
  d.rows=data.items.filter(i=>i.kind==='asset'&&stockAt(data,i.id,o.asOf)>0).map((i):Record<string,string>=>{const r=receipts(i.id)[0];return t===6?{code:i.code,description:i.name,quantity:String(stockAt(data,i.id,o.asOf)),unit:i.unit,date:r?thaiDay(r.m.date):'',total:r?money(r.l.quantity*r.l.unitCost):'',funding:'',condition:'',remark:''}:{code:i.code,description:i.name,condition:'',reason:'',date:r?thaiDay(r.m.date):'',funding:'',remark:''};});
  d.notes=t===6?'รวมทรัพย์สินที่ให้ยืมและยังเป็นของหน่วยงาน ระบุสภาพจากผลตรวจจริง':'คัดออกเฉพาะรายการที่ไม่เข้าเกณฑ์ แล้วเติมสภาพและสาเหตุจากผลตรวจจริง';
 }
 if(t===7||t===8)d.fields.fiscalYear=String(Number(o.asOf.slice(0,4))+543+(o.asOf.slice(5,7)>='10'?1:0));
 if(t===8){d.fields.proposal='จึงเรียนมาเพื่อโปรดพิจารณา';d.notes='กรอกคำสั่งแต่งตั้ง ผลตรวจ และผู้ตรวจสอบตามการดำเนินงานจริง';}
 if(d.rows.length>500)throw Error('ข้อมูลเกิน 500 รายการ กรุณาแยกเอกสาร');
 return d;
}
