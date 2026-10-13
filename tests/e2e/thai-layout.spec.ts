import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {documentHtml} from '../../src/lib/render-document';
import {newDraft} from '../../src/lib/document';
const data=(file:string,mime:string)=>`data:${mime};base64,${fs.readFileSync('public/'+file).toString('base64')}`;
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png'),routingStamp:data('assets/approval-routing-stamp.png','image/png'),copyMark:data('assets/copy-counterpart.png','image/png')};

for(const type of ['external','internal'] as const)test(`${type}: Thai paragraphs distribute naturally in preview and print`,async({page})=>{
 const text='เทศบาลมีความประสงค์ตรวจสอบอุปกรณ์สำนักงานเพื่อจัดทำข้อมูลประกอบการพิจารณา โดยให้เจ้าหน้าที่รวบรวมข้อเท็จจริงและรายละเอียดที่เกี่ยวข้องกับการดำเนินงาน '.repeat(5).trim();
 const draft={...newDraft(type),subject:'ทดสอบการกระจายข้อความภาษาไทย',body:text+'\nจึงเรียนมาเพื่อโปรดพิจารณา',signer:'ผู้ลงนาม',position:'นายกเทศมนตรี',appendixPages:[{id:crypto.randomUUID(),title:'รายละเอียดประกอบ',body:text}]};
 await page.setContent(documentHtml(draft,assets));
 await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 for(const selector of ['.body-text','.appendix-text']){
  const para=page.locator(selector).first();
  const result=await para.evaluate(el=>{
   const css=getComputedStyle(el),box=el.getBoundingClientRect(),lines=new Map<number,{left:number;right:number}>();
   const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
   while(walker.nextNode()){
    const node=walker.currentNode;
    for(const segment of new Intl.Segmenter('th',{granularity:'grapheme'}).segment(node.textContent||'')){
     if(!segment.segment.trim())continue;
     const range=document.createRange();range.setStart(node,segment.index);range.setEnd(node,segment.index+segment.segment.length);
     const rect=range.getBoundingClientRect(),key=Math.round(rect.top),line=lines.get(key);
     lines.set(key,{left:Math.min(line?.left??rect.left,rect.left),right:Math.max(line?.right??rect.right,rect.right)});
    }
   }
   return {align:css.textAlign,justify:css.getPropertyValue('text-justify'),last:css.textAlignLast,lines:[...lines.values()],right:box.right,text:el.textContent,breaks:el.querySelectorAll('br').length};
  });
  expect(result.text).toBe(text);expect(result.breaks).toBe(0);
  expect(result.align).toBe('justify');expect(result.justify).toBe('inter-character');expect(result.last).toBe('start');
  expect(result.lines.length).toBeGreaterThan(3);
  for(const line of result.lines.slice(0,-1))expect(Math.abs(result.right-line.right)).toBeLessThan(2);
  expect(result.lines.at(-1)!.right).toBeLessThan(result.right-5);
 }
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 fs.mkdirSync('output/thai-layout',{recursive:true});
 await page.locator('.page').first().screenshot({path:`output/thai-layout/${type}.png`});
 await page.pdf({path:`output/thai-layout/${type}.pdf`,format:'A4',preferCSSPageSize:true,printBackground:true});
});
test('continued Thai paragraphs fill the last line only until the real paragraph ends',async({page})=>{
 const text='ด้วยเทศบาลมีความประสงค์ตรวจสอบข้อมูลและเสนอแนวทางการดำเนินงานเพื่อให้บริการประชาชนอย่างทั่วถึง '.repeat(90);
 await page.setContent(documentHtml({...newDraft('internal'),body:text},assets));
 await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 const parts=page.locator('.body-text');expect(await parts.count()).toBeGreaterThan(1);
 expect((await parts.allTextContents()).join('')).toBe(text);
 const values=await parts.evaluateAll(nodes=>nodes.map(node=>getComputedStyle(node).textAlignLast));
 expect(values.slice(0,-1).every(value=>value==='justify')).toBe(true);expect(values.at(-1)).toBe('start');
});
