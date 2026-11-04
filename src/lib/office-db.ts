import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";
import { officeSchema, type OfficeItem } from "./office";
import {annualCopy} from './workdesk';
import {projectChecks,type ProjectFile} from './project';
import {normalizeTaskProgress} from './task-progress';
function connection(){const c=db();c.exec("CREATE TABLE IF NOT EXISTS office_items(id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL)");return c;}
export function listOffice():OfficeItem[]{return connection().prepare("SELECT * FROM office_items ORDER BY updated_at DESC,id").all().map(row=>({...officeSchema.parse(JSON.parse(String(row.data))),id:String(row.id),version:Number(row.version),updatedAt:String(row.updated_at)}));}
export function writeOffice(input:unknown,id?:string,version?:number,starterTasks:readonly string[]=[]){
 const data=normalizeTaskProgress(officeSchema.parse(input)),c=connection(),key=id||randomUUID(),now=new Date().toISOString();
 c.transaction(()=>{
  if(data.documentId&&!c.prepare("SELECT id FROM documents WHERE id=? AND deleted_at IS NULL").get(data.documentId))throw new Error("ไม่พบหนังสือที่เชื่อมโยง กรุณาเลือกใหม่");
  const items=listOffice();const old=items.find(i=>i.id===id);
  if(old&&old.kind!==data.kind)throw new Error("ไม่สามารถเปลี่ยนประเภทของรายการเดิมได้");
  if(data.notApplicable&&!data.exclusionReason.trim())throw new Error('กรุณาระบุเหตุผลที่งานนี้ไม่เกี่ยวข้อง');
  if(data.kind==='task'&&data.required&&data.archived&&!data.notApplicable)throw new Error('งานที่ต้องตรวจให้ครบไม่ควรซ่อน หากไม่ใช้ให้ระบุว่าไม่เกี่ยวข้องพร้อมเหตุผลก่อนเก็บ');
  // Do not detach evidence from its project when a task is moved in another screen.
  if(old?.projectId&&old.projectId!==data.projectId&&c.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_files'").get()&&c.prepare('SELECT 1 FROM project_files WHERE task_id=?').get(key))throw new Error('งานนี้มีหลักฐานในโครงการเดิม กรุณานำหลักฐานออกก่อนย้ายงาน');
  if(data.kind==='task')data.completedAt=data.status==='done'?(old?.status==='done'?(old.completedAt||old.updatedAt):now):'';
  if(data.kind==='project'){
   if(!data.fiscalYear)throw new Error('กรุณาระบุปีงบประมาณของโครงการ');
   if(data.projectId)throw new Error('โครงการไม่สามารถซ้อนในโครงการอื่นได้');
   if(data.status==='done'&&(starterTasks.length>0||items.some(i=>i.projectId===key&&!i.archived&&!i.notApplicable&&i.status!=='done')))throw new Error('ยังมีงานย่อยไม่เสร็จ กรุณาตรวจงานย่อยก่อนปิดโครงการ');
   if(data.status==='done'&&data.projectProfile){
    const files=c.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_files'").get()?c.prepare('SELECT task_id FROM project_files WHERE project_id=?').all(key).map(r=>({taskId:String(r.task_id)} as ProjectFile)):[];
    const check=projectChecks({...data,id:key,version:version||1,updatedAt:now},items,files);
    if(check.done<check.total)throw new Error('แฟ้มโครงการยังไม่ครบ: '+check.checks.filter(i=>!i.done).slice(0,3).map(i=>i.label).join(', '));
   }
  }
  if(['project','task'].includes(data.kind)&&data.date&&data.due&&data.due<data.date)throw new Error('กำหนดเสร็จต้องไม่ก่อนวันเริ่มงาน');
  if(data.projectId){
   const project=items.find(i=>i.id===data.projectId&&i.kind==='project');
   if(data.kind!=='task'||!project)throw new Error('ไม่พบโครงการที่ต้องการเชื่อม');
   if(project.archived||project.status==='done')throw new Error('กรุณาเปิดโครงการกลับมาดำเนินการก่อนแก้ไขงานย่อย');
   data.fiscalYear=project.fiscalYear;
  }
  if(id){if(!c.prepare("UPDATE office_items SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?").run(JSON.stringify(data),now,id,version??-1).changes)throw new Error("ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชก่อนแก้ไข");}
  else c.prepare("INSERT INTO office_items VALUES(?,?,1,?)").run(key,JSON.stringify(data),now);
  if(id&&data.kind==='project'&&old&&old.fiscalYear!==data.fiscalYear)for(const child of items.filter(i=>i.projectId===id)){const updated=officeSchema.parse({...child,fiscalYear:data.fiscalYear});c.prepare('UPDATE office_items SET data=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(updated),now,child.id);c.prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(child.id,'office_project_year_changed',child.version+1,now);}
  if(!id&&data.kind==='project')for(const [index,title] of starterTasks.entries()){const child=randomUUID();const task=officeSchema.parse({kind:'task',title,projectId:key,fiscalYear:data.fiscalYear,owner:data.owner,sortOrder:index+1});c.prepare('INSERT INTO office_items VALUES(?,?,1,?)').run(child,JSON.stringify(task),now);c.prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(child,'office_create',1,now);}
  c.prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(key,id?"office_update":"office_create",id?(version??0)+1:1,now);
 })();return key;
}
export function deleteOffice(id:string,version:number){const c=connection();c.transaction(()=>{if(listOffice().some(i=>i.projectId===id))throw new Error('โครงการมีงานย่อย ให้พักโครงการหรือย้ายงานย่อยก่อนลบ');if(c.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='project_files'").get()&&c.prepare('SELECT 1 FROM project_files WHERE project_id=? OR task_id=?').get(id,id))throw new Error('รายการมีไฟล์แนบ ให้เก็บรายการไว้แทนการลบ');if(!c.prepare("DELETE FROM office_items WHERE id=? AND version=?").run(id,version).changes)throw new Error("ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรช");c.prepare("INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)").run(id,"office_delete",version,new Date().toISOString());})();}
// One transaction creates the next annual occurrence and all tasks. Repeated clicks return it.
export function copyAnnualOffice(id:string,version:number){
 const c=connection();let result='';
 c.transaction(()=>{
  const items=listOffice(),source=items.find(i=>i.id===id);
  if(!source||source.version!==version)throw new Error('ข้อมูลเปลี่ยนแล้ว กรุณารีเฟรชก่อนสร้างปีถัดไป');
  if(!['project','task'].includes(source.kind)||!source.annual||source.archived||source.projectId||!source.fiscalYear)throw new Error('เลือกโครงการหรืองานประจำปีที่ยังใช้งานอยู่ก่อน');
  const year=source.fiscalYear+1;if(year>2800)throw new Error('ปีงบประมาณเกินช่วงที่รองรับ');
  const origin=source.originId||source.id;
  const existing=items.find(i=>i.originId===origin&&i.fiscalYear===year&&i.kind===source.kind);
  if(existing){result=existing.id;return;}
  const insert=(item:OfficeItem,projectId='')=>{const key=randomUUID(),now=new Date().toISOString(),data=officeSchema.parse({...annualCopy(item,year),projectId});c.prepare('INSERT INTO office_items VALUES(?,?,1,?)').run(key,JSON.stringify(data),now);c.prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(key,'office_annual_copy',1,now);return key};
  result=insert(source);
  if(source.kind==='project')for(const child of items.filter(i=>i.kind==='task'&&i.projectId===id&&!i.archived))insert(child,result);
 })();return result;
}
