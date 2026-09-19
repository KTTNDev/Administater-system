import {it,expect} from 'vitest';
import {emptyReference,referenceIssues,referenceText} from '../src/lib/budget-references';
import {budgetSample} from '../src/lib/budget';
import {budgetDraft} from '../src/lib/budget-document';
import index from '../src/lib/budget-reference-index.json';
it('keeps all 70 ICT entries and routes revised 1–11 to the new edition',()=>{
 const old=index.items.filter(x=>x.source==='ict'),updated=index.items.filter(x=>x.source==='ict-2569');
 expect(old).toHaveLength(70);expect(updated).toHaveLength(11);expect(old.filter(x=>x.archived)).toHaveLength(11);
 expect(index.items.find(x=>x.id==='ict-37')).toMatchObject({price:'33000',page:20});expect(index.items.find(x=>x.id==='ict-2569-4')).toMatchObject({price:'23000',page:4});
});
it('requires evidence for local prices and distinguishes standard references',()=>{
 const r={...emptyReference(),pricingBasis:'local' as const,referenceChecked:true};expect(referenceIssues(r).join()).toContain('หลักฐาน');
 r.pricingReason='ความสามารถเฉพาะต่างจากรายการมาตรฐาน';r.pricingEvidence='ใบเสนอราคา สาธิต วันที่ 15/09/2569';r.citedCirculars=['1095','1989','7509'];expect(referenceIssues(r)).toEqual([]);expect(referenceText(r).join()).toContain('ว 1989');expect(referenceText(r).join()).not.toContain('ไม่มีกำหนดไว้');
 const standard={...emptyReference(),pricingBasis:'standard' as const,sourceId:'ict' as const,sourceItem:'37 อุปกรณ์ค้นหาเส้นทางเครือข่าย',sourcePage:20,referenceChecked:true};expect(referenceIssues(standard)).toEqual([]);expect(referenceText(standard).join()).toContain('ธันวาคม 2568');expect(referenceText(standard).join()).not.toContain('ราคาท้องถิ่น');
 expect(referenceIssues({...standard,sourceItem:'4 เครื่องคอมพิวเตอร์'}).join()).toContain('2569');
});
it('places each citation under its equipment before the next entry',()=>{
 const b=budgetSample('2026-09-15');Object.assign(b.increases[0],{pricingBasis:'standard',sourceId:'ict',sourceItem:'37 Router',sourcePage:20,citedCirculars:['1095']});Object.assign(b.increases[1],{pricingBasis:'local',pricingReason:'ตัวอย่างการเทียบคุณลักษณะ',pricingEvidence:'หลักฐานสาธิต',citedCirculars:['1989','7509']});
 const d=budgetDraft(b);expect(d.layout).toBe('budget-reference');expect(d.body.indexOf('37 Router')).toBeLessThan(d.body.indexOf('รายการที่ 2'));expect(d.body).toContain('ว 1989');expect(d.contentBlocks.some(b=>b.kind==='budget-money')).toBe(true);
});
