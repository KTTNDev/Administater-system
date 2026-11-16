import {d01Missing,d07Missing,type ProcurementInput} from './procurement';
import {documentTemplates,d01Optional,type DraftDocumentCode} from './procurement-documents';
import {billValues} from './procurement-bill';
export const procurementSteps=[{id:'details',label:'งานและรายการ'},{id:'header',label:'ส่วนหัว'},{id:'body',label:'เนื้อหา'},{id:'signing',label:'ผู้ลงนาม'},{id:'documents',label:'ชุดเอกสาร'},{id:'contract',label:'สัญญา'},{id:'evidence',label:'หลักฐาน'},{id:'finance',label:'ส่งคลัง'}] as const;
export type ProcurementStep=typeof procurementSteps[number]['id'];
export function procurementReadiness(data:ProcurementInput,code:DraftDocumentCode){
 if(code!=='D01'&&code!=='D07'){const values=billValues(data),missing=['vendor','item','agreed'].filter(key=>!values[key]?.trim());return {total:3,done:3-missing.length,percent:Math.floor((3-missing.length)/3*100),missing};}
 const missing=code==='D01'?d01Missing(data):d07Missing(data),required=documentTemplates[code].slots.filter(slot=>!(code==='D01'?d01Optional:['secretaryActing','authorityActing']).includes(slot.key));
 const labels=new Set([...required.map(slot=>slot.label),...missing]);
 const total=labels.size,done=total-new Set(missing).size;return {total,done,percent:total?Math.floor(done/total*100):0,missing};
}
