"use client";
import {useId,useMemo,useRef,useState} from 'react';
import {Check,FileText,Search,X} from 'lucide-react';
import {thaiDate,type SavedDraft} from '@/lib/document';
import {templates} from '@/lib/templates';
import {normalizeSearch} from '@/lib/correspondence';
import styles from './draft-link-picker.module.css';

type Props={documents:SavedDraft[];value:string;onChange:(id:string)=>void;disabled?:boolean;loading?:boolean};
const pageSize=8;
const typeName=(type:string)=>templates.find(t=>t.id===type)?.name||type;
export function DraftLinkPicker({documents,value,onChange,disabled=false,loading=false}:Props){
 const id=useId(),trigger=useRef<HTMLButtonElement>(null);
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[type,setType]=useState(''),[year,setYear]=useState(''),[page,setPage]=useState(0);
 const selected=documents.find(d=>d.id===value),missing=!!value&&!selected&&!loading;
 const sorted=useMemo(()=>[...documents].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)),[documents]);
 const years=useMemo(()=>[...new Set(documents.map(d=>d.date.slice(0,4)).filter(y=>/^\d{4}$/.test(y)))].sort().reverse(),[documents]);
 const matches=useMemo(()=>{
  const terms=normalizeSearch(query).split(' ').filter(Boolean);
  return sorted.filter(d=>(!type||d.type===type)&&(!year||d.date.startsWith(year+'-'))&&terms.every(term=>normalizeSearch([d.subject,d.number,d.department,d.recipient,d.date,thaiDate(d.date),typeName(d.type)].join(' ')).includes(term)));
 },[sorted,query,type,year]);
 const pages=Math.max(1,Math.ceil(matches.length/pageSize)),current=Math.min(page,pages-1);
 const visible=matches.slice(current*pageSize,(current+1)*pageSize),locked=disabled||loading;
 function close(){setOpen(false);trigger.current?.focus();}
 function choose(id:string){onChange(id);close();}
 function show(){setQuery('');setType('');setYear('');setPage(0);setOpen(true);}
 return <div className={styles.picker} aria-busy={loading} onKeyDown={event=>{if(open&&event.key==='Escape'){event.preventDefault();event.stopPropagation();close();}}}>
  <span id={id+'-label'} className={styles.label}>เชื่อมร่างหนังสือในระบบ</span>
  {selected?<div className={styles.selected}><Check size={17} aria-hidden="true"/><div><strong>{selected.subject}</strong><small>{selected.number||'ยังไม่มีเลขหนังสือ'} · {typeName(selected.type)} · {thaiDate(selected.date)||'ยังไม่ระบุวันที่'}</small></div></div>:missing?<p id={id+'-error'} role="alert" className={styles.error}>ร่างเดิมไม่อยู่ในรายการ เลือกร่างใหม่หรือยกเลิกการเชื่อม</p>:<p className={styles.hint}>ค้นจากชื่อเรื่อง เลขหนังสือ หรือหน่วยงาน</p>}
  <div className={styles.actions}>
   <button ref={trigger} type="button" disabled={locked} aria-expanded={open} aria-controls={id+'-panel'} aria-describedby={missing?id+'-error':undefined} onClick={()=>open?close():show()}><Search size={16} aria-hidden="true"/>{loading?'กำลังโหลดร่าง…':selected||missing?'เปลี่ยนร่างที่เชื่อม':'ค้นหาและเลือกร่าง'}</button>
   {value&&<button type="button" disabled={locked} onClick={()=>choose('')}><X size={15} aria-hidden="true"/>ยกเลิกการเชื่อม</button>}
  </div>
  {open&&<section id={id+'-panel'} className={styles.panel} aria-label="ค้นหาร่างเพื่อเชื่อมทะเบียน">
   <label htmlFor={id+'-search'}>ค้นหาร่าง</label>
   <input id={id+'-search'} type="search" autoFocus disabled={locked} value={query} maxLength={300} placeholder="เช่น กล้องวีดิโอ หรือ ภก 123/2569" onChange={e=>{setQuery(e.target.value);setPage(0);}} onKeyDown={e=>{if(e.key==='Enter')e.preventDefault();}}/>
   <div className={styles.filters}>
    <label htmlFor={id+'-type'}>ประเภทหนังสือ<select id={id+'-type'} disabled={locked} value={type} onChange={e=>{setType(e.target.value);setPage(0);}}><option value="">ทุกประเภท</option>{templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label htmlFor={id+'-year'}>ปีในหนังสือ<select id={id+'-year'} disabled={locked} value={year} onChange={e=>{setYear(e.target.value);setPage(0);}}><option value="">ทุกปี</option>{years.map(y=><option key={y} value={y}>{Number(y)+543}</option>)}</select></label>
   </div>
   <p className={styles.count} role="status">{loading?'กำลังโหลดร่าง…':!documents.length?'ยังไม่มีร่างหนังสือในระบบ':!matches.length?'ไม่พบร่าง ลองเปลี่ยนคำค้นหรือเงื่อนไข':(query||type||year?'พบ ':'ร่างล่าสุด · ')+matches.length.toLocaleString('th-TH')+' เรื่อง · แสดง '+(current*pageSize+1)+'–'+Math.min((current+1)*pageSize,matches.length)}</p>
   <ul className={styles.results} aria-label="ร่างที่ค้นพบ">{visible.map(d=><li key={d.id}><button type="button" disabled={locked} className={styles.result} aria-pressed={d.id===value} onClick={()=>choose(d.id)} title={d.subject+' · '+d.number}>
    <FileText size={17} aria-hidden="true"/><span><strong>{d.subject}</strong><small>{d.number||'ยังไม่มีเลขหนังสือ'} · {typeName(d.type)} · {thaiDate(d.date)||'ยังไม่ระบุวันที่'}</small>{(d.department||d.recipient)&&<small>{[d.department,d.recipient].filter(Boolean).join(' → ')}</small>}</span>{d.id===value&&<Check size={15} aria-hidden="true"/>}
   </button></li>)}</ul>
   <div className={styles.footer}>{pages>1&&<nav aria-label="หน้าผลค้นหาร่าง"><button type="button" disabled={locked||current===0} onClick={()=>setPage(current-1)}>ก่อนหน้า</button><span>{current+1} / {pages}</span><button type="button" disabled={locked||current===pages-1} onClick={()=>setPage(current+1)}>ถัดไป</button></nav>}<button type="button" disabled={locked} onClick={close}>ปิดการค้นหา</button></div>
  </section>}
 </div>;
}
