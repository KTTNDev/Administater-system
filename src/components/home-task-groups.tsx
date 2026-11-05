'use client';
import type {ReactNode} from 'react';
import type {OfficeItem} from '@/lib/office';

export function HomeTaskGroups({tasks,day,weekEnd,renderRows}:{tasks:OfficeItem[];day:string;weekEnd:string;renderRows:(tasks:OfficeItem[])=>ReactNode}){
 const groups=[
  {id:'late',label:'เกินกำหนด',items:tasks.filter(t=>t.status!=='done'&&t.due&&t.due<day)},
  {id:'today',label:'ครบกำหนดวันนี้',items:tasks.filter(t=>t.status!=='done'&&t.due===day)},
  {id:'week',label:'ภายใน 7 วัน',items:tasks.filter(t=>t.status!=='done'&&t.due>day&&t.due<=weekEnd)},
  {id:'later',label:'งานถัดไป',items:tasks.filter(t=>t.status!=='done'&&t.due>weekEnd)},
  {id:'undated',label:'ยังไม่กำหนดวัน',items:tasks.filter(t=>t.status!=='done'&&!t.due)},
  {id:'done',label:'ทำเสร็จแล้ว',items:tasks.filter(t=>t.status==='done')},
 ];
 return <div className="home-task-scroll" role="region" aria-label="รายการ To-do แบ่งตามกำหนดส่ง" tabIndex={0}>
  {!tasks.length&&renderRows([])}
  {groups.filter(group=>group.items.length).map(group=><details className="home-task-group" data-task-group={group.id} key={group.id} open>
   <summary><span>{group.label}</span><small>{group.items.length} งาน</small></summary>
   {renderRows(group.items)}
  </details>)}
 </div>;
}
