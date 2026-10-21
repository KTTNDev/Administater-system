"use server";
import {requireUser} from '@/lib/auth';
import {listDirectory,saveDirectory,deleteDirectory} from '@/lib/organization-directory-db';
import {z} from 'zod';
const message=(e:unknown)=>e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ';
export async function getOrganizationDirectory(){await requireUser();return listDirectory();}
export async function writeOrganizationDirectory(input:unknown){try{await requireUser();const entry=saveDirectory(input);return {ok:true as const,entry,entries:listDirectory()};}catch(e){return {ok:false as const,error:message(e)};}}
export async function removeOrganizationDirectory(id:string,version:number){try{await requireUser();deleteDirectory(id,version);return {ok:true as const,entries:listDirectory()};}catch(e){return {ok:false as const,error:message(e)};}}
