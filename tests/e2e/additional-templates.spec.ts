import {test,expect} from '@playwright/test';import fs from 'node:fs';
import {newDraft} from '../../src/lib/document';import {documentHtml} from '../../src/lib/render-document';
const data=(file:string,mime:string)=>`data:${mime};base64,${fs.readFileSync('public/'+file).toString('base64')}`;
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png')};
test('new variants render without overflow and keep the requested top margin',async({page})=>{
 for(const type of ['external','internal','memorandum','stamped','order','regulation','announcement','certificate','minutes'] as const){
  await page.setContent(documentHtml({...newDraft(type),firstPageTop:'25',memoEmblem:true,subject:'ทดสอบรูปแบบเพิ่มเติม',organization:'เทศบาลตัวอย่าง',number:'2',body:'ข้อความตัวอย่างสำหรับตรวจรูปแบบ',signer:'ผู้ลงนามตัวอย่าง',position:'นายกเทศมนตรี',orderReceivedBy:'นายกเทศมนตรี'},assets));
  await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
  expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow),type).toBe(false);
  expect(await page.locator('.page').first().evaluate(el=>parseFloat(getComputedStyle(el).paddingTop))).toBeCloseTo(25*96/25.4,1);
  if(type==='order'){await expect(page.locator('.received-order')).toHaveText('รับคำสั่งนายกเทศมนตรี');await page.screenshot({path:'output/additional-order.png'});}
  if(type==='regulation'){await expect(page.locator('.title').filter({hasText:'ว่าด้วย'})).toBeVisible();await page.screenshot({path:'output/additional-regulation.png'});}
 }
});
test('reference manual can be read at a selected template page',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'แบบหนังสือราชการ',exact:true}).click();await page.getByRole('button',{name:'เปิดคู่มือแบบหนังสือเพิ่มเติม 40 หน้า'}).click();await page.getByLabel('เลือกแบบในคู่มือ').selectOption('18');await expect(page.locator('canvas[aria-label="เอกสารหน้า 18"]')).toHaveAttribute('data-rendered','true',{timeout:30000});
});
