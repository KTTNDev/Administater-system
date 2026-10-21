"use client";
import {useEffect,useId,useState} from 'react';
import {Building2,Plus,Pencil,Trash2,RefreshCw,Save} from 'lucide-react';
import {getOrganizationDirectory,writeOrganizationDirectory,removeOrganizationDirectory} from '@/app/organization-directory-actions';
import {emptyOrganization,type DirectoryOrganization,type OrganizationInput} from '@/lib/organization-directory';
import {normalizeSearch} from '@/lib/correspondence';
import s from './organization-directory-manager.module.css';
type Props={entries:DirectoryOrganization[];onChange:(entries:DirectoryOrganization[])=>void;onDirty:(v:boolean)=>void;onBusy:(v:boolean)=>void};
export function OrganizationDirectoryManager({entries,onChange,onDirty,onBusy}:Props){
 const heading=useId(),[query,setQuery]=useState(''),[page,setPage]=useState(0),[form,setForm]=useState<OrganizationInput|null>(null),[id,setId]=useState(''),[version,setVersion]=useState(0),[baseline,setBaseline]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const dirty=!!form&&JSON.stringify(form)!==baseline;
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
 const terms=normalizeSearch(query).split(' ').filter(Boolean);
 const matches=entries.filter(e=>terms.every(t=>normalizeSearch([e.name,e.department,e.address,e.phone,e.prefix].join(' ')).includes(t)));
 const pages=Math.max(1,Math.ceil(matches.length/10)),current=Math.min(page,pages-1),visible=matches.slice(current*10,(current+1)*10);
 const canLeave=()=>!dirty||confirm('มีรายชื่อหน่วยงานที่ยังไม่บันทึก ต้องการละทิ้งการแก้ไขหรือไม่?');
 function edit(entry?:DirectoryOrganization){if(busy||!canLeave())return;const next=entry?{name:entry.name,department:entry.department,address:entry.address,phone:entry.phone,prefix:entry.prefix}:emptyOrganization();setForm(next);setId(entry?.id||crypto.randomUUID());setVersion(entry?.version||0);setBaseline(JSON.stringify(next));setError('');setNotice('');}
 async function save(event:React.FormEvent){event.preventDefault();if(!form||busy)return;setBusy(true);setError('');setNotice('');try{const result=await writeOrganizationDirectory({id,version,input:form});if(!result.ok){setError(result.error);return;}onChange(result.entries);setForm(null);setNotice('บันทึกรายชื่อหน่วยงานแล้ว');}catch{setError('บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง');}finally{setBusy(false);}}
 async function remove(entry:DirectoryOrganization){if(busy||!canLeave()||!confirm('ลบ '+entry.name+(entry.department?' · '+entry.department:'')+' ออกจากรายการกรอกอัตโนมัติ? หนังสือที่บันทึกแล้วจะไม่เปลี่ยน'))return;setBusy(true);setError('');setNotice('');try{const result=await removeOrganizationDirectory(entry.id,entry.version);if(!result.ok){setError(result.error);return;}onChange(result.entries);setForm(null);setNotice('ลบรายชื่อหน่วยงานแล้ว');}catch{setError('ลบไม่สำเร็จ กรุณาลองอีกครั้ง');}finally{setBusy(false);}}
 async function refresh(){if(busy||!canLeave())return;setBusy(true);try{onChange(await getOrganizationDirectory());setForm(null);setError('');setNotice('โหลดรายชื่อล่าสุดแล้ว');}catch{setError('โหลดรายชื่อไม่สำเร็จ');}finally{setBusy(false);}}
 return <section className={s.manager} aria-labelledby={heading}>
  <header className={s.header}><div><h2 id={heading}><Building2 size={20}/>รายการกรอกอัตโนมัติ</h2><p>จัดการข้อมูลสำหรับเลือกใส่ในฟอร์ม หนังสือเดิมจะคงข้อมูลเดิมไว้</p></div><button type="button" className="primary" disabled={busy} onClick={()=>edit()}><Plus size={16}/>เพิ่มหน่วยงาน</button></header>
  {error&&<p role="alert" className={s.error}>{error}</p>}{notice&&<p role="status" className={s.notice}>{notice}</p>}
  {form&&<form aria-label="แก้ไขรายชื่อหน่วยงาน" onSubmit={save} className={s.editor}><h3>{version?'แก้ไขหน่วยงาน':'เพิ่มหน่วยงาน'}</h3><fieldset disabled={busy}><div className={s.fields}>
   <label>ชื่อส่วนราชการ<input autoFocus required maxLength={200} value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/></label>
   <label>หน่วยงานเจ้าของเรื่อง<input maxLength={200} value={form.department} onChange={e=>setForm({...form,department:e.target.value})}/></label>
   <label className={s.wide}>ที่อยู่<textarea rows={2} maxLength={1000} value={form.address} onChange={e=>setForm({...form,address:e.target.value})}/></label>
   <label>โทรศัพท์<input type="tel" maxLength={100} value={form.phone} onChange={e=>setForm({...form,phone:e.target.value})}/></label>
   <label>รหัสหน่วยงาน<input maxLength={100} value={form.prefix} onChange={e=>setForm({...form,prefix:e.target.value})}/></label>
  </div><div className={s.actions}><button type="submit" className="primary"><Save size={16}/>{busy?'กำลังบันทึก…':'บันทึกรายชื่อ'}</button><button type="button" onClick={()=>{if(canLeave())setForm(null);}}>ยกเลิก</button></div></fieldset></form>}
  <div className={s.tools}><label>ค้นหารายชื่อหน่วยงาน<input type="search" value={query} maxLength={300} onChange={e=>{setQuery(e.target.value);setPage(0);}} placeholder="ชื่อส่วนราชการ กอง หรือโทรศัพท์"/></label><button type="button" disabled={busy} onClick={refresh}><RefreshCw size={16}/>โหลดรายชื่อล่าสุด</button></div>
  <p className={s.count}>{matches.length} รายการ</p>
  <ul className={s.list}>{visible.map(e=><li key={e.id}><div><strong>{e.name}</strong><span>{e.department||'ไม่ระบุหน่วยงานเจ้าของเรื่อง'}</span><small>{[e.phone,e.prefix].filter(Boolean).join(' · ')}</small></div><div className={s.actions}><button type="button" disabled={busy} aria-label={'แก้ไข '+e.name+' '+e.department} onClick={()=>edit(e)}><Pencil size={16}/><span>แก้ไข</span></button><button type="button" disabled={busy} aria-label={'ลบ '+e.name+' '+e.department} onClick={()=>remove(e)}><Trash2 size={16}/><span>ลบ</span></button></div></li>)}</ul>
  {!matches.length&&<p className={s.empty}>{entries.length?'ไม่พบรายชื่อ ลองเปลี่ยนคำค้น':'ยังไม่มีรายการ เพิ่มหน่วยงานที่ใช้ประจำได้เลย'}</p>}
  {pages>1&&<nav className={s.actions} aria-label="หน้ารายชื่อหน่วยงาน"><button disabled={busy||current===0} onClick={()=>setPage(current-1)}>ก่อนหน้า</button><span>{current+1} / {pages}</span><button disabled={busy||current>=pages-1} onClick={()=>setPage(current+1)}>ถัดไป</button></nav>}
 </section>;
}
