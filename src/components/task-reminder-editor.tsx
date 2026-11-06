'use client';
import {useEffect,useRef,useState} from 'react';
import type {OfficeInput} from '@/lib/office';
import {calculateTaskDue,taskAlertSettingsSchema,type TaskAlertSettings} from '@/lib/task-alerts';
import {getTaskAlertSettings} from '@/app/task-alert-actions';
export function TaskReminderEditor({value,onChange}:{value:OfficeInput;onChange:(patch:Partial<OfficeInput>)=>void}){
 const [settings,setSettings]=useState<TaskAlertSettings>(taskAlertSettingsSchema.parse({})),[ready,setReady]=useState(false),[error,setError]=useState('');
 async function load(){try{setSettings((await getTaskAlertSettings()).settings);setReady(true);setError('')}catch{setError('โหลดแม่แบบและวันหยุดไม่สำเร็จ ลองใหม่ก่อนคำนวณกำหนด')}}
 useEffect(()=>{void load();const refresh=()=>void load();window.addEventListener('sarabun-task-alert-settings-changed',refresh);return()=>window.removeEventListener('sarabun-task-alert-settings-changed',refresh)},[]);
 const calculationKey=JSON.stringify([value.date,value.taskDeadline]);
 const previousCalculation=useRef(calculationKey);
 let calculated='';try{if(ready&&value.taskDeadline.mode==='duration')calculated=calculateTaskDue(value.date,value.taskDeadline,settings.holidays)}catch{}
 useEffect(()=>{
  // Keep an existing agreed deadline when merely opening the form. Recalculate
  // only after a counting input changes (or when no deadline has been set).
  if(!ready)return;
  const changed=previousCalculation.current!==calculationKey;
  previousCalculation.current=calculationKey;
  if(calculated&&(changed||!value.due)&&value.due!==calculated)onChange({due:calculated});
 },[ready,calculationKey,calculated,value.due,onChange]);
 const reminder=value.taskReminder,rule=value.taskDeadline;
 function deadline(patch:Partial<typeof rule>){onChange({taskDeadline:{...rule,...patch}})}
 return <details className="task-reminder-editor" open={rule.mode==='duration'}><summary>กำหนดเวลาและการแจ้งเตือน</summary>
  {error&&<p role="alert">{error}<button type="button" onClick={()=>void load()}>ลองใหม่</button></p>}
  <fieldset disabled={!ready}>
   <label>วิธีกำหนดวันเสร็จ<select value={rule.mode} onChange={e=>deadline({mode:e.target.value as 'manual'|'duration'})}><option value="manual">เลือกกำหนดเสร็จเอง</option><option value="duration">นับระยะเวลาจากวันเริ่ม</option></select></label>
   {rule.mode==='duration'&&<>
    <label>เลือกแม่แบบระยะเวลา<select value={rule.ruleId} onChange={e=>{const selected=settings.rules.find(r=>r.id===e.target.value);deadline(selected?{...selected,ruleId:selected.id}:{ruleId:''})}}><option value="">กำหนดเอง</option>{settings.rules.map(r=><option key={r.id} value={r.id}>{r.label}</option>)}</select></label>
    <div className="task-alert-grid">
     <label>ระยะเวลาดำเนินงาน (วัน)<input type="number" min={1} max={3660} value={rule.days} onChange={e=>deadline({days:Number(e.target.value)})}/></label>
     <label>ประเภทวัน<select value={rule.count} onChange={e=>deadline({count:e.target.value as 'calendar'|'business'})}><option value="calendar">วันปฏิทิน</option><option value="business">วันทำการ</option></select></label>
     <label>วิธีเริ่มนับ<select value={rule.start} onChange={e=>deadline({start:e.target.value as 'include'|'next'})}><option value="next">เริ่มนับวันถัดไป</option><option value="include">รวมวันเริ่มเป็นวันแรก</option></select></label>
    </div>
    <label>ระเบียบ / คำสั่ง / แหล่งอ้างอิง<textarea rows={2} maxLength={2000} value={rule.reference} onChange={e=>deadline({reference:e.target.value})}/></label>
    <p className="task-deadline-preview" role="status">{calculated?'กำหนดเสร็จ '+(value.due||calculated):'ระบุวันเริ่มนับและระยะเวลาให้ครบ'}</p>
    {calculated&&value.due&&value.due!==calculated&&<small>ตามวันหยุดปัจจุบันจะคำนวณได้ {calculated} ระบบยังคงกำหนดเดิมไว้จนกว่าจะปรับวันเริ่มหรือระยะเวลา</small>}
    <small>ใช้ช่องวันเริ่มด้านบนเป็นวันเริ่มนับ ตรวจวันครบกำหนดกับระเบียบที่อ้างอิงก่อนบันทึก</small>
   </>}
   <label className="task-alert-check"><input type="checkbox" checked={reminder.enabled} onChange={e=>onChange({taskReminder:{...reminder,enabled:e.target.checked}})}/>แจ้งเตือนงานนี้เมื่อยังไม่เสร็จ</label>
   {reminder.enabled&&<>
    <label className="task-alert-check"><input type="checkbox" checked={reminder.offsets===null} onChange={e=>onChange({taskReminder:{...reminder,offsets:e.target.checked?null:[...settings.offsets]}})}/>ใช้วันเตือนล่วงหน้าจากตั้งค่า ({settings.offsets.join(', ')||'ไม่มี'})</label>
    {reminder.offsets!==null&&<div className="task-reminder-offsets" role="group" aria-label="เตือนก่อนกำหนด">{[...new Set([7,3,1,0,...reminder.offsets])].sort((a,b)=>b-a).map(day=><label className="task-alert-check" key={day}><input type="checkbox" checked={reminder.offsets!.includes(day)} onChange={e=>onChange({taskReminder:{...reminder,offsets:e.target.checked?[...reminder.offsets!,day]:reminder.offsets!.filter(n=>n!==day)}})}/>{day===0?'วันครบกำหนด':day+' วัน'}</label>)}</div>}
    <div className="task-reminder-dates">{reminder.dates.map((date,index)=><div key={index}><label>วันเตือนเฉพาะที่ {index+1}<input type="date" value={date} onChange={e=>onChange({taskReminder:{...reminder,dates:reminder.dates.map((v,i)=>i===index?e.target.value:v)}})}/></label><button type="button" aria-label={'ลบวันเตือนที่ '+(index+1)} onClick={()=>onChange({taskReminder:{...reminder,dates:reminder.dates.filter((_,i)=>i!==index)}})}>ลบ</button></div>)}</div>
    <button type="button" disabled={reminder.dates.length>=12} onClick={()=>onChange({taskReminder:{...reminder,dates:[...reminder.dates,'']}})}>เพิ่มวันเตือนที่กำหนดเอง</button>
   </>}
   <button type="button" onClick={()=>window.dispatchEvent(new Event('sarabun-task-alert-settings'))}>จัดการแม่แบบและวันหยุด</button>
  </fieldset>
 </details>;
}
