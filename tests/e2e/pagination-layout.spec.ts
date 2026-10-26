import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import { documentHtml } from '../../src/lib/render-document';
import { newDraft } from '../../src/lib/document';
const data=(file:string,mime:string)=>`data:${mime};base64,${fs.readFileSync('public/'+file).toString('base64')}`;
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png'),routingStamp:data('assets/approval-routing-stamp.png','image/png'),copyMark:data('assets/copy-counterpart.png','image/png')};
for(const type of ['external','internal'] as const)test(`${type}: continuation text matches next page with no lost paragraphs`,async({page})=>{
 const body='การทดสอบเอกสารต่อเนื่อง 123 เพื่อให้ข้อความทุกคำปรากฏครบถ้วนในการแบ่งหน้า '.repeat(130);
 await page.setContent(documentHtml({...newDraft(type),organization:'เทศบาลตัวอย่าง',number:'ทดสอบ 123',body,numeralStyle:'thai',signer:'ผู้ลงนามตัวอย่าง',position:'เจ้าหน้าที่'},assets));
 await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 expect(await page.locator('.page').count()).toBeGreaterThan(1);expect((await page.locator('.body-text').allTextContents()).join('')).toBe(body.replace('123','๑๒๓').replaceAll('123','๑๒๓'));
 await expect(page.locator('.page').first().locator('.page-number')).toHaveCount(0);await expect(page.locator('.page').nth(1).locator('.page-number')).toHaveText('- ๒ -');
 const checks=await page.locator('.page').evaluateAll(pages=>pages.slice(0,-1).map((p,i)=>{const cue=p.querySelector('.continuation-cue')!,next=pages[i+1].querySelector('.content')!,first=Array.from(next.querySelectorAll('p,b,strong')).find(n=>n.textContent?.trim())!;return {match:first.textContent!.trim().startsWith(cue.textContent!.slice(0,-3)),gap:cue.getBoundingClientRect().top-p.querySelector('.content')!.getBoundingClientRect().bottom};}));expect(checks.every(x=>x.match&&x.gap>=0)).toBe(true);
 await expect(page.locator('.page').last().locator('.continuation-cue')).toHaveCount(0);
 if(type==='external'){const diff=await page.evaluate(()=>{const date=document.querySelector('.date')!.getBoundingClientRect(),g=document.querySelector('.garuda')!.getBoundingClientRect();return Math.abs(date.left-(g.left+g.width/2));});expect(diff).toBeLessThan(1);}
 await page.locator('.page').first().screenshot({path:`output/pagination-${type}-page1.png`});await page.locator('.page').nth(1).screenshot({path:`output/pagination-${type}-page2.png`});
});

test('external closing and signer remain together on a single page',async({page})=>{
 const body='ข้อความทดสอบให้เนื้อหาเต็มหน้า และตรวจการจัดกลุ่มคำลงท้ายกับผู้ลงนาม '.repeat(150);
 await page.setContent(documentHtml({...newDraft('external'),body,closing:'ขอแสดงความนับถือ',signer:'ผู้ลงนามทดสอบ',position:'นายกเทศมนตรี'},assets));
 await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 const group=page.locator('.signoff-group');await expect(group).toHaveCount(1);
 await expect(group.locator('.closing')).toHaveText('ขอแสดงความนับถือ');await expect(group.locator('.signature')).toContainText('นายกเทศมนตรี');
 const pageClass=await group.evaluate(el=>el.closest('.page')?.className);expect(pageClass).toContain('page');
 const metrics=await group.evaluate(el=>{const closing=el.querySelector('.closing')!,signature=el.querySelector('.signature')!,garuda=document.querySelector('.garuda')!;const g=garuda.getBoundingClientRect(),c=closing.getBoundingClientRect(),s=signature.getBoundingClientRect();return {pageBottom:el.closest('.content')!.getBoundingClientRect().bottom,groupBottom:el.getBoundingClientRect().bottom,closingStart:c.left,closingCenter:c.left+c.width/2,garudaCenter:g.left+g.width/2,signatureCenter:s.left+s.width/2}});
 expect(metrics.groupBottom).toBeLessThanOrEqual(metrics.pageBottom);expect(Math.abs(metrics.closingStart-metrics.garudaCenter)).toBeLessThan(1);expect(Math.abs(metrics.signatureCenter-metrics.closingCenter)).toBeLessThan(1);
});

test('external letter prioritizes keeping signoff on the first page',async({page})=>{
 const body='เทศบาลดำเนินการตรวจสอบรายละเอียดและรวบรวมข้อมูลจากหน่วยงานที่เกี่ยวข้อง เพื่อประกอบการพิจารณาและแจ้งผลตามขั้นตอนของทางราชการ '.repeat(16);
 await page.setContent(documentHtml({...newDraft('external'),body,closing:'ขอแสดงความนับถือ',signer:'ผู้ลงนามทดสอบ',position:'นายกเทศมนตรี'},assets));
 await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 const details=await page.locator('.signoff-group').evaluate(el=>({page:Array.from(document.querySelectorAll('.page')).indexOf(el.closest('.page')!)}));
 expect(details.page).toBe(0);
 await page.locator('.page').first().screenshot({path:'output/signoff-first-page.png'});
});
