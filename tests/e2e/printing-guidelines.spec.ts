import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {documentHtml} from '../../src/lib/render-document';
import {newDraft} from '../../src/lib/document';
const data=(file:string,mime:string)=>`data:${mime};base64,${fs.readFileSync('public/'+file).toString('base64')}`;
const assets={regular:data('fonts/THSarabunNew.ttf','font/ttf'),bold:data('fonts/THSarabunNew-Bold.ttf','font/ttf'),garuda:data('assets/garuda.png','image/png')};
for(const type of ['external','internal'] as const)test(`${type} follows the supplied printing measurements`,async({page})=>{
 const d={...newDraft(type),subject:'ขอเชิญประชุมจัดทำแผนการดำเนินงาน',date:'2026-09-21',number:'มท ๐๐๐๐/๑๒๓',organization:'สำนักงานเทศบาลตัวอย่าง',department:'สำนักปลัดเทศบาล',address:'อำเภอเมือง จังหวัดตัวอย่าง ๑๐๐๐๐',phone:'๐ ๒๐๐๐ ๐๐๐๐',recipient:'หัวหน้าส่วนราชการทุกส่วน',signer:'ชื่อ นามสกุล (ตัวอย่าง)',position:'นายกเทศมนตรีตัวอย่าง',body:'ด้วยสำนักงานเทศบาลตัวอย่างกำหนดจัดประชุมเพื่อพิจารณาแผนการดำเนินงานของหน่วยงาน และเตรียมข้อมูลสำหรับการให้บริการประชาชน\nในการนี้ จึงขอเชิญท่านเข้าร่วมประชุมตามวัน เวลา และสถานที่ที่หน่วยงานกำหนด พร้อมจัดเตรียมข้อมูลที่เกี่ยวข้อง\nจึงเรียนมาเพื่อโปรดพิจารณาเข้าร่วมประชุม',memoGuides:false};
 await page.setContent(documentHtml(d,assets));await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
 const measured=await page.evaluate(()=>{
  const p=document.querySelector('.page')!,g=document.querySelector('.garuda')!,body=document.querySelector('.body-text')!,sig=document.querySelector('.signature')!,space=document.querySelector('.sign-space')!,signer=sig.querySelector('p')!;
  const style=getComputedStyle(p),b=getComputedStyle(body),heading=document.querySelector('.memo-head strong');
  return {left:parseFloat(style.paddingLeft),right:parseFloat(style.paddingRight),top:g.getBoundingClientRect().top-p.getBoundingClientRect().top,garuda:g.getBoundingClientRect().height,indent:parseFloat(b.textIndent),before:parseFloat(b.marginTop),lineHeight:b.lineHeight,signBlank:space.getBoundingClientRect().height,oneLine:signer.getBoundingClientRect().height,heading:heading?{size:getComputedStyle(heading).fontSize,line:getComputedStyle(heading).lineHeight}:null,dots:[...document.querySelectorAll('.memo-value')].map(e=>getComputedStyle(e,'::after').borderBottomStyle),closing:document.querySelector('.closing')?parseFloat(getComputedStyle(document.querySelector('.closing')!).marginTop):null,contact:document.querySelector('.contact')?parseFloat(getComputedStyle(document.querySelector('.contact')!).marginTop):null};
 });
 const mm=96/25.4;expect(measured.left).toBeCloseTo(30*mm,1);expect(measured.right).toBeCloseTo(20*mm,1);expect(measured.top).toBeCloseTo(15*mm,1);expect(measured.garuda).toBeCloseTo((type==='internal'?15:30)*mm,1);expect(measured.indent).toBeCloseTo(25*mm,1);expect(measured.before).toBe(8);expect(measured.lineHeight).toBe('normal');expect(measured.signBlank).toBeCloseTo(measured.oneLine*3,0);
 if(type==='internal'){expect(parseFloat(measured.heading!.size)).toBeCloseTo(29*96/72,2);expect(parseFloat(measured.heading!.line)).toBeCloseTo(35*96/72,2);expect(measured.dots).toEqual(['dotted','dotted','dotted','dotted']);}
 else{expect(measured.closing).toBe(16);expect(measured.contact).toBeCloseTo(measured.oneLine*3,0);}
 expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow)).toBe(false);
 fs.mkdirSync('output/pdf',{recursive:true});await page.pdf({path:`output/pdf/printing-guidelines-${type}.pdf`,format:'A4',preferCSSPageSize:true,printBackground:true});await page.locator('.page').first().screenshot({path:`output/printing-guidelines-${type}.png`});
});
