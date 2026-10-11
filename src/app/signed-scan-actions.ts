"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { listSignedScans, removeSignedScan, storeSignedScan } from "@/lib/signed-scans";

const uuid=z.string().uuid();
export async function getSignedScans(documentId:string){
  await requireUser();
  return listSignedScans(uuid.parse(documentId));
}
export async function uploadSignedScan(documentId:string,form:FormData){
  try{
    await requireUser();
    if(form.get("confirmed")!=="yes")throw new Error("โปรดยืนยันว่าเป็นไฟล์สแกนฉบับที่ลงนามแล้ว");
    const file=form.get("file");
    if(!(file instanceof File))throw new Error("กรุณาเลือกไฟล์");
    const item=await storeSignedScan(uuid.parse(documentId),file);
    revalidatePath("/");
    return {ok:true as const,data:item};
  }catch(error){
    return {ok:false as const,error:error instanceof Error?error.message:"อัปโหลดไฟล์ไม่สำเร็จ"};
  }
}
export async function deleteSignedScan(documentId:string,id:string){
  try{
    await requireUser();
    removeSignedScan(uuid.parse(documentId),uuid.parse(id));
    revalidatePath("/");
    return {ok:true as const};
  }catch(error){
    return {ok:false as const,error:error instanceof Error?error.message:"ลบไฟล์ไม่สำเร็จ"};
  }
}
