"use server";
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireUser} from '@/lib/auth';
import {analyzeWord} from '@/lib/word-import';
import {WORD_IMPORT_LIMIT} from '@/lib/word-import-model';
import {importWordDraft,listDocumentSources} from '@/lib/document-sources';
const message=(error:unknown)=>error instanceof z.ZodError?'ข้อมูลบางช่องยาวเกินหรือรูปแบบไม่ถูกต้อง กรุณาตรวจข้อมูลที่แก้ไข':error instanceof Error?error.message:'นำเข้าไม่สำเร็จ';
function getFile(form:FormData){const file=form.get('file');if(!(file instanceof File))throw Error('กรุณาเลือกไฟล์ Word');if(file.size>WORD_IMPORT_LIMIT)throw Error('เลือกไฟล์ Word ขนาดไม่เกิน 10 MB');return file;}
export async function analyzeWordFile(form:FormData){try{await requireUser();const file=getFile(form);return {ok:true as const,data:await analyzeWord(Buffer.from(await file.arrayBuffer()),file.name)};}catch(error){return {ok:false as const,error:message(error)};}}
export async function confirmWordImport(form:FormData){try{
 await requireUser();if(form.get('confirmed')!=='yes')throw Error('กรุณาตรวจข้อมูลและยืนยันก่อนสร้างร่าง');
 const input=String(form.get('fields')||'');if(input.length>60000)throw Error('ข้อมูลที่กรอกยาวเกินขอบเขต');
 const saved=await importWordDraft(getFile(form),JSON.parse(input),String(form.get('requestId')||''));revalidatePath('/');return {ok:true as const,data:saved};
}catch(error){return {ok:false as const,error:message(error)};}}
export async function getDocumentSources(id:string){await requireUser();return listDocumentSources(z.string().uuid().parse(id));}
