import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {PDFDocument} from 'pdf-lib';
import {randomUUID} from 'node:crypto';
import {db,listDrafts,readDraft,writeDraft,removeDraft} from '../../db';
import {appendixSources} from '../../appendix';
import {createAttachment,readAttachment,validateAttachments} from '../../attachments';
import {exportWorkspace,setStorage} from '../../storage';
import {activateBackupRestore,prepareBackupRestore} from '../../workspace-restore';
import {sqliteRepository as repo} from '../storage/sqlite';
import {sampleCase} from '../workspace/samples';
import {bindProcurementCoreDrafts,listCoreDraftBindings,type LinkedCoreDraft} from '../core/bindings';

const root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-core-bindings-'));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(root,'db.sqlite');setStorage(path.join(root,'files'),'','');});
beforeEach(()=>{repo.listCases();db().exec('DELETE FROM procurement_core_drafts; DELETE FROM procurement_domain_cases; DELETE FROM documents; DELETE FROM document_numbers; DELETE FROM audit;');});
afterAll(()=>{db().close();});
const versions=(links:LinkedCoreDraft[])=>Object.fromEntries(links.map(link=>[link.doc_id,link.draft!.version]));

it('creates all fifteen Core documents once and does not Sync implicitly on repeated create',async()=>{
  const record=repo.saveCase(sampleCase(22890));
  const links=await bindProcurementCoreDrafts(record.caseInput.id,record.version,'create');
  expect(links).toHaveLength(15);expect(listDrafts()).toHaveLength(15);expect(new Set(links.map(link=>link.draft_id)).size).toBe(15);
  const edited=writeDraft({...links[0].draft!,body:'แก้เฉพาะฉบับ'},links[0].draft_id,links[0].draft!.version);
  const repeated=await bindProcurementCoreDrafts(record.caseInput.id,record.version,'create');
  expect(repeated.map(link=>link.draft_id)).toEqual(links.map(link=>link.draft_id));expect(repeated[0].draft?.body).toBe('แก้เฉพาะฉบับ');expect(repeated[0].draft?.version).toBe(edited.version);
});

it('imports photos once and Sync preserves binary references, overlays and attachments in the latest Core version',async()=>{
  const sample=sampleCase(1520),photo=await sharp({create:{width:80,height:50,channels:3,background:'#aaccee'}}).png().toBuffer();
  sample.caseInput.attachments.photoPaths=[`data:image/png;base64,${photo.toString('base64')}`];
  const record=repo.saveCase(sample),links=await bindProcurementCoreDrafts(record.caseInput.id,record.version,'create');
  const photos=links.find(link=>link.doc_id==='11.3')!,original=photos.draft!;
  expect(original.appendixImages).toHaveLength(1);expect(Object.values(appendixSources(original))[0]).toMatch(/^data:image\/jpeg;base64,/);
  const image=original.appendixImages[0];
  const signatureId=randomUUID();
  db().prepare('INSERT INTO document_appendix_images SELECT ?,name,mime,width,height,file,created_at FROM document_appendix_images WHERE id=?').run(signatureId,image.id);
  const pdf=await PDFDocument.create();pdf.addPage();pdf.addPage();
  const attachment=await createAttachment(new File([new Uint8Array(await pdf.save())],'ฎีกา.pdf',{type:'application/pdf'}));
  const edited=writeDraft({...original,floatingItems:[{kind:'text',id:randomUUID(),page:1,xMm:40,yMm:180,widthMm:60,fontPt:16,bold:false,text:'ห้ามทับกล่องข้อความ'},
    {kind:'image',purpose:'signature',id:randomUUID(),page:2,xMm:40,yMm:210,widthMm:30,image:{...image,id:signatureId}}],
    attachmentFiles:[attachment]},photos.draft_id,original.version);
  const fileBefore=readAttachment(attachment.id).file;
  const input=structuredClone(record);input.caseInput.items[0].unitPrice=900;input.caseInput.inspectors[0].fullName='นายผู้ตรวจรับคนใหม่';input.caseInput.attachments.photoPaths=[];
  const updated=repo.saveCase(input),fresh=listCoreDraftBindings(record.caseInput.id);
  const result=await bindProcurementCoreDrafts(updated.caseInput.id,updated.version,'sync',versions(fresh));
  const after=result.find(link=>link.doc_id==='11.3')!.draft!;
  expect(after.signer).toBe(''); // Photo-sheet signers are placed manually with text boxes.
  for(const key of ['floatingItems','appendixImages','attachmentFiles'] as const)expect(after[key]).toEqual(edited[key]);
  expect(appendixSources({...after,floatingItems:[]})).toEqual(appendixSources(original));
  expect(appendixSources(after)[signatureId]).toBe(Object.values(appendixSources(original))[0]);
  validateAttachments(after);expect(readAttachment(attachment.id).file).toEqual(fileBefore);
  expect(result.find(link=>link.doc_id==='10')!.draft!.body).toContain('๒,๑๔๐.๐๐');
});

