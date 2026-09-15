"use client";
import { useEffect,useRef,useState } from 'react';
import type { PDFDocumentProxy,PDFDocumentLoadingTask,RenderTask } from 'pdfjs-dist';

function PdfPage({pdf,number}:{pdf:PDFDocumentProxy;number:number}){
 const host=useRef<HTMLDivElement>(null),canvas=useRef<HTMLCanvasElement>(null);
 const [visible,setVisible]=useState(false),[width,setWidth]=useState(600),[error,setError]=useState(''),[ready,setReady]=useState(false);
 useEffect(()=>{const element=host.current!;const observer=new IntersectionObserver(([entry])=>{if(entry.isIntersecting)setVisible(true);},{rootMargin:'300px'});observer.observe(element);const resize=new ResizeObserver(([entry])=>setWidth(Math.max(1,Math.round(entry.contentRect.width))));resize.observe(element);return()=>{observer.disconnect();resize.disconnect();};},[]);
 useEffect(()=>{if(!visible)return;let stopped=false;let render:RenderTask|undefined;const element=canvas.current!;setReady(false);setError('');
  (async()=>{const page=await pdf.getPage(number);if(stopped)return;const base=page.getViewport({scale:1});const scale=Math.min(width/base.width,2);const viewport=page.getViewport({scale});const ratio=Math.min(window.devicePixelRatio||1,2,Math.sqrt(16000000/(viewport.width*viewport.height)));element.width=Math.ceil(viewport.width*ratio);element.height=Math.ceil(viewport.height*ratio);element.style.width='100%';element.style.height='auto';const context=element.getContext('2d');if(!context)throw new Error('Canvas unavailable');render=page.render({canvas:element,canvasContext:context,viewport,transform:ratio===1?undefined:[ratio,0,0,ratio,0,0],background:'white'});await render.promise;if(!stopped)setReady(true);})().catch(()=>{if(!stopped)setError('แสดงหน้านี้ไม่สำเร็จ กรุณาลองโหลดไฟล์ใหม่');});
  return()=>{stopped=true;render?.cancel();};
 },[pdf,number,visible,width]);
 return <div ref={host} className="pdf-render-page" aria-label={`หน้า PDF ${number}`} style={{minHeight:ready?undefined:240}}><div className="pdf-page-label">หน้า {number}</div>{error?<p role="alert">{error}</p>:<>{!ready&&<p role="status">{visible?'กำลังแสดงหน้า…':'เลื่อนเพื่อดูหน้านี้'}</p>}<canvas ref={canvas} role="img" aria-label={`เอกสารหน้า ${number}`} data-rendered={ready?'true':'false'} style={{display:ready?'block':'none'}}/></>}</div>;
}
export function PdfPreview({url,title,pageNumber}:{url:string;title:string;pageNumber?:number}){
 const [pdf,setPdf]=useState<PDFDocumentProxy|null>(null),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let stopped=false;let task:PDFDocumentLoadingTask|undefined;setPdf(null);setError('');
  (async()=>{const lib=await import('pdfjs-dist');if(stopped)return;const base=`/vendor/pdfjs/${lib.version}/`;lib.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.mjs';task=lib.getDocument({url,withCredentials:true,cMapUrl:base+'cmaps/',cMapPacked:true,standardFontDataUrl:base+'standard_fonts/',wasmUrl:base+'wasm/'});const document=await task.promise;if(!stopped)setPdf(document);})().catch(()=>{if(!stopped)setError('โหลด PDF ไม่สำเร็จ โปรดลองใหม่หรือดาวน์โหลดไฟล์เพื่อตรวจสอบ');});
  return()=>{stopped=true;void task?.destroy();};
 },[url,attempt]);
 return <div className="pdf-preview" aria-label={title}>{error?<div role="alert"><p>{error}</p><button type="button" onClick={()=>setAttempt(n=>n+1)}>ลองใหม่</button> <a href={url} target="_blank" rel="noreferrer">เปิดไฟล์ PDF</a></div>:pdf?pageNumber?<PdfPage key={`${url}-${attempt}-${pageNumber}`} pdf={pdf} number={Math.max(1,Math.min(pdf.numPages,pageNumber))}/>:Array.from({length:pdf.numPages},(_,i)=><PdfPage key={`${url}-${attempt}-${i}`} pdf={pdf} number={i+1}/>):<p role="status">กำลังโหลด PDF…</p>}</div>;
}
