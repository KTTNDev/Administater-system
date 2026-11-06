"use client";
import {useEffect,useRef,useState} from 'react';
import {Upload,FileText,X,ArrowRight,AlertCircle} from 'lucide-react';
import {analyzeWordFile,confirmWordImport} from '@/app/word-import-actions';
import {WORD_IMPORT_LIMIT,type WordImportAnalysis,type WordImportFields} from '@/lib/word-import-model';
import type {SavedDraft} from '@/lib/document';
import styles from './word-import.module.css';
export function WordImportDialog({onClose,onImported}:{onClose:()=>void;onImported:(draft:SavedDraft&{localFileWarning?:string})=>void}){
 const dialog=useRef<HTMLDialogElement>(null),fileInput=useRef<HTMLInputElement>(null);
 const [file,setFile]=useState<File|null>(null),[analysis,setAnalysis]=useState<WordImportAnalysis|null>(null),[fields,setFields]=useState<WordImportFields|null>(null);
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[confirmed,setConfirmed]=useState(false),request=useRef('');
 useEffect(()=>{dialog.current?.showModal();return()=>dialog.current?.close();},[]);
 useEffect(()=>{if(!file)return;const leave=(e:BeforeUnloadEvent)=>{e.preventDefault();};window.addEventListener('beforeunload',leave);return()=>window.removeEventListener('beforeunload',leave);},[file]);
 function close(){if(busy)return;if(fields&&!window.confirm('ปิดการนำเข้าโดยยังไม่สร้างร่างหรือไม่? ข้อมูลที่แก้ในหน้านี้จะไม่ถูกบันทึก'))return;onClose();}
 async function analyze(next:File){
  setError('');setAnalysis(null);setFields(null);setConfirmed(false);setFile(next);request.current=crypto.randomUUID();
  if(!/\.docx$/i.test(next.name)||next.size>WORD_IMPORT_LIMIT){setError('เลือกไฟล์ .docx ขนาดไม่เกิน 10 MB');return;}
  setBusy(true);try{const data=new FormData();data.set('file',next);const result=await analyzeWordFile(data);if(!result.ok)throw Error(result.error);setAnalysis(result.data);setFields(result.data.fields);}catch(e){setError(e instanceof Error?e.message:'อ่านไฟล์ไม่สำเร็จ ลองเลือกไฟล์อีกครั้ง');}finally{setBusy(false);}
 }
 function change(key:keyof WordImportFields,value:string){setFields(current=>current?{...current,[key]:value}:current);setConfirmed(false);}
 async function create(){
  if(!file||!fields||!confirmed||busy)return;setBusy(true);setError('');
  try{const data=new FormData();data.set('file',file);data.set('fields',JSON.stringify(fields));data.set('requestId',request.current);data.set('confirmed','yes');const result=await confirmWordImport(data);if(!result.ok)throw Error(result.error);onImported(result.data);}catch(e){setError(e instanceof Error?e.message:'บันทึกไม่สำเร็จ ข้อมูลยังอยู่ กรุณาลองอีกครั้ง');}finally{setBusy(false);}
 }
 const labels:[keyof WordImportFields,string][]=[['organization','ส่วนราชการ'],['number','เลขที่หนังสือ'],['date','วันที่หนังสือ'],['subject','เรื่อง'],['recipient','เรียน'],['closing','คำลงท้าย (ถ้ามี)'],['signer','ชื่อผู้ลงนาม'],['position','ตำแหน่งผู้ลงนาม']];
 return <dialog ref={dialog} className={styles.dialog} aria-labelledby="word-import-title" onCancel={e=>{e.preventDefault();close();}}>
  <header className={styles.header}><div><h2 id="word-import-title"><FileText size={21}/>นำเข้า Word เป็นร่างหนังสือ</h2><p>บันทึกข้อความ / หนังสือภายใน · ตรวจข้อมูลก่อนสร้างร่าง</p></div><button type="button" disabled={busy} aria-label="ปิดการนำเข้า Word" onClick={close}><X size={20}/></button></header>
  <div className={styles.content}>
   <label className={styles.upload}><Upload size={21}/><span><strong>{file?.name||'เลือกไฟล์ Word .docx'}</strong><small>ไม่เกิน 10 MB · เก็บต้นฉบับไว้กับเรื่องเมื่อสร้างร่าง</small></span><input ref={fileInput} type="file" aria-label="ไฟล์ Word ที่ต้องการนำเข้า" accept=".docx" disabled={busy} onChange={e=>{const selected=e.target.files?.[0];if(selected){if(fields&&!confirm('เปลี่ยนไฟล์และเริ่มตรวจข้อมูลใหม่หรือไม่?')){e.target.value='';return;}void analyze(selected);}e.target.value='';}}/></label>
   {busy&&<p role="status">{analysis?'กำลังสร้างร่างและเก็บต้นฉบับ…':'กำลังอ่านและแยกข้อมูล…'}</p>}
   {analysis&&fields&&<>
    <details className={styles.warnings} open><summary><AlertCircle size={17}/>จุดที่ต้องตรวจ {analysis.warnings.length} รายการ</summary><ul>{analysis.warnings.map(w=><li key={w}>{w}</li>)}</ul></details>
    <div className={styles.columns}>
     <section className={styles.source}><h3>ข้อความที่อ่านได้จากต้นฉบับ</h3><p>{analysis.paragraphs} ย่อหน้า · {analysis.tables} ตาราง · {analysis.images} ภาพ/วัตถุ</p><pre tabIndex={0}>{analysis.sourceText}</pre></section>
     <section className={styles.review}><h3>ข้อมูลที่จะสร้างเป็นร่าง</h3><fieldset disabled={busy}><label>ประเภทหนังสือ<select value={fields.type} onChange={e=>change('type',e.target.value)}><option value="internal">หนังสือภายใน (บันทึกข้อความ)</option><option value="memorandum">บันทึก</option></select></label>
      <label>ชั้นความลับ<select value={fields.confidentiality} onChange={e=>change('confidentiality',e.target.value)}>{['ปกติ','ลับ','ลับมาก','ลับที่สุด'].map(v=><option key={v}>{v}</option>)}</select></label><label>ชั้นความเร็ว<select value={fields.urgency} onChange={e=>change('urgency',e.target.value)}>{['ปกติ','ด่วน','ด่วนมาก','ด่วนที่สุด'].map(v=><option key={v}>{v}</option>)}</select></label>
      {labels.map(([key,label])=><label key={key}>{label}{key==='subject'&&' *'}<input type={key==='date'?'date':'text'} value={fields[key]} maxLength={key==='subject'?300:key==='date'?10:2000} onChange={e=>change(key,e.target.value)}/></label>)}
      <label>เนื้อหาหนังสือ<textarea rows={16} maxLength={40000} value={fields.body} onChange={e=>change('body',e.target.value)}/></label><small>**ข้อความ** เป็นตัวหนา · ## เป็นหัวข้อ · ตารางแสดงด้วย | และแก้ต่อในฟอร์มได้<br/>เมื่อสร้างร่าง ระบบจะเปิดฟอร์มพร้อมตัวอย่างเอกสารให้ตรวจจัดหน้า</small>
     </fieldset></section>
    </div>
   </>}
  </div>
  <footer className={styles.footer}>{error&&<p role="alert">{error}</p>}{fields&&<label className="check-label"><input type="checkbox" checked={confirmed} disabled={busy} onChange={e=>setConfirmed(e.target.checked)}/>ฉันตรวจข้อมูลที่แยกได้และข้อจำกัดข้างต้นแล้ว</label>}<div><button type="button" className="secondary" disabled={busy} onClick={close}>ยกเลิก</button><button type="button" className="primary" disabled={busy||!confirmed||!fields?.subject.trim()} onClick={()=>void create()}>สร้างร่างและเปิดแก้ไข <ArrowRight size={16}/></button></div></footer>
 </dialog>;
}
