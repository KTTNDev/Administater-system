"use server";
import {requireUser} from '@/lib/auth';
import {listRegister,saveRegister,registerHistory} from '@/lib/correspondence-db';
import {z} from 'zod';
export async function getRegister(){await requireUser();return listRegister();}
export async function getRegisterHistory(id:string){await requireUser();return registerHistory(z.string().uuid().parse(id));}
export async function writeRegister(value:unknown){try{await requireUser();const entry=saveRegister(value);return {ok:true as const,entry,entries:listRegister(),history:registerHistory(entry.id)};}catch(e){return {ok:false as const,error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'บันทึกไม่สำเร็จ'};}}
