import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
const mock=vi.hoisted(()=>({files:new Map<string,{id:string;name:string;mimeType?:string;parents?:string[];appProperties?:Record<string,string>}>(),next:0,lost:false,create:vi.fn()}));
vi.mock('@googleapis/drive',()=>({auth:{OAuth2:class{setCredentials(){}}},drive:()=>({files:{
 list:async({q}:{q:string})=>({data:{files:[...mock.files.values()].filter(f=>q.includes("inventoryFileId")?!!f.appProperties&&q.includes("value='"+f.appProperties.inventoryFileId+"'")&&q.includes("value='"+f.appProperties.hash+"'"):q.includes("name = '"+f.name+"'")&&f.mimeType==='application/vnd.google-apps.folder'&&(!f.parents?.length||q.includes("'"+f.parents[0]+"' in parents")))}}),
 get:async({fileId}:{fileId:string})=>{const f=mock.files.get(fileId);if(!f)throw Object.assign(Error('missing'),{code:404});return {data:f};},
 generateIds:async()=>({data:{ids:['drive-'+(++mock.next)]}}),
 create:async({requestBody}:{requestBody:{id:string;name:string;mimeType?:string;parents?:string[];appProperties?:Record<string,string>}})=>{mock.create(requestBody);mock.files.set(requestBody.id,requestBody);if(mock.lost&&requestBody.mimeType!=='application/vnd.google-apps.folder'){mock.lost=false;throw Error('lost response');}return {data:{id:requestBody.id}};}
}})}));
import {db,setSetting} from '../src/lib/db';
import {encrypt,uploadInventoryFile} from '../src/lib/drive';
beforeEach(()=>{mock.files.clear();mock.create.mockClear();mock.next=0;mock.lost=false;vi.stubEnv('DATABASE_PATH',path.join(fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-drive-')),'test.sqlite'));vi.stubEnv('SESSION_SECRET','test-secret-long-enough-for-encryption-1234567890');vi.stubEnv('APP_URL','http://localhost:3100');vi.stubEnv('GOOGLE_CLIENT_ID','test');vi.stubEnv('GOOGLE_CLIENT_SECRET','test');setSetting('google:token',encrypt('fake-token'));setSetting('google:account','test');});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
const input={id:'photo-1',ownerId:'asset-1',folder:'A01 test',kind:'ครุภัณฑ์',name:'ภาพ.png',mime:'image/png',bytes:Buffer.from('fixture'),hash:'fixture-hash'};
it('organizes folders and serializes retries without duplicate photos',async()=>{
 const ids=await Promise.all([uploadInventoryFile(input),uploadInventoryFile(input)]);expect(ids[0]).toBe(ids[1]);
 expect([...mock.files.values()].map(f=>f.name)).toEqual(['สารบรรณ','พัสดุและครุภัณฑ์','ครุภัณฑ์','A01 test','ภาพ.png']);
 expect(mock.create).toHaveBeenCalledTimes(5);
});
it('reuses the reserved file after Google accepted it but its response was lost',async()=>{
 mock.lost=true;await expect(uploadInventoryFile(input)).rejects.toThrow('lost response');
 const id=await uploadInventoryFile(input);expect(mock.files.has(id)).toBe(true);expect(mock.create).toHaveBeenCalledTimes(5);
});

it('finds the existing photo after the local Drive ID cache is cleared',async()=>{
 const first=await uploadInventoryFile(input);db().prepare("DELETE FROM settings WHERE key LIKE 'drive:%'").run();
 expect(await uploadInventoryFile(input)).toBe(first);expect(mock.create).toHaveBeenCalledTimes(5);
});