it('rejects stale source and Core versions without changing any document',async()=>{
  const record=repo.saveCase(sampleCase(1520)),links=await bindProcurementCoreDrafts(record.caseInput.id,record.version,'create');
  await expect(bindProcurementCoreDrafts(record.caseInput.id,record.version+1,'sync',versions(links))).rejects.toThrow(/หน้าต่างอื่น/);
  writeDraft({...links[0].draft!,body:'งานใหม่ในอีกหน้าต่าง'},links[0].draft_id,links[0].draft!.version);
  await expect(bindProcurementCoreDrafts(record.caseInput.id,record.version,'sync',versions(links))).rejects.toThrow(/เปลี่ยนไปแล้ว/);
  expect(readDraft(links[1].draft_id).version).toBe(1);expect(readDraft(links[0].draft_id).body).toBe('งานใหม่ในอีกหน้าต่าง');
});

it('rolls back the entire initial bundle when a late document has a duplicate number',async()=>{
  const sample=sampleCase(1520);sample.caseInput.docs.doc13_disbursement={...sample.caseInput.docs.doc1_approvePrinciple};
  const record=repo.saveCase(sample);
  await expect(bindProcurementCoreDrafts(record.caseInput.id,record.version,'create')).rejects.toThrow(/ซ้ำ/);
  expect(listDrafts()).toHaveLength(0);expect(listCoreDraftBindings(record.caseInput.id)).toHaveLength(0);
  expect(db().prepare('SELECT COUNT(*) n FROM audit').get()?.n).toBe(0);
});

it('rolls back prior Sync writes when the last document number conflicts',async()=>{
  const record=repo.saveCase(sampleCase(1520)),links=await bindProcurementCoreDrafts(record.caseInput.id,record.version,'create');
  const changed=structuredClone(record);changed.caseInput.purposeText='แก้เหตุผลใหม่';changed.caseInput.docs.doc13_disbursement={...changed.caseInput.docs.doc1_approvePrinciple};
  const updated=repo.saveCase(changed);
  await expect(bindProcurementCoreDrafts(updated.caseInput.id,updated.version,'sync',versions(links))).rejects.toThrow(/ซ้ำ/);
  expect(readDraft(links[0].draft_id)).toEqual(links[0].draft);expect(listCoreDraftBindings(updated.caseInput.id).every(link=>link.source_version===record.version)).toBe(true);
});

it('retains links to trashed drafts and requires explicit restore instead of replacing them',async()=>{
  const record=repo.saveCase(sampleCase(1520)),links=await bindProcurementCoreDrafts(record.caseInput.id,record.version,'create');
  removeDraft(links[0].draft_id,links[0].draft!.version);
  await expect(bindProcurementCoreDrafts(record.caseInput.id,record.version,'create')).rejects.toThrow(/ถังขยะ/);
  expect(listCoreDraftBindings(record.caseInput.id)).toHaveLength(15);expect(listDrafts()).toHaveLength(14);
});

it('includes links and Core documents in verified backup/restore; deleting a case keeps its Core documents',async()=>{
  const record=repo.saveCase(sampleCase(1520)),links=await bindProcurementCoreDrafts(record.caseInput.id,record.version,'create');
  const backup=exportWorkspace();
  expect(JSON.parse(fs.readFileSync(path.join(backup.folder,'procurement_core_drafts.json'),'utf8'))).toHaveLength(15);
  repo.deleteCase(record.caseInput.id,record.version);expect(listCoreDraftBindings(record.caseInput.id)).toHaveLength(0);expect(listDrafts()).toHaveLength(15);
  const prepared=await prepareBackupRestore(path.basename(backup.folder));expect(prepared.counts.procurement_core_drafts).toBe(15);
  activateBackupRestore(prepared.token,'กู้คืนข้อมูล');
  expect(listCoreDraftBindings(record.caseInput.id).map(link=>link.draft_id)).toEqual(links.map(link=>link.draft_id));
});
