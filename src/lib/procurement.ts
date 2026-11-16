import {z} from 'zod';
import {templateSlots,type TemplateValues} from './procurement-lab/template-model';
import {d01OwnKeys,d01Slots,d01Optional,emptyD01,additionalCommonFields,type DraftDocumentCode} from './procurement-documents';
import {templates} from './templates';
import {defaultProcurementTypes} from './procurement-document-types';
import {billSchema,billValues,moneyWords,monetaryWordSources} from './procurement-bill';
import {documentConfigSchema,workflowSchema,contractTaskSchema,inspectionSchema} from './procurement-workflow-model';
const documentTypeSchema=z.enum(templates.map(item=>item.id));

export const procurementProfiles={
 pending:'ยังไม่ยืนยันแนวทาง',general:'วิธีเฉพาะเจาะจง / แนวทางทั่วไป',
 w119:'ว119 — ตรวจรายการค่าใช้จ่ายและเงื่อนไขก่อนใช้',
 w804:'ว804 — งานซื้อไม่เกิน 50,000 บาทตามเงื่อนไข',
 invitation:'ประกาศเชิญชวนทั่วไป / แนวทางอื่น',
} as const;
export const procurementCodes=['D01','D02','D03','D04','D05','D06','D07','D08','D09','D10','D11','D12','D13','D14','P01','E01','V01','OTHER'] as const;
export const sourceCodes=['D05','D06','D07','D08','D09','D10','D11'] as const;
export const procurementSql={
 procurement_cases:'id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL',
 procurement_revisions:'id TEXT PRIMARY KEY,case_id TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL',
 procurement_templates:'id TEXT PRIMARY KEY,name TEXT NOT NULL,sha256 TEXT NOT NULL,file BLOB NOT NULL,created_at TEXT NOT NULL',
 procurement_files:'id TEXT PRIMARY KEY,case_id TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,sha256 TEXT NOT NULL,file BLOB NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL',
} as const;
const text=(max:number)=>z.string().max(max).regex(/^[^\x00-\x1f\x7f]*$/,'กรอกข้อความในย่อหน้าเดิมโดยไม่ขึ้นบรรทัดใหม่');
export const procurementCommonSchema=z.object(Object.fromEntries([...templateSlots,...additionalCommonFields].map(f=>[f.key,text(f.max).default('')]))).strict();
const isoDate=z.string().refine(v=>!v||/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v,'วันที่ไม่ถูกต้อง');
export const procurementSchema=z.object({
 sample:z.boolean().default(false),
 kind:z.enum(['purchase','hire']),title:text(160).trim().min(1,'ระบุชื่องาน'),
 profile:z.enum(['pending','general','w119','w804','invitation']),
 egpExemption:z.enum(['pending','none','w322']),
 billType:z.enum(['quotation','invoice','receipt','other']),billNumber:text(100),
 contractDue:isoDate,notes:z.string().max(3000),common:procurementCommonSchema,
 sources:z.object(Object.fromEntries(sourceCodes.map(code=>[code,z.enum(['external','draft'])]))).strict(),
 d07Overrides:z.object(Object.fromEntries(templateSlots.map(f=>[f.key,text(f.max).optional()]))).strict(),
 d01:z.object(Object.fromEntries(d01OwnKeys.map(key=>[key,text(d01Slots.find(slot=>slot.key===key)!.max).default('')]))).strict().default(emptyD01),
 d01Overrides:z.object(Object.fromEntries(d01Slots.map(slot=>[slot.key,text(slot.max).optional()]))).strict().default({}),
 documentTypes:z.object(Object.fromEntries(procurementCodes.map(code=>[code,documentTypeSchema.default(defaultProcurementTypes[code])]))).strict().default(()=>({...defaultProcurementTypes})),
 bill:billSchema,
 documents:z.partialRecord(z.enum(procurementCodes),documentConfigSchema).default({}),
 workflow:workflowSchema,
 tasks:z.array(contractTaskSchema).max(100).default([]),
 inspection:inspectionSchema,
}).strict().transform(data=>{data.common.allocatedBudgetWords=moneyWords(data.common.allocatedBudget||'');return data;});
export type ProcurementInput=z.infer<typeof procurementSchema>;
export type ProcurementCase=ProcurementInput&{id:string;version:number;updatedAt:string};
export const procurementFileSchema=z.object({
 code:z.enum(procurementCodes),origin:z.enum(['vendor','egp','elaas','scan','word','draft']),
 caseVersion:z.number().int().positive().nullable(),
 templateHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),
 values:z.record(z.string().max(80),z.string().max(60000)).optional(),outputVersion:z.string().max(60).optional(),
 documentType:documentTypeSchema.optional(),
 contentHash:z.string().regex(/^[a-f0-9]{64}$/).optional(),
 baseFileId:z.string().uuid().optional(),
}).strict();
export type ProcurementFile={id:string;caseId:string;name:string;mime:string;sha256:string;createdAt:string;bytes:number;meta:z.infer<typeof procurementFileSchema>};
export type ProcurementSnapshot={cases:ProcurementCase[];files:ProcurementFile[];template:{ready:boolean;name?:string;sha256?:string};templates?:Record<DraftDocumentCode,{ready:boolean;name?:string;sha256?:string}>};
export function newProcurement(kind:ProcurementInput['kind']='purchase',department=''):ProcurementInput{
 const today=new Date(),month=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
 return {sample:false,kind,title:'',profile:'pending',egpExemption:'pending',billType:'quotation',billNumber:'',contractDue:'',notes:'',
  common:{...Object.fromEntries([...templateSlots,...additionalCommonFields].map(f=>[f.key,''])),department,day:String(today.getDate()),month:month[today.getMonth()],year:String(today.getFullYear()+543)},
  sources:Object.fromEntries(sourceCodes.map(code=>[code,code==='D07'?'draft':'external'])) as ProcurementInput['sources'],d07Overrides:{},d01:{...emptyD01(),day:String(today.getDate()),month:month[today.getMonth()],year:String(today.getFullYear()+543)},d01Overrides:{},documentTypes:{...defaultProcurementTypes},bill:billSchema.parse({}),documents:{},workflow:workflowSchema.parse({}),tasks:[],inspection:inspectionSchema.parse({})};
}
export const procurementBindings={vendor:'ชื่อร้านค้า',item:'รายการ',offered:'ราคาที่เสนอ',agreed:'ราคาที่ตกลง',number:'เลขหนังสือ',subject:'เรื่อง',organization:'ชื่อหน่วยงาน',unit:'ชื่อกอง',action:'จัดซื้อ / จัดจ้าง',budgetYear:'ปีงบประมาณ',allocatedBudget:'วงเงินงบประมาณตั้งไว้',allocatedBudgetWords:'วงเงินงบประมาณเป็นตัวอักษร',...Object.fromEntries(additionalCommonFields.map(f=>[f.key,f.label])),amountWords:'จำนวนเงินเป็นตัวอักษร',agreedWords:'ยอดตกลงเป็นตัวอักษร',offeredWords:'ยอดเสนอเป็นตัวอักษร',referencePriceWords:'ราคาอ้างอิงเป็นตัวอักษร',remainingBudgetWords:'งบคงเหลือเป็นตัวอักษร',net:'ยอดก่อนภาษี',vat:'ภาษีมูลค่าเพิ่ม'} as const;
function bindText(text:string,values:TemplateValues){return text.replace(/\{\{([a-zA-Z]+)\}\}/g,(token,name)=>Object.hasOwn(values,name)?values[name]||token:token);}
function unresolvedLabels(values:TemplateValues){const labels:string[]=[],known=new Set([...Object.values(procurementBindings),...templateSlots.map(slot=>slot.label),...d01Slots.map(slot=>slot.label.replace(/ D0[17]$/,''))]);for(const value of Object.values(values)){for(const match of value.matchAll(/\{\{([a-zA-Z]+)\}\}/g))labels.push(procurementBindings[(monetaryWordSources[match[1]]||match[1]) as keyof typeof procurementBindings]||'ตรวจตัวแปร '+match[1]);for(const match of value.matchAll(/\[([^\[\]]+)\]/g))if(known.has(match[1]))labels.push(match[1]);}return labels;}
export function d07Values(data:ProcurementInput):TemplateValues{
 const values={...billValues(data),action:data.kind==='purchase'?'จัดซื้อ':'จัดจ้าง',directorRecipient:data.common.directorRecipient||data.common.secretaryPosition,secretaryRecipient:data.common.secretaryRecipient||data.common.authorityPosition,...data.d07Overrides} as TemplateValues;
 const resolved=Object.fromEntries(templateSlots.map(slot=>[slot.key,values[slot.key]]));
 for(const key of ['intro','consideration','proposal'])resolved[key]=bindText(values[key],values);
 return resolved;
}
export function d07Missing(data:ProcurementInput){const values=d07Values(data),missing=templateSlots.filter(f=>!['secretaryActing','authorityActing'].includes(f.key)&&!values[f.key]?.trim()).map(f=>f.label);return [...new Set([...missing,...unresolvedLabels(values)])];}
export function d01Values(data:ProcurementInput):TemplateValues{
 const own=data.d01||emptyD01(),common=billValues(data),values={...common,directorRecipient:data.common.directorRecipient||data.common.secretaryPosition,secretaryRecipient:data.common.secretaryRecipient||data.common.authorityPosition,action:data.kind==='purchase'?'จัดซื้อ':'จัดจ้าง',...own,subject:own.subject||'ขออนุมัติ'+(data.kind==='purchase'?'จัดซื้อ':'จัดจ้าง')+common.item,...data.d01Overrides} as TemplateValues;
 const resolved:TemplateValues={};for(const slot of d01Slots)resolved[slot.key]=bindText(values[slot.key]||'',values);return resolved;
}
export function d01Missing(data:ProcurementInput){const values=d01Values(data),missing=d01Slots.filter(slot=>!d01Optional.includes(slot.key)&&!values[slot.key]?.trim()).map(slot=>slot.label);return [...new Set([...missing,...unresolvedLabels(values)])];}
export function procurementWarnings(data:ProcurementInput){
 const amount=Number((billValues(data).agreed||'').replaceAll(',',''));
 const warnings:string[]=[];
 if(data.profile==='invitation')warnings.push('แม่แบบตัวอย่างมาจากวิธีเฉพาะเจาะจง ต้องปรับข้อความและชุดเอกสารให้ตรงวิธีที่เลือกก่อนใช้');
 if(data.profile==='pending')warnings.push('ยังไม่ได้ยืนยันแนวทางจัดซื้อจัดจ้าง');
 if(data.profile==='w119')warnings.push('ว119 ใช้เฉพาะรายการและเงื่อนไขที่กำหนด ไม่ได้ใช้กับทุกบิลที่ไม่เกิน 10,000 บาท');
 if(data.profile==='w119'&&amount>10000)warnings.push('วงเงินเกิน 10,000 บาท ตรวจแนวทาง ว119 ใหม่');
 if(data.profile==='w804'&&(data.kind!=='purchase'||amount>50000))warnings.push('ว804 ที่ตรวจไว้ใช้กับงานซื้อไม่เกิน 50,000 บาท ตรวจแนวทางใหม่');
 if(data.egpExemption==='w322')warnings.push('ว322 สำหรับ อปท. ใช้เกณฑ์ต่ำกว่า 5,000 บาทตามเงื่อนไข เป็นข้อยกเว้น e-GP แยกจากวิธีจัดซื้อจัดจ้าง');
 if(data.egpExemption==='w322'&&amount>=5000)warnings.push('ยอดตั้งแต่ 5,000 บาทไม่เข้าเกณฑ์วงเงินข้อนี้ของ ว322');
 if(data.billType==='receipt')warnings.push('เริ่มจากใบเสร็จแล้ว: ตรวจลำดับการอนุมัติจริง และไม่ลงวันที่ย้อนหลังเพื่อทดแทนขั้นตอน');
 return warnings;
}
