import 'server-only';
import {db} from '../../db';
import {DraftCaseSchema, emptyMaster, MasterSchema, registryEntries, StoredCaseSchema, type RegistryEntry, type StoredCase} from '../workspace/model';
import type {MasterRecord} from './repository';
import {domainSql} from './sql-schema';
function connection(){const c=db();for(const [table,sql] of Object.entries(domainSql))c.exec(`CREATE TABLE IF NOT EXISTS ${table} (${sql})`);return c;}
export class ConflictError extends Error {constructor(){super('ข้อมูลถูกแก้ไขจากหน้าต่างอื่น กรุณาเปิดข้อมูลล่าสุดก่อนบันทึก');}}
export const sqliteRepository={
  listCases(){return connection().prepare('SELECT data,version,updated_at FROM procurement_domain_cases ORDER BY updated_at DESC').all().map(r=>StoredCaseSchema.parse({...JSON.parse(String(r.data)),version:r.version,updatedAt:r.updated_at}));},
  getCase(id:string){const row=connection().prepare('SELECT data,version,updated_at FROM procurement_domain_cases WHERE id=?').get(id);return row?StoredCaseSchema.parse({...JSON.parse(String(row.data)),version:row.version,updatedAt:row.updated_at}):null;},
  saveCase(input:StoredCase){const record=StoredCaseSchema.parse(input),c=connection();return c.transaction(()=>{
    const now=new Date().toISOString(),version=record.version+1;
    if(record.version===0){if(c.prepare('SELECT id FROM procurement_domain_cases WHERE id=?').get(record.caseInput.id))throw new ConflictError();c.prepare('INSERT INTO procurement_domain_cases VALUES(?,?,?,?)').run(record.caseInput.id,JSON.stringify(record),version,now);}
    else if(!c.prepare('UPDATE procurement_domain_cases SET data=?,version=?,updated_at=? WHERE id=? AND version=?').run(JSON.stringify(record),version,now,record.caseInput.id,record.version).changes)throw new ConflictError();
    return {...record,version,updatedAt:now};
  })();},
  deleteCase(id:string,version:number){const c=connection();c.transaction(()=>{if(!c.prepare('DELETE FROM procurement_domain_cases WHERE id=? AND version=?').run(id,version).changes)throw new ConflictError();c.prepare('DELETE FROM procurement_core_drafts WHERE case_id=?').run(id);})();},
  getMasterData():MasterRecord{const row=connection().prepare("SELECT data,version FROM procurement_domain_master WHERE id='default'").get();return row?{data:MasterSchema.parse(JSON.parse(String(row.data))),version:Number(row.version)}:{data:emptyMaster(),version:0};},
  saveMasterData(input:MasterRecord){const data=MasterSchema.parse(input.data),c=connection();return c.transaction(()=>{const old=this.getMasterData();if(old.version!==input.version)throw new ConflictError();const version=old.version+1;c.prepare("INSERT INTO procurement_domain_master VALUES('default',?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version").run(JSON.stringify(data),version);return {data,version};})();},
  getNumberingRegistry():RegistryEntry[]{return connection().prepare('SELECT track,year_be,running_no FROM procurement_domain_registry').all().map(r=>({track:r.track as RegistryEntry['track'],yearBE:Number(r.year_be),runningNo:String(r.running_no)}));},
  advanceNumberingRegistry(input:unknown){const draft=DraftCaseSchema.parse(input),c=connection();return c.transaction(()=>{for(const entry of registryEntries(draft)){const old=c.prepare('SELECT running_no FROM procurement_domain_registry WHERE track=? AND year_be=?').get(entry.track,entry.yearBE);if(!old||BigInt(entry.runningNo)>BigInt(String(old.running_no)))c.prepare('INSERT INTO procurement_domain_registry VALUES(?,?,?,?) ON CONFLICT(track,year_be) DO UPDATE SET running_no=excluded.running_no').run(entry.track+':'+entry.yearBE,entry.track,entry.yearBE,entry.runningNo);}return this.getNumberingRegistry();})();},
};
