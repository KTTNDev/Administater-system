"use server";
import fs from 'node:fs';
import path from 'node:path';
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireUser} from '@/lib/auth';
import {listTrash,restoreDraft,reserveDraftNumber,numberHistory} from '@/lib/db';
import {automaticBackupStatus,configureAutomaticBackup,runAutomaticBackup} from '@/lib/automatic-backup';
export async function getTrash(){await requireUser();return listTrash();}
export async function recoverDocument(id:string,version:number){try{await requireUser();const saved=restoreDraft(z.string().uuid().parse(id),z.number().int().positive().parse(version));revalidatePath('/');return {ok:true as const,data:saved};}catch(error){return {ok:false as const,error:error instanceof Error?error.message:'กู้คืนไม่สำเร็จ'};}}
export async function reserveNumber(id:string,version:number,prefix:string,start:number){try{await requireUser();const saved=reserveDraftNumber(z.string().uuid().parse(id),z.number().int().positive().parse(version),z.string().max(100).parse(prefix),z.number().int().positive().parse(start));revalidatePath('/');return {ok:true as const,data:saved};}catch(error){return {ok:false as const,error:error instanceof Error?error.message:'จองเลขไม่สำเร็จ'};}}
export async function getNumberHistory(){await requireUser();return numberHistory();}
export async function getAutomaticBackup(){await requireUser();return automaticBackupStatus();}
export async function saveAutomaticBackup(hours:number){await requireUser();return configureAutomaticBackup(z.number().parse(hours));}
export async function backupNow(){await requireUser();return runAutomaticBackup(true);}
export async function getAppVersion(){
  await requireUser();
  try{const value=JSON.parse(fs.readFileSync(path.join(process.env.SARABUN_SOURCE_DIR||process.cwd(),'.desktop','current.json'),'utf8'));return {version:String(value.appVersion||value.version),built:String(value.built)};}
  catch{return {version:'โหมดพัฒนา',built:''};}
}
