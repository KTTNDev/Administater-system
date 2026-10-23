import {test,expect} from '@playwright/test';
import fs from 'node:fs';import {documentHtml} from '../../src/lib/render-document';import {newDraft} from '../../src/lib/document';import {templates} from '../../src/lib/templates';
const data=(f:string,m:string)=>'data:'+m+';base64,'+fs.readFileSync('public/'+f).toString('base64');
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png'),routingStamp:'',copyMark:''};
test('every form uses the paper center for centered headings and preserves left-aligned memo emblems',async({page})=>{
 for(const t of templates)for(const populated of [false,true]){
  const d={...newDraft(t.id),subject:populated?'การตรวจสอบและดำเนินการเกี่ยวกับทรัพย์สินของหน่วยงานตามแผนการดำเนินงานประจำปีงบประมาณเพื่อปรับปรุงการให้บริการประชาชน':'ร่างหนังสือใหม่',organization:populated?'เทศบาลทดสอบตำแหน่งหัวหนังสือ':'',number:populated?'123/2569':'',body:'ข้อความสำหรับตรวจสอบตำแหน่งบนกระดาษ'};
  await page.setContent(documentHtml(d,assets));await page.waitForFunction(()=>Boolean((window as unknown as {__paginationDone:boolean}).__paginationDone));
  const checks=await page.locator('.page').first().evaluate(el=>{
   const p=el.getBoundingClientRect(),center=p.left+p.width/2,content=el.querySelector('.content')!.getBoundingClientRect();
   const headings=Array.from(el.querySelectorAll('.content>.center,.memo-head strong')).map(n=>{const b=n.getBoundingClientRect();return Math.abs(b.left+b.width/2-center)});
   const g=el.querySelector('.garuda')?.getBoundingClientRect();return {headings,emblem:g?Math.abs(g.left+g.width/2-center):null,memoLeft:g?Math.abs(g.left-content.left):null};
  });
  expect(checks.headings.every(n=>n<1),t.id+' heading').toBe(true);
  if(['internal','memorandum'].includes(t.id)){if(checks.memoLeft!==null)expect(checks.memoLeft,t.id+' left emblem').toBeLessThan(1);}
  else if(checks.emblem!==null)expect(checks.emblem,t.id+' centered emblem').toBeLessThan(1);
  expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow),t.id).toBe(false);
  if(populated&&['order','announcement','statement'].includes(t.id)){await page.locator('.page').first().screenshot({path:'output/center-'+t.id+'.png'});await page.pdf({path:'output/center-'+t.id+'.pdf',preferCSSPageSize:true});}
 }
});
