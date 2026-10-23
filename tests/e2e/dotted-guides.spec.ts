import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {documentHtml} from '../../src/lib/render-document';
import {newDraft} from '../../src/lib/document';
import {extractWordPages} from '../../src/lib/word-layout';
const data=(f:string,m:string)=>'data:'+m+';base64,'+fs.readFileSync('public/'+f).toString('base64');
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png'),routingStamp:'',copyMark:''};
for(const type of ['internal','memorandum'] as const)test(type+': field guides match signature dots without changing header text or wrapping',async({page})=>{
 for(const long of [false,true]){
 const organization=long?'เทศบาลตัวอย่าง หน่วยงานเจ้าของเรื่องสำหรับตรวจสอบข้อความหลายบรรทัด '.repeat(3):'เทศบาลตัวอย่าง';
 await page.setContent(documentHtml({...newDraft(type),organization,department:'สำนักปลัดเทศบาล',subject:'ตรวจสอบเส้นปะใต้ข้อความ',number:'ทส 1234/56',body:'ข้อความทดสอบ',opinions:[{title:'ความเห็นหัวหน้าสำนักปลัด',name:'',position:'หัวหน้าสำนักปลัด',comment:'',lines:2,showDate:true}]},assets));
 await page.waitForFunction(()=>Boolean((window as unknown as {__paginationDone:boolean}).__paginationDone));
 const guides=page.locator('.document-dot-guide');await expect(guides).toHaveCount(6);
 const matches=await guides.evaluateAll(nodes=>{
  const ref=getComputedStyle(document.querySelector('.opinion-sign p')!),canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;
  return nodes.every(n=>{const el=n as HTMLElement,s=getComputedStyle(el);ctx.font=s.font;return s.font===ref.font&&s.color===ref.color&&s.letterSpacing===ref.letterSpacing&&ctx.measureText(el.textContent||'').width<=el.clientWidth+1&&el.getAttribute('aria-hidden')==='true';});
 });expect(matches).toBe(true);
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 const pages=await page.evaluate(extractWordPages),paragraphs=pages.flatMap(p=>p.blocks).filter(b=>b.kind==='paragraph');
 expect(paragraphs.some(p=>p.runs.map(r=>r.text).join('').includes(organization))).toBe(true);
 expect(paragraphs.filter(p=>p.runs.some(r=>r.text.includes('เทศบาลตัวอย่าง'))).every(p=>!p.runs.some(r=>r.text.includes('....')))).toBe(true);
 const dotOverlays=pages.flatMap(p=>p.overlays).filter(p=>p.kind==='paragraph'&&p.runs.some(r=>/^\.+$/.test(r.text)));
 expect(dotOverlays).toHaveLength(6);
 if(!long){await page.locator('.page').first().screenshot({path:'output/dotted-guides-'+type+'.png'});await page.pdf({path:'output/dotted-guides-'+type+'.pdf',preferCSSPageSize:true});}
 }
});
