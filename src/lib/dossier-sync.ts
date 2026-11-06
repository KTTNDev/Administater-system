import 'server-only';
import fs from 'node:fs';
import {createHash,randomUUID} from 'node:crypto';
import {db,getSetting,setSetting} from './db';
import {storageConfig} from './storage';
import {driveClient,queueDriveJob,verifyDriveFolder} from './drive';
import {buildDossierSyncPlan,dossierOwnerSnapshot,type DossierEntry} from '../../scripts/dossier-sync-plan.mjs';
import {uploadDossierEntry} from '../../scripts/dossier-drive.mjs';
import {inside} from '../../scripts/workspace-files.mjs';
export type DossierJob={id:string;namespace:string;root:string;account:string;localRoot:string;createdAt:string;entries:DossierEntry[];skipped:{label:string;reason:string}[];queue:number[];cursor:number;permissionsVerified?:boolean;rootChecked?:boolean;finishedAt?:string;pauseReason?:string};
const jobKey='drive:dossier:job',leaseKey='drive:dossier:lease';
const runtime=globalThis as unknown as {sarabunDossierFolders?:{job:string;cache:Map<string,string>}};
function current(){const root=storageConfig().driveRoot.trim(),account=getSetting('google:account')||getSetting('google:email')||'';if(!root)throw Error('ระบุโฟลเดอร์ Drive ในตั้งค่าก่อน');if(!getSetting('google:token')||!account)throw Error('เชื่อมบัญชี Google Drive ก่อน');return {root,account,namespace:createHash('sha256').update(account+':'+root).digest('hex').slice(0,24),localRoot:storageConfig().localFolder};}
function read(){const raw=getSetting(jobKey);return raw?JSON.parse(raw) as DossierJob:null;}
function write(job:DossierJob){setSetting(jobKey,JSON.stringify(job));}
function assertContext(job:DossierJob){const c=current();if(c.root!==job.root||c.account!==job.account||c.localRoot!==job.localRoot)throw Error('บัญชีหรือที่เก็บเปลี่ยนแล้ว กรุณาเตรียมรายการใหม่');}
function acquire(){db().transaction(()=>{if(Number(getSetting(leaseKey)||0)>Date.now())throw Error('มีการส่งไฟล์จากหน้าต่างอื่นอยู่ กรุณารอแล้วลองอีกครั้ง');setSetting(leaseKey,String(Date.now()+300000));})();}
export function dossierSyncStatus(){const job=read();if(!job)return null;try{assertContext(job);return job;}catch{return null;}}
export function prepareDossierSync(){
 if(Number(getSetting(leaseKey)||0)>Date.now())throw Error('กำลังส่งไฟล์อยู่ กรุณาหยุดหรือรอให้รอบนี้เสร็จ');
 const c=current(),plan=buildDossierSyncPlan(db(),c.localRoot),job:DossierJob={...c,...plan,id:randomUUID(),createdAt:new Date().toISOString(),queue:plan.entries.map((_,i)=>i),cursor:0};write(job);runtime.sarabunDossierFolders={job:job.id,cache:new Map()};return job;
}
export function retryDossierSync(id:string){const job=read();if(!job||job.id!==id)throw Error('รายการซิงก์เปลี่ยนแล้ว กรุณาโหลดล่าสุด');assertContext(job);if(Number(getSetting(leaseKey)||0)>Date.now())throw Error('กำลังส่งไฟล์อยู่ กรุณารอ');job.queue=job.entries.flatMap((e,i)=>e.status==='synced'?[]:[i]);job.cursor=0;job.finishedAt=undefined;job.pauseReason=undefined;job.rootChecked=false;runtime.sarabunDossierFolders={job:job.id,cache:new Map()};write(job);return job;}
function readableError(error:unknown){const e=error as {code?:number;response?:{status?:number};message?:string};const status=Number(e.code||e.response?.status);if(status===401||/invalid_grant/i.test(e.message||''))return 'การเชื่อมต่อ Google หมดอายุ กรุณาเชื่อมบัญชีใหม่';if(status===403)return 'Drive ไม่อนุญาตให้เขียนไฟล์ หรือพื้นที่/โควตาไม่พอ';if(status===429)return 'Drive จำกัดจำนวนคำขอชั่วคราว กรุณาลองใหม่ภายหลัง';if(status>=500)return 'Google Drive ขัดข้องชั่วคราว กรุณาลองใหม่';if(e.message&&/[ก-๙]/.test(e.message))return e.message;return 'ติดต่อ Drive ไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองรายการที่ค้างอีกครั้ง';}
export async function advanceDossierSync(id:string){return queueDriveJob(async()=>{
 let job=read();if(!job||job.id!==id)throw Error('รายการซิงก์เปลี่ยนแล้ว กรุณาโหลดล่าสุด');assertContext(job);acquire();
 try{
  if(!job.rootChecked){const permission=await verifyDriveFolder(job.root,true);job.permissionsVerified=permission.publicAccess===false;job.rootChecked=true;write(job);}
  const drive=await driveClient();if(runtime.sarabunDossierFolders?.job!==id)runtime.sarabunDossierFolders={job:id,cache:new Map()};
  for(let batch=0;batch<2&&job.cursor<job.queue.length;batch++){
   const entry=job.entries[job.queue[job.cursor]];entry.status='uploading';entry.error=undefined;write(job);
   try{
    assertContext(job);const owner=dossierOwnerSnapshot(db(),entry.ownerKind,entry.ownerId,job.localRoot);if(!owner||owner.fingerprint!==entry.ownerFingerprint)throw Error('เรื่องหรือไฟล์แนบเปลี่ยนแล้ว กรุณาเตรียมรายการใหม่ก่อนส่ง');
    const bytes=fs.readFileSync(inside(job.localRoot,entry.relativePath));
    const result=await uploadDossierEntry(drive,{get:getSetting,set:setSetting},job.namespace,job.root,entry,bytes,runtime.sarabunDossierFolders!.cache);
    // Do not advertise a removed/changed local document as current even if the
    // snapshot was already accepted by Google while the user edited it.
    const latest=dossierOwnerSnapshot(db(),entry.ownerKind,entry.ownerId,job.localRoot);if(!latest||latest.fingerprint!==entry.ownerFingerprint)throw Error('ส่งฉบับก่อนแก้ไขแล้ว กรุณาเตรียมรายการใหม่เพื่อตรวจฉบับล่าสุด');
    Object.assign(entry,result,{status:'synced'});
   }catch(error){entry.status='failed';entry.error=readableError(error);runtime.sarabunDossierFolders!.cache.clear();const e=error as {code?:number;response?:{status?:number};message?:string};if(Number(e.code||e.response?.status)>=400||!/[ก-๙]/.test(e.message||''))job.pauseReason=entry.error;}
   job.cursor++;if(job.cursor>=job.queue.length)job.finishedAt=new Date().toISOString();write(job);if(job.pauseReason)break;
  }
  return job;
 }catch(error){throw Error(readableError(error));}finally{setSetting(leaseKey,'0');}
 });}
