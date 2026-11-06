'use server';
import {requireUser} from '@/lib/auth';
import {z} from 'zod';
import {dossierSyncStatus,prepareDossierSync,retryDossierSync,advanceDossierSync} from '@/lib/dossier-sync';
async function attempt<T>(work:()=>T|Promise<T>){try{await requireUser();return {ok:true as const,data:await work()};}catch(e){return {ok:false as const,error:e instanceof Error?e.message:'ซิงก์แฟ้มไม่สำเร็จ'};}}
export async function getDossierSync(){return attempt(dossierSyncStatus);}
export async function prepareDriveDossiers(){return attempt(prepareDossierSync);}
export async function retryDriveDossiers(id:string){return attempt(()=>retryDossierSync(z.string().uuid().parse(id)));}
export async function advanceDriveDossiers(id:string){return attempt(()=>advanceDossierSync(z.string().uuid().parse(id)));}
