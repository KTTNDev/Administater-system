'use server';
import {z} from 'zod';
import {documentAssets} from '@/lib/assets';
import {requireUser} from '@/lib/auth';
import {listInventoryForms,readInventoryForm,saveInventoryForm} from '@/lib/inventory-form-db';
import {seedInventoryForm,formOptionsSchema} from '@/lib/inventory-forms';
import {inventorySnapshot} from '@/lib/inventory-db';
export async function loadInventoryForms(){await requireUser();return listInventoryForms();}
export async function openInventoryForm(id:string){await requireUser();return readInventoryForm(id);}
export async function createInventoryForm(options:unknown){await requireUser();return seedInventoryForm(inventorySnapshot(),formOptionsSchema.parse(options));}
export async function saveInventoryFormAction(id:string,version:number,data:unknown){try{await requireUser();return {ok:true as const,data:saveInventoryForm(id,version,data)};}catch(e){return {ok:false as const,error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'บันทึกร่างไม่สำเร็จ'};}}

export async function inventoryPreviewAssets(){await requireUser();const {regular,bold,garuda,thaiTerms}=documentAssets();return {regular,bold,garuda,thaiTerms};}
