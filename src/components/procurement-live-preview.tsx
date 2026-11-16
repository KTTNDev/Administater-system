'use client';
import {useEffect,useRef,useState} from 'react';
import {RefreshCw,Printer} from 'lucide-react';
import {PdfPreview} from './pdf-preview';
import {documentTemplates,type DraftDocumentCode} from '@/lib/procurement-documents';
import type {ProcurementInput,ProcurementFile} from '@/lib/procurement';
import {billSchema} from '@/lib/procurement-bill';
import {suiteCodes} from '@/lib/procurement-workflow-model';
import styles from './procurement-workspace.module.css';
type Result={id:string;state:string;url?:string;pages?:number;error?:string};
export function ProcurementLivePreview({data,code,onCode,available,activeFile}:{data:ProcurementInput;code:DraftDocumentCode;onCode:(code:DraftDocumentCode)=>void;available:boolean;activeFile?:ProcurementFile}){
 const client=useRef(''),paper=useRef<HTMLDivElement>(null),[results,setResults]=useState<Partial<Record<DraftDocumentCode,{url:string;stamp:string;pages:number}>>>({}),[status,setStatus]=useState('waiting'),[error,setError]=useState(''),[attempt,setAttempt]=useState(0),[fit,setFit]=useState<string>('65'),stamp=JSON.stringify(data);
 const [automatic,setAutomatic]=useState(true),[manual,setManual]=useState<{stamp:string;code:DraftDocumentCode}|null>(null);
 useEffect(()=>{try{setAutomatic(localStorage.getItem('sarabun.procurement.preview-mode')!=='manual');}catch{}},[]);
 function refresh(){setManual({stamp,code});setAttempt(n=>n+1);}
 function updateMode(value:boolean){setAutomatic(value);setManual(null);try{localStorage.setItem('sarabun.procurement.preview-mode',value?'auto':'manual');}catch{}}
 const [inspectDraft,setInspectDraft]=useState(false);useEffect(()=>setInspectDraft(false),[code,activeFile?.id]);
 const fileSelected=!!activeFile&&(activeFile.meta.origin==='word'||Object.hasOwn(data.sources,code)&&data.sources[code as keyof typeof data.sources]==='external'),showFile=fileSelected&&!inspectDraft,activeUrl=activeFile?'/api/procurement/file-preview/'+activeFile.id:'';
 const previous=results[code],current=previous?.stamp===stamp,displayUrl=showFile?activeUrl:previous?.url;
 useEffect(()=>{const element=paper.current;if(!element)return;const resize=new ResizeObserver(([entry])=>element.style.setProperty('--fit-width',Math.max(160,(entry.contentRect.height-70)*.707)+'px'));resize.observe(element);return()=>resize.disconnect();},[]);
 useEffect(()=>{
  if(!available||showFile||!automatic&&(manual?.stamp!==stamp||manual?.code!==code))return;if(!billSchema.safeParse(data.bill).success){setStatus('incomplete');setError('');return;}let stopped=false;const controller=new AbortController();setStatus('waiting');setError('');
  const timer=setTimeout(()=>{void(async()=>{
   if(!client.current)client.current=crypto.randomUUID();
   const read=async(url:string,body?:unknown)=>{const response=await fetch('/api/procurement'+url,{signal:controller.signal,cache:'no-store',...body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}});const value=await response.json();if(!response.ok)throw Error(value.error||'โหลดตัวอย่างไม่สำเร็จ');return value as Result;};
   let result=await read('/live',{data:JSON.parse(stamp),code,client:client.current});
   while(!stopped){
    if(result.state==='ready'&&result.url){setResults(old=>({...old,[code]:{url:result.url!,stamp,pages:result.pages||1}}));setStatus('ready');return;}
    if(result.state==='error')throw Error(result.error||'จัดหน้าไม่สำเร็จ');
    if(result.state==='superseded')return;
    setStatus(result.state);await new Promise(resolve=>setTimeout(resolve,1000));if(stopped)return;result=await read('/live/'+result.id);
   }
  })().catch(e=>{if(!stopped){setError(e instanceof Error?e.message:'แสดงตัวอย่างไม่สำเร็จ');setStatus('error');}});},1200);
  return()=>{stopped=true;clearTimeout(timer);controller.abort();};
 },[stamp,code,available,attempt,showFile,automatic,manual]);
 return <aside className={styles.livePanel} aria-label="ตัวอย่างเอกสารขณะกรอก" data-live-code={code} data-preview-url={displayUrl||''} data-preview-current={showFile||current?'true':'false'}>
  <div className={styles.liveHeader}><strong>ตัวอย่างเอกสารขณะกรอก</strong><div className={styles.docSwitch}>{(['D01','D07'] as const).map(value=><button key={value} type="button" aria-pressed={code===value} onClick={()=>onCode(value)}>{value}</button>)}<select aria-label="เลือกเอกสารตัวอย่าง" value={code} onChange={e=>onCode(e.target.value as DraftDocumentCode)}>{suiteCodes.map(value=><option key={value} value={value}>{value} · {documentTemplates[value].name}</option>)}</select></div></div>
  {fileSelected&&<p className={styles.liveStale}>ฉบับใช้งานเป็นไฟล์แนบ ไม่เขียนทับเมื่อข้อมูลกลางเปลี่ยน <button className="text-button" onClick={()=>setInspectDraft(v=>!v)}>{showFile?'เทียบกับแบบร่างจากข้อมูลกลาง':'กลับไปดูไฟล์ฉบับใช้งาน'}</button></p>}
  {!fileSelected&&Object.hasOwn(data.sources,code)&&data.sources[code as keyof typeof data.sources]==='external'&&<p className={styles.liveStale}>กำลังดูแบบร่างเพื่อเทียบข้อมูล · ฉบับใช้งานเลือกเป็นไฟล์จากระบบ เปิดไฟล์จริงได้ในรายการหลักฐาน</p>}
  <div className={styles.liveCaption}><strong>{code} · {documentTemplates[code].name}</strong><span role="status" data-preview-state={status}>{showFile?'ฉบับใช้งานจากไฟล์แนบ — ตรวจข้อมูลและสแกนตามจริง':!available?'รอติดตั้งแม่แบบ':status==='incomplete'?'กรอกรายการให้ครบเพื่ออัปเดตตัวอย่าง':error?'ตัวอย่างยังไม่อัปเดต':current?'ตรงกับข้อมูลที่กำลังแก้':!automatic&&(manual?.stamp!==stamp||manual?.code!==code)?'ข้อมูลเปลี่ยน — กดอัปเดตตัวอย่าง':status==='rendering'?'กำลังจัดหน้าเอกสาร…':status==='queued'?'รอจัดหน้าเอกสาร…':'รอหยุดพิมพ์เพื่ออัปเดต…'}</span><div className={styles.fitButtons}><label className={styles.previewMode} title="ปิดเพื่อลดการจัดหน้าระหว่างพิมพ์ ไฟล์ส่งออกยังใช้การตรวจเดิม"><input type="checkbox" aria-label="อัปเดตตัวอย่างอัตโนมัติ" checked={automatic} onChange={e=>updateMode(e.target.checked)}/>อัตโนมัติ</label><label><span className={styles.srOnly}>ขนาดตัวอย่างเอกสาร</span><select aria-label="ขนาดตัวอย่างเอกสาร" value={fit} onChange={e=>setFit(e.target.value)}><option value="page">เต็มหน้า</option><option value="width">เต็มความกว้าง</option>{[50,65,75,100,125].map(value=><option key={value} value={value}>{value}%</option>)}</select></label><button title="อัปเดตตัวอย่างจากข้อมูลล่าสุด" aria-label="จัดตัวอย่างใหม่" onClick={refresh}><RefreshCw size={17}/></button><button title="เปิด PDF เพื่อพิมพ์" aria-label="เปิด PDF เพื่อพิมพ์" disabled={!showFile&&(!current||!previous)} onClick={()=>{if(displayUrl)window.open(displayUrl,'_blank','noopener,noreferrer');}}><Printer size={17}/></button></div></div>
  {error&&<div className={styles.error}><p>{error}</p><button className="secondary" onClick={refresh}>ลองแสดงตัวอย่างอีกครั้ง</button></div>}
  {!showFile&&previous&&!current&&<p className={styles.liveStale}>แสดงตัวอย่างก่อนหน้า ระหว่างอัปเดตข้อมูลล่าสุด</p>}
  <div ref={paper} className={styles.livePaper} data-fit={fit}><div className={styles.paperMetrics}><span>A4 · 210 × 297 มม.</span><span>รูปแบบตามต้นฉบับ</span></div><div className={styles.previewScale} style={fit!=='page'&&fit!=='width'?{width:794*Number(fit)/100}:undefined}>{displayUrl?<PdfPreview url={displayUrl} title={'ตัวอย่างสด '+code}/>:<div className={styles.previewWaiting}>{available?!automatic?'กดปุ่มอัปเดตตัวอย่างเพื่อจัดหน้าจากข้อมูลล่าสุด':'กำลังจัดตัวอย่างจากแม่แบบ Word ข้อความประจำจะแสดงพร้อมข้อมูลที่กรอก':'ติดตั้งแม่แบบในแท็บเอกสารเพื่อเปิดตัวอย่าง'}<small>ตัวอย่างจากการจัดหน้าจริง อาจใช้เวลาสักครู่ ไม่บันทึกเป็นเอกสารฉบับส่งออก</small></div>}</div></div>
  <div className={styles.liveFooter}>{!showFile&&previous?`${previous.pages} หน้า · `:''}ร่างขณะทำงาน · ตัวเลข “—” หรือข้อความในวงเล็บเหลี่ยมคือช่องที่ยังไม่กรอก{!showFile&&previous&&previous.pages>1&&<strong>เอกสารยาวเกินหนึ่งหน้า ต้องตรวจใบต่อและลายเซ็นก่อนใช้จริง</strong>}</div>
 </aside>;
}
