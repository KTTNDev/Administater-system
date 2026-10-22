'use server';
import {requireUser} from '@/lib/auth';
import {inventorySnapshot,saveInventoryItem,createMovement,transitionMovement} from '@/lib/inventory-db';
import {addInventoryFile,deleteInventoryFile,syncInventoryFile} from '@/lib/inventory-files';
import {z} from 'zod';
function message(e:unknown){return e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'ดำเนินการไม่สำเร็จ';}
export async function loadInventory(){await requireUser();return inventorySnapshot();}
export async function inventoryAction(command:unknown){try{
 await requireUser();
 const c=z.discriminatedUnion('type',[
 z.object({type:z.literal('item'),id:z.string().uuid(),version:z.number(),input:z.unknown()}),
 z.object({type:z.literal('create'),id:z.string().uuid(),input:z.unknown()}),
 z.object({type:z.literal('transition'),input:z.unknown()}),
 z.object({type:z.literal('delete-file'),id:z.string().uuid()}),
 z.object({type:z.literal('drive'),id:z.string().uuid()})
 ]).parse(command);
 let selectedId='';
 if(c.type==='item')selectedId=saveInventoryItem(c.input,c.id,c.version).id;
 if(c.type==='create')selectedId=createMovement(c.input,c.id).id;
 if(c.type==='transition')selectedId=transitionMovement(c.input).id;
 if(c.type==='delete-file')deleteInventoryFile(c.id);
 if(c.type==='drive')await syncInventoryFile(c.id);
 return {ok:true as const,data:inventorySnapshot(),selectedId};
 }catch(e){return {ok:false as const,error:message(e)};}
}
export async function uploadInventoryFileAction(form:FormData){try{await requireUser();const owner=z.string().uuid().parse(form.get('ownerId')),type=z.enum(['item','movement']).parse(form.get('ownerType')),file=form.get('file');if(!(file instanceof File))throw Error('เลือกไฟล์ก่อน');const result=await addInventoryFile(owner,type,file);return {ok:true as const,data:inventorySnapshot(),warning:result.warning};}catch(e){return {ok:false as const,error:message(e)};}}
