"use client";
import {useEffect,useState} from "react";
import {ExternalLink,FileCheck2,Trash2,Upload,X} from "lucide-react";
import type {SavedDraft} from "@/lib/document";
import type {SignedScan} from "@/lib/signed-scans";
import {deleteSignedScan,getSignedScans,uploadSignedScan} from "@/app/signed-scan-actions";

export function SignedScansManager({document,onClose,onChanged}:{document:SavedDraft;onClose:()=>void;onChanged:()=>void}){
 const [items,setItems]=useState<SignedScan[]>([]);
 const [confirmed,setConfirmed]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 useEffect(()=>{let active=true;getSignedScans(document.id).then(list=>{if(active)setItems(list)}).catch(e=>{if(active)setError(e instanceof Error?e.message:"โหลดไฟล์ไม่สำเร็จ")});return()=>{active=false}},[document.id]);
 async function upload(files:File[]){
  if(!files.length)return;
  setBusy(true);setError("");
  try{
   for(const file of files){
    const form=new FormData();form.set("file",file);form.set("confirmed","yes");
    const result=await uploadSignedScan(document.id,form);
    if(!result.ok)throw new Error(result.error);
   }
   setItems(await getSignedScans(document.id));onChanged();setConfirmed(false);
  }catch(e){setItems(await getSignedScans(document.id));onChanged();setError(e instanceof Error?e.message:"อัปโหลดไม่สำเร็จ")}
  finally{setBusy(false)}
 }
 async function remove(id:string){
  if(!confirm("ลบไฟล์สแกนฉบับลงนามนี้ออกจากระบบหรือไม่?"))return;
  setBusy(true);setError("");
  try{const result=await deleteSignedScan(document.id,id);if(!result.ok)throw new Error(result.error);setItems(await getSignedScans(document.id));onChanged()}
  catch(e){setError(e instanceof Error?e.message:"ลบไฟล์ไม่สำเร็จ")}
  finally{setBusy(false)}
 }
 return <div className="signed-scans-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="signed-scans-dialog" role="dialog" aria-modal="true" aria-label="ไฟล์สแกนฉบับลงนาม"><header><div><h2><FileCheck2 size={21}/> ไฟล์สแกนฉบับลงนาม</h2><p>{document.subject}</p></div><button type="button" aria-label="ปิด" onClick={onClose}><X size={18}/></button></header><p className="field-note">เก็บ PDF หรือภาพสแกนฉบับที่ลงนามแล้วไว้กับรายการนี้ สถานะนี้ระบุจากการอัปโหลดของผู้ใช้ ระบบไม่ได้ตรวจลายมือชื่ออัตโนมัติ</p><div className="signed-scans-list">{items.length?items.map(item=><div className="signed-scan-row" key={item.id}><FileCheck2 size={18}/><div><strong>{item.name}</strong><small>{(item.bytes/1024/1024).toFixed(2)} MB · {new Date(item.uploadedAt).toLocaleString("th-TH")}</small></div><a href={`/api/signed-scans/${item.id}`} target="_blank" rel="noreferrer" aria-label={`เปิด ${item.name}`} title="เปิดไฟล์"><ExternalLink size={17}/></a><a href={`/api/signed-scans/${item.id}?download=1`} aria-label={`ดาวน์โหลด ${item.name}`} title="ดาวน์โหลด">↓</a><button type="button" aria-label={`ลบ ${item.name}`} title="ลบไฟล์" disabled={busy} onClick={()=>void remove(item.id)}><Trash2 size={17}/></button></div>):<p>ยังไม่มีไฟล์สแกนฉบับลงนาม</p>}</div><label className="signed-scan-confirm"><input type="checkbox" checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/> ยืนยันว่าไฟล์ที่เลือกเป็นฉบับลงนามหรืออนุมัติแล้ว</label><label className={`signed-scan-upload ${!confirmed||busy?"disabled":""}`}><Upload size={17}/> {busy?"กำลังอัปโหลด…":"เพิ่มไฟล์ PDF, PNG หรือ JPEG"}<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" multiple disabled={!confirmed||busy||items.length>=10} onChange={event=>{const files=Array.from(event.currentTarget.files||[]);event.currentTarget.value="";void upload(files)}}/></label><small>สูงสุด 10 ไฟล์ · ไฟล์ละไม่เกิน 15 MB · รวมไม่เกิน 50 MB</small>{error&&<p className="overflow-alert" role="alert">{error}</p>}</section></div>;
}
