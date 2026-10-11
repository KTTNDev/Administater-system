"use client";
import { PdfPreview } from "./pdf-preview";
import { useState } from "react";
import type { Draft } from "@/lib/document";
import { uploadAttachment } from "@/app/attachment-actions";
type Props={draft:Draft;onChange:(files:Draft['attachmentFiles'])=>void;onBusy:(busy:boolean)=>void;onPhrase:(phrase:Draft['attachmentPhrase'])=>void};
export function AttachmentEditor({draft,onChange,onBusy,onPhrase}:Props){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');const files=draft.attachmentFiles;
 async function upload(selected:File[]){
  if(!selected.length)return;
  setBusy(true);onBusy(true);setError('');
  const next=[...files],errors:string[]=[];
  try{
   for(const file of selected){
    if(next.length>=10){errors.push('แนบได้ไม่เกิน 10 ไฟล์');break;}
    if(file.size>10*1024*1024){errors.push(`${file.name}: ไฟล์ต้องไม่เกิน 10 MB`);continue;}
    if(next.reduce((total,item)=>total+item.bytes,0)+file.size>50*1024*1024){errors.push(`${file.name}: ไฟล์แนบรวมเกิน 50 MB`);continue;}
    try{
     const form=new FormData();form.set('file',file);
     const result=await uploadAttachment(form);
     if(!result.ok){errors.push(`${file.name}: ${result.error}`);continue;}
     if(next.reduce((total,item)=>total+item.bytes,0)+result.data.bytes>50*1024*1024){errors.push(`${file.name}: ไฟล์หลังจัดรูปแบบทำให้เกิน 50 MB`);continue;}
     next.push(result.data);onChange([...next]);
    }catch(error){errors.push(`${file.name}: ${error instanceof Error?error.message:'อัปโหลดไม่สำเร็จ'}`);}
   }
  }finally{setError(errors.join(' · '));setBusy(false);onBusy(false);}
 }
 function move(index:number,offset:number){const next=[...files];[next[index],next[index+offset]]=[next[index+offset],next[index]];onChange(next);}
 return <details className="form-section" open={files.length>0}><summary><strong>ไฟล์ที่ส่งไปพร้อมหนังสือ</strong><span>{files.length} ไฟล์</span></summary><div className="field-grid">
 <label className="wide">{busy?'กำลังจัดเก็บไฟล์…':'เพิ่ม PDF หรือรูปภาพ (เลือกหลายไฟล์ได้)'}<input type="file" accept="application/pdf,image/png,image/jpeg" multiple disabled={busy||files.length>=10} onChange={e=>{const selected=Array.from(e.currentTarget.files||[]);e.currentTarget.value='';void upload(selected);}}/></label>
 <details className="form-help wide"><summary>ชนิดไฟล์และขนาดที่รองรับ</summary><p className="field-note">เลือกหลายไฟล์พร้อมกันได้สูงสุด 10 ไฟล์ ระบบเรียงตามลำดับที่เลือก และเลื่อนลำดับภายหลังได้ · ไม่เกิน 10 MB ต่อไฟล์ รวม 50 MB · Word/Excel กรุณาแปลงเป็น PDF · รูปภาพจัดลง A4 ส่วน PDF คงขนาดหน้าเดิม ไฟล์แนบใช้สำหรับอ่าน/พิมพ์ PDF รวมไม่เก็บช่องกรอกหรือการตรวจลายเซ็นดิจิทัล โปรดใช้ต้นฉบับสำหรับตรวจลายเซ็น</p></details>
 {error&&<p className="wide overflow-alert" role="alert">{error}</p>}
 {files.map((a,index)=><div className="wide attachment-card" key={a.id}><label>รายการที่ {index+1}<input disabled={busy} value={a.description} maxLength={300} onChange={e=>onChange(files.map(x=>x.id===a.id?{...x,description:e.target.value}:x))}/></label><label className="check-label"><input type="checkbox" disabled={busy} checked={a.showNameInDocument!==false} onChange={e=>onChange(files.map(x=>x.id===a.id?{...x,showNameInDocument:e.target.checked}:x))}/>แสดงชื่อรายการในเอกสาร</label><div className="attachment-controls"><label>จำนวน<input disabled={busy} type="number" min={1} max={999} value={a.quantity} onChange={e=>onChange(files.map(x=>x.id===a.id?{...x,quantity:Number(e.target.value)}:x))}/></label><label>หน่วย<select disabled={busy} value={a.unit} onChange={e=>onChange(files.map(x=>x.id===a.id?{...x,unit:e.target.value as typeof a.unit}:x))}>{['ฉบับ','ชุด','แผ่น'].map(unit=><option key={unit}>{unit}</option>)}</select></label><button type="button" title="เลื่อนขึ้น" disabled={busy||index===0} onClick={()=>move(index,-1)}>↑</button><button type="button" title="เลื่อนลง" disabled={busy||index===files.length-1} onClick={()=>move(index,1)}>↓</button><button type="button" disabled={busy} onClick={()=>onChange(files.filter(x=>x.id!==a.id))}>เอาออกจากร่าง</button></div><small>{a.name} · {a.originalAvailable&&<a href={`/api/attachments/${a.id}?original=1`}>ดาวน์โหลดต้นฉบับ</a>} · {a.pages} หน้า · {(a.bytes/1024/1024).toFixed(2)} MB</small></div>)}
 {!!files.length&&['internal','memorandum'].includes(draft.type)&&<label className="wide">ข้อความอ้างเอกสารแนบในเนื้อหา<select value={draft.attachmentPhrase} onChange={e=>onPhrase(e.target.value as Draft['attachmentPhrase'])}>{['ตามเอกสารที่แนบมาพร้อมนี้','รายละเอียดตามเอกสารแนบ','พร้อมนี้ได้แนบเอกสารประกอบการพิจารณา'].map(s=><option key={s}>{s}</option>)}</select></label>}
 <details className="form-help wide"><summary>การแสดงชื่อรายการและการรวมไฟล์</summary><p className="field-note">{draft.type==='external'?'ระบบแสดงไฟล์นี้ใน “สิ่งที่ส่งมาด้วย” ตามลำดับหลังเอกสารแนบท้ายและภาพประกอบ':'หนังสือภายในอ้างเอกสารในเนื้อความ ไม่เพิ่มหัวข้อ “สิ่งที่ส่งมาด้วย” ในส่วนหัว'} · ถ้าปิด “แสดงชื่อรายการในเอกสาร” ระบบจะพิมพ์เพียง “เอกสารแนบ” พร้อมจำนวนและหน่วย โดยยังแนบไฟล์ไว้{draft.attachments&&!files.length?' · ร่างเดิมมีข้อความรายการแนบ แต่ยังไม่มีไฟล์ กรุณาแนบไฟล์เพื่อให้รายการปรากฏ':''}</p></details>
 </div></details>;
}
export function AttachmentPreview({files}:{files:Draft['attachmentFiles']}){if(!files.length)return null;return <div className="attachment-preview"><h3>เอกสารแนบตามลำดับส่ง</h3><p>{files.length} ไฟล์ · {files.reduce((n,a)=>n+a.pages,0)} หน้า · ส่งออก PDF จะรวมต่อท้ายหนังสือปะหน้า</p>{files.map((a,i)=><section key={a.id}><h4>{i+1}. {a.description} <a href={`/api/attachments/${a.id}`} target="_blank" rel="noreferrer">เปิดเต็มจอ</a></h4><PdfPreview title={`เอกสารแนบ ${i+1} ${a.description}`} url={`/api/attachments/${a.id}`}/></section>)}</div>;}
