import 'server-only';
import {db} from './db';
import {inventoryFormSchema,inventoryFormSql,type InventoryFormDraft} from './inventory-forms';
import {z} from 'zod';
export function formDb(){const conn=db();conn.exec('CREATE TABLE IF NOT EXISTS inventory_form_drafts ('+inventoryFormSql+')');return conn;}
export function validatedForm(input:unknown){return inventoryFormSchema.parse(input);}

export function listInventoryForms(){return formDb().prepare('SELECT id,data,version,updated_at FROM inventory_form_drafts ORDER BY updated_at DESC').all().map(r=>{const d=JSON.parse(String(r.data));return {id:String(r.id),title:String(d.title),templateId:Number(d.templateId),asOf:String(d.asOf),version:Number(r.version),updatedAt:String(r.updated_at)};});}
export function readInventoryForm(id:string):InventoryFormDraft{z.string().uuid().parse(id);const r=formDb().prepare('SELECT * FROM inventory_form_drafts WHERE id=?').get(id);if(!r)throw Error('ไม่พบร่างแบบฟอร์ม');return {...validatedForm(JSON.parse(String(r.data))),id:String(r.id),version:Number(r.version),updatedAt:String(r.updated_at)};}
export function saveInventoryForm(id:string,version:number,input:unknown){z.string().uuid().parse(id);z.number().int().nonnegative().parse(version);const d=validatedForm(input),conn=formDb();return conn.transaction(()=>{const at=new Date().toISOString(),json=JSON.stringify(d);if(version===0){const existing=conn.prepare('SELECT data FROM inventory_form_drafts WHERE id=?').get(id);if(existing){if(existing.data===json)return readInventoryForm(id);throw Error('ร่างนี้มีอยู่แล้ว กรุณาเปิดข้อมูลล่าสุด');}conn.prepare('INSERT INTO inventory_form_drafts VALUES(?,?,1,?)').run(id,json,at);}else{const r=conn.prepare('UPDATE inventory_form_drafts SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?').run(json,at,id,version);if(!r.changes)throw Error('ร่างเปลี่ยนจากหน้าต่างอื่นแล้ว กรุณาเปิดข้อมูลล่าสุด');}return readInventoryForm(id);})();}
