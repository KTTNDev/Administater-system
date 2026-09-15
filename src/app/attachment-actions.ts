"use server";
import { requireUser } from "@/lib/auth";
import { createAttachment } from "@/lib/attachments";
export async function uploadAttachment(form:FormData){await requireUser();try{const file=form.get('file');if(!(file instanceof File))throw new Error('กรุณาเลือกไฟล์');return {ok:true as const,data:await createAttachment(file)};}catch(e){return {ok:false as const,error:e instanceof Error?e.message:'อัปโหลดไม่สำเร็จ'};}}
