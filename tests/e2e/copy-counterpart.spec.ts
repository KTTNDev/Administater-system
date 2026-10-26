import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {documentHtml} from '../../src/lib/render-document';
import {newDraft} from '../../src/lib/document';
const data=(file:string,mime:string)=>`data:${mime};base64,${fs.readFileSync('public/'+file).toString('base64')}`;
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png'),routingStamp:data('assets/approval-routing-stamp.png','image/png'),copyMark:data('assets/copy-counterpart.png','image/png')};

test('counterpart keeps original clean and overlays the supplied stamp on the copy',async({page})=>{
 const draft={...newDraft('external'),organization:'เทศบาลตัวอย่าง',number:'ทส 0000/001',subject:'ทดสอบสำเนาคู่ฉบับ',recipient:'ผู้รับหนังสือ',closing:'จึงเรียนมาเพื่อโปรดทราบ',signer:'ผู้ลงนาม',position:'นายกเทศมนตรี',body:'ข้อความทดสอบฉบับจริงและสำเนา',copyMark:'สำเนาคู่ฉบับ' as const,productionMark:true};
 await page.setContent(documentHtml(draft,assets));
 await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 const sheets=page.locator('.page');
 await expect(sheets).toHaveCount(2);
 await expect(sheets.nth(0).locator('.copy-mark,.routing-stamp')).toHaveCount(0);
 await expect(sheets.nth(1).locator('.copy-mark')).toHaveAttribute('src',assets.copyMark);
 await expect(sheets.nth(1).locator('.copy-mark')).toHaveAttribute('alt','สำเนาคู่ฉบับ');
 await expect(sheets.nth(1).locator('.routing-stamp')).toHaveAttribute('src',assets.routingStamp);
 const stampGap=await sheets.nth(1).evaluate(el=>{const stamp=el.querySelector('.copy-mark')!.getBoundingClientRect(),garuda=el.querySelector('.garuda')!.getBoundingClientRect();return garuda.top-stamp.bottom;});
 expect(stampGap).toBeCloseTo(96/25.4,0);
 expect(await page.locator('.body-text').allTextContents()).toContain('ข้อความทดสอบฉบับจริงและสำเนา');
 const position=await sheets.nth(1).locator('.routing-stamp').evaluate(el=>{const r=el.getBoundingClientRect(),p=el.closest('.page')!.getBoundingClientRect(),style=getComputedStyle(el);return {right:p.right-r.right,bottom:p.bottom-r.bottom,width:r.width,zIndex:style.zIndex};});
 expect(position.right).toBeGreaterThan(0);expect(position.right).toBeLessThan(90);expect(position.bottom).toBeGreaterThan(0);expect(position.bottom).toBeLessThan(90);expect(position.width).toBeGreaterThan(250);
 expect(position.zIndex).toBe('21');
 const signoffAlignment=await sheets.nth(0).locator('.signoff-group').evaluate(el=>{const c=el.querySelector('.closing')!.getBoundingClientRect(),s=el.querySelector('.signature')!.getBoundingClientRect();return Math.abs(c.left+c.width/2-s.left-s.width/2)});
 expect(signoffAlignment).toBeLessThan(1);
 await sheets.nth(1).screenshot({path:'output/copy-counterpart.png'});
});
