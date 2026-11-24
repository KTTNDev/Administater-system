import {beforeAll,afterAll,it,expect,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {PDFDocument} from 'pdf-lib';
import {db,setSetting,writeDraft,readDraft} from '../src/lib/db';
import {templateFixture} from '../src/lib/procurement/__tests__/templates-fixtures';
import {defaultAgency} from '../src/lib/procurement/presets/default-agency';
import {newCase} from '../src/lib/procurement/workspace/model';
import {sqliteRepository} from '../src/lib/procurement/storage/sqlite';
import {bindProcurementCoreDrafts,listCoreDraftBindings} from '../src/lib/procurement/core/bindings';
import {coreOutputCase,corePdfBinder,coreWordOutput} from '../src/lib/procurement/core/output';
import {POST as preview} from '../src/app/api/procurement/preview-html/route';
import * as pdfEngine from '../src/lib/pdf';import * as wordEngine from '../src/lib/word';
let caseId='',draftId='';
beforeAll(async()=>{
 const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-core-authority-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'data.sqlite'));vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');vi.stubEnv('SARABUN_REQUIRE_LOGIN','false');setSetting('storage:local',folder);
 const record=sqliteRepository.saveCase({...newCase(),caseInput:templateFixture(),agency:defaultAgency});caseId=record.caseInput.id;
 const links=await bindProcurementCoreDrafts(caseId,record.version,'create'),draft=links.find(row=>row.doc_id==='13')!.draft!;draftId=draft.id;
 writeDraft({...draft,body:'ข้อความที่แก้ไว้ใน Core ต้องเป็นฉบับจริง',floatingItems:[{kind:'text',id:randomUUID(),page:1,xMm:110,yMm:190,widthMm:65,fontPt:16,bold:false,text:'ผู้ลงนามที่จัดวางเอง'}]},draft.id,draft.version);
});
afterAll(()=>{vi.restoreAllMocks();db().close();vi.unstubAllEnvs();});
it('preview resolves the saved linked draft and never rebuilds its content from central input',async()=>{
 const request=new Request('http://localhost/api/procurement/preview-html',{method:'POST',headers:{Origin:'http://localhost',host:'localhost','Content-Type':'application/json'},body:JSON.stringify({caseId,docId:'13',expectedVersions:{'13':readDraft(draftId).version}})});
 const response=await preview(request);expect(response.status).toBe(200);expect(response.headers.get('x-core-draft-id')).toBe(draftId);
 const html=await response.text();expect(html).toContain('ข้อความที่แก้ไว้ใน Core ต้องเป็นฉบับจริง');expect(html).toContain('ผู้ลงนามที่จัดวางเอง');expect(html).not.toContain('class="opinion"');
});
it('PDF binder and Word export receive the very same saved text boxes and edited body',async()=>{
 const pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save());
 const pdfSpy=vi.spyOn(pdfEngine,'renderPdf').mockResolvedValue(bytes),wordSpy=vi.spyOn(wordEngine,'renderWord').mockResolvedValue(Buffer.from('saved-core-docx'));
 const version=readDraft(draftId).version;
 const result=await corePdfBinder({caseId,expectedVersions:{'13':version}},{profile:{mode:'SINGLE_DOC',docId:'13'},duplicateCopies:false,includeDividers:false,includeCoverChecklist:false,routingStripMode:'NONE'});
 expect(result.entries[0]).toMatchObject({draftId,version});expect(pdfSpy.mock.calls[0][0].body).toContain('ข้อความที่แก้ไว้ใน Core');expect(pdfSpy.mock.calls[0][0].floatingItems[0]).toMatchObject({kind:'text',text:'ผู้ลงนามที่จัดวางเอง'});
 await coreWordOutput({caseId},'SINGLE_DOC','13');expect(wordSpy.mock.calls[0][0]).toEqual(pdfSpy.mock.calls[0][0]);pdfSpy.mockRestore();wordSpy.mockRestore();
});
it('refuses a stale draft version instead of exporting a different revision silently',()=>{
 expect(()=>coreOutputCase({caseId,expectedVersions:{'13':1}}).draft('13')).toThrow(/เปลี่ยนไปแล้ว/);
});
it('leaves central and Core data unchanged when reading output snapshots',()=>{
 const before=readDraft(draftId),source=sqliteRepository.getCase(caseId);coreOutputCase({caseId}).draft('13');
 expect(readDraft(draftId)).toEqual(before);expect(sqliteRepository.getCase(caseId)).toEqual(source);expect(listCoreDraftBindings(caseId)).toHaveLength(15);
});
