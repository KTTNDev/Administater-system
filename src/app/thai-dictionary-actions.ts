'use server';
import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {listThaiTerms,getThaiKeepTerms,saveThaiTerm,deleteThaiTerm} from '@/lib/thai-dictionary-db';
import {analyzeThai,thaiLexicon} from '@/lib/thai-proofread';
const message=(e:unknown)=>e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ';
export async function getThaiDictionary(){await requireUser();return {entries:listThaiTerms(),keepTerms:getThaiKeepTerms(),dictionarySize:thaiLexicon().size};}
export async function writeThaiTerm(input:unknown,id?:string,version=0){try{await requireUser();const entries=saveThaiTerm(input,id,version);return {ok:true as const,entries,keepTerms:getThaiKeepTerms()};}catch(e){return {ok:false as const,error:message(e)};}}
export async function removeThaiTerm(id:string,version:number){try{await requireUser();const entries=deleteThaiTerm(id,version);return {ok:true as const,entries,keepTerms:getThaiKeepTerms()};}catch(e){return {ok:false as const,error:message(e)};}}
export async function checkThaiText(input:unknown){try{await requireUser();const text=z.string().max(40000,'ตรวจข้อความได้ครั้งละไม่เกิน 40,000 ตัวอักษร').parse(input);return {ok:true as const,...analyzeThai(text,listThaiTerms())};}catch(e){return {ok:false as const,error:message(e)};}}
