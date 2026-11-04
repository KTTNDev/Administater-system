'use client';
import type {OfficeItem} from '@/lib/office';
import {taskProgress} from '@/lib/task-progress';
const labels={new:'ยังไม่เริ่ม',working:'กำลังทำ',waiting:'รอผล / ประสาน',done:'เสร็จแล้ว'} as const;
export function TaskOverview({tasks,onFilter}:{tasks:OfficeItem[];onFilter:(status:OfficeItem['status'])=>void}){
 const percent=tasks.length?Math.round(tasks.reduce((sum,t)=>sum+taskProgress(t).percent,0)/tasks.length):0;
 return <section className="task-overview" aria-label="ภาพรวมความคืบหน้างาน"><div className="task-overview-total"><div><span>ความคืบหน้าเฉลี่ย</span><strong>{tasks.length?percent+'%':'—'}</strong></div><progress value={percent} max={100} aria-label="ความคืบหน้าเฉลี่ยทุกงานที่เลือก"/><small>{tasks.length} งาน · ไม่รวมรายการที่เก็บไว้และโครงการที่พักไว้</small></div><div className="task-status-counts">{Object.entries(labels).map(([status,label])=><button type="button" key={status} data-task-status={status} onClick={()=>onFilter(status as OfficeItem['status'])}><strong>{tasks.filter(t=>t.status===status).length}</strong><span>{label}</span></button>)}</div></section>;
}
