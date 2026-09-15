import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { calendarSchema,type CalendarEvent } from "./calendar";
function connection(){const c=db();c.exec("CREATE TABLE IF NOT EXISTS calendar_events(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL)");return c;}
export function listCalendar():CalendarEvent[]{return connection().prepare("SELECT * FROM calendar_events ORDER BY id").all().map(r=>({...calendarSchema.parse(JSON.parse(String(r.data))),id:String(r.id),version:Number(r.version)}));}
export function writeCalendar(input:unknown,id?:string,version?:number){const data=calendarSchema.parse(input),c=connection(),key=id||randomUUID();c.transaction(()=>{
 if(data.documentId&&!c.prepare("SELECT id FROM documents WHERE id=?").get(data.documentId))throw new Error("ไม่พบหนังสือที่เลือก กรุณาเลือกใหม่");
 if(data.sourceOfficeId&&!c.prepare("SELECT id FROM office_items WHERE id=?").get(data.sourceOfficeId))throw new Error("ไม่พบทะเบียนต้นทาง กรุณาเลือกใหม่");
 if(id){if(!c.prepare("UPDATE calendar_events SET data=?,version=version+1 WHERE id=? AND version=?").run(JSON.stringify(data),id,version??-1).changes)throw new Error("รายการเปลี่ยนแล้ว กรุณาปิดฟอร์มและโหลดใหม่ก่อนแก้ไข");}
 else c.prepare("INSERT INTO calendar_events VALUES(?,?,1)").run(key,JSON.stringify(data));
 c.prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(key,id?"calendar_update":"calendar_create",id?(version??0)+1:1,new Date().toISOString());
 })();return key;}
