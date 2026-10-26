"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { createAppendixImage, readAppendixImage } from "@/lib/appendix";

export async function uploadAppendixImage(form:FormData){await requireUser();try{const file=form.get("file");if(!(file instanceof File))throw new Error("กรุณาเลือกรูปภาพ");return {ok:true as const,data:await createAppendixImage(file)};}catch(error){return {ok:false as const,error:error instanceof Error?error.message:"อัปโหลดรูปภาพไม่สำเร็จ"};}}
export async function getAppendixImageSources(ids:string[]){await requireUser();const valid=z.array(z.string().uuid()).max(20).parse(ids);return Object.fromEntries(valid.map(id=>{const item=readAppendixImage(id);return [id,`data:${item.mime};base64,${Buffer.from(item.file).toString("base64")}`];}));}
