'use server';
import {z} from 'zod';
import sharp from 'sharp';
import {revalidatePath} from 'next/cache';
import {requireUser} from '@/lib/auth';
import {readHomeLayout,writeHomeLayout} from '@/lib/home-layout-db';
export async function getHomeLayout(){await requireUser();return readHomeLayout();}
export async function saveHomeLayout(input:unknown,version:number){
 try{await requireUser();z.number().int().min(0).parse(version);const data=writeHomeLayout(input,version);revalidatePath('/');revalidatePath('/home');return {ok:true as const,data};}
 catch(e){return {ok:false as const,error:e instanceof z.ZodError?e.issues[0]?.message||'ตรวจสอบข้อมูลหน้าหลัก':e instanceof Error?e.message:'บันทึกหน้าหลักไม่สำเร็จ'};}
}
// Convert uploads into a bounded, metadata-free raster before accepting them.
// The resulting image is stored with the layout only when the user presses Save.
export async function prepareHomeImage(form:FormData){
 try{
  await requireUser();const file=form.get('file');
  if(!(file instanceof File)||!file.size||file.size>5*1024*1024)throw Error('เลือกรูป JPG, PNG หรือ WebP ขนาดไม่เกิน 5 MB');
  const source=Buffer.from(await file.arrayBuffer());const image=sharp(source,{limitInputPixels:25000000});const metadata=await image.metadata();
  if(!['jpeg','png','webp'].includes(metadata.format||''))throw Error('รองรับเฉพาะรูป JPG, PNG และ WebP');
  const output=await image.rotate().resize(960,640,{fit:'inside',withoutEnlargement:true}).webp({quality:70}).toBuffer();
  if(output.length>160000)throw Error('รูปนี้มีรายละเอียดมากเกินไป กรุณาย่อรูปหรือเลือกรูปอื่น');
  return {ok:true as const,image:'data:image/webp;base64,'+output.toString('base64')};
 }catch(e){return {ok:false as const,error:e instanceof Error&&/เลือกรูป|รองรับเฉพาะ|รายละเอียดมาก|เข้าสู่ระบบ/.test(e.message)?e.message:'อ่านรูปไม่ได้ กรุณาเลือกไฟล์ภาพที่สมบูรณ์'};}
}
