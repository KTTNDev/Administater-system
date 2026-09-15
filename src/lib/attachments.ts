import "server-only";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PDFDocument, PDFName } from "pdf-lib";
import { db } from "./db";
import { storageConfig } from "./storage";
import type { Draft } from "./document";

export function attachmentTable(){db().exec(`CREATE TABLE IF NOT EXISTS document_attachments(id TEXT PRIMARY KEY,name TEXT NOT NULL,pages INTEGER NOT NULL,file BLOB NOT NULL,created_at TEXT NOT NULL)`);const columns=db().prepare("PRAGMA table_info(document_attachments)").all().map(r=>r.name);if(!columns.includes("original"))db().exec("ALTER TABLE document_attachments ADD COLUMN original BLOB");if(!columns.includes("original_name"))db().exec("ALTER TABLE document_attachments ADD COLUMN original_name TEXT");}
export function readAttachment(id:string){attachmentTable();const r=db().prepare('SELECT * FROM document_attachments WHERE id=?').get(id);if(!r)throw new Error('ไม่พบไฟล์แนบ กรุณาแนบไฟล์ใหม่');return {id:String(r.id),name:String(r.name),pages:Number(r.pages),file:Buffer.from(r.file as Uint8Array),original:r.original?Buffer.from(r.original as Uint8Array):null,originalName:r.original_name?String(r.original_name):null};}
export function validateAttachments(d:Draft){let total=0;const seen=new Set<string>();for(const a of d.attachmentFiles){if(seen.has(a.id))throw new Error('มีไฟล์แนบซ้ำ');seen.add(a.id);const row=readAttachment(a.id);if(row.pages!==a.pages||row.file.length!==a.bytes||row.name!==a.name)throw new Error('ข้อมูลไฟล์แนบไม่ตรงกับไฟล์ที่จัดเก็บ');total+=a.bytes;}if(total>50*1024*1024)throw new Error('ไฟล์แนบรวมเกิน 50 MB');}
export async function createAttachment(file:File){
 if(!file.size||file.size>10*1024*1024)throw new Error('แนบ PDF, PNG หรือ JPEG ไม่เกิน 10 MB ต่อไฟล์');
 const bytes=Buffer.from(await file.arrayBuffer());const output=await PDFDocument.create();
 if(bytes.subarray(0,5).toString()==='%PDF-'){
   const source=await PDFDocument.load(bytes);if(source.getPageCount()>200||source.getPageCount()===0)throw new Error('ไฟล์ PDF ต้องมี 1–200 หน้า');
   const pages=await output.copyPages(source,source.getPageIndices());for(const page of pages){page.node.delete(PDFName.of('Annots'));page.node.delete(PDFName.of('AA'));output.addPage(page);}
 }else if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.subarray(0,3).equals(Buffer.from([255,216,255]))){
   const picture=bytes[0]===137?await output.embedPng(bytes):await output.embedJpg(bytes);const page=output.addPage([595.28,841.89]);const size=picture.scale(Math.min(555.28/picture.width,801.89/picture.height));page.drawImage(picture,{x:(595.28-size.width)/2,y:(841.89-size.height)/2,...size});
 }else throw new Error('รองรับ PDF, PNG และ JPEG เท่านั้น กรุณาแปลง Word/Excel เป็น PDF ก่อนแนบ');
 const pdf=Buffer.from(await output.save());if(pdf.length>15*1024*1024)throw new Error('ไฟล์หลังจัดรูปแบบมีขนาดใหญ่เกินกำหนด');
 const id=randomUUID(),name=file.name.replace(/[\\/\x00-\x1f]/g,'_').slice(0,235).replace(/\.[^.]+$/,'')+'.pdf';
 const folder=path.join(storageConfig().localFolder,'เอกสารแนบ');fs.mkdirSync(folder,{recursive:true});fs.writeFileSync(path.join(folder,id+'.pdf'),pdf,{flag:'wx'});
 attachmentTable();db().prepare('INSERT INTO document_attachments(id,name,pages,file,created_at,original,original_name) VALUES(?,?,?,?,?,?,?)').run(id,name,output.getPageCount(),pdf,new Date().toISOString(),bytes,file.name.replace(/[\\/\x00-\x1f]/g,"_").slice(0,240));
 fs.writeFileSync(path.join(folder,id+"-original"),bytes,{flag:"wx"});
 return {originalAvailable:true,id,name,description:name.replace(/\.pdf$/i,''),pages:output.getPageCount(),bytes:pdf.length,quantity:1,unit:'ฉบับ' as const};
}
export async function appendAttachments(cover:Buffer,d:Draft){if(!d.attachmentFiles.length)return cover;validateAttachments(d);const target=await PDFDocument.load(cover);for(const item of d.attachmentFiles){const source=await PDFDocument.load(readAttachment(item.id).file);for(const page of await target.copyPages(source,source.getPageIndices()))target.addPage(page);}return Buffer.from(await target.save());}
