import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID,createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {PDFDocument} from 'pdf-lib';
import {sampleCase} from '../../src/lib/procurement/workspace/samples';
import {procurementSql,newProcurement,procurementFileSchema} from '../../src/lib/procurement';
const root=process.env.SARABUN_E2E_DATA_ROOT;
test.skip(!root,'Requires disposable test data');
test('calendar opens a new case and a checklist creates missing drafts then opens the requested Core form',async({page})=>{
  test.setTimeout(180000);await page.goto('/?view=procurement');
  const record=sampleCase(1520);record.caseInput.projectTitleShort='ทดสอบปฏิทิน Core '+randomUUID();delete record.caseInput.inspectionResult.deliveryDate;
  record.agency.codes.internalMemoPrefix='ทดสอบ '+record.caseInput.id;record.agency.codes.externalLetterPrefix=record.agency.codes.internalMemoPrefix;record.agency.codes.poPrefix=record.agency.codes.internalMemoPrefix;record.caseInput.docs.doc6_2_inspectorOrder.runningNo=String(Date.now());
  const headers={Origin:new URL(page.url()).origin};
  const save=await page.request.post('/api/procurement/workspace',{headers,data:{action:'save',payload:record}});expect(save.ok()).toBe(true);
  const calendar=await page.request.get('/api/procurement/contracts');expect(calendar.ok()).toBe(true);const date=(await calendar.json()).dates.find((row:{caseId:string})=>row.caseId===record.caseInput.id);
  expect(date.url).toContain('coreCase=');expect(date.done).toBe(false);expect(date.date).toBe('2026-11-20');
  await page.goto(date.url);await expect(page.getByRole('heading',{name:record.caseInput.projectTitleShort,exact:true})).toBeVisible();await expect(page.getByLabel('10 วันที่',{exact:true})).toHaveValue('2026-11-17');
  expect(await (await page.request.get('/api/procurement/core-drafts?caseId='+record.caseInput.id)).json()).toHaveLength(0);
  await page.getByRole('navigation',{name:'ลายแทงเรียงแฟ้ม'}).getByRole('button',{name:/^เอกสาร 4\.1 /}).click();
  await expect(page.getByLabel(/^เรื่อง \/ ชื่อร่าง/)).toHaveValue(/รายละเอียดคุณลักษณะเฉพาะ/,{timeout:45000});
  const links=await (await page.request.get('/api/procurement/core-drafts?caseId='+record.caseInput.id)).json();expect(links).toHaveLength(15);expect(links.find((row:{doc_id:string})=>row.doc_id==='4.1').draft.layout).toBe('procurement-tor');
});
test('old bookmarks open a read-only archive and original files download unchanged while legacy generation is closed',async({page})=>{
  test.setTimeout(120000);await page.goto('/?view=procurement');
  const target=path.resolve(root!);if(!target.endsWith(path.join('output','feature-check')))throw Error('Use disposable data only');
  const conn=new DatabaseSync(path.join(target,'data','sarabun.sqlite')),id=randomUUID(),fileId=randomUUID(),title='งานที่จัดเก็บ '+id;conn.exec('PRAGMA busy_timeout=5000');
  const data=JSON.stringify({...newProcurement(),title,contractDue:'2026-11-30'}),pdf=await PDFDocument.create();pdf.addPage();const bytes=Buffer.from(await pdf.save()),hash=createHash('sha256').update(bytes).digest('hex');
  try{for(const [name,sql] of Object.entries(procurementSql))conn.exec(`CREATE TABLE IF NOT EXISTS ${name} (${sql})`);
    conn.prepare('INSERT INTO procurement_cases VALUES(?,?,?,?)').run(id,data,1,'2026-11-20T00:00:00Z');
    conn.prepare('INSERT INTO procurement_files(id,case_id,name,mime,sha256,data,file,created_at) VALUES(?,?,?,?,?,?,?,?)').run(fileId,id,'หลักฐานที่จัดเก็บ.pdf','application/pdf',hash,JSON.stringify(procurementFileSchema.parse({code:'OTHER',origin:'scan',caseVersion:null})),bytes,'2026-11-20T00:00:00Z');
  }finally{conn.close();}
  await page.goto('/?view=procurement&case='+id);
  await expect(page.getByRole('heading',{name:'เอกสารที่จัดเก็บก่อนย้ายระบบ',exact:true})).toBeVisible();await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'เปิดงานเดิม / ระบบเดิม',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'สร้าง/อัปเดตชุดร่างเอกสาร',exact:true})).toHaveCount(0);
  const download=page.waitForEvent('download');await page.getByRole('link',{name:'หลักฐานที่จัดเก็บ.pdf',exact:true}).click();expect(fs.readFileSync((await (await download).path())!)).toEqual(bytes);
  const headers={Origin:new URL(page.url()).origin};for(const endpoint of ['/api/procurement/generate/'+id,'/api/procurement/live','/api/procurement-template','/api/procurement-lab'])expect((await page.request.post(endpoint,{headers,data:{}})).status()).toBe(410);
  const check=new DatabaseSync(path.join(target,'data','sarabun.sqlite'),{readOnly:true});try{expect(check.prepare('SELECT data FROM procurement_cases WHERE id=?').get(id)?.data).toBe(data);expect(check.prepare('SELECT sha256 FROM procurement_files WHERE id=?').get(fileId)?.sha256).toBe(hash);}finally{check.close();}
});
