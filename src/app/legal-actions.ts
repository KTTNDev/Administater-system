"use server";
import { z } from "zod";
import { randomUUID,createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { mirrorLegal } from "@/lib/storage";
import { legalSchema } from "@/lib/legal";
import { uploadLibraryPdf } from "@/lib/drive";
function connection(){const c=db();c.exec("CREATE TABLE IF NOT EXISTS legal_library(id TEXT PRIMARY KEY,data TEXT NOT NULL,file BLOB,file_name TEXT,updated_at TEXT NOT NULL)");return c;}
export async function listLegalReferences(){await requireUser();return connection().prepare("SELECT id,data,file_name,updated_at FROM legal_library ORDER BY updated_at DESC").all().map(r=>({id:String(r.id),...legalSchema.parse(JSON.parse(String(r.data))),fileName:r.file_name?String(r.file_name):null,updatedAt:String(r.updated_at)}));}
export async function saveLegalReference(form:FormData){
 await requireUser();const id=form.get("id")?z.string().uuid().parse(form.get("id")):randomUUID(),file=form.get("file");let bytes:Buffer|null=null,name:string|null=null;
 if(file instanceof File&&file.size){if(file.size>10*1024*1024)throw new Error("PDF ต้องไม่เกิน 10 MB");bytes=Buffer.from(await file.arrayBuffer());if(bytes.subarray(0,5).toString()!=="%PDF-")throw new Error("รองรับไฟล์ PDF เท่านั้น");name=file.name.slice(0,200);}
 const c=connection();c.transaction(()=>{const old=c.prepare("SELECT data,updated_at FROM legal_library WHERE id=?").get(id);if(form.get("id")&&!old)throw new Error("ไม่พบรายการเดิม กรุณาโหลดคลังใหม่");if(old&&form.get("updatedAt")&&String(old.updated_at)!==form.get("updatedAt"))throw new Error("รายการเปลี่ยนแล้ว กรุณาปิดฟอร์มและโหลดใหม่");
 const previous=old?JSON.parse(String(old.data)):{};const fields=Object.fromEntries(["title","url","section","notes","category","tags","year","status","highlight","page"].filter(k=>form.has(k)).map(k=>[k,String(form.get(k)||"")]));const data=legalSchema.parse({...previous,...fields});if(bytes||["title","category","year"].some(k=>previous[k]!==data[k as keyof typeof data])){data.driveFileId="";data.driveHash="";}
 const at=new Date(Math.max(Date.now(),old?Date.parse(String(old.updated_at))+1:0)).toISOString();c.prepare("INSERT INTO legal_library(id,data,file,file_name,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,file=COALESCE(excluded.file,legal_library.file),file_name=COALESCE(excluded.file_name,legal_library.file_name),updated_at=excluded.updated_at").run(id,JSON.stringify(data),bytes,name,at);
 c.prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(id,old?"legal_update":"legal_create",1,at);
 })();try{mirrorLegal(id);}catch{throw new Error("บันทึกในฐานข้อมูลแล้ว แต่เขียนสำเนา PDF ไม่สำเร็จ กรุณาตรวจพาธในตั้งค่าและกดส่งออกในเครื่อง");}revalidatePath("/");return id;
}
export async function uploadLegalReference(id:string){await requireUser();const key=z.string().uuid().parse(id),c=connection(),row=c.prepare("SELECT * FROM legal_library WHERE id=?").get(key);if(!row?.file)throw new Error("กรุณาแนบ PDF และบันทึกเข้าคลังก่อน");const data=legalSchema.parse(JSON.parse(String(row.data))),bytes=Buffer.from(row.file as Uint8Array),hash=createHash("sha256").update(bytes).update(JSON.stringify([data.title,data.category,data.year])).digest("hex");
 const fileId=await uploadLibraryPdf({id:key,hash,title:data.title,category:data.category,year:data.year,bytes});
 c.transaction(()=>{const latest=c.prepare("SELECT data,updated_at FROM legal_library WHERE id=?").get(key);if(latest&&String(latest.updated_at)===String(row.updated_at)){c.prepare("UPDATE legal_library SET data=? WHERE id=?").run(JSON.stringify({...JSON.parse(String(latest.data)),driveFileId:fileId,driveHash:hash}),key);}else throw new Error("อัปโหลดฉบับก่อนแก้ไขแล้ว แต่รายการเปลี่ยนระหว่างอัปโหลด กรุณาโหลดคลังและอัปโหลดฉบับล่าสุดอีกครั้ง");})();revalidatePath("/");return fileId;
}
export async function deleteLegalReference(id:string){await requireUser();const key=z.string().uuid().parse(id),c=connection();c.transaction(()=>{const used=c.prepare("SELECT data FROM documents").all().some(r=>(JSON.parse(String(r.data)).legalReferenceIds||[]).includes(key));if(used)throw new Error("รายการนี้ถูกอ้างอิงในร่างหนังสือ กรุณาถอดการเชื่อมโยงก่อนลบ");c.prepare("DELETE FROM legal_library WHERE id=?").run(key);})();revalidatePath("/");}
