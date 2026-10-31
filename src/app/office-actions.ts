"use server";
import {projectStarters} from "@/lib/workdesk";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { listOffice,writeOffice,deleteOffice,copyAnnualOffice } from "@/lib/office-db";
export async function getOfficeItems(){await requireUser();return listOffice();}
export async function saveOfficeItem(input:unknown,id?:string,version?:number){try{await requireUser();if(id){z.string().uuid().parse(id);z.number().int().positive().parse(version);}writeOffice(input,id,version);revalidatePath("/");return {ok:true as const,items:listOffice()};}catch(e){return {ok:false as const,error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:"บันทึกไม่สำเร็จ"};}}
export async function removeOfficeItem(id:string,version:number){try{await requireUser();deleteOffice(z.string().uuid().parse(id),z.number().int().positive().parse(version));revalidatePath("/");return {ok:true as const,items:listOffice()};}catch(e){return {ok:false as const,error:e instanceof Error?e.message:"ลบไม่สำเร็จ"};}}

export async function createNextAnnualOffice(id:string,version:number){try{await requireUser();const createdId=copyAnnualOffice(z.string().uuid().parse(id),z.number().int().positive().parse(version));revalidatePath('/');revalidatePath('/home');return {ok:true as const,id:createdId,items:listOffice()}}catch(e){return {ok:false as const,error:e instanceof Error?e.message:'สร้างงานปีถัดไปไม่สำเร็จ'}}}

export async function createWorkProject(input:unknown,starterId:string){try{await requireUser();const starter=projectStarters.find(s=>s.id===starterId);if(starterId&&!starter)throw new Error('ไม่พบชุดงานตัวอย่าง');const id=writeOffice({...z.object({kind:z.literal('project')}).passthrough().parse(input)},undefined,undefined,starter?.tasks||[]);revalidatePath('/');revalidatePath('/home');return {ok:true as const,id,items:listOffice()}}catch(e){return {ok:false as const,error:e instanceof Error?e.message:'สร้างโครงการไม่สำเร็จ'}}}
