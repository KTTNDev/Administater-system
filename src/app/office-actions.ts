"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { listOffice,writeOffice,deleteOffice } from "@/lib/office-db";
export async function getOfficeItems(){await requireUser();return listOffice();}
export async function saveOfficeItem(input:unknown,id?:string,version?:number){try{await requireUser();if(id){z.string().uuid().parse(id);z.number().int().positive().parse(version);}writeOffice(input,id,version);revalidatePath("/");return {ok:true as const,items:listOffice()};}catch(e){return {ok:false as const,error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:"บันทึกไม่สำเร็จ"};}}
export async function removeOfficeItem(id:string,version:number){try{await requireUser();deleteOffice(z.string().uuid().parse(id),z.number().int().positive().parse(version));revalidatePath("/");return {ok:true as const,items:listOffice()};}catch(e){return {ok:false as const,error:e instanceof Error?e.message:"ลบไม่สำเร็จ"};}}
