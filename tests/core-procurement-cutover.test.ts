import {afterAll,beforeAll,beforeEach,expect,it} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {db,writeDraft,reserveDraftNumber} from '../src/lib/db';
import {newDraft} from '../src/lib/document';
import {sampleCase} from '../src/lib/procurement/workspace/samples';
import {sqliteRepository as repo} from '../src/lib/procurement/storage/sqlite';
import {defaultAgency} from '../src/lib/procurement/presets/default-agency';
import {coreContractDates} from '../src/lib/procurement/core/contracts';
import {readProcurementArchive,readArchivedProcurementFile} from '../src/lib/procurement/core/archive';
import {procurementSql,newProcurement} from '../src/lib/procurement';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-core-cutover-'));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(root,'data.sqlite');repo.listCases();});
beforeEach(()=>{db().exec('DELETE FROM procurement_core_drafts;DELETE FROM procurement_domain_cases;DELETE FROM procurement_domain_registry;DELETE FROM documents;DELETE FROM document_numbers;');if(db().prepare("SELECT 1 FROM sqlite_master WHERE name='procurement_cases'").get())db().exec('DROP TABLE procurement_cases');});
afterAll(()=>db().close());
it('blocks a Core number reserved by a domain case, even when provenance is forged',()=>{
  const stored=repo.saveCase(sampleCase(1520));
  const draft={...newDraft('internal'),date:'2026-11-12',number:defaultAgency.codes.internalMemoPrefix+'/1439',organization:defaultAgency.municipalityName};
  expect(()=>writeDraft(draft)).toThrow(/ถูกจองในงานจัดซื้อ/);
  expect(()=>writeDraft({...draft,procurementSource:{caseId:stored.caseInput.id,docId:'1'}})).toThrow(/ถูกจองในงานจัดซื้อ/);
});
it('reserves after both domain case numbers and the shared numbering registry',()=>{
  repo.saveCase(sampleCase(1520));
  db().prepare('INSERT INTO procurement_domain_registry VALUES(?,?,?,?)').run('registry','INTERNAL_MEMO',2569,'2000');
  const draft=writeDraft({...newDraft('internal'),date:'2026-11-12',number:''});
  expect(reserveDraftNumber(draft.id,draft.version,defaultAgency.codes.internalMemoPrefix,1).number).toBe(defaultAgency.codes.internalMemoPrefix+'/2001');
});
it('keeps purchase-order numbers unique through a fiscal year crossing two calendar years',()=>{
  repo.saveCase(sampleCase(1520));
  const draft={...newDraft('other'),layout:'procurement-po' as const,number:defaultAgency.codes.poPrefix+' 13/2570',date:'2027-01-15'};
  expect(()=>writeDraft(draft)).toThrow(/ซ้ำ/);
  db().exec('DELETE FROM procurement_domain_cases');
  writeDraft({...draft,date:'2026-11-17'});
  expect(()=>writeDraft(draft)).toThrow(/ซ้ำ/);
});
it('projects live contract dates into the new workspace without inventing completion from planned inspection dates',()=>{
  const record=sampleCase(1520);record.caseInput.projectTitleShort='งานจัดซื้อจริงสำหรับทดสอบ';delete record.caseInput.inspectionResult.deliveryDate;
  const before=JSON.stringify(record),dates=coreContractDates([record],'2026-11-23');
  expect(dates).toHaveLength(1);expect(dates[0].date).toBe('2026-11-20');expect(dates[0].done).toBe(false);expect(dates[0].url).toContain('coreCase=');expect(dates[0].url).not.toContain('&case=');
  expect(JSON.stringify(record)).toBe(before);
  record.caseInput.docs.doc10_purchaseOrder.date='2026-11-19';expect(coreContractDates([record])[0].date).toBe('2026-11-23');
});
it('reads the old archive without creating legacy tables or modifying stored case bytes',()=>{
  expect(readProcurementArchive().cases).toEqual([]);
  expect(db().prepare("SELECT 1 FROM sqlite_master WHERE name='procurement_cases'").get()).toBeUndefined();
  db().exec('CREATE TABLE procurement_cases ('+procurementSql.procurement_cases+')');
  const data=JSON.stringify({...newProcurement(),title:'งานเก่าที่ต้องยังมองเห็น'});
  db().prepare('INSERT INTO procurement_cases VALUES(?,?,?,?)').run('old-case',data,1,'2026-11-20T00:00:00Z');
  expect(readProcurementArchive().cases[0].title).toBe('งานเก่าที่ต้องยังมองเห็น');
  expect(db().prepare('SELECT data FROM procurement_cases WHERE id=?').get('old-case')?.data).toBe(data);
  db().exec('CREATE TABLE IF NOT EXISTS procurement_files ('+procurementSql.procurement_files+')');
  db().prepare('INSERT INTO procurement_files(id,case_id,name,mime,sha256,file,data,created_at) VALUES(?,?,?,?,?,?,?,?)').run('corrupt-file','old-case','หลักฐาน.pdf','application/pdf','0'.repeat(64),Buffer.from('changed'),'{}','2026-11-20');
  expect(()=>readArchivedProcurementFile('corrupt-file')).toThrow(/หลักฐาน/);
});
