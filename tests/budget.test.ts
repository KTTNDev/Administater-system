import {beforeAll,afterAll,it,expect} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {budgetSample,budgetIssues,budgetTotals,cents,newBudget} from '../src/lib/budget';
import {budgetDraft} from '../src/lib/budget-document';
import {documentSchema} from '../src/lib/document';
import {db,readDraft} from '../src/lib/db';
import {saveBudgetRecord,generateBudgetDocument,removeBudgetRecord,listBudgets} from '../src/lib/budget-db';
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-budget-'));
beforeAll(()=>{process.env.DATABASE_PATH=path.join(folder,'test.sqlite');});
afterAll(()=>db().close());
function ready(){const sample=budgetSample('2026-09-15');sample.increases.forEach(r=>Object.assign(r,{pricingBasis:'local',pricingReason:'คุณลักษณะเฉพาะที่ทดสอบต่างจากบัญชี',pricingEvidence:'ใบเสนอราคาทดสอบ',referenceChecked:true,citedCirculars:['1095','1989','7509']}));return {...sample,signer:'ผู้เสนอ (ทดสอบ)',position:'เจ้าพนักงานธุรการ',authorityChecked:true};}
it('uses integer satang and rejects imbalanced or unavailable transfers',()=>{
 const b=ready();expect(budgetTotals(b)).toEqual({decrease:15246000,increase:15246000,difference:0});expect(budgetIssues(b)).toEqual([]);
 b.increases[0].amount='21300.01';expect(budgetIssues(b).join()).toContain('เท่ากัน');expect(cents('0.10')+cents('0.20')).toBe(cents('0.30'));
 b.decreases[0].remaining='10';expect(budgetIssues(b).join()).toContain('เกินยอดคงเหลือ');
 b.decreases[0].amount='-1';expect(budgetIssues(b).length).toBeGreaterThan(0);
});
it('requires human authority review and routes new investment to council',()=>{
 const b=ready();b.authorityChecked=false;expect(budgetIssues(b).join()).toContain('ยืนยัน');
 b.authorityChecked=true;b.authority='executive';expect(budgetIssues(b).join()).toContain('ข้อ 27');
 b.increases.forEach(r=>r.investment=false);expect(budgetIssues(b).join()).toContain('ข้อ 27');
 b.authority='council';b.increases[0].allocated='1';expect(budgetIssues(b).join()).toContain('ต้องเป็นศูนย์');
 expect(newBudget('2026-10-01').year).toBe(2570);
});
it('builds editable internal draft with all six increase entries and five opinions',()=>{
 const d=documentSchema.parse(budgetDraft(ready()));expect(d.type).toBe('internal');expect(d.status).toBe('draft');expect(d.opinions).toHaveLength(5);
 expect(d.contentBlocks.filter(b=>b.kind==='heading'&&b.text.startsWith('โอนตั้ง'))).toHaveLength(6);expect(d.body).toContain('128,540.00');expect(d.numeralStyle).toBe('thai');
});
it('saves incomplete requests but blocks their memo, and handles generation and optimistic concurrency',()=>{
 const incomplete=saveBudgetRecord(newBudget('2026-09-15'));expect(()=>generateBudgetDocument(incomplete.id,1)).toThrow();
 const r=saveBudgetRecord(ready()),d=generateBudgetDocument(r.id,r.version);expect(generateBudgetDocument(r.id,r.version).id).toBe(d.id);
 const edited=saveBudgetRecord({...r.data,reason:'เหตุผลเพิ่มเติม'},r.id,r.version);expect(()=>saveBudgetRecord(r.data,r.id,r.version)).toThrow();expect(()=>generateBudgetDocument(r.id,r.version)).toThrow();
 const d2=generateBudgetDocument(r.id,edited.version);expect(d2.id).not.toBe(d.id);expect(readDraft(d.id).body).not.toContain('เหตุผลเพิ่มเติม');
 expect(()=>removeBudgetRecord(r.id,1)).toThrow();removeBudgetRecord(r.id,edited.version);expect(listBudgets().some(x=>x.id===r.id)).toBe(false);expect(readDraft(d2.id).status).toBe('draft');
});
