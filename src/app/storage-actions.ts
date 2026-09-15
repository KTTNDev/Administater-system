"use server";
import fs from "node:fs";
import path from "node:path";
import { requireUser } from "@/lib/auth";
import { storageConfig,setStorage,exportWorkspace,reportData } from "@/lib/storage";
import { listLegalReferences,uploadLegalReference } from "./legal-actions";
import { listDrafts } from "@/lib/db";
import { syncToDrive,verifyDriveFolder,uploadBackupFile,driveStatus } from "@/lib/drive";
export async function getStorage(){await requireUser();return {...storageConfig(),drive:driveStatus()};}
export async function saveStorage(local:string,root:string,backup:string){await requireUser();const id=(v:string)=>v.match(/\/folders\/([\w-]+)/)?.[1]||v.trim();return setStorage(local,id(root),id(backup));}
export async function exportLocal(){await requireUser();return exportWorkspace();}
export async function getReports(){await requireUser();return reportData();}
export async function checkDrive(){await requireUser();return verifyDriveFolder(storageConfig().driveRoot,false);}
export async function syncWorkspace(){await requireUser();const config=storageConfig();await verifyDriveFolder(config.backupRoot||config.driveRoot,true);const result:{name:string;ok:boolean;message:string}[]=[];
 for(const d of listDrafts().filter(d=>d.status==="reviewed"&&d.confidentiality==="ปกติ"&&d.syncedVersion!==d.version)){try{await verifyDriveFolder(config.driveRoot,true);await syncToDrive(d.id,d.version);result.push({name:d.subject,ok:true,message:"PDF อัปโหลดแล้ว"});}catch(e){result.push({name:d.subject,ok:false,message:e instanceof Error?e.message:"อัปโหลดไม่สำเร็จ"});}}
 for(const law of (await listLegalReferences()).filter(x=>x.fileName&&!x.driveFileId)){try{await uploadLegalReference(law.id);result.push({name:law.title,ok:true,message:"อัปโหลด PDF แล้ว"});}catch(e){result.push({name:law.title,ok:false,message:e instanceof Error?e.message:"อัปโหลดไม่สำเร็จ"});}}
 const backup=exportWorkspace();for(const file of fs.readdirSync(backup.folder)){try{await uploadBackupFile(path.join(backup.folder,file),config.backupRoot||config.driveRoot,path.basename(backup.folder));result.push({name:file,ok:true,message:"สำรองแล้ว"});}catch(e){result.push({name:file,ok:false,message:e instanceof Error?e.message:"สำรองไม่สำเร็จ"});}}
 return {result,localFolder:backup.folder};}

export async function exportDocumentPdfs(){await requireUser();const {renderPdf}=await import("@/lib/pdf");const {storeDocumentPdf}=await import("@/lib/storage");const result:{name:string;ok:boolean;message:string}[]=[];for(const d of listDrafts()){try{const file=storeDocumentPdf(d,await renderPdf(d));result.push({name:d.subject,ok:true,message:file});}catch(e){result.push({name:d.subject,ok:false,message:e instanceof Error?e.message:"สร้าง PDF ไม่สำเร็จ"});}}return result;}
