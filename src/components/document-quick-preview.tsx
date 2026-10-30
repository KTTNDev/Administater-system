"use client";
import {useEffect,useRef,useState} from "react";
import {createPortal} from "react-dom";
import {ArrowRight,RefreshCw,X} from "lucide-react";
import type {SavedDraft} from "@/lib/document";
import type {DocumentAssets} from "@/lib/render-document";
import {getAppendixImageSources} from "@/app/appendix-actions";
import {AttachmentPreview} from "./attachment-editor";

// A read-only doorway into the existing renderer; all editing stays in DocumentForm.
export function DocumentQuickPreview({document:doc,assets,onClose,onEdit}:{document:SavedDraft;assets:DocumentAssets;onClose:()=>void;onEdit:()=>void}) {
 const frame=useRef<HTMLIFrameElement>(null),viewport=useRef<HTMLDivElement>(null),close=useRef<HTMLButtonElement>(null);
 const [mounted,setMounted]=useState(false);
 const [html,setHtml]=useState(""),[error,setError]=useState(false),[ready,setReady]=useState(false),[overflow,setOverflow]=useState(false),[revision,setRevision]=useState(0),[height,setHeight]=useState(1123),[scale,setScale]=useState(.6);
 useEffect(()=>{setMounted(true)},[]);
 useEffect(()=>{if(mounted)close.current?.focus()},[mounted]);
 useEffect(()=>{const e=viewport.current;if(!e)return;const observer=new ResizeObserver(([entry])=>setScale(Math.max(.1,Math.min(1,(entry.contentRect.width-32)/794))));observer.observe(e);return()=>observer.disconnect()},[mounted]);
 useEffect(()=>{
  let active=true;setHtml("");setError(false);setReady(false);setOverflow(false);setHeight(1123);
  const ids=[...new Set([...doc.appendixImages.map(i=>i.id),...doc.floatingItems.filter(i=>i.kind==="image").map(i=>i.image.id)])];
  Promise.all([import("@/lib/render-document"),ids.length?getAppendixImageSources(ids):Promise.resolve({})]).then(([{documentHtml},sources])=>{if(active)setHtml(documentHtml(doc,assets,sources))}).catch(()=>{if(active)setError(true)});
  return()=>{active=false};
 },[doc,assets,revision]);
 useEffect(()=>{
  const message=(e:MessageEvent)=>{if(e.source!==frame.current?.contentWindow||e.data?.source!=="sarabun-preview")return;const m=e.data;if(m.error||!Number.isFinite(m.height)||m.height<=0){setError(true);return}setHeight(m.height);setOverflow(!!m.overflow);setReady(true)};
  window.addEventListener("message",message);return()=>window.removeEventListener("message",message);
 },[]);
 useEffect(()=>{if(ready||error)return;const timer=setTimeout(()=>setError(true),20000);return()=>clearTimeout(timer)},[html,ready,error,revision]);
 // Portal avoids transformed page ancestors changing the fixed panel position.
 if(!mounted)return null;
 return createPortal(<aside className="document-peek" role="dialog" aria-modal="false" aria-label="ดูเอกสารอย่างรวดเร็ว" onKeyDown={e=>{if(e.key==="Escape"){e.stopPropagation();onClose()}}}>
  <header><div><small>ตัวอย่างฉบับที่บันทึกไว้ · เลือกเรื่องอื่นจากรายการได้</small><h2>{doc.subject}</h2></div><button ref={close} aria-label="ปิดตัวอย่างเอกสาร" onClick={onClose}><X size={20}/></button></header>
  <div className="document-peek-actions"><button className="primary" onClick={onEdit}>เปิดแก้ไขเอกสาร<ArrowRight size={16}/></button><button aria-label="โหลดตัวอย่างด่วนใหม่" onClick={()=>setRevision(r=>r+1)}><RefreshCw size={16}/></button></div>
  <div className="document-peek-paper" ref={viewport}>
   {overflow&&<p role="alert">มีองค์ประกอบยาวเกินหน้า กรุณาเปิดแก้ไขและตรวจรูปแบบก่อนพิมพ์</p>}
   {error?<p role="alert">โหลดตัวอย่างไม่สำเร็จ กรุณาลองใหม่หรือเปิดแก้ไขเอกสาร</p>:!ready&&<p role="status">กำลังจัดหน้าเอกสาร…</p>}
   {html&&<div style={{width:794*scale,height:height*scale,margin:"0 auto"}}><iframe ref={frame} title="ตัวอย่างเอกสารจากรายการ" sandbox="allow-scripts allow-modals" srcDoc={html} style={{width:794,height,transform:`scale(${scale})`,transformOrigin:"top left",border:0}}/></div>}
   <AttachmentPreview files={doc.attachmentFiles}/>
  </div>
 </aside>,window.document.body);
}
