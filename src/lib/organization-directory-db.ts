import 'server-only';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {db,getSetting} from './db';
import {organizations} from './templates';
import {organizationInputSchema,organizationDirectorySql,type DirectoryOrganization} from './organization-directory';
function initialize(){
 const connection=db();
 if(connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organization_directory'").get())return;
 connection.transaction(()=>{
  if(connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='organization_directory'").get())return;
  connection.exec('CREATE TABLE organization_directory ('+organizationDirectorySql+')');
  const seeds=[...organizations];
  try{const saved=organizationInputSchema.safeParse(JSON.parse(getSetting('organization')||'null'));if(saved.success&&!seeds.some(o=>o.name===saved.data.name&&o.department===saved.data.department))seeds.unshift(saved.data);}catch{}
  const insert=connection.prepare('INSERT INTO organization_directory(id,data,version) VALUES(?,?,1)');
  for(const seed of seeds)insert.run(randomUUID(),JSON.stringify(seed));
 })();
}
function decode(row:Record<string,unknown>):DirectoryOrganization{return {...organizationInputSchema.parse(JSON.parse(String(row.data))),id:String(row.id),version:Number(row.version)};}
export function listDirectory(){initialize();return db().prepare('SELECT * FROM organization_directory').all().map(decode).sort((a,b)=>a.name.localeCompare(b.name,'th')||a.department.localeCompare(b.department,'th'));}
const command=z.object({id:z.string().uuid(),version:z.number().int().nonnegative(),input:organizationInputSchema});
export function saveDirectory(value:unknown){
 const c=command.parse(value);initialize();
 return db().transaction(()=>{
  const old=db().prepare('SELECT * FROM organization_directory WHERE id=?').get(c.id);
  if(old&&c.version===0&&JSON.stringify(organizationInputSchema.parse(decode(old)))===JSON.stringify(c.input))return decode(old);
  if(old?Number(old.version)!==c.version:c.version!==0)throw Error('รายการนี้เปลี่ยนจากอีกหน้าต่างแล้ว กรุณาโหลดรายชื่อล่าสุด');
  const key=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('th').replace(/\s+/g,' ').trim();
  const duplicate=db().prepare('SELECT * FROM organization_directory WHERE id<>?').all(c.id).map(decode).some(o=>key(o.name)===key(c.input.name)&&key(o.department)===key(c.input.department));
  if(duplicate)throw Error('มีชื่อส่วนราชการและหน่วยงานเจ้าของเรื่องนี้แล้ว เลือกแก้ไขรายการเดิม');
  if(old)db().prepare('UPDATE organization_directory SET data=?,version=? WHERE id=?').run(JSON.stringify(c.input),c.version+1,c.id);
  else db().prepare('INSERT INTO organization_directory(id,data,version) VALUES(?,?,1)').run(c.id,JSON.stringify(c.input));
  return {...c.input,id:c.id,version:c.version+1};
 })();
}
export function deleteDirectory(id:string,version:number){
 z.string().uuid().parse(id);z.number().int().positive().parse(version);initialize();
 const result=db().prepare('DELETE FROM organization_directory WHERE id=? AND version=?').run(id,version);
 if(!result.changes)throw Error('รายการนี้เปลี่ยนหรือลบจากอีกหน้าต่างแล้ว กรุณาโหลดรายชื่อล่าสุด');
}
