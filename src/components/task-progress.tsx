'use client';
import {Plus,Trash2} from 'lucide-react';
import type {OfficeInput} from '@/lib/office';
import {taskProgress} from '@/lib/task-progress';

export function TaskProgress({task}:{task:OfficeInput}){
 const progress=taskProgress(task);return <span className="task-progress-mini"><span><b>{progress.percent}%</b><span>{progress.automatic?`${progress.done}/${progress.total} รายการย่อย`:'ระบุความคืบหน้าเอง'}</span></span><progress aria-label={'ความคืบหน้า: '+task.title} value={progress.percent} max={100}/></span>;
}
export function TaskProgressEditor({value,onChange}:{value:OfficeInput;onChange:(patch:Partial<OfficeInput>)=>void}){
 const progress=taskProgress(value),closed=value.status==='done';
 function patch(input:Partial<OfficeInput>){
  const next={...value,...input};
  const started=next.taskTracking==='checklist'?next.taskChecklist.some(s=>s.done):next.taskPercent>0;
  onChange({...input,...(value.status==='new'&&started?{status:'working' as const}:{})});
 }
 function update(id:string,input:Partial<OfficeInput['taskChecklist'][number]>){patch({taskChecklist:value.taskChecklist.map(s=>s.id===id?{...s,...input}:s)});}
 function changeMode(mode:OfficeInput['taskTracking']){
  // Preserve the current percentage when leaving automatic calculation. Empty
  // placeholder rows are discarded so hidden inputs cannot block a manual save.
  patch(mode==='manual'?{taskTracking:mode,taskPercent:progress.percent,taskChecklist:value.taskChecklist.filter(step=>step.title.trim())}:{taskTracking:mode});
 }
 return <section className="task-tracker-editor" aria-label="ติดตามความคืบหน้างาน">
  <div className="task-tracker-heading"><h3>ความคืบหน้าของงาน</h3><strong>{progress.percent}%</strong></div>
  <progress aria-label="ความคืบหน้าของงานที่กำลังแก้ไข" value={progress.percent} max={100}/>
  <label>วิธีติดตามความคืบหน้า<select aria-label="วิธีติดตามความคืบหน้า" disabled={closed} value={value.taskTracking} onChange={e=>changeMode(e.target.value as OfficeInput['taskTracking'])}><option value="manual">กำหนดเปอร์เซ็นต์เอง</option><option value="checklist">คำนวณจากรายการย่อย</option></select></label>
  {closed&&<p className="task-tracker-note">งานปิดแล้ว หากต้องการแก้เปอร์เซ็นต์หรือรายการย่อย ให้เปลี่ยนสถานะเป็นกำลังดำเนินการก่อน</p>}
  {value.taskTracking==='manual'?<label>ความคืบหน้าที่ประเมิน (%)<input type="number" min="0" max="100" step="1" disabled={closed} value={value.taskPercent} onChange={e=>{const amount=Number(e.target.value);if(Number.isInteger(amount)&&amount>=0&&amount<=100)patch({taskPercent:amount});}}/></label>:<div className="task-checklist-editor">
   <div className="task-checklist-summary">เสร็จ {progress.done} จาก {progress.total} รายการ · แต่ละรายการมีน้ำหนักเท่ากัน</div>
   {value.taskChecklist.map((step,index)=><div className="task-checklist-row" key={step.id}><input type="checkbox" disabled={closed} aria-label={`เสร็จรายการย่อย ${index+1}`} checked={step.done} onChange={e=>update(step.id,{done:e.target.checked})}/><input aria-label={`ชื่อรายการย่อย ${index+1}`} required maxLength={300} disabled={closed} value={step.title} onChange={e=>update(step.id,{title:e.target.value})} placeholder="เช่น รวบรวมข้อมูลจากผู้เกี่ยวข้อง"/><button type="button" aria-label={`ลบรายการย่อย ${index+1}`} disabled={closed} onClick={()=>patch({taskChecklist:value.taskChecklist.filter(s=>s.id!==step.id)})}><Trash2 size={16}/></button></div>)}
   <button type="button" disabled={closed||value.taskChecklist.length>=50} onClick={()=>patch({taskChecklist:[...value.taskChecklist,{id:crypto.randomUUID(),title:'',done:false}]})}><Plus size={16}/>เพิ่มรายการย่อย</button>
   <p className="task-tracker-note">ครบ 100% หมายถึงรายการย่อยครบแล้ว เลือกสถานะ “เสร็จสิ้น” เมื่อพร้อมปิดงาน</p>
  </div>}
  <label>ขั้นตอนถัดไป<textarea rows={2} maxLength={2000} value={value.nextStep} onChange={e=>onChange({nextStep:e.target.value})} placeholder="กลับมาเปิดงานครั้งหน้า ต้องทำอะไรต่อ"/></label>
  {(value.status==='waiting'||value.waitingFor)&&<label>สิ่งที่กำลังรอ / ปัญหาที่ติดอยู่<textarea rows={2} maxLength={2000} value={value.waitingFor} onChange={e=>onChange({waitingFor:e.target.value})} placeholder="เช่น รอข้อมูลจากหน่วยงาน หรือรอผู้บังคับบัญชาพิจารณา"/></label>}
 </section>;
}
