import 'server-only';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {db,getSetting,setSetting} from './db';
import {storageConfig} from './storage';
const execute=promisify(execFile);

type BackupState={lastSuccess:string;lastAttempt:string;folder:string;error:string};
const empty:BackupState={lastSuccess:'',lastAttempt:'',folder:'',error:''};
export function automaticBackupStatus(){
  let state=empty;try{state={...empty,...JSON.parse(getSetting('backup:auto:state')||'{}')};}catch{}
  const hours=Number(getSetting('backup:auto:hours')??24);
  return {...state,hours,enabled:hours>0,running:Number(getSetting('backup:auto:lease')||0)>Date.now(),nextDue:hours>0&&state.lastSuccess?new Date(Date.parse(state.lastSuccess)+hours*3600000).toISOString():'',destination:path.join(storageConfig().localFolder,'สำรองข้อมูล')};
}
export function configureAutomaticBackup(hours:number){
  if(![0,6,24,168].includes(hours))throw new Error('เลือกรอบสำรองจากรายการ');
  setSetting('backup:auto:hours',String(hours));return automaticBackupStatus();
}
export async function runAutomaticBackup(force=false,now=Date.now()){
  const state=automaticBackupStatus();
  if(!force&&(!state.enabled||(state.lastSuccess&&path.dirname(state.folder)===state.destination&&now-Date.parse(state.lastSuccess)<state.hours*3600000)||(state.error&&now-Date.parse(state.lastAttempt)<3600000)))return state;
  const locked=db().transaction(()=>{
    if(Number(getSetting('backup:auto:lease')||0)>now)return false;
    setSetting('backup:auto:lease',String(now+30*60000));return true;
  })();
  if(!locked)return state;
  const at=new Date(now).toISOString();
  setSetting('backup:auto:state',JSON.stringify({...state,lastAttempt:at,error:''}));
  try{
    const root=process.env.SARABUN_SOURCE_DIR||process.cwd(),config=storageConfig();
    const {stdout}=await execute(process.execPath,[path.join(root,'scripts','backup-worker.mjs'),config.database,config.localFolder,root],{windowsHide:true,timeout:300000,maxBuffer:1024*1024});
    const backup=JSON.parse(stdout) as {folder:string};
    setSetting('storage:lastExport',backup.folder);
    setSetting('backup:auto:state',JSON.stringify({lastSuccess:at,lastAttempt:at,folder:backup.folder,error:''}));
  }catch(error){
    setSetting('backup:auto:state',JSON.stringify({...state,lastAttempt:at,error:error instanceof Error?error.message:'สำรองไม่สำเร็จ'}));
  }finally{setSetting('backup:auto:lease','0');}
  return automaticBackupStatus();
}
const runtime=globalThis as unknown as {sarabunBackupTimer?:ReturnType<typeof setInterval>};
export function startAutomaticBackups(){
  if(runtime.sarabunBackupTimer||process.env.SARABUN_DISABLE_AUTO_BACKUP==='true')return;
  const tick=()=>{runAutomaticBackup().catch(error=>console.error('Automatic backup failed:',error instanceof Error?error.message:'unknown error'));};
  setTimeout(tick,15000).unref();
  runtime.sarabunBackupTimer=setInterval(tick,60000);runtime.sarabunBackupTimer.unref();
}
