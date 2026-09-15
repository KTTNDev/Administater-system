"use server";
import {z} from 'zod';
import {revalidatePath} from 'next/cache';
import {requireUser} from '@/lib/auth';
import {listBudgets,saveBudgetRecord,removeBudgetRecord,generateBudgetDocument} from '@/lib/budget-db';
export async function getBudgets(){await requireUser();return listBudgets();}
export async function saveBudget(input:unknown,id?:string,version?:number){await requireUser();try{if(id){z.string().uuid().parse(id);z.number().int().positive().parse(version);}const data=saveBudgetRecord(input,id,version);revalidatePath('/');return {ok:true as const,data};}catch(e){return {ok:false as const,error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'บันทึกไม่สำเร็จ'};}}
export async function deleteBudget(id:string,version:number){await requireUser();removeBudgetRecord(z.string().uuid().parse(id),z.number().int().positive().parse(version));revalidatePath('/');}
export async function createBudgetMemo(id:string,version:number){await requireUser();const draft=generateBudgetDocument(z.string().uuid().parse(id),z.number().int().positive().parse(version));revalidatePath('/');return draft;}
