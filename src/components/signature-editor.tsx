"use client";
import {useRef,useState} from "react";
import {PenLine,MousePointer2,Trash2,Minus,Plus} from "lucide-react";
import type {Draft} from "@/lib/document";
import {fitFloatingImage,isSignature} from "@/lib/floating-item";
import {uploadAppendixImage} from "@/app/appendix-actions";

type Props={items:Draft["floatingItems"];pages:number;sources:Record<string,string>;onChange:(items:Draft["floatingItems"])=>void;onSources:(sources:Record<string,string>)=>void;onBusy:(busy:boolean)=>void;onPlace:(id:string)=>void};
export function SignatureEditor({items,pages,sources,onChange,onSources,onBusy,onPlace}:Props){
 const input=useRef<HTMLInputElement>(null),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const signatures=items.filter(isSignature);
 function resize(id:string,widthMm:number){onChange(items.map(item=>item.id===id&&isSignature(item)?fitFloatingImage(item,{widthMm}):item))}
 async function upload(file:File){
  setBusy(true);onBusy(true);setError("");
  try{
   if(items.length>=30)throw new Error("เพิ่มข้อความและภาพได้รวมสูงสุด 30 รายการ");
   const form=new FormData();form.set("file",file);const result=await uploadAppendixImage(form);
   if(!result.ok)throw new Error(result.error);
   const {source,caption,widthMm,...image}=result.data;
   if(image.height/image.width>29)throw new Error("ภาพสูงเกินหน้ากระดาษ กรุณาเลือกภาพเฉพาะส่วนลายเซ็น");
   const item=fitFloatingImage({kind:"image",purpose:"signature",id:crypto.randomUUID(),page:1,xMm:110,yMm:180,widthMm:45,image});
   onSources({...sources,[image.id]:source});onChange([...items,item]);onPlace(item.id);
  }catch(e){setError(e instanceof Error?e.message:"เพิ่มภาพลายเซ็นไม่สำเร็จ")}
  finally{setBusy(false);onBusy(false)}
 }
 return <details className="signature-editor wide" open={signatures.length>0}>
  <summary><PenLine size={17}/><strong>ลายเซ็น (ภาพ)</strong><span>{signatures.length?`${signatures.length} รายการ`:"ถ้ามี"}</span></summary>
  <div className="signature-editor-body">
   <p className="compact-hint">เลือกภาพ แล้วคลิกวางบนหน้าตัวอย่าง ลากภาพเพื่อย้าย หรือลากมุมล่างขวาเพื่อปรับขนาด</p>
   <input ref={input} type="file" accept="image/png,image/jpeg" aria-label="ไฟล์ภาพลายเซ็น" hidden disabled={busy||items.length>=30} onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value="";if(file)void upload(file)}}/>
   <button type="button" className="secondary signature-upload" disabled={busy||items.length>=30} onClick={()=>input.current?.click()}><PenLine size={16}/>{busy?"กำลังเพิ่มภาพ…":"แนบภาพลายเซ็น"}</button>
   <small className="field-note">PNG โปร่งใสหรือ JPG ไม่เกิน 10 MB · เป็นภาพลายเซ็น ไม่ใช่การลงนามด้วยใบรับรองดิจิทัล</small>
   {error&&<p className="error-text" role="alert">{error}</p>}
   {signatures.map((item,index)=><section className="signature-entry" key={item.id} aria-label={`ลายเซ็นที่ ${index+1}`}>
    <div className="signature-entry-heading"><div className="signature-image">{sources[item.image.id]&&<img src={sources[item.image.id]} alt={`ลายเซ็นที่ ${index+1}`}/>}</div><span>{item.image.name}</span><button type="button" aria-label={`ลบลายเซ็นที่ ${index+1}`} onClick={()=>onChange(items.filter(other=>other.id!==item.id))}><Trash2 size={16}/></button></div>
    <div className="signature-controls"><button type="button" className="secondary" onClick={()=>onPlace(item.id)}><MousePointer2 size={16}/>คลิกวางตำแหน่ง</button><label>หน้า<select value={item.page} onChange={e=>onChange(items.map(other=>other.id===item.id?{...other,page:Number(e.target.value)}:other))}>{Array.from({length:Math.max(pages,item.page)},(_,i)=><option key={i} value={i+1}>{i+1}</option>)}</select></label></div>
    <div className="signature-size"><button type="button" aria-label={`ย่อลายเซ็นที่ ${index+1}`} disabled={item.widthMm<=10} onClick={()=>resize(item.id,item.widthMm-5)}><Minus size={16}/></button><input aria-label={`ขนาดลายเซ็นที่ ${index+1}`} type="range" min="10" max={Math.min(180,Math.floor(297*item.image.width/item.image.height))} step="1" value={item.widthMm} onChange={e=>resize(item.id,Number(e.target.value))}/><button type="button" aria-label={`ขยายลายเซ็นที่ ${index+1}`} disabled={item.widthMm>=Math.min(180,297*item.image.width/item.image.height)} onClick={()=>resize(item.id,item.widthMm+5)}><Plus size={16}/></button><output>{item.widthMm} มม.</output></div>
   </section>)}
  </div>
 </details>;
}
