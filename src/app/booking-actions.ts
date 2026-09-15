"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { bookingSnapshot,saveRoom,saveBooking,cancelBooking } from "@/lib/booking-db";
const uuid=z.string().uuid(), versionSchema=z.number().int().positive();
const errorMessage=(e:unknown)=>e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:"ดำเนินการไม่สำเร็จ";
export async function getBookings(){await requireUser();return bookingSnapshot();}
export async function writeRoom(input:unknown,id?:string,version?:number){try{await requireUser();if(id){uuid.parse(id);versionSchema.parse(version);}saveRoom(input,id,version);revalidatePath("/");return {ok:true as const,...bookingSnapshot()};}catch(e){return {ok:false as const,error:errorMessage(e)};}}
export async function writeBooking(input:unknown,id?:string,version?:number){try{await requireUser();if(id){uuid.parse(id);versionSchema.parse(version);}saveBooking(input,id,version);revalidatePath("/");return {ok:true as const,...bookingSnapshot()};}catch(e){return {ok:false as const,error:errorMessage(e)};}}
export async function cancelRoomBooking(id:string,version:number,reason:string){try{await requireUser();cancelBooking(uuid.parse(id),versionSchema.parse(version),z.string().trim().min(1,"ระบุเหตุผลยกเลิก").max(1000).parse(reason));revalidatePath("/");return {ok:true as const,...bookingSnapshot()};}catch(e){return {ok:false as const,error:errorMessage(e)};}}
