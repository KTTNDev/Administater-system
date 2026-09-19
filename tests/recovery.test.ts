import {beforeAll,afterAll,it,expect} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {db} from '../src/lib/db';import {newDraft} from '../src/lib/document';import {newBudget} from '../src/lib/budget';
import {storeRecovery,listRecovery,readRecovery} from '../src/lib/recovery';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-recovery-'));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(folder,'test.sqlite');});afterAll(()=>db().close());
it('stores incomplete drafts without modifying the document registry and ignores late writes',()=>{const id=randomUUID();storeRecovery({id,scope:'document',sequence:2,data:{...newDraft(),subject:'',body:'ข้อความล่าสุด'}});storeRecovery({id,scope:'document',sequence:1,data:{...newDraft(),body:'เก่า'}});expect((readRecovery(id,'document') as ReturnType<typeof newDraft>).body).toBe('ข้อความล่าสุด');expect(db().prepare('SELECT count(*) AS count FROM documents').get()?.count).toBe(0);expect(listRecovery('document')).toHaveLength(1);expect(()=>readRecovery(id,'budget')).toThrow();});
it('recovers budget requests and validates incoming structure',()=>{const id=randomUUID(),data=newBudget('2026-09-16');storeRecovery({id,scope:'budget',sequence:1,data});expect(readRecovery(id,'budget')).toEqual(data);expect(()=>storeRecovery({id,scope:'budget',sequence:2,data:{bad:true}})).toThrow();});
