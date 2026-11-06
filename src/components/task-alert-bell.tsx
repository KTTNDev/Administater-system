'use client';
import {useEffect,useRef,useState} from 'react';
import {Bell,RefreshCw,Settings2,X} from 'lucide-react';
import type {OfficeItem} from '@/lib/office';
import {shiftDay} from '@/lib/task-alerts';
import {getTaskAlerts,updateTaskAlert,type TaskAlertSnapshot} from '@/app/task-alert-actions';
import {TaskAlertSettingsDialog} from './task-alert-settings';
type Alert=TaskAlertSnapshot['alerts'][number];
export function TaskAlertBell({onOpenTask}:{onOpenTask:(task:OfficeItem)=>boolean}){
 const [snapshot,setSnapshot]=useState<TaskAlertSnapshot|null>(null),[open,setOpen]=useState(false),[settingsOpen,setSettingsOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [snoozeDates,setSnoozeDates]=useState<Record<string,string>>({});
 const root=useRef<HTMLDivElement>(null),button=useRef<HTMLButtonElement>(null),serial=useRef(0),mutating=useRef(false);
 async function load(){
  if(mutating.current)return;const request=++serial.current;
  try{const data=await getTaskAlerts();if(serial.current===request){setSnapshot(data);setError('')}}catch{if(serial.current===request)setError('โหลดแจ้งเตือนไม่สำเร็จ ลองรีเฟรชกระดิ่ง')}
 }
 useEffect(()=>{
  void load();
  const refresh=()=>{if(!document.hidden)void load()};
  const settings=()=>{setOpen(false);setSettingsOpen(true)};
  const timer=setInterval(refresh,60000);
  for(const event of ['focus','sarabun-office-change','sarabun-task-alert-settings-changed'])window.addEventListener(event,refresh);
  document.addEventListener('visibilitychange',refresh);window.addEventListener('sarabun-task-alert-settings',settings);
  return()=>{serial.current++;clearInterval(timer);for(const event of ['focus','sarabun-office-change','sarabun-task-alert-settings-changed'])window.removeEventListener(event,refresh);document.removeEventListener('visibilitychange',refresh);window.removeEventListener('sarabun-task-alert-settings',settings)};
 },[]);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false)};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);button.current?.focus()}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape)};
 },[open]);
 async function act(alert:Alert,operation:'ack'|'snooze'|'resume'){
  if(mutating.current)return;mutating.current=true;serial.current++;setBusy(true);setError('');
  try{
   const result=await updateTaskAlert({id:alert.id,taskId:alert.task.id,phase:alert.phase,operation,until:operation==='snooze'?(snoozeDates[alert.id]||shiftDay(snapshot!.today,1)):''});
   if(!result.ok)throw Error(result.error);setSnapshot(result.data);
  }catch(e){setError(e instanceof Error?e.message:'อัปเดตไม่สำเร็จ')}finally{mutating.current=false;setBusy(false)}
 }
 const active=snapshot?.alerts.filter(a=>!a.snoozed)||[],snoozed=snapshot?.alerts.filter(a=>a.snoozed)||[],unread=active.filter(a=>!a.acknowledged).length;
 const groups=[{label:'เกินกำหนด',rows:active.filter(a=>a.remaining!==null&&a.remaining<0)},{label:'ครบกำหนดวันนี้',rows:active.filter(a=>a.remaining===0)},{label:'ใกล้ครบกำหนด',rows:active.filter(a=>a.remaining!==null&&a.remaining>0)},{label:'ถึงวันที่นัดเตือน',rows:active.filter(a=>a.remaining===null)}];
 function entry(alert:Alert){
  return <article className="task-alert-item" data-read={alert.acknowledged} key={alert.id}>
   <button type="button" className="task-alert-open" disabled={busy} onClick={()=>{if(onOpenTask(alert.task))setOpen(false)}}><strong>{alert.task.title}</strong><span>{alert.task.owner||'ยังไม่ระบุผู้รับผิดชอบ'} · {alert.task.due||'ไม่ระบุกำหนดเสร็จ'}</span></button>
   <p className={alert.remaining!==null&&alert.remaining<0?'is-late':''}>{alert.remaining===null?'ถึงวันที่ตั้งเตือนไว้':alert.remaining<0?'เกินกำหนด '+(-alert.remaining)+' วัน':alert.remaining===0?'ครบกำหนดวันนี้':'เหลือ '+alert.remaining+' วัน'}{alert.acknowledged?' · รับทราบแล้ว':''}</p>
   {alert.task.taskDeadline.reference&&<details><summary>ที่มาของกำหนด</summary><p>{alert.task.taskDeadline.reference}</p></details>}
   <div className="task-alert-item-actions">
    {!alert.acknowledged&&!alert.snoozed&&<button type="button" disabled={busy} onClick={()=>void act(alert,'ack')}>รับทราบ</button>}
    {alert.snoozed?<><span>พักเตือนถึง {alert.snoozeUntil}</span><button type="button" disabled={busy} onClick={()=>void act(alert,'resume')}>กลับมาเตือน</button></>:<details><summary>เตือนอีกครั้งวันที่…</summary><label>วันเตือนอีกครั้ง<input type="date" min={shiftDay(snapshot!.today,1)} value={snoozeDates[alert.id]||shiftDay(snapshot!.today,1)} onChange={e=>setSnoozeDates(v=>({...v,[alert.id]:e.target.value}))}/></label><button type="button" disabled={busy} onClick={()=>void act(alert,'snooze')}>เลื่อนเตือน</button></details>}
   </div>
  </article>;
 }
 return <div className="task-alert-bell" ref={root}>
  <button type="button" className="task-alert-trigger" ref={button} aria-label="แจ้งเตือนงาน" aria-expanded={open} aria-controls="task-alert-panel" onClick={()=>setOpen(v=>!v)}><Bell size={18}/>{unread>0&&<span className="task-alert-badge" aria-hidden="true">{unread>99?'99+':unread}</span>}</button>
  <span className="task-alert-sr" role="status" aria-live="polite" aria-atomic="true">{unread?'งานที่ยังไม่รับทราบ '+unread+' รายการ':'ไม่มีแจ้งเตือนงานที่ยังไม่รับทราบ'}</span>
  {open&&<section className="task-alert-panel" id="task-alert-panel" aria-label="รายการแจ้งเตือนงาน" aria-busy={busy}>
   <header><h2>แจ้งเตือนงาน</h2><button type="button" aria-label="รีเฟรชแจ้งเตือน" disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/></button><button type="button" aria-label="ตั้งค่าการแจ้งเตือนงาน" disabled={!snapshot||busy} onClick={()=>{setOpen(false);setSettingsOpen(true)}}><Settings2 size={16}/></button><button type="button" aria-label="ปิดแจ้งเตือนงาน" onClick={()=>{setOpen(false);button.current?.focus()}}><X size={17}/></button></header>
   {error&&<p role="alert" className="task-alert-error">{error}</p>}
   {!snapshot?<p className="task-alert-empty">กำลังโหลดรายการ…</p>:<>
    {!snapshot.settings.enabled&&<p className="task-alert-empty">ปิดการแจ้งเตือนอยู่ เปิดได้ในตั้งค่ากระดิ่ง</p>}
    {groups.filter(g=>g.rows.length).map(g=><section key={g.label}><h3>{g.label} <span>{g.rows.length}</span></h3>{g.rows.map(entry)}</section>)}
    {!active.length&&snapshot.settings.enabled&&<p className="task-alert-empty">ยังไม่มีงานถึงช่วงเตือน</p>}
    {snoozed.length>0&&<details className="task-alert-snoozed"><summary>รายการที่เลื่อนเตือน ({snoozed.length})</summary>{snoozed.map(entry)}</details>}
    <footer>กดรับทราบเพื่อจัดการตัวเลขกระดิ่ง งานที่ยังไม่เสร็จจะอยู่ในรายการติดตาม และตรวจใหม่เมื่อเปิดระบบ</footer>
   </>}
  </section>}
  {settingsOpen&&snapshot&&<TaskAlertSettingsDialog snapshot={snapshot} onSaved={setSnapshot} onClose={()=>{setSettingsOpen(false)}}/>}
 </div>;
}
