import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { officeSchema, type OfficeItem } from "./office";
function connection(){const c=db();c.exec("CREATE TABLE IF NOT EXISTS office_items(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL)");return c;}
export function listOffice():OfficeItem[]{return connection().prepare("SELECT * FROM office_items ORDER BY updated_at DESC,id").all().map(row=>({...officeSchema.parse(JSON.parse(String(row.data))),id:String(row.id),version:Number(row.version),updatedAt:String(row.updated_at)}));}
export function writeOffice(input:unknown,id?:string,version?:number){
 const data=officeSchema.parse(input),c=connection(),key=id||randomUUID(),now=new Date().toISOString();
 c.transaction(()=>{
  if(data.documentId&&!c.prepare("SELECT id FROM documents WHERE id=?").get(data.documentId))throw new Error("ไม่พบหนังสือที่เชื่อมโยง กรุณาเลือกใหม่");
  if(id){if(!c.prepare("UPDATE office_items SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?").run(JSON.stringify(data),now,id,version??-1).changes)throw new Error("ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชก่อนแก้ไข");}
  else c.prepare("INSERT INTO office_items VALUES(?,?,1,?)").run(key,JSON.stringify(data),now);
  c.prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(key,id?"office_update":"office_create",id?(version??0)+1:1,now);
 })();return key;
}
export function deleteOffice(id:string,version:number){const c=connection();c.transaction(()=>{if(!c.prepare("DELETE FROM office_items WHERE id=? AND version=?").run(id,version).changes)throw new Error("ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช");c.prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(id,"office_delete",version,new Date().toISOString());})();}
