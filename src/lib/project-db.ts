import 'server-only';
import {randomUUID} from 'node:crypto';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {z} from 'zod';
import {db} from './db';
import {listOffice,writeOffice} from './office-db';
import {officeSchema} from './office';
import {checklistFor,projectFilesSql,stageSchema,projectProfileSchema,type ProjectFile} from './project';

export function projectDb(){const c=db();c.exec('CREATE TABLE IF NOT EXISTS project_files('+projectFilesSql+'); CREATE INDEX IF NOT EXISTS project_files_owner ON project_files(project_id,task_id)');return c;}
export function readProject(id:string,editable=false){z.string().uuid().parse(id);const p=listOffice().find(i=>i.id===id&&i.kind==='project');if(!p)throw Error('ไม่พบโครงการ');if(editable&&(p.archived||p.status==='done'))throw Error('เปิดโครงการกลับมาดำเนินการก่อนแก้ไขแฟ้ม');return p;}
function metadata(r:Record<string,unknown>):ProjectFile{return {id:String(r.id),projectId:String(r.project_id),taskId:String(r.task_id),stage:stageSchema.parse(r.stage),name:String(r.name),mime:String(r.mime),bytes:Number(r.bytes),caption:String(r.caption),includeInReport:!!r.include_report,createdAt:String(r.created_at)};}
export function projectFiles(projectId:string){readProject(projectId);return projectDb().prepare('SELECT id,project_id,task_id,stage,name,mime,caption,include_report,created_at,length(file) bytes FROM project_files WHERE project_id=? ORDER BY created_at,id').all(projectId).map(metadata);}
export function readProjectFile(id:string){z.string().uuid().parse(id);const r=projectDb().prepare('SELECT *,length(file) bytes FROM project_files WHERE id=?').get(id);if(!r)throw Error('ไม่พบไฟล์แนบโครงการ');readProject(String(r.project_id));return {...metadata(r),file:Buffer.from(r.file as Uint8Array)};}
const audit=(id:string,action:string)=>db().prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(id,action,null,new Date().toISOString());
export function saveProjectProfile(id:string,version:number,input:unknown){const p=readProject(id,true);writeOffice({...p,projectProfile:projectProfileSchema.parse(input)},id,z.number().int().positive().parse(version));}
export function seedProjectChecklist(id:string,version:number){
 const c=projectDb();c.transaction(()=>{const p=readProject(id,true);if(p.version!==version)throw Error('โครงการเปลี่ยนแล้ว กรุณาโหลดล่าสุด');
 const existing=listOffice().filter(i=>i.projectId===id);const now=new Date().toISOString();
 for(const [index,row] of checklistFor(p.projectProfile?.category||'general').entries()){if(existing.some(t=>t.checklistKey===row.key))continue;const key=randomUUID(),task=officeSchema.parse({kind:'task',title:row.title,taskStage:row.stage,required:true,evidenceRequired:row.evidence,checklistKey:row.key,projectId:id,fiscalYear:p.fiscalYear,owner:p.owner,sortOrder:existing.length+index+1});c.prepare('INSERT INTO office_items VALUES(?,?,1,?)').run(key,JSON.stringify(task),now);audit(id,'project_checklist_add:'+key);}
 c.prepare('UPDATE office_items SET data=?,version=version+1,updated_at=? WHERE id=?').run(JSON.stringify(officeSchema.parse({...p,projectProfile:p.projectProfile||projectProfileSchema.parse({})})),now,id);
 })();
}
export async function addProjectFile(form:FormData){
 const projectId=z.string().uuid().parse(form.get('projectId')),taskId=z.union([z.literal(''),z.string().uuid()]).parse(form.get('taskId')||''),stage=stageSchema.parse(form.get('stage'));
 readProject(projectId,true);const file=form.get('file');if(!(file instanceof File)||!file.size||file.size>8*1024*1024)throw Error('เลือกไฟล์ PDF, PNG หรือ JPEG ขนาดไม่เกิน 8 MB');
 const raw=Buffer.from(await file.arrayBuffer());let bytes:Buffer,mime:string;
 if(raw.subarray(0,5).toString()==='%PDF-'){const pdf=await PDFDocument.load(raw);if(pdf.getPageCount()>100)throw Error('PDF ต้องไม่เกิน 100 หน้า');bytes=raw;mime='application/pdf';}
 else{const img=sharp(raw,{limitInputPixels:20000000});const m=await img.metadata();if(!['png','jpeg'].includes(m.format||''))throw Error('รองรับเฉพาะ PDF, PNG และ JPEG');bytes=await img.rotate().resize({width:2400,height:2400,fit:'inside',withoutEnlargement:true}).png().toBuffer();mime='image/png';}
 const id=randomUUID(),c=projectDb();
 c.transaction(()=>{readProject(projectId,true);if(taskId&&!listOffice().some(t=>t.id===taskId&&t.kind==='task'&&t.projectId===projectId&&!t.archived))throw Error('ไม่พบงานย่อยในโครงการนี้');
 const count=c.prepare('SELECT count(*) n,coalesce(sum(length(file)),0) bytes FROM project_files WHERE project_id=?').get(projectId)!;
 if(Number(count.n)>=100||Number(count.bytes)+bytes.length>200*1024*1024)throw Error('โครงการเก็บได้ 100 ไฟล์ รวมไม่เกิน 200 MB');
 const name=file.name.replace(/[\\/\u0000-\u001f]/g,'_').slice(0,240)||'ไฟล์แนบ';
 c.prepare('INSERT INTO project_files VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,projectId,taskId,stage,name,mime,bytes,'',1,new Date().toISOString());audit(projectId,'project_file_add:'+id);
 })();return id;
}
export function updateProjectFile(id:string,caption:string,includeInReport:boolean){const f=readProjectFile(id);readProject(f.projectId,true);projectDb().transaction(()=>{projectDb().prepare('UPDATE project_files SET caption=?,include_report=? WHERE id=?').run(z.string().max(2000).parse(caption),z.boolean().parse(includeInReport)?1:0,id);audit(f.projectId,'project_file_edit:'+id);})();return f.projectId;}
export function removeProjectFile(id:string){const f=readProjectFile(id);readProject(f.projectId,true);projectDb().transaction(()=>{projectDb().prepare('DELETE FROM project_files WHERE id=?').run(id);audit(f.projectId,'project_file_remove:'+id);})();return f.projectId;}
