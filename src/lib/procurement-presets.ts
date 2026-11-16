import 'server-only';
import {newProcurement,type ProcurementInput} from './procurement';
import {templateInitial} from './procurement-template';
import {d01Initial} from './procurement-d01-template';
import {procurementSnapshot,procurementTemplateBytes} from './procurement-db';
import {d01OwnKeys} from './procurement-documents';
/** Wording is retained from the approved source, while bill-specific data is cleared. */
export async function procurementPreset(kind:ProcurementInput['kind']){
 const data=newProcurement(kind),snapshot=procurementSnapshot();
 data.common.category='วัสดุสำนักงาน';
 if(snapshot.template.ready){
  const {values}=await templateInitial(procurementTemplateBytes('D07'));
  for(const key of ['department','recipient','directorRecipient','secretaryRecipient','proposer','proposerPosition','director','directorPosition','secretary','secretaryPosition','secretaryActing','authority','authorityPosition','authorityActing'])data.common[key]=values[key];
  data.common.organization=values.department.match(/เทศบาล[^ ]+/)?.[0]||'';
  data.common.unit=values.department.match(/กอง[^ ]+/)?.[0]||'';
  data.common.subject=values.subject.replace('สั่งซื้อสั่งจ้าง',kind==='purchase'?'สั่งซื้อ':'สั่งจ้าง');
  data.common.intro='ขอรายงานผลการพิจารณาค่า{{action}}{{item}} โดยวิธีเฉพาะเจาะจงดังนี้';
  data.common.consideration=(data.common.organization?values.consideration.replaceAll(data.common.organization,'{{organization}}'):values.consideration).replaceAll('จัดจ้าง','{{action}}');
  data.common.proposal=values.proposal.replaceAll('สั่งซื้อสั่งจ้าง',kind==='purchase'?'สั่งซื้อ':'สั่งจ้าง');
 }
 if(snapshot.templates?.D01.ready){
  const values=await d01Initial(procurementTemplateBytes('D01'));
  for(const key of d01OwnKeys)if(!['number','day','month','year'].includes(key))data.d01[key]=values[key];
  const unit=(text:string)=>data.common.unit?text.replaceAll(data.common.unit,'{{unit}}'):text;
  data.d01.background=unit(values.background.replace('๒๕68','{{budgetYear}}').replace('30,๐๐๐.-','{{allocatedBudget}}').replace('สามหมื่นบาทถ้วน','{{allocatedBudgetWords}}'));
  data.d01.facts=unit(values.facts).replace('จัดซื้อวัสดุสำนักงาน จำนวน 4 รายการ','{{action}}{{item}}');
  data.d01.subject=data.d01.subject.replaceAll('วัสดุสำนักงาน','{{item}}');
  const aliases={...data.common,...Object.fromEntries(['proposer','proposerPosition','director','directorPosition','secretary','secretaryPosition','secretaryActing','authority','authorityPosition','authorityActing'].map(key=>[key,values[key]]))};
  for(const key of d01OwnKeys)if(!['number','day','month','year'].includes(key)){
   data.d01[key]=data.d01[key].replace(/จัดซื้อวัสดุสำนักงาน\s*จำนวน\s*[24]\s*รายการ/g,'{{action}}{{item}}').replaceAll('วัสดุสำนักงาน','{{category}}').replace(/จัดซื้อ(?!จัดจ้าง)/g,'{{action}}');
   for(const field of ['organization','unit','proposer','proposerPosition','director','secretary','authority'].sort((a,b)=>(aliases[b]?.length||0)-(aliases[a]?.length||0)))if(aliases[field])data.d01[key]=data.d01[key].replaceAll(aliases[field],'{{'+field+'}}');
  }
 }
 const latest=[...snapshot.cases].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt))[0];
 const shared=['department','organization','organizationAddress','organizationPhone','unit','category','budgetYear','recipient','directorRecipient','secretaryRecipient','proposer','proposerPosition','director','directorPosition','secretary','secretaryPosition','secretaryActing','authority','authorityPosition','authorityActing'];
 for(const key of shared)data.common[key]=latest?.common[key]||'';
 return {data,source:latest?'หน่วยงานและรายชื่อใช้ข้อมูลจากงานล่าสุดที่บันทึกไว้ ตรวจอีกครั้งก่อนใช้':'มีข้อความแม่แบบให้แล้ว ช่องข้อมูลจริงยังว่าง ข้อความสีจางเป็นตัวอย่างเท่านั้น',ready:{D01:!!snapshot.templates?.D01.ready,D07:snapshot.template.ready}};
}
