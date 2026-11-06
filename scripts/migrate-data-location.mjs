import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {parseEnv} from 'node:util';
import {execFileSync} from 'node:child_process';
import {inside,atomicFile,fileHash,mirrorWorkspaceFiles} from './workspace-files.mjs';

function tree(root){
 if(!fs.existsSync(root))return [];
 const result=[];function walk(relative){for(const item of fs.readdirSync(inside(root,relative),{withFileTypes:true})){
  const rel=path.join(relative,item.name);if(item.isSymbolicLink())throw Error('พบลิงก์ในโฟลเดอร์เดิม กรุณาจัดเก็บเป็นไฟล์จริงก่อนย้าย');
  if(!relative&&item.name==='ฐานข้อมูล')continue;
  if(item.isDirectory())walk(rel);else if(item.isFile()){const stat=fs.statSync(inside(root,rel));result.push({relative:rel,bytes:stat.size});}
  if(result.length>100000)throw Error('โฟลเดอร์มีไฟล์มากเกินไป กรุณาตรวจตำแหน่งต้นทาง');
 }}walk('');return result;
}
function checkTarget(source,folder,database){
 if(!path.isAbsolute(folder)||folder.length>180||/[\r\n\0]/.test(folder))throw Error('เลือกโฟลเดอร์ย่อยด้วยพาธเต็ม ความยาวไม่เกิน 180 ตัวอักษร');
 const target=path.resolve(folder);if(target===path.parse(target).root)throw Error('เลือกโฟลเดอร์ย่อย ไม่ใช้รากไดรฟ์');
 for(const base of [source,path.dirname(database)]){const a=path.relative(base,target),b=path.relative(target,base);if(!a||(!a.startsWith('..'+path.sep)&&a!=='..'&&!path.isAbsolute(a))||!b||(!b.startsWith('..'+path.sep)&&b!=='..'&&!path.isAbsolute(b)))throw Error('พื้นที่ใหม่ต้องแยกจากโฟลเดอร์ข้อมูลเดิม ไม่ซ้อนกัน');}
 let parent=target;while(!fs.existsSync(parent)){const next=path.dirname(parent);if(parent===next)throw Error('ไม่พบไดรฟ์ปลายทาง');parent=next;}
 let scan=parent;while(true){if(fs.lstatSync(scan).isSymbolicLink())throw Error('พื้นที่ใหม่ต้องไม่อยู่ผ่านลิงก์หรือ Junction');const next=path.dirname(scan);if(next===scan)break;scan=next;}
 if(fs.existsSync(target)&&(!fs.statSync(target).isDirectory()||fs.readdirSync(target).length))throw Error('เลือกโฟลเดอร์ว่างสำหรับข้อมูลระบบ เพื่อไม่ปะปนหรือเขียนทับงานเดิม');
 const probe=path.join(parent,'.sarabun-probe-'+randomUUID());try{fs.writeFileSync(probe,'ok',{flag:'wx'});}finally{if(fs.existsSync(probe))fs.unlinkSync(probe);}
 return {target,freeBytes:Number(fs.statfsSync(parent).bavail)*Number(fs.statfsSync(parent).bsize)};
}
export function planDataMove({sourceRoot,database,localFolder,target}){
 const config=path.join(sourceRoot,'.env.local');if(!fs.existsSync(config))throw Error('ไม่พบไฟล์ตั้งค่าเริ่มระบบ');
 const destination=checkTarget(localFolder,target,database),files=tree(localFolder),bytes=files.reduce((n,f)=>n+f.bytes,0)+fs.statSync(database).size;
 if(destination.freeBytes<bytes*2+128*1024*1024)throw Error('พื้นที่ปลายทางไม่พอสำหรับข้อมูลและการตรวจสำเนา');
 return {database,localFolder,target:destination.target,files:files.length,bytes,freeBytes:destination.freeBytes,configurationHash:fileHash(fs.readFileSync(config))};
}
function privateFolder(folder){fs.mkdirSync(folder,{recursive:true,mode:0o700});if(process.platform==='win32'){
 const identity=execFileSync('whoami.exe',['/user','/fo','csv','/nh'],{encoding:'utf8',windowsHide:true}),sid=identity.match(/S-1-5-[\d-]+/)?.[0];if(!sid)throw Error('ตรวจสิทธิ์สำรองในเครื่องไม่สำเร็จ');
 execFileSync('icacls.exe',[folder,'/inheritance:r','/grant:r','*'+sid+':(OI)(CI)F','*S-1-5-18:(OI)(CI)F'],{windowsHide:true});
}}
export function migrateDataLocation(input){
 const plan=planDataMove(input);if(input.configurationHash!==plan.configurationHash)throw Error('การตั้งค่าเปลี่ยนแล้ว กรุณาตรวจแผนย้ายอีกครั้ง');
 const source=new DatabaseSync(plan.database),configFile=path.join(input.sourceRoot,'.env.local'),oldConfig=fs.readFileSync(configFile,'utf8');
 const targetDatabase=path.join(plan.target,'ฐานข้อมูล','sarabun.sqlite'),checkpoint=path.join(input.sourceRoot,'output','data-migrations',new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID().slice(0,8));
 let committed=false,guarded=false;
 try{
  source.exec('PRAGMA busy_timeout=5000; BEGIN IMMEDIATE');guarded=true;
  const lease=Number(source.prepare("SELECT value FROM settings WHERE key='backup:auto:lease'").get()?.value||0);if(lease>Date.now())throw Error('ระบบกำลังสำรองข้อมูล กรุณารอให้สำรองเสร็จแล้วจึงย้าย');
  if(Number(source.prepare("SELECT value FROM settings WHERE key='drive:dossier:lease'").get()?.value||0)>Date.now())throw Error('ระบบกำลังส่งแฟ้มไป Drive กรุณาหยุดหรือรอให้รอบนี้เสร็จก่อนย้าย');
  if(source.prepare("SELECT value FROM settings WHERE key='storage:relocatedTo'").get())throw Error('ฐานข้อมูลถูกย้ายแล้ว กรุณาโหลดสถานะล่าสุด');
  privateFolder(checkpoint);fs.writeFileSync(path.join(checkpoint,'original.env'),oldConfig,{flag:'wx',mode:0o600});
  const snapshot=path.join(checkpoint,'original.sqlite'),reader=new DatabaseSync(plan.database,{readOnly:true});
  try{reader.exec('PRAGMA busy_timeout=5000');reader.prepare('VACUUM INTO ?').run(snapshot);}finally{reader.close();}
  fs.mkdirSync(plan.target,{recursive:true});privateFolder(path.dirname(targetDatabase));
  fs.copyFileSync(snapshot,targetDatabase,fs.constants.COPYFILE_EXCL);
  if(fileHash(fs.readFileSync(snapshot))!==fileHash(fs.readFileSync(targetDatabase)))throw Error('สำเนาฐานข้อมูลไม่ตรงกับต้นฉบับ');
  for(const item of tree(plan.localFolder)){const from=inside(plan.localFolder,item.relative),to=inside(plan.target,item.relative);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to,fs.constants.COPYFILE_EXCL);if(fileHash(fs.readFileSync(from))!==fileHash(fs.readFileSync(to)))throw Error('ตรวจสำเนาไฟล์ไม่ผ่าน: '+item.relative);}
  const target=new DatabaseSync(targetDatabase);
  let dossiers;
  try{
   if(target.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('ตรวจฐานข้อมูลใหม่ไม่ผ่าน');
   const update=target.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value');update.run('storage:local',plan.target);
   target.prepare("DELETE FROM settings WHERE key IN ('storage:relocatedTo','backup:auto:lease','backup:auto:state','storage:lastExport')").run();
   dossiers=mirrorWorkspaceFiles(target,plan.target);if(dossiers.some(r=>!r.ok))throw Error('มีแฟ้มจัดเก็บไม่ครบ กรุณาตรวจไฟล์อ้างอิงก่อนย้าย');
  }finally{target.close();}
  let nextConfig=oldConfig.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>!/^\s*(?:export\s+)?(?:DATABASE_PATH|DATABASE_REQUIRE_EXISTING)\s*=/.test(line)).join('\n');
  const value=targetDatabase.replaceAll('\\','/');if(value.includes('"')||value.includes("'"))throw Error('ชื่อโฟลเดอร์ต้องไม่มีเครื่องหมายคำพูด');nextConfig=nextConfig.trimEnd()+'\nDATABASE_PATH="'+value+'"\nDATABASE_REQUIRE_EXISTING=true\n';if(parseEnv(nextConfig).DATABASE_PATH!==value)throw Error('ตั้งค่าตำแหน่งใหม่ไม่สำเร็จ');
  // Prepare the new config before the database cutover. The old DB becomes a
  // read-only redirect, preventing an old process from splitting the data.
  const pendingConfig=path.join(checkpoint,'next.env');fs.writeFileSync(pendingConfig,nextConfig,{flag:'wx',mode:0o600});
  source.prepare('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('storage:relocatedTo',targetDatabase);
  for(const row of source.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all())for(const action of ['INSERT','UPDATE','DELETE']){
   const quote=name=>'"'+name.replaceAll('"','""')+'"';source.exec('CREATE TRIGGER '+quote('sarabun_retired_'+action+'_'+row.name)+' BEFORE '+action+' ON '+quote(row.name)+" BEGIN SELECT RAISE(ABORT, 'ฐานข้อมูลนี้ย้ายแล้ว กรุณาเปิดโปรแกรมรุ่นล่าสุดใหม่'); END");
  }
  source.exec('COMMIT');guarded=false;committed=true;
  let warning='';try{atomicFile(configFile,nextConfig);}catch{warning='ย้ายข้อมูลสำเร็จ แต่แก้ไฟล์ตั้งค่าเริ่มระบบไม่สำเร็จ ระบบยังตามตำแหน่งใหม่ผ่านฐานข้อมูลเดิมได้ กรุณาตรวจสิทธิ์ไฟล์ .env.local';}
  try{atomicFile(path.join(checkpoint,'result.json'),JSON.stringify({status:'complete',sourceDatabase:plan.database,targetDatabase,localFolder:plan.target,files:plan.files,dossiers:dossiers.length,warning},null,2));}catch{warning+=' บันทึกรายงานการย้ายไม่สำเร็จ แต่ข้อมูลย้ายเสร็จแล้ว';}
  return {database:targetDatabase,localFolder:plan.target,checkpoint,files:plan.files,dossiers:dossiers.length,warning};
 }catch(error){if(guarded)source.exec('ROLLBACK');if(!committed&&fs.existsSync(checkpoint))atomicFile(path.join(checkpoint,'result.json'),JSON.stringify({status:'failed',message:error.message,target:plan.target}));throw error;}finally{source.close();}
}
