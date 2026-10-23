'use client';
import {useState,useEffect,useRef,useMemo} from 'react';
import {FileText,Save,Plus,Printer,Download,Search,Trash2,ArrowUp,ArrowDown} from 'lucide-react';
import {inventoryForms,formDefinition,calculatedRows,type FormField,type InventoryFormDraft,type InventoryFormInput} from '@/lib/inventory-forms';
import {inventoryFormHtml} from '@/lib/inventory-form-render';
import {inventoryPreviewAssets,loadInventoryForms,openInventoryForm,createInventoryForm,saveInventoryFormAction} from '@/app/inventory-form-actions';
import type {InventorySnapshot} from '@/lib/inventory';
import styles from './inventory-reports.module.css';

type Props={data:InventorySnapshot;organization:string;department:string;onDirty:(v:boolean)=>void;onBusy:(v:boolean)=>void};
export function InventoryFormWorkspace({data,organization,department,onDirty,onBusy}:Props){
 const [list,setList]=useState<Awaited<ReturnType<typeof loadInventoryForms>>>([]),[templateId,setTemplateId]=useState(1),[asOf,setAsOf]=useState(()=>new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Bangkok'})),[source,setSource]=useState(''),[query,setQuery]=useState(''),[find,setFind]=useState('');
 const [draft,setDraft]=useState<InventoryFormDraft|null>(null),[previewDraft,setPreviewDraft]=useState<InventoryFormDraft|null>(null),[dirty,setDirty]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState(false),[zoom,setZoom]=useState(0),[pages,setPages]=useState(0),[overflow,setOverflow]=useState(false);
 const [assets,setAssets]=useState<{regular:string;bold:string;garuda:string;thaiTerms?:string[]}>();
 const frame=useRef<HTMLIFrameElement>(null);
 useEffect(()=>{inventoryPreviewAssets().then(setAssets).catch(()=>{setError(true);setMessage('โหลดฟอนต์ตัวอย่างไม่สำเร็จ กรุณาเปิดหน้านี้ใหม่');});loadInventoryForms().then(setList).catch(()=>{setError(true);setMessage('โหลดร่างไม่สำเร็จ ลองเปิดหน้านี้ใหม่');});},[]);
 useEffect(()=>{onDirty(dirty);return()=>onDirty(false);},[dirty,onDirty]);
 useEffect(()=>{onBusy(busy);return()=>onBusy(false);},[busy,onBusy]);
 useEffect(()=>{const timer=setTimeout(()=>setPreviewDraft(draft),300);return()=>clearTimeout(timer);},[draft]);
 useEffect(()=>{const handler=(e:MessageEvent)=>{if(e.source!==frame.current?.contentWindow||e.data?.source!=='sarabun-preview')return;setPages(Number(e.data.pages)||0);setOverflow(Boolean(e.data.overflow));};window.addEventListener('message',handler);return()=>window.removeEventListener('message',handler);},[]);
 async function work(fn:()=>Promise<void>){if(busy)return;setBusy(true);setError(false);setMessage('');try{await fn();}catch(e){setError(true);setMessage(e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ');}finally{setBusy(false);}}
 function canReplace(){return !dirty||confirm('มีเอกสารที่ยังไม่บันทึก ต้องการละทิ้งการแก้ไขหรือไม่?');}
 function change(input:Partial<InventoryFormInput>){setDraft(d=>d?{...d,...input}:d);setDirty(true);}
 const options=templateId===4?data.movements.filter(m=>m.kind==='issue').map(m=>({id:m.id,label:m.number+' · '+m.requester+' · '+m.purpose})):data.items.filter(i=>i.kind===(templateId===1?'supply':'asset')).map(i=>({id:i.id,label:i.code+' · '+i.name}));
 const filtered=options.filter(o=>o.label.toLocaleLowerCase().includes(query.toLocaleLowerCase())),needsSource=templateId<=4;
 const html=useMemo(()=>{
  if(!previewDraft||!assets)return '';
  const rendered=inventoryFormHtml(previewDraft,false,assets);
  if(zoom)return rendered.replace('</style>','@media screen{body{zoom:'+zoom/100+'}}</style>');
  const width=formDefinition(previewDraft.templateId).landscape?297:210;
  return rendered.replace('</body>','<script>(()=>{const fit=()=>document.body.style.zoom=String(Math.min(1,Math.max(.15,(innerWidth-16)/('+width+'*96/25.4))));fit();addEventListener("resize",fit)})();</script></body>');
 },[previewDraft,zoom,assets]);

 const def=draft?formDefinition(draft.templateId):null,rows=draft?calculatedRows(draft):[];
 async function save(){if(!draft)return;await work(async()=>{const result=await saveInventoryFormAction(draft.id,draft.version,draft);if(!result.ok)throw Error(result.error);const saved=result.data;setDraft(saved);setDirty(false);setList(await loadInventoryForms());setMessage('บันทึกร่างแล้ว');});}
 function moveRow(index:number,offset:number){if(!draft)return;const rows=[...draft.rows];[rows[index],rows[index+offset]]=[rows[index+offset],rows[index]];change({rows});}
 const valueInput=(f:FormField,value:string,onChange:(value:string)=>void,disabled=false)=>f.multiline?<textarea rows={4} maxLength={12000} value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}/>:<input inputMode={f.numeric?'decimal':undefined} maxLength={12000} value={value} onChange={e=>onChange(e.target.value)} disabled={disabled}/>;
 return <fieldset disabled={busy} className={styles.root+' '+styles.formGuard}>
 <header className={styles.sectionHeading}><div><h2>แบบฟอร์มและผลตรวจ</h2><p>กรอกข้อมูล ตรวจตัวอย่าง แล้วส่งออกเป็น PDF หรือ Word</p></div><a href="https://drive.google.com/drive/folders/1hvQjmfb6aW4srAJ-8-Sc3BgNsN25FGhv" target="_blank" rel="noreferrer">เอกสารอ้างอิง</a></header>
 {message&&<p className={error?styles.error:styles.notice} role={error?'alert':'status'}>{message}</p>}
 <details className={styles.setup} open={!draft}><summary>สร้างเอกสารจากแบบฟอร์ม</summary><div className={styles.controls}><label>แบบฟอร์ม<select value={templateId} onChange={e=>{setTemplateId(Number(e.target.value));setSource('');setQuery('');}}>{inventoryForms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label><label>ข้อมูลถึงวันที่<input type="date" value={asOf} onChange={e=>setAsOf(e.target.value)}/></label></div>
 {needsSource&&<div className={styles.controls}><label>ค้นหารายการ<input type="search" value={query} placeholder="ชื่อ รหัส หรือเลขใบเบิก" onChange={e=>setQuery(e.target.value)}/></label><label>เชื่อมรายการ<select value={source} onChange={e=>setSource(e.target.value)}><option value="">เลือกรายการ</option>{filtered.slice(0,50).map(o=><option key={o.id} value={o.id}>{o.label}</option>)}</select>{filtered.length>50&&<small>แสดง 50 รายการแรก พิมพ์ค้นหาเพื่อเจาะจง</small>}</label></div>}
 <button className={styles.primary} disabled={busy||!asOf||needsSource&&!source} onClick={()=>{if(canReplace())void work(async()=>{const d=await createInventoryForm({templateId,asOf,sourceId:source,organization,department});setDraft({...d,id:crypto.randomUUID(),version:0,updatedAt:''});setDirty(true);});}}><Plus size={16}/>สร้างร่าง</button></details>
 {draft&&def&&<>
 <div className={styles.editorBar}><label>ชื่อร่าง<input value={draft.title} maxLength={200} onChange={e=>change({title:e.target.value})}/></label><button className={styles.primary} disabled={busy||!dirty} onClick={save}><Save size={16}/>{busy?'กำลังบันทึก…':'บันทึกร่าง'}</button>
 {draft.version>0&&!dirty?<><a className={styles.button} href={'/api/inventory/forms?id='+draft.id+'&format=pdf'} target="_blank" rel="noreferrer"><Printer size={16}/>PDF</a><a className={styles.button} href={'/api/inventory/forms?id='+draft.id+'&format=office'}><Download size={16}/>Word</a></>:<small>บันทึกก่อนส่งออก</small>}</div>
 <div className={styles.formLayout}><div className={styles.formInputs}>
 <section className={styles.formSection}><h3>ข้อมูลเอกสาร</h3><div className={styles.fieldGrid}><label>หน่วยงาน<input value={draft.organization} maxLength={300} onChange={e=>change({organization:e.target.value})}/></label><label>ส่วนราชการ / กอง<input value={draft.department} maxLength={300} onChange={e=>change({department:e.target.value})}/></label><label>{[4,8].includes(draft.templateId)?'วันที่เอกสาร':'ข้อมูลถึงวันที่ในร่าง'}<input type="date" disabled={![4,8].includes(draft.templateId)} value={draft.asOf} onChange={e=>change({asOf:e.target.value})}/>{![4,8].includes(draft.templateId)&&<small>ต้องการยอดอีกวัน ให้สร้างร่างใหม่แล้วเลือกวันที่นั้น</small>}</label></div>
 <div className={styles.fieldGrid}>{def.fields.map(f=><label key={f.key} className={f.multiline?styles.wideField:undefined}>{f.label}{valueInput(f,draft.fields[f.key]||'',v=>change({fields:{...draft.fields,[f.key]:v}}))}</label>)}</div></section>
 {!!def.columns.length&&<section className={styles.formSection}><div className={styles.sectionHeading}><h3>รายการในเอกสาร <small>{draft.rows.length} รายการ</small></h3><button disabled={draft.rows.length>=500} onClick={()=>change({rows:[...draft.rows,{}]})}><Plus size={16}/>เพิ่มรายการ</button></div>
 {draft.rows.map((row,index)=><details key={index} className={styles.lineItem} open={draft.rows.length<=3||!Object.values(row).some(Boolean)}><summary>{index+1}. {row.description||row.party||row.code||'รายการใหม่'}</summary><div className={styles.fieldGrid}>{(def.columns as FormField[]).map(f=><label key={f.key}>{f.label}{valueInput(f,rows[index][f.key]||'',v=>change({rows:draft.rows.map((r,j)=>j===index?{...r,[f.key]:v}:r)}),f.calculated)}</label>)}</div><div className={styles.actions}><button disabled={index===0} onClick={()=>moveRow(index,-1)} aria-label={'เลื่อนรายการ '+(index+1)+' ขึ้น'}><ArrowUp size={16}/></button><button disabled={index===draft.rows.length-1} onClick={()=>moveRow(index,1)} aria-label={'เลื่อนรายการ '+(index+1)+' ลง'}><ArrowDown size={16}/></button><button onClick={()=>{if(confirm('ลบรายการที่ '+(index+1)+' ออกจากร่างนี้?'))change({rows:draft.rows.filter((_,j)=>j!==index)});}}><Trash2 size={16}/>ลบรายการ {index+1}</button></div></details>)}
 {!draft.rows.length&&<p>เพิ่มรายการเพื่อเริ่มตาราง ระบบจะแบ่งหน้าให้เมื่อข้อมูลยาวขึ้น</p>}</section>}
 <section className={styles.formSection}><h3>ข้อความเพิ่มเติม</h3><label>ข้อความท้ายเอกสาร<textarea rows={3} maxLength={8000} value={draft.footer} onChange={e=>change({footer:e.target.value})}/></label></section>
 <section className={styles.formSection}><h3>ผู้ลงนาม</h3>{draft.signers.map((s,index)=><details key={index} className={styles.lineItem} open><summary>{s.role||'ผู้ลงนาม '+(index+1)}</summary><div className={styles.fieldGrid}>{(['role','name','position'] as const).map((key,n)=><label key={key}>{['หน้าที่','ชื่อผู้ลงนาม','ตำแหน่ง'][n]}<input maxLength={key==='role'?100:key==='name'?200:300} value={s[key]} onChange={e=>change({signers:draft.signers.map((v,j)=>j===index?{...v,[key]:e.target.value}:v)})}/></label>)}</div></details>)}</section>
 <details className={styles.method}><summary>ข้อมูลที่ควรตรวจทาน</summary><p className={styles.pre}>{draft.notes}</p><p>การแก้ร่างเอกสารนี้ไม่เปลี่ยนรายการรับ–จ่ายหรือยอดสต็อก</p></details>
 </div><aside className={styles.previewPanel}><div className={styles.sectionHeading}><h3>ตัวอย่างเอกสาร <small>{pages?pages+' หน้า':''}</small></h3><label>ขนาดตัวอย่าง<select value={zoom} onChange={e=>setZoom(Number(e.target.value))}><option value={0}>พอดีหน้าจอ</option>{[35,50,60,75,100].map(z=><option key={z} value={z}>{z}%</option>)}</select></label></div>
 {overflow&&<p className={styles.error} role="alert">มีรายการสูงเกินหน้ากระดาษ กรุณาย่อข้อความในรายการนั้น</p>}
 <div className={styles.preview}>{assets?<iframe ref={frame} title="ตัวอย่างแบบฟอร์มพัสดุ" sandbox="allow-scripts" srcDoc={html}/>:<p>กำลังโหลดตัวอย่าง…</p>}</div><small>TH Sarabun New · ตารางแบ่งหน้าอัตโนมัติ · Word แก้ไขข้อความและตารางต่อได้</small>
 </aside></div>
 </>}
 <section className={styles.saved}><div className={styles.sectionHeading}><h3>ร่างที่บันทึกไว้</h3><label className={styles.search}><Search size={16}/><input type="search" aria-label="ค้นหาร่างแบบฟอร์ม" placeholder="ค้นหาชื่อร่าง" value={find} onChange={e=>setFind(e.target.value)}/></label></div>
 {list.filter(d=>d.title.includes(find)).slice(0,30).map(d=><button className={styles.savedRow} key={d.id} disabled={busy} onClick={()=>{if(canReplace())void work(async()=>{setDraft(await openInventoryForm(d.id));setDirty(false);});}}><FileText size={19}/><span><strong>{d.title}</strong><small>ข้อมูลถึง {d.asOf} · แก้ไข {new Date(d.updatedAt).toLocaleDateString('th-TH')}</small></span></button>)}
 {!list.length&&<p>ร่างที่บันทึกจะอยู่ที่นี่ และรวมอยู่ในชุดสำรองข้อมูล</p>}{list.filter(d=>d.title.includes(find)).length>30&&<small>แสดง 30 รายการล่าสุด พิมพ์ค้นหาเพื่อหาเอกสารที่ต้องการ</small>}</section>
 </fieldset>;
}
