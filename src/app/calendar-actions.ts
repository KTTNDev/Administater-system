"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { listCalendar,writeCalendar } from "@/lib/calendar-db";
export async function getCalendar(){await requireUser();return listCalendar();}
export async function saveCalendar(input:unknown,id?:string,version?:number){try{await requireUser();if(id){z.string().uuid().parse(id);z.number().int().positive().parse(version);}writeCalendar(input,id,version);revalidatePath("/");return {ok:true as const,events:listCalendar()};}catch(e){return {ok:false as const,error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:"บันทึกไม่สำเร็จ"};}}
