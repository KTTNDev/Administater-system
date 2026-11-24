import {it,describe,expect,beforeAll,afterAll,vi} from 'vitest';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {db} from '../src/lib/db';import {suiteCodes} from '../src/lib/procurement-workflow-model';import {installProcurementTemplate} from '../src/lib/procurement-db';import {procurementPreset} from '../src/lib/procurement-presets';import {buildLivePreview} from '../src/lib/procurement-live-preview';import {d01Initial} from '../src/lib/procurement-d01-template';import {templateInitial} from '../src/lib/procurement-template';
const root='output/procurement-reference-17/templates';
describe.skipIf(!suiteCodes.every(code=>fs.existsSync(path.join(root,code+'.docx'))))('latest retained reference mapping',()=>{
 beforeAll(()=>{const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-ref17-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'test.sqlite'));vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');vi.stubEnv('SARABUN_SOURCE_DIR',folder);for(const code of suiteCodes)installProcurementTemplate(fs.readFileSync(path.join(root,code+'.docx')),code+'.docx',code);});
 afterAll(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
 it('reads real numbers and dates from the new header targets',async()=>{expect((await d01Initial(fs.readFileSync(path.join(root,'D01.docx')))).number).toBe('ภก 52906/1439');expect((await templateInitial(fs.readFileSync(path.join(root,'D07.docx')))).values.number).toBe('ภก 52906/1465');});
 for(const code of suiteCodes)it('builds '+code+' with the latest paragraph map',async()=>{const {data}=await procurementPreset('purchase');const preview=await buildLivePreview(data,code);expect(preview.length).toBeGreaterThan(1000);},20000);
});
