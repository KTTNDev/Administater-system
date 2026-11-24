'use client';
import {useEffect,useRef,useState} from 'react';
import dynamic from 'next/dynamic';
import type {SavedDraft} from '@/lib/document';
import {procurementFetch} from '@/lib/procurement/storage/client-request';
const AttachmentPreview=dynamic(()=>import('@/components/attachment-editor').then(m=>m.AttachmentPreview));
export function CoreA4Preview({caseId,docId,docTitle,docIds,draft,loading,onSelectDoc,onJumpBinder,onReload,onCreate,onEdit,onDownload}:{caseId:string;docId:string;docTitle?:string;docIds?:string[];draft?:SavedDraft|null;loading:boolean;onSelectDoc?:(id:string)=>void;onJumpBinder?:()=>void;onReload:()=>void;onCreate:()=>void;onEdit:()=>void;onDownload:(kind:'pdf'|'docx')=>void}){
 const frame=useRef<HTMLIFrameElement>(null),container=useRef<HTMLDivElement>(null);
 const [html,setHtml]=useState(''),[error,setError]=useState(''),[ready,setReady]=useState(false),[pages,setPages]=useState(0),[height,setHeight]=useState(1123),[width,setWidth]=useState(480),[fit,setFit]=useState(true);
 useEffect(()=>{const el=container.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(el);return()=>observer.disconnect();},[]);
 useEffect(()=>{
  setHtml('');setReady(false);setError('');setPages(0);setHeight(1123);if(!draft)return;
  const controller=new AbortController();
  procurementFetch('/api/procurement/preview-html',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:JSON.stringify({caseId,docId,expectedVersions:{[docId]:draft.version}})}).then(async response=>{
   if(!response.ok){const data=await response.json();throw Error(data.error||data.issues?.map((i:{messageTh:string})=>i.messageTh).join('; ')||'เปิดร่างฉบับจริงไม่สำเร็จ');}
   const result=await response.text();if(!controller.signal.aborted)setHtml(result);
  }).catch(e=>{if(!controller.signal.aborted)setError(e instanceof Error?e.message:String(e));});
  return()=>controller.abort();
 },[caseId,docId,draft]);
 useEffect(()=>{
  const message=(event:MessageEvent)=>{if(event.source!==frame.current?.contentWindow||event.data?.source!=='sarabun-preview')return;const data=event.data;if(data.error||!Number.isFinite(data.height)||data.height<=0){setError('จัดหน้าร่างไม่สำเร็จ กรุณาเปิดตรวจในระบบร่างหนังสือ');return;}setPages(data.pages);setHeight(data.height);setReady(true);if(data.overflow||data.missingOverlayPages?.length)setError('มีข้อความหรือวัตถุเกินหน้า กรุณาเปิดแก้ไขร่างและตรวจตำแหน่งก่อนส่งออก');};
  window.addEventListener('message',message);return()=>window.removeEventListener('message',message);
 },[]);
 useEffect(()=>{if(!html||ready)return;const timer=setTimeout(()=>setError('ตัวอย่างยังจัดหน้าไม่เสร็จ กรุณาโหลดฉบับล่าสุดหรือตรวจในระบบร่างหนังสือ'),25000);return()=>clearTimeout(timer);},[html,ready]);
 const scale=fit?Math.min(1,width/794):1;
 const list=docIds&&docIds.length?docIds:[],idx=list.indexOf(docId);
 const prevId=idx>0?list[idx-1]:undefined,nextId=idx>=0&&idx<list.length-1?list[idx+1]:undefined;
 return <section id="pw-preview-panel" className="pw-card pw-preview" aria-label="ตัวอย่างร่างฉบับจริง">
  <div className="pw-preview-head">
    <div className="pw-preview-title">
      <span className="pw-binder-num">{docId}</span>
      <div>
        <strong>ตัวอย่าง A4 · เอกสาร {docId}</strong>
        {docTitle&&<small className="pw-muted">{docTitle}</small>}
      </div>
    </div>
    <div className="pw-row">
      {list.length>1&&onSelectDoc&&<div className="pw-preview-stepper" role="group" aria-label="เปลี่ยนฉบับตัวอย่าง"><button type="button" disabled={loading||!prevId} title={prevId?`ก่อนหน้า (${prevId==='OTHER'?'อื่นๆ':prevId})`:undefined} onClick={()=>prevId&&onSelectDoc(prevId)}>‹ ก่อนหน้า</button><button type="button" disabled={loading||!nextId} title={nextId?`ถัดไป (${nextId==='OTHER'?'อื่นๆ':nextId})`:undefined} onClick={()=>nextId&&onSelectDoc(nextId)}>ถัดไป ›</button></div>}
      {onJumpBinder&&<button type="button" onClick={onJumpBinder}>↑ การเรียงแฟ้ม</button>}
      <button type="button" onClick={onReload} disabled={loading}>โหลดฉบับล่าสุด</button>
      <button type="button" onClick={()=>setFit(!fit)}>{fit?'100%':'พอดีจอ'}</button>
    </div>
  </div>
  <p className="pw-hint">ฉบับที่บันทึกในระบบร่างหนังสือ{draft?` · รุ่น ${draft.version}`:''} · การเปลี่ยนข้อมูลกลางจะไม่ทับฉบับนี้จนกว่าจะสั่งอัปเดตชุดร่าง</p>
  <div className="pw-row"><button type="button" className="pw-primary" disabled={!draft||loading} onClick={onEdit}>แก้ไขฉบับนี้</button><button type="button" disabled={!draft||loading} onClick={()=>onDownload('pdf')}>โหลดฉบับนี้ PDF</button><button type="button" disabled={!draft||loading} onClick={()=>onDownload('docx')}>โหลดฉบับนี้ Word</button></div>
  <div className="pw-preview-canvas" ref={container}>{!draft?<div><p>{loading?'กำลังเปิดร่างฉบับจริง…':'ยังไม่มีร่างฉบับนี้ กรุณาสร้างชุดร่างก่อนดูตัวอย่าง'}</p>{!loading&&<button type="button" className="pw-primary" onClick={onCreate}>สร้างชุดร่างเพื่อดูตัวอย่าง</button>}</div>:<>{error&&<p className="pw-error" role="alert">{error}</p>}{!ready&&!error&&<p role="status">กำลังจัดหน้าจากร่างที่บันทึก…</p>}{html&&<div style={{width:Math.floor(794*scale),height:Math.ceil(height*scale),margin:'0 auto',overflow:'hidden'}}><iframe ref={frame} title={`ตัวอย่างเอกสาร ${docId}`} sandbox="allow-scripts allow-modals" srcDoc={html} style={{width:794,height,transform:`scale(${scale})`,transformOrigin:'top left'}}/></div>}<AttachmentPreview files={draft.attachmentFiles}/></>}</div>
  <small>TH Sarabun IT๙ · A4 · ตัวอย่าง {pages||'—'} หน้า{draft?.attachmentFiles.length?` · แนบ ${draft.attachmentFiles.reduce((n,a)=>n+a.pages,0)} หน้า`:''} · ใช้ฉบับเดียวกันสำหรับ Preview / PDF / Word</small>
 </section>;
}
