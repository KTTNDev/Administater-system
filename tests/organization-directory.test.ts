import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {db,setSetting,writeDraft,readDraft} from '../src/lib/db';
import {newDraft} from '../src/lib/document';
import {listDirectory,saveDirectory,deleteDirectory} from '../src/lib/organization-directory-db';
import {emptyOrganization} from '../src/lib/organization-directory';
beforeEach(()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-agency-'));vi.stubEnv('DATABASE_PATH',path.join(root,'test.sqlite'));});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
const input=()=>({...emptyOrganization(),name:'เทศบาลทดสอบ',department:'กองช่าง',address:'ที่อยู่เดิม',phone:'076 123456',prefix:'ภก 123'});
it('migrates saved agency and examples once, without bringing deleted entries back',()=>{
 setSetting('organization',JSON.stringify(input()));expect(listDirectory()).toHaveLength(4);
 for(const entry of listDirectory())deleteDirectory(entry.id,entry.version);
 expect(listDirectory()).toEqual([]);expect(listDirectory()).toEqual([]);
});
it('validates, deduplicates, retries creates and rejects stale edits or deletes',()=>{
 const c={id:randomUUID(),version:0,input:input()},a=saveDirectory(c);
 expect(saveDirectory(c)).toEqual(a);
 expect(()=>saveDirectory({...c,id:randomUUID()})).toThrow(/มีชื่อ/);
 expect(()=>saveDirectory({...c,id:randomUUID(),input:{...input(),name:' '}})).toThrow();
 const b=saveDirectory({...c,version:a.version,input:{...input(),phone:'076 999999'}});
 expect(()=>saveDirectory({...c,version:a.version})).toThrow(/เปลี่ยน/);
 expect(()=>deleteDirectory(b.id,a.version)).toThrow(/เปลี่ยน/);
 deleteDirectory(b.id,b.version);expect(listDirectory().some(e=>e.id===b.id)).toBe(false);
});
it('catalogue edits and deletion do not change an existing draft snapshot',()=>{
 const a=saveDirectory({id:randomUUID(),version:0,input:input()});
 const draft=writeDraft({...newDraft(),organization:a.name,address:a.address,phone:a.phone});
 const edited=saveDirectory({id:a.id,version:a.version,input:{...input(),address:'ที่อยู่ใหม่'}});
 deleteDirectory(edited.id,edited.version);
 expect(readDraft(draft.id)).toMatchObject({organization:a.name,address:'ที่อยู่เดิม',phone:a.phone});
});
