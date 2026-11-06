'use client';
import {useEffect,useRef,useState} from 'react';
import {Plus,Trash2,X} from 'lucide-react';
import {taskAlertSettingsSchema,type TaskAlertSettings} from '@/lib/task-alerts';
import {saveTaskAlertSettings,type TaskAlertSnapshot} from '@/app/task-alert-actions';
export function TaskAlertSettingsDialog({snapshot,onSaved,onClose}:{snapshot:TaskAlertSnapshot;onSaved:(data:TaskAlertSnapshot)=>void;onClose:()=>void}){
 const dialog=useRef<HTMLDialogElement>(null);
 // Polling may refresh the parent's snapshot while this dialog is open. Keep
 // the original version so a concurrent edit cannot be silently overwritten.
 const [baseline]=useState(snapshot);
 const [value,setValue]=useState(snapshot.settings),[days,setDays]=useState(snapshot.settings.offsets.join(', ')),[holidays,setHolidays]=useState(snapshot.settings.holidays.join('\n'));
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 const dirty=JSON.stringify(value)!==JSON.stringify(baseline.settings)||days!==baseline.settings.offsets.join(', ')||holidays!==baseline.settings.holidays.join('\n');
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;dialog.current?.showModal();return()=>{dialog.current?.close();previous?.focus({preventScroll:true})}},[]);
 useEffect(()=>{if(!dirty)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[dirty]);
 function close(){if(busy)return;if(dirty&&!confirm('มีการตั้งค่ายังไม่บันทึก ต้องการปิดหรือไม่?'))return;onClose()}
 function patch(update:Partial<TaskAlertSettings>){setValue(v=>({...v,...update}))}
 async function save(){
  setError('');
  const offsets=days.trim()?days.split(',').map(v=>Number(v.trim())):[];
  if(offsets.some(n=>!Number.isInteger(n)||n<0||n>365)){setError('วันเตือนต้องเป็นจำนวนเต็ม 0–365 คั่นด้วยเครื่องหมายจุลภาค');return}
  const parsed=taskAlertSettingsSchema.safeParse({...value,offsets:[...new Set(offsets)],holidays:[...new Set(holidays.split(/[\s,]+/).filter(Boolean))]});
  if(!parsed.success){setError(parsed.error.issues[0].message);return}
  setBusy(true);
  try{const result=await saveTaskAlertSettings(parsed.data,baseline.version);if(!result.ok)throw Error(result.error);onSaved(result.data);window.dispatchEvent(new Event('sarabun-task-alert-settings-changed'));onClose()}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ')}finally{setBusy(false)}
 }
 return <dialog className="task-alert-settings-dialog" ref={dialog} aria-label="ตั้งค่าการแจ้งเตือนงาน" onCancel={e=>{e.preventDefault();close()}}>
  <header><h2>ตั้งค่าการแจ้งเตือนงาน</h2><button type="button" aria-label="ปิดตั้งค่าแจ้งเตือน" disabled={busy} onClick={close}><X size={18}/></button></header>
  <fieldset disabled={busy}>
   <label className="task-alert-check"><input type="checkbox" checked={value.enabled} onChange={e=>patch({enabled:e.target.checked})}/>เปิดกระดิ่งแจ้งเตือนงาน</label>
   <div className="task-alert-grid">
    <label>งานที่ต้องการติดตาม<select value={value.owner} onChange={e=>patch({owner:e.target.value})}><option value="">ทุกผู้รับผิดชอบ</option>{[...new Set([...snapshot.owners,...(value.owner?[value.owner]:[])])].map(owner=><option key={owner}>{owner}</option>)}</select></label>
    <label>เตือนล่วงหน้า (วัน)<input aria-label="วันเตือนล่วงหน้าเริ่มต้น" value={days} onChange={e=>setDays(e.target.value)} placeholder="3, 1, 0"/><small>0 คือวันครบกำหนด ใช้เป็นค่าตั้งต้นของงาน</small></label>
   </div>
   <label className="task-alert-check"><input type="checkbox" checked={value.overdue} onChange={e=>patch({overdue:e.target.checked})}/>เตือนอีกครั้งเมื่อเกินกำหนด</label>
   <details><summary>วันหยุดเพิ่มเติมสำหรับการนับวันทำการ</summary><label>วันหยุด YYYY-MM-DD หนึ่งวันต่อบรรทัด<textarea rows={5} value={holidays} onChange={e=>setHolidays(e.target.value)}/></label><small>วันทำการข้ามเสาร์–อาทิตย์และวันที่ระบุ ตรวจวันหยุดพิเศษของปีที่ใช้งานด้วย</small></details>
   <section className="task-alert-rules"><h3>แม่แบบระยะเวลาดำเนินงาน</h3><p>เพิ่มจากระยะเวลาที่ตรวจสอบแล้ว ระบุระเบียบหรือคำสั่งที่อ้างอิงได้ การแก้แม่แบบมีผลกับงานที่เลือกใช้ครั้งถัดไป</p>
    {value.rules.map((rule,index)=><div className="task-alert-rule" key={rule.id}>
     <div className="task-alert-grid"><label>ชื่อแม่แบบ<input aria-label={'ชื่อแม่แบบที่ '+(index+1)} value={rule.label} maxLength={120} onChange={e=>patch({rules:value.rules.map(r=>r.id===rule.id?{...r,label:e.target.value}:r)})}/></label><label>ระยะเวลา (วัน)<input type="number" min={1} max={3660} value={rule.days} onChange={e=>patch({rules:value.rules.map(r=>r.id===rule.id?{...r,days:Number(e.target.value)}:r)})}/></label>
      <label>นับวัน<select value={rule.count} onChange={e=>patch({rules:value.rules.map(r=>r.id===rule.id?{...r,count:e.target.value as 'calendar'|'business'}:r)})}><option value="calendar">วันปฏิทิน</option><option value="business">วันทำการ</option></select></label>
      <label>วันเริ่มนับ<select value={rule.start} onChange={e=>patch({rules:value.rules.map(r=>r.id===rule.id?{...r,start:e.target.value as 'include'|'next'}:r)})}><option value="next">เริ่มวันถัดไป</option><option value="include">รวมวันเริ่มเป็นวันแรก</option></select></label>
     </div>
     <label>ระเบียบ / ข้อ / แหล่งอ้างอิง (ถ้ามี)<textarea rows={2} maxLength={2000} value={rule.reference} onChange={e=>patch({rules:value.rules.map(r=>r.id===rule.id?{...r,reference:e.target.value}:r)})}/></label>
     <button type="button" onClick={()=>patch({rules:value.rules.filter(r=>r.id!==rule.id)})}><Trash2 size={15}/>ลบแม่แบบ</button>
    </div>)}
    <button type="button" disabled={value.rules.length>=30} onClick={()=>patch({rules:[...value.rules,{id:crypto.randomUUID(),label:'',days:7,count:'calendar',start:'next',reference:''}]})}><Plus size={16}/>เพิ่มแม่แบบ</button>
   </section>
  </fieldset>
  {error&&<p role="alert" className="task-alert-error">{error}</p>}
  <footer><button type="button" disabled={busy} onClick={close}>ยกเลิก</button><button type="button" className="primary" disabled={busy} onClick={()=>void save()}>{busy?'กำลังบันทึก…':'บันทึกการแจ้งเตือน'}</button></footer>
 </dialog>;
}
