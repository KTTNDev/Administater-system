import type {ProcurementCase} from './procurement';
import {billValues} from './procurement-bill';
import {today} from './document';
export const contractStatusNames={unplanned:'ยังไม่กำหนดวัน',overdue:'เกินกำหนด',today:'ครบกำหนดวันนี้',soon:'ใกล้ครบกำหนด',scheduled:'รอดำเนินการ',fulfilled:'ตรวจรับแล้ว รอดำเนินการคลัง',closed:'เสร็จงานแล้ว'} as const;
export type ContractStatus=keyof typeof contractStatusNames;
export type ContractDate={id:string;caseId:string;taskId:string;date:string;title:string;caseTitle:string;vendor:string;number:string;amount:string;owner:string;done:boolean;status:ContractStatus;waiting:string[];url:string};
const valid=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value;
export function contractStatus(date:string,done=false,closed=false,asOf=today()):ContractStatus{
 if(closed)return 'closed';if(done)return 'fulfilled';if(!valid(date))return 'unplanned';const days=Math.round((Date.parse(date)-Date.parse(asOf))/86400000);return days<0?'overdue':days===0?'today':days<=7?'soon':'scheduled';
}
/** A live projection: no duplicate calendar rows and no changes to the source case. */
export function procurementContractDates(cases:ProcurementCase[],asOf=today()):ContractDate[]{
 return cases.filter(record=>!record.sample).flatMap(record=>{
  const closed=record.workflow.state==='closed',done=record.inspection.result==='complete'&&record.tasks.every(t=>t.done),base={caseId:record.id,caseTitle:record.title,vendor:record.common.vendor||'',number:record.documents.E01?.number||record.documents.D09?.number||record.common.orderNumber||'',amount:billValues(record).agreed||'',url:'/?view=procurement&case='+encodeURIComponent(record.id)+'&step=contract'};
  const dates:ContractDate[]=[{...base,id:'contract:'+record.id,taskId:'',date:valid(record.contractDue)?record.contractDue:'',title:'ครบกำหนดสัญญา · '+record.title,owner:record.common.proposer||'',done:closed||done,status:contractStatus(record.contractDue,done,closed,asOf),waiting:[]}];
  for(const task of record.tasks){dates.push({...base,id:'contract:'+record.id+':task:'+task.id,taskId:task.id,date:valid(task.due)?task.due:'',title:task.title,owner:task.owner,done:closed||task.done,status:contractStatus(task.due,task.done,closed,asOf),waiting:closed?[]:task.dependsOn.map(id=>record.tasks.find(t=>t.id===id)).filter(t=>t&&!t.done).map(t=>t!.title)});}
  return dates;
 }).sort((a,b)=>Number(a.done)-Number(b.done)||(a.date||'9999').localeCompare(b.date||'9999')||a.id.localeCompare(b.id));
}
