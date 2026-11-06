'use server';
import {headers} from 'next/headers';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {requireUser} from '@/lib/auth';
import {storageConfig} from '@/lib/storage';
import {db} from '@/lib/db';
import {planDataMove,migrateDataLocation,type MovePlan} from '../../scripts/migrate-data-location.mjs';
import {organizeAllLocalFiles} from '@/lib/local-dossiers';
const execute=promisify(execFile);
const state=globalThis as unknown as {sarabunMovePlans?:Map<string,{plan:MovePlan;expires:number}>;sarabunFolderPicker?:boolean};
async function localUser(){await requireUser();const h=await headers(),host=h.get('host')||'';if(!/^(localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host))throw Error('จัดการพื้นที่จัดเก็บจากเครื่องที่เปิดโปรแกรมเท่านั้น');const origin=h.get('origin');if(origin&&new URL(origin).host!==host)throw Error('ที่มาคำขอไม่ตรงกับโปรแกรม');}
async function browseDataFolderImpl(){await localUser();if(process.platform!=='win32')throw Error('ปุ่ม Browse รองรับ Windows; สามารถพิมพ์พาธโฟลเดอร์ได้');if(state.sarabunFolderPicker)throw Error('มีหน้าต่างเลือกโฟลเดอร์เปิดอยู่แล้ว');state.sarabunFolderPicker=true;try{const {stdout}=await execute('powershell.exe',['-NoProfile','-STA','-File',path.join(process.env.SARABUN_SOURCE_DIR||process.cwd(),'scripts/pick-storage-folder.ps1')],{windowsHide:true,timeout:180000,maxBuffer:16384});return {path:JSON.parse(stdout.trim()) as string|null};}finally{state.sarabunFolderPicker=false;}}
async function previewDataMoveImpl(target:string){await localUser();if(typeof target!=='string')throw Error('เลือกโฟลเดอร์ก่อน');const current=storageConfig();const plan=planDataMove({sourceRoot:process.env.SARABUN_SOURCE_DIR||process.cwd(),database:current.database,localFolder:current.localFolder,target});const token=randomUUID();state.sarabunMovePlans??=new Map();for(const [key,value] of state.sarabunMovePlans)if(value.expires<Date.now())state.sarabunMovePlans.delete(key);state.sarabunMovePlans.set(token,{plan,expires:Date.now()+600000});return {...plan,configurationHash:undefined,token};}
async function applyDataMoveImpl(token:string){await localUser();const entry=state.sarabunMovePlans?.get(token);if(!entry||entry.expires<Date.now())throw Error('แผนย้ายหมดอายุ กรุณาตรวจสอบอีกครั้ง');state.sarabunMovePlans!.delete(token);const current=storageConfig();if(current.database!==entry.plan.database||current.localFolder!==entry.plan.localFolder)throw Error('ที่เก็บเปลี่ยนแล้ว กรุณาตรวจแผนใหม่');const result=migrateDataLocation({sourceRoot:process.env.SARABUN_SOURCE_DIR||process.cwd(),...entry.plan});process.env.DATABASE_PATH=result.database;process.env.DATABASE_REQUIRE_EXISTING='true';db();return result;}
async function organizeLocalDossiersImpl(){await localUser();return organizeAllLocalFiles();}

async function attempt<T>(work:()=>Promise<T>){try{return {ok:true as const,data:await work()};}catch(error){return {ok:false as const,error:error instanceof Error?error.message:'จัดการที่เก็บไม่สำเร็จ'};}}
export async function browseDataFolder(){return attempt(browseDataFolderImpl);}
export async function previewDataMove(target:string){return attempt(()=>previewDataMoveImpl(target));}
export async function applyDataMove(token:string){return attempt(()=>applyDataMoveImpl(token));}
export async function organizeLocalDossiers(){return attempt(organizeLocalDossiersImpl);}
