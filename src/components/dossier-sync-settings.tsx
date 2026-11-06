'use client';
import {useEffect,useRef,useState,useTransition} from 'react';
import {CloudUpload,RefreshCw,Pause,CheckCircle2,AlertCircle,ExternalLink} from 'lucide-react';
import {getDossierSync,prepareDriveDossiers,retryDriveDossiers,advanceDriveDossiers} from '@/app/dossier-sync-actions';
import type {DossierJob} from '@/lib/dossier-sync';
import s from './data-location-settings.module.css';
const statusText={pending:'รอส่ง / ตรวจไฟล์',uploading:'กำลังส่ง',synced:'ตรวจไฟล์ตรงกันแล้ว',failed:'ยังไม่สำเร็จ'};
export function DossierSyncSettings({connected}:{connected:boolean}){
 const [job,setJob]=useState<DossierJob|null>(null),[message,setMessage]=useState(''),[query,setQuery]=useState(''),[onlyProblems,setOnlyProblems]=useState(false),[visible,setVisible]=useState(10),[running,setRunning]=useState(false),[pending,start]=useTransition(),stop=useRef(false);
 useEffect(()=>{getDossierSync().then(r=>{if(r.ok)setJob(r.data);else setMessage(r.error);});return()=>{stop.current=true;};},[]);
 function prepare(){start(async()=>{setMessage('กำลังตรวจไฟล์ในเครื่อง…');const r=await prepareDriveDossiers();if(r.ok){setJob(r.data);setMessage(`เตรียม ${r.data.entries.length} ไฟล์แล้ว ยังไม่ได้ส่งขึ้น Drive`);setVisible(10);}else setMessage(r.error);});}
 async function sync(){if(!job)return;stop.current=false;setRunning(true);setMessage('');try{
  const retry=await retryDriveDossiers(job.id);if(!retry.ok)throw Error(retry.error);let next=retry.data;setJob(next);
  while(next.cursor<next.queue.length&&!stop.current){const current=next.entries[next.queue[next.cursor]];setMessage('กำลังส่ง / ตรวจ '+current.ownerLabel+' · '+current.name);setJob({...next,entries:next.entries.map((e,i)=>i===next.queue[next.cursor]?{...e,status:'uploading'}:e)});const r=await advanceDriveDossiers(next.id);if(!r.ok)throw Error(r.error);next=r.data;setJob(next);if(next.pauseReason)break;}
  const ok=next.entries.filter(e=>e.status==='synced').length;
  setMessage(next.pauseReason|| (stop.current?'หยุดแล้ว กดทำต่อได้โดยไม่ส่งไฟล์สำเร็จซ้ำ':`ตรวจสำเร็จ ${ok} / ${next.entries.length} ไฟล์${ok<next.entries.length?' · ดูรายการที่ยังไม่สำเร็จด้านล่าง':''}`));
 }catch(e){setMessage(e instanceof Error?e.message:'ส่งไฟล์ไม่สำเร็จ');const r=await getDossierSync();if(r.ok)setJob(r.data);}finally{setRunning(false);}}
 const done=job?.entries.filter(e=>e.status==='synced').length||0,failed=job?.entries.filter(e=>e.status==='failed').length||0,busy=pending||running;
 const groups=new Map<string,{name:string;entries:NonNullable<typeof job>['entries']}>();
 for(const e of job?.entries||[]){if(onlyProblems&&e.status==='synced')continue;if(query&&!`${e.ownerLabel} ${e.name}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()))continue;const key=e.ownerKind+e.ownerId;if(!groups.has(key))groups.set(key,{name:e.ownerLabel,entries:[]});groups.get(key)!.entries.push(e);}
 return <section className={s.root} aria-label="ซิงก์แฟ้มงานรายเรื่องขึ้น Drive">
  <div className={s.heading}><CloudUpload size={23}/><div><h3>แฟ้มงานบน Google Drive</h3><p>แยกเรื่องและหมวดเหมือนแฟ้มในเครื่อง</p></div></div>
  <p>เก็บข้อมูลร่าง ไฟล์แนบ รูปภาพ ฉบับลงนาม และ PDF/Word รุ่นปัจจุบันที่เคยส่งออก รวมแบบฟอร์มพัสดุ รูปเล่มโครงการ และรายงานช่วงเวลา PDF/CSV เป็นสำเนาเก็บงาน ไม่เปลี่ยนสถานะตรวจทานหรือเลขทะเบียน และไม่ส่งหนังสือลับหรือรายการในถังขยะ</p>
  <div className={s.actions}><button type="button" disabled={busy||!connected} onClick={prepare}><RefreshCw size={16}/>เตรียมรายการจากแฟ้มในเครื่อง</button><button type="button" className="primary" disabled={busy||!job?.entries.length||!connected||done===job.entries.length} onClick={()=>void sync()}><CloudUpload size={16}/>{job?.cursor?'ทำต่อ / ลองไฟล์ที่ค้างใหม่':'เริ่มซิงก์แฟ้มงาน'}</button>{running&&<button type="button" onClick={()=>{stop.current=true;setMessage('จะหยุดเมื่อรายการที่กำลังส่งเสร็จ');}}><Pause size={16}/>หยุดหลังรายการนี้</button>}</div>
  {!connected&&<p>เชื่อมบัญชีในหมวด Google Drive แล้วบันทึกโฟลเดอร์ปลายทางก่อน</p>}
  {job&&<><div className={s.syncProgress}><span><CheckCircle2 size={15}/> สำเร็จ {done} / {job.entries.length} ไฟล์</span>{failed>0&&<span><AlertCircle size={15}/> ยังไม่สำเร็จ {failed}</span>}<progress value={done} max={job.entries.length||1} aria-label="ไฟล์ที่ตรวจสำเร็จบน Drive"/></div>
  {job.rootChecked&&!job.permissionsVerified&&<p className={s.warning}>Google ไม่เปิดเผยสิทธิ์แชร์ของโฟลเดอร์ให้แอปตรวจ โปรดตรวจสิทธิ์แชร์ใน Drive ให้เหมาะกับข้อมูลงาน</p>}
  {job.skipped.length>0&&<details><summary>รายการที่ยังไม่ส่ง {job.skipped.length} รายการ</summary><ul>{job.skipped.map((item,i)=><li key={i}>{item.label} — {item.reason}</li>)}</ul></details>}
  <div className={s.syncFilters}><label>ค้นหาเรื่องหรือชื่อไฟล์<input value={query} onChange={e=>{setQuery(e.target.value);setVisible(10);}} placeholder="ค้นหาในรายการซิงก์"/></label><label className={s.confirm}><input type="checkbox" checked={onlyProblems} onChange={e=>setOnlyProblems(e.target.checked)}/>เฉพาะที่ยังไม่สำเร็จ</label></div>
  <div className={s.syncList}>{[...groups.entries()].slice(0,visible).map(([key,group])=><details key={key}><summary>{group.name}<span>{group.entries.filter(e=>e.status==='synced').length}/{group.entries.length} ไฟล์</span></summary>{group.entries.map(e=><div className={s.syncFile} key={e.key}><div><strong>{e.name}</strong><small>{e.groups.join(' / ')} / {e.subfolders.join(' / ')}</small><span data-state={e.status}>{statusText[e.status]}{e.verifiedAt?' · '+new Date(e.verifiedAt).toLocaleString('th-TH'):''}</span>{e.error&&<p className={s.error}>{e.error}</p>}</div>{e.fileId&&<a href={'https://drive.google.com/file/d/'+encodeURIComponent(e.fileId)+'/view'} target="_blank" rel="noreferrer" aria-label={'เปิด '+e.name+' บน Drive'}><ExternalLink size={16}/></a>}</div>)}</details>)}</div>{groups.size>visible&&<button type="button" onClick={()=>setVisible(n=>n+10)}>แสดงอีก 10 เรื่อง</button>}
  <p>การตรวจสำเร็จอ้างอิงเวลาที่แสดง หากแก้ร่างหรือแนบไฟล์เพิ่ม ให้เตรียมรายการใหม่ ระบบคงไฟล์รุ่นเก่าบน Drive และไม่ลบไฟล์ที่นำออกจากร่างอัตโนมัติ</p></>}
  {message&&<p role="status" className={s.message}>{message}</p>}
 </section>;
}
