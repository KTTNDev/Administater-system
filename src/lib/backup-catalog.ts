import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {storageConfig} from './storage';
const execute=promisify(execFile);
const root=()=>path.join(storageConfig().localFolder,'สำรองข้อมูล');
function sourceFor(name:string){
 if(!name||name.length>150||name==='.'||name==='..'||/[\\/:]/.test(name))throw new Error('ชื่อชุดสำรองไม่ถูกต้อง');
 const base=fs.realpathSync.native(root()),source=fs.realpathSync.native(path.join(base,name));
 if(path.relative(base,path.dirname(source))!=='')throw new Error('ชุดสำรองต้องอยู่ในโฟลเดอร์สำรองที่ตั้งค่าไว้');
 return source;
}
export function backupCatalog(){
 if(!fs.existsSync(root()))return [];
 return fs.readdirSync(root(),{withFileTypes:true}).filter(e=>e.isDirectory()&&!e.isSymbolicLink()).map(entry=>{
  try{const source=sourceFor(entry.name),m=JSON.parse(fs.readFileSync(path.join(source,'manifest.json'),'utf8'));
   return {name:entry.name,at:String(m.at||''),version:Number(m.schemaVersion),files:Array.isArray(m.files)?m.files.length:0,documents:Number(m.counts?.documents||0)};
  }catch{return null;}
 }).filter((x):x is NonNullable<typeof x>=>x!==null).sort((a,b)=>b.at.localeCompare(a.at));
}
export async function restoreCatalogBackup(name:string){
 const source=sourceFor(name);
 const parent=path.join(storageConfig().localFolder,'กู้คืนข้อมูล');fs.mkdirSync(parent,{recursive:true});
 const destination=path.join(parent,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
 const script=path.join(process.env.SARABUN_SOURCE_DIR||process.cwd(),'scripts','restore-backup.mjs');
 try{await execute(process.execPath,[script,source,destination],{windowsHide:true,timeout:120000,maxBuffer:1024*1024});}
 catch{throw new Error('กู้คืนไม่สำเร็จ: ตรวจว่าชุดสำรองเป็นรุ่น 2 ไฟล์ครบและไม่เสียหาย และพื้นที่ปลายทางเขียนได้');}
 return {folder:destination,database:path.join(destination,'data','sarabun.sqlite')};
}
