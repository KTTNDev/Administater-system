'use server';
import {requireUser} from '@/lib/auth';
import {backupCatalog} from '@/lib/backup-catalog';
import {prepareBackupRestore,activateBackupRestore} from '@/lib/workspace-restore';
import {revalidatePath} from 'next/cache';
export async function listBackups(){await requireUser();return backupCatalog();}
export async function restoreBackupCopy(name:string){
 await requireUser();try{return {ok:true as const,data:await prepareBackupRestore(name)};}catch(error){return {ok:false as const,error:error instanceof Error?error.message:'ตรวจชุดสำรองไม่สำเร็จ'};}
}
export async function useRestoredBackup(token:string,confirmation:string){
 await requireUser();try{const result=activateBackupRestore(token,confirmation);revalidatePath('/');return {ok:true as const,data:result};}catch(error){return {ok:false as const,error:error instanceof Error?error.message:'นำชุดสำรองกลับมาใช้ไม่สำเร็จ'};}
}
