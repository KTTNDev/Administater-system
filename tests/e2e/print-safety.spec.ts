import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {documentHtml} from '../../src/lib/render-document';
import {newDraft} from '../../src/lib/document';
const data=(file:string,mime:string)=>`data:${mime};base64,${fs.readFileSync('public/'+file).toString('base64')}`;
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png'),routingStamp:data('assets/approval-routing-stamp.png','image/png'),copyMark:data('assets/copy-counterpart.png','image/png')};
for(const type of ['external','internal'] as const)test(`${type}: long document preserves all rows, signoff, stamps and authored attachments`,async({page})=>{
 const rows=Array.from({length:85},(_,i)=>`| ${i+1} | อุปกรณ์ลำดับ ${i+1} |`).join('\n');
 const draft={...newDraft(type),subject:'ตรวจสอบครุภัณฑ์',body:'ขอรายงานผลการตรวจสอบและรวบรวมรายละเอียดครุภัณฑ์ที่ชำรุดเพื่อประกอบการพิจารณา '.repeat(100),closing:'ขอแสดงความนับถือ',signer:'ผู้ลงนามทดสอบ',position:'นายกเทศมนตรี',copyMark:'สำเนาคู่ฉบับ' as const,productionMark:true,appendixPages:[{id:'00000000-0000-4000-8000-000000000001',title:'บัญชีรายการ',body:'| ลำดับ | รายละเอียด |\n| --- | --- |\n'+rows},{id:'00000000-0000-4000-8000-000000000002',title:'หมายเหตุเพิ่มเติม',body:'**ตรวจสอบครบแล้ว**'}]};
 await page.setContent(documentHtml(draft,assets));await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 const original=page.locator('.page:not(.counterpart-page)'),copy=page.locator('.counterpart-page');
 expect(await original.count()).toBeGreaterThan(3);expect(await copy.count()).toBe(await original.count());
 expect((await original.locator('.body-text').allTextContents()).join('')).toBe(draft.body);
 await expect(original.locator('.routing-stamp,.copy-mark')).toHaveCount(0);await expect(copy.locator('.copy-mark')).toHaveCount(1);
 if(type==='external')await expect(copy.locator('.routing-stamp')).toHaveCount(1);
 for(const pages of [original,copy]){
  await expect(pages.locator('tbody tr')).toHaveCount(85);
  expect(await pages.locator('tbody td:first-child').allTextContents()).toEqual(Array.from({length:85},(_,i)=>String(i+1)));
  const bounds=await pages.locator('.document-table,.signoff-group,.signature').evaluateAll(nodes=>nodes.map(node=>{const content=node.closest('.content')!.getBoundingClientRect(),box=node.getBoundingClientRect();return box.bottom<=content.bottom+1&&box.top>=content.top-1;}));expect(bounds.every(Boolean)).toBe(true);
  await expect(pages.locator('.appendix-page-start')).toHaveText(['บัญชีรายการ','หมายเหตุเพิ่มเติม']);
 }
 await page.pdf({path:`output/print-check/${type}-v1.pdf`,format:"A4",preferCSSPageSize:true,printBackground:true});
 const signature=original.locator('.signature').first();await signature.locator('..').screenshot({path:`output/print-check/${type}-signature.png`});
 await original.locator('.document-table').first().locator('..').screenshot({path:`output/print-check/${type}-table.png`});
});
