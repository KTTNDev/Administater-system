import {afterAll,beforeAll,expect,it} from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {chromium,type Browser} from 'playwright';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {documentHtml} from '../src/lib/render-document';
import {documentAssets} from '../src/lib/assets';
import {extractWordPages} from '../src/lib/word-layout';
import {mapProcurementCaseToDrafts} from '../src/lib/procurement/core/mapper';
import {templateFixture} from '../src/lib/procurement/__tests__/templates-fixtures';
import {defaultAgency} from '../src/lib/procurement/presets/default-agency';
import {renderPdf} from '../src/lib/pdf';
import {renderWord} from '../src/lib/word';
import {db,setSetting} from '../src/lib/db';
import {createAppendixImage,appendixSources} from '../src/lib/appendix';
import type {Draft} from '../src/lib/document';

const output='output/core-layout';
let browser:Browser;
beforeAll(async()=>{
  const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-core-layout-'));
  process.env.DATABASE_PATH=path.join(folder,'data.sqlite');setSetting('storage:local',folder);
  fs.mkdirSync(output,{recursive:true});
  const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
  browser=await chromium.launch({headless:true,executablePath});
});
afterAll(async()=>{await browser?.close();db().close();});

async function preview(draft:Draft,name:string){
  const page=await browser.newPage();await page.route('**/*',route=>route.abort());
  await page.setContent(documentHtml(draft,documentAssets(),appendixSources(draft)),{waitUntil:'load'});
  await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
  expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow),name).toBe(false);
  const count=await page.locator('#pages .page').count();
  const text=await page.locator('#pages').innerText();expect(text).not.toMatch(/[0-9]/);
  const outside=await page.locator('#pages .content').evaluateAll(contents=>contents.flatMap(content=>{
    const c=content.getBoundingClientRect();return Array.from(content.querySelectorAll('p,h1,h2,table,img,figcaption')).filter(el=>{
      const b=el.getBoundingClientRect();return !el.closest('.garuda')&&(b.right>c.right+2||b.left<c.left-2||b.bottom>c.bottom+2);
    }).map(el=>el.textContent?.slice(0,80)||el.tagName);
  }));expect(outside,name).toEqual([]);
  await page.locator('#pages .page').first().screenshot({path:`${output}/${name}.png`});
  fs.writeFileSync(`${output}/${name}-metrics.json`,JSON.stringify(await page.locator('#pages .content').evaluateAll(contents=>contents.map(content=>({height:content.clientHeight,blocks:Array.from(content.children).map(el=>({class:el.className,text:el.textContent?.slice(0,100),height:el.getBoundingClientRect().height,signSpace:el.querySelector('.sign-space')?.getBoundingClientRect().height}))}))),null,2));
  return {page,count,text};
}

it('renders all fifteen Thai-numbered Core drafts and preserves the four physical form structures',async()=>{
  for(const item of mapProcurementCaseToDrafts(templateFixture(),defaultAgency)){
    const page=await browser.newPage();await page.setContent(documentHtml(item.draft,documentAssets()));
    await page.waitForFunction(()=>!!(window as unknown as {__paginationDone:boolean}).__paginationDone);
    expect(await page.locator('#pages').innerText()).not.toMatch(/[0-9]/);
    expect(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow),item.docId).toBe(false);
    await page.close();
  }
  for(const id of ['4.1','10','11.2','11.3']){
    const draft=mapProcurementCaseToDrafts(templateFixture(),defaultAgency).find(d=>d.docId===id)!.draft;
    const {page}=await preview(draft,`short-${id}`);
    if(id==='10'){
      expect(await page.locator('#pages .page').count()).toBe(1);
      const columns=await page.locator('#pages .procurement-metadata>div').evaluateAll(cols=>cols.map(el=>el.getBoundingClientRect().x));
      expect(columns[1]).toBeGreaterThan(columns[0]+200);
      const signers=await page.locator('#pages .procurement-signatures .signature').evaluateAll(cols=>cols.map(el=>({x:el.getBoundingClientRect().x,y:el.getBoundingClientRect().y})));
      expect(signers).toHaveLength(0);
      expect(await page.locator('#pages td[colspan="3"][rowspan="3"]').count()).toBe(1);
      const garuda=await page.locator('#pages .garuda').boundingBox();expect(garuda!.y).toBeCloseTo(15*96/25.4,0);
      const measured=await page.evaluate(extractWordPages),table=measured.flatMap(p=>p.blocks).find(b=>b.kind==='table');
      expect(table?.kind==='table'&&table.rows.some(r=>r.cells.some(c=>c.colSpan===3&&c.rowSpan===3))).toBe(true);
    }
    if(id==='11.2'){
      expect(await page.locator('#pages .page').count()).toBe(1);
      expect(await page.locator('#pages .procurement-checkbox').count()).toBe(5);
      expect(await page.locator('#pages .garuda').count()).toBe(0);
      const boxes=await page.locator('#pages .procurement-checkbox').evaluateAll(els=>els.map(el=>({text:el.textContent?.trim()||'',x:el.getBoundingClientRect().x})));
      const okBox=boxes.find(b=>b.text.includes('ถูกต้อง'))!,fullBox=boxes.find(b=>b.text.endsWith('ครบถ้วนตามสัญญา')&&!b.text.includes('ไม่'))!,partialBox=boxes.find(b=>b.text.includes('ไม่ครบถ้วนตามสัญญา'))!;
      expect(fullBox.x-okBox.x).toBeGreaterThan(40);
      expect(partialBox.x-okBox.x).toBeGreaterThan(40);
      expect(await page.locator('#pages .inspection-signatures .signature').count()).toBe(1);
      const sigText=await page.locator('#pages .inspection-signatures .signature').innerText();
      expect(sigText).toContain('(ลงชื่อ)');expect(sigText).toContain('ผู้ตรวจรับพัสดุ');expect(sigText).toContain(draft.signer);expect(sigText).toContain('นักพัฒนาชุมชนชำนาญการ');
    }
    if(id==='11.3'){
      expect(await page.locator('#pages .page').count()).toBe(1);expect(await page.locator('#pages .procurement-photo-certification').count()).toBe(1);
      const photoSig=await page.locator('#pages .photo-signatures .signature').innerText();
      expect(photoSig).toContain('(ลงชื่อ)');expect(photoSig).toContain('ผู้ตรวจรับพัสดุ');expect(photoSig).toContain(draft.signer);expect(photoSig).toContain('นักพัฒนาชุมชนชำนาญการ');
    }
    await page.close();
  }
},180000);

it('aligns the memo date and sole automatic proposer to ข while preserving manual text boxes',async()=>{
 const draft=mapProcurementCaseToDrafts(templateFixture(),defaultAgency).find(d=>d.docId==='1')!.draft;
 draft.proposers=[{name:'ผู้ลงนามอื่นที่ไม่ควรเติม',position:'ตำแหน่งอื่น'}];draft.opinions=[{title:'ความเห็นอัตโนมัติที่ไม่ต้องการ',comment:'',name:'ชื่ออื่น',position:'ตำแหน่ง',lines:1,showDate:false}];
 draft.floatingItems=[{kind:'text',id:randomUUID(),page:1,xMm:110,yMm:220,widthMm:65,fontPt:16,bold:false,text:'ผู้ลงนามที่วางเอง'}];
 const {page}=await preview(draft,'memo-proposer-alignment');
 expect(await page.locator('#pages .signature').count()).toBe(1);expect(await page.locator('#pages .opinion').count()).toBe(0);
 const anchor=await page.locator('#pages .memo-kho').first().boundingBox(),date=await page.locator('#pages .memo-row p:last-child b').first().boundingBox(),signer=await page.locator('#pages .signature').first().boundingBox();
 expect(Math.abs(anchor!.x-date!.x)).toBeLessThan(1);expect(Math.abs(anchor!.x-signer!.x)).toBeLessThan(1);
 expect(await page.locator('#pages .signature').evaluate(el=>getComputedStyle(el).textAlign)).toBe('center');
 expect(await page.locator('#pages .floating-item').innerText()).toContain('ผู้ลงนามที่วางเอง');await page.close();
});

it('aligns memo section headings with the first line of their body in free and structured Core drafts',async()=>{
  for(const linked of [true,false])for(const mode of ['free','structured'] as const){
    const draft=mapProcurementCaseToDrafts(templateFixture(),defaultAgency).find(d=>d.docId==='1')!.draft;
    if(!linked)delete draft.procurementSource;
    draft.bodyMode=mode;draft.sectionHeadings=true;
    const text='รายละเอียดเนื้อหาสำหรับตรวจสอบแนวย่อหน้า';
    draft.body=['เรื่องเดิม','ข้อเท็จจริง','ข้อกฎหมาย','ข้อพิจารณา'].map(title=>`## ${title}\n${text}`).join('\n');
    draft.background=text;draft.facts=text;draft.legalBasis=text;draft.consideration=text;
    const {page,count}=await preview(draft,`memo-headings-${linked?'linked':'ordinary'}-${mode}`);
    const offsets=await page.locator('#pages .body-subheading,#pages .structured-section-title').evaluateAll(headings=>headings.map(heading=>{
      const firstLetterX=(element:Element)=>{const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);while(walker.nextNode()){if(!walker.currentNode.textContent?.trim())continue;const range=document.createRange();range.setStart(walker.currentNode,0);range.setEnd(walker.currentNode,1);return range.getBoundingClientRect().x;}throw Error('Missing paragraph text');};
      return firstLetterX(heading)-firstLetterX(heading.nextElementSibling!);
    }));
    expect(offsets).toHaveLength(4);for(const offset of offsets)expect(Math.abs(offset)).toBeLessThan(1);
    const measured=await page.evaluate(extractWordPages),paragraphs=measured.flatMap(p=>p.blocks).filter(b=>b.kind==='paragraph');
    const heading=paragraphs.find(p=>p.runs.map(r=>r.text).join('')==='เรื่องเดิม')!,body=paragraphs.find(p=>p.runs.map(r=>r.text).join('')===text)!;
    expect(Math.abs(heading.x+heading.indent-body.x-body.indent)).toBeLessThan(1);
    if(linked&&mode==='free')expect((await PDFDocument.load(await renderPdf(draft))).getPageCount()).toBe(count);
    await page.close();
  }
});

it('repeats PO table headers and Thai continuation notes without losing rows or merged VAT totals',async()=>{
  const input=templateFixture();input.items=Array.from({length:42},(_,i)=>({id:randomUUID(),description:`วัสดุสำนักงานลำดับ ${i+1} สำหรับตรวจรับรายละเอียด`,quantity:1,unit:'ชิ้น',unitPrice:107}));
  const draft=mapProcurementCaseToDrafts(input,defaultAgency).find(d=>d.docId==='10')!.draft;
  const {page,count,text}=await preview(draft,'long-po');expect(count).toBeGreaterThan(1);
  expect(await page.locator('#pages .procurement-items').count()).toBeGreaterThan(1);
  expect(text).toContain('ตารางรายการ (ต่อ)');expect(text).toContain('ใบต่อเอกสาร');
  expect(await page.locator('#pages .continuation-cue').count()).toBeGreaterThan(0);
  expect(await page.locator('#pages td[colspan="3"][rowspan="3"]').count()).toBe(1);
  expect(text).toContain('๔,๔๙๔.๐๐');expect(text).toContain('๒๙๔.๐๐');
  fs.writeFileSync(`${output}/long-po.pdf`,await renderPdf(draft));
  const zip=await JSZip.loadAsync(await renderWord(draft)),xml=await zip.file('word/document.xml')!.async('string');
  expect(xml).toContain('w:gridSpan w:val="3"');expect(xml).toContain('w:vMerge w:val="restart"');expect(xml).toContain('ใบต่อเอกสาร');expect(xml).toContain('w:tblHeader');
  await page.close();
},180000);

it('keeps five real photos on photo pages with one final certification and exports all four editable forms',async()=>{
  const photoBytes=new Uint8Array(fs.readFileSync('public/assets/garuda.png'));
  const photos=[];
  for(let i=0;i<5;i++)photos.push({...await createAppendixImage(new File([photoBytes],`ภาพทดสอบ-${i}.png`,{type:'image/png'})),caption:`หลักฐานลำดับ ${i+1}`,widthMm:70});
  const mapped=mapProcurementCaseToDrafts(templateFixture(),defaultAgency);
  for(const id of ['4.1','10','11.2','11.3']){
    const draft=mapped.find(d=>d.docId===id)!.draft;
    if(id==='11.3')draft.appendixImages=photos;
    const {page,count,text}=await preview(draft,`export-${id}`);
    if(id==='11.3'){
      expect(count).toBe(2);expect(await page.locator('#pages .procurement-photo-grid img').count()).toBe(5);
      expect(text.match(/ขอรับรองว่าเป็นเอกสารที่ถูกต้อง/g)).toHaveLength(2);
      expect(await page.locator('#pages .page').first().locator('.procurement-photo-certification').count()).toBe(1);
      expect(await page.locator('#pages .page').last().locator('.procurement-photo-certification').count()).toBe(1);
      const certYs=await page.locator('#pages .page').evaluateAll(ps=>ps.map(p=>p.querySelector('.procurement-photo-certification')!.getBoundingClientRect().top-p.getBoundingClientRect().top));
      expect(Math.abs(certYs[0]-certYs[1])).toBeLessThan(2);
      await page.locator('#pages .page').nth(1).screenshot({path:`${output}/export-11.3-page2.png`});
    }
    const pdf=await renderPdf(draft);expect((await PDFDocument.load(pdf)).getPageCount()).toBe(count);fs.writeFileSync(`${output}/${id}.pdf`,pdf);
    const word=await renderWord(draft);fs.writeFileSync(`${output}/${id}.docx`,word);
    const zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
    const savedXmlText=Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),m=>m[1]).join('').replaceAll('\u2060','');
    expect(xml).toContain('TH SarabunIT๙');expect(savedXmlText).toContain(draft.signer);
    if(id==='10'){expect(xml).toContain('w:gridSpan');expect(xml).toContain('๙๙.๔๔');}
    if(id==='11.2'||id==='11.3'){expect(savedXmlText).toContain('(ลงชื่อ)');expect(savedXmlText).toContain('ผู้ตรวจรับพัสดุ');expect(savedXmlText).toContain('นักพัฒนาชุมชนชำนาญการ');}
    if(id==='11.2')expect(xml).toContain('☑');
    await page.close();
  }
},240000);

it('places Core headerSubtitle above the divider and renders automatic authorizing signatories on order (6.2) and announcement (8)',async()=>{
  const input=templateFixture(),mapped=mapProcurementCaseToDrafts(input,defaultAgency);
  const doc8=mapped.find(d=>d.docId==='8')!.draft;
  const legacyDoc8={...doc8,headerSubtitle:'',procurementForm:undefined,body:`${doc8.headerSubtitle}\n${doc8.body}`};
  for(const [label,draft] of [['mapped',doc8],['legacy',legacyDoc8]] as const){
    const {page}=await preview(draft,`doc08-${label}`);
    const order=await page.locator('#pages .content > p').evaluateAll(nodes=>nodes.map(el=>({cls:el.className,text:el.textContent?.trim()||''})));
    const subjectIdx=order.findIndex(item=>item.text.startsWith('เรื่อง ประกาศผู้ชนะ'));
    const subtitleIdx=order.findIndex(item=>item.text.startsWith('ของ'+defaultAgency.divisionName));
    const dividerIdx=order.findIndex(item=>item.cls.includes('divider'));
    expect(subjectIdx,label).toBeGreaterThanOrEqual(0);
    expect(subtitleIdx,label).toBe(subjectIdx+1);
    expect(dividerIdx,label).toBe(subtitleIdx+1);
    expect(order[subtitleIdx].cls,label).toContain('center');
    expect(order[subtitleIdx].cls,label).toContain('title');
    expect(await page.locator('#pages .signature').count(),label).toBe(1);
    expect(await page.locator('#pages .signature').innerText(),label).toContain(input.signatories.mayor.fullName);
    await page.close();
  }
  const doc62=mapped.find(d=>d.docId==='6.2')!.draft;
  const legacyDoc62={...doc62,headerSubtitle:'',procurementForm:undefined,body:`${doc62.headerSubtitle}\n${doc62.body}`};
  for(const [label,draft] of [['mapped',doc62],['legacy',legacyDoc62]] as const){
    const {page}=await preview(draft,`doc062-${label}`);
    const order=await page.locator('#pages .content > p').evaluateAll(nodes=>nodes.map(el=>({cls:el.className,text:el.textContent?.trim()||''})));
    const subjectIdx=order.findIndex(item=>item.text.startsWith('เรื่อง แต่งตั้ง'));
    const sub1Idx=order.findIndex(item=>item.text.startsWith('สำหรับการ'));
    const sub2Idx=order.findIndex(item=>item.text.startsWith('ของ'+defaultAgency.divisionName));
    const dividerIdx=order.findIndex(item=>item.cls.includes('divider'));
    expect(subjectIdx,label).toBeGreaterThanOrEqual(0);
    expect(sub1Idx,label).toBe(subjectIdx+1);
    expect(sub2Idx,label).toBe(subjectIdx+2);
    expect(dividerIdx,label).toBe(subjectIdx+3);
    for(const idx of [sub1Idx,sub2Idx]){
      expect(order[idx].cls,label).toContain('center');
      expect(order[idx].cls,label).toContain('title');
    }
    expect(await page.locator('#pages .signature').count(),label).toBe(1);
    expect(await page.locator('#pages .signature').innerText(),label).toContain(input.signatories.mayor.fullName);
    await page.close();
  }
  const ordinaryOrder:Draft={...doc62,procurementSource:undefined,headerSubtitle:'สำหรับโครงการตัวอย่างประจำปี\nของส่วนราชการเจ้าของเรื่อง'};
  const {page:ordPage}=await preview(ordinaryOrder,'core-order-subtitle');
  const ordOrder=await ordPage.locator('#pages .content > p').evaluateAll(nodes=>nodes.map(el=>({cls:el.className,text:el.textContent?.trim()||''})));
  const ordSubIdx=ordOrder.findIndex(item=>item.text.startsWith('เรื่อง '));
  expect(ordOrder[ordSubIdx+1].text).toBe('สำหรับโครงการตัวอย่างประจำปี');
  expect(ordOrder[ordSubIdx+2].text).toBe('ของส่วนราชการเจ้าของเรื่อง');
  expect(ordOrder[ordSubIdx+3].cls).toContain('divider');
  await ordPage.close();
  const doc9=mapped.find(d=>d.docId==='9')!.draft;
  const {page:p9,count:c9}=await preview(doc9,'doc09-signatory');
  expect(c9).toBe(1);
  const sig9=await p9.locator('#pages .signoff-group .signature').innerText();
  expect(sig9).toContain(`(${input.signatories.mayor.fullName})`);
  expect(sig9).toContain(`${input.signatories.mayor.position} ${input.signatories.mayor.actingLine}`);
  expect(sig9).toContain(input.signatories.mayor.actingTarget!);
  await p9.close();
  for(const [id,draft] of [['doc062',doc62],['doc08',doc8],['doc09',doc9]] as const){
    const word=await renderWord(draft),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
    const savedText=Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),match=>match[1]).join('').replaceAll('\u2060','');
    expect(savedText,id).toContain(`(${input.signatories.mayor.fullName})`);
    expect(savedText,id).toContain(input.signatories.mayor.position);
    expect(savedText,id).toContain(input.signatories.mayor.actingTarget!);
    if(id!=='doc09')expect(savedText,id).toContain(`ของ${defaultAgency.divisionName} ${defaultAgency.municipalityName} โดยวิธีเฉพาะเจาะจง`);
  }
},180000);

it('uses identical physical page breaks for a TOR paragraph longer than one page in preview, PDF and Word',async()=>{
  const draft=mapProcurementCaseToDrafts(templateFixture(),defaultAgency).find(d=>d.docId==='4.1')!.draft;
  const paragraph='ข้อกำหนดรายละเอียดวัสดุสำหรับตรวจสอบคุณภาพและยืนยันคุณลักษณะให้ครบถ้วนตามที่หน่วยงานกำหนด '.repeat(90).trim();
  draft.body=`## รายละเอียดเพิ่มเติม\n${paragraph}`;
  const {page,count}=await preview(draft,'long-tor');expect(count).toBeGreaterThan(1);
  const pdf=await renderPdf(draft);expect((await PDFDocument.load(pdf)).getPageCount()).toBe(count);fs.writeFileSync(`${output}/long-tor.pdf`,pdf);
  const word=await renderWord(draft),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
  fs.writeFileSync(`${output}/long-tor.docx`,word);
  expect(xml.match(/<w:sectPr>/g)).toHaveLength(count);expect(xml).toContain('ใบต่อเอกสาร');
  const savedTexts=Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),match=>match[1]).join('').replaceAll('\u2060','');
  expect(savedTexts.match(/ข้อกำหนดรายละเอียดวัสดุ/g)).toHaveLength(90);
  fs.writeFileSync(`${output}/long-tor.docx`,word);await page.close();
},180000);

it('uses zero before/after spacing between body lines inside sections and before-only spacing on section headings in preview and Word',async()=>{
  const doc1=mapProcurementCaseToDrafts(templateFixture(22890),defaultAgency).find(d=>d.docId==='1')!.draft;
  const {page}=await preview(doc1,'doc01-spacing');
  const metrics=await page.locator('#pages .page:first-child .content > p').evaluateAll(nodes=>nodes.map(el=>{
    const css=getComputedStyle(el),rect=el.getBoundingClientRect();
    return {cls:el.className,text:el.textContent?.trim()||'',mt:parseFloat(css.marginTop)||0,mb:parseFloat(css.marginBottom)||0,top:rect.top,bottom:rect.bottom};
  }));
  const headings=metrics.filter(m=>m.cls.includes('body-subheading'));
  expect(headings.length).toBeGreaterThanOrEqual(4);
  for(const h of headings){expect(h.mt,h.text).toBeCloseTo(8,0);expect(h.mb,h.text).toBe(0);}
  const considerIdx=metrics.findIndex(m=>m.text.includes('ข้อพิจารณา'));
  expect(considerIdx).toBeGreaterThan(0);
  const sectionBodies=metrics.slice(considerIdx+1).filter(m=>m.cls.includes('body-text'));
  expect(sectionBodies.length).toBeGreaterThanOrEqual(6);
  for(const b of sectionBodies){expect(b.mt,b.text).toBe(0);expect(b.mb,b.text).toBe(0);}
  expect(Math.abs(sectionBodies[0].top-metrics[considerIdx].bottom)).toBeLessThan(0.5);
  for(let i=1;i<sectionBodies.length;i++)expect(Math.abs(sectionBodies[i].top-sectionBodies[i-1].bottom),sectionBodies[i].text).toBeLessThan(0.5);
  await page.close();

  const word=await renderWord(doc1),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
  const wParas=Array.from(xml.matchAll(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g)).map(m=>({
    before:Number(m[1].match(/w:before="(\d+)"/)?.[1]??0),
    after:Number(m[1].match(/w:after="(\d+)"/)?.[1]??0),
    text:Array.from(m[1].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),t=>t[1]).join('').replaceAll('\u2060',''),
  }));
  const wHeading=wParas.find(p=>p.text.includes('ข้อพิจารณา'))!;
  expect(wHeading.before).toBeGreaterThanOrEqual(100);expect(wHeading.after).toBe(0);
  for(const snippet of ['เพื่อให้เจ้าหน้าที่พัสดุ','จัดซื้อกรณีวิธีเฉพาะเจาะจง','๑. ','๒. ','๓. ','๔. ','จึงเรียนมาเพื่อโปรด']){
    const para=wParas.find(p=>p.text.includes(snippet))!;
    expect(para,snippet).toBeDefined();
    expect(para.before,snippet).toBe(0);expect(para.after,snippet).toBe(0);
  }

  const doc62=mapProcurementCaseToDrafts(templateFixture(),defaultAgency).find(d=>d.docId==='6.2')!.draft;
  const {page:p62}=await preview(doc62,'doc062-spacing');
  const m62=await p62.locator('#pages .page:first-child .content > p').evaluateAll(nodes=>nodes.map(el=>{
    const css=getComputedStyle(el);return {cls:el.className,text:el.textContent?.trim()||'',mt:parseFloat(css.marginTop)||0,mb:parseFloat(css.marginBottom)||0};
  }));
  const h62=m62.find(m=>m.cls.includes('body-subheading'))!;
  expect(h62.mt).toBeCloseTo(8,0);expect(h62.mb).toBe(0);
  for(const b of m62.filter(m=>m.cls.includes('body-text'))){expect(b.mt,b.text).toBe(0);expect(b.mb,b.text).toBe(0);}
  await p62.close();
},180000);

it('merges summary footer label cells across leading columns in Doc 7 and general Core tables in preview and Word',async()=>{
  const doc7=mapProcurementCaseToDrafts(templateFixture(22890),defaultAgency).find(d=>d.docId==='7')!.draft;
  const {page}=await preview(doc7,'doc07-merged-totals');
  const rows=await page.locator('#pages table.document-table tbody tr').evaluateAll(trs=>trs.map(tr=>Array.from(tr.children).map(td=>({
    colSpan:(td as HTMLTableCellElement).colSpan,
    cls:td.className,
    align:getComputedStyle(td).textAlign,
    text:td.textContent?.trim()||'',
  }))));
  expect(rows).toHaveLength(4);
  expect(rows[0].map(c=>c.colSpan)).toEqual([1,1,1,1]);
  expect(rows[0][2].align).toBe('right');expect(rows[0][3].align).toBe('right');
  for(const [idx,label] of [[1,'รวมมูลค่าสินค้า'],[2,'ภาษีมูลค่าเพิ่ม ๗%'],[3,'รวมเป็นเงินทั้งสิ้น']] as const){
    expect(rows[idx],label).toHaveLength(2);
    expect(rows[idx][0].colSpan,label).toBe(3);
    expect(rows[idx][0].text,label).toBe(label);
    expect(rows[idx][0].align,label).toBe('right');
    expect(rows[idx][1].colSpan,label).toBe(1);
    expect(rows[idx][1].align,label).toBe('right');
  }
  await page.close();

  const word=await renderWord(doc7),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
  expect(xml.match(/w:gridSpan w:val="3"/g)).toHaveLength(3);
},180000);

it('renders all three appointed committee inspectors cleanly on one page in Doc 11.2',async()=>{
  const input=templateFixture(22890);input.inspectorMode='COMMITTEE_3';
  input.inspectors=[
    {fullName:'นายประธาน ตรวจรับ',position:'หัวหน้าฝ่าย',role:'CHAIRPERSON'},
    {fullName:'นางสาวกรรมการ สอง',position:'นักวิชาการ',role:'MEMBER'},
    {fullName:'นายกรรมการ สาม',position:'เจ้าพนักงาน',role:'MEMBER'},
  ];
  const doc112=mapProcurementCaseToDrafts(input,defaultAgency).find(d=>d.docId==='11.2')!.draft;
  const {page,count}=await preview(doc112,'doc112-committee');
  expect(count).toBe(1);
  const sigs=await page.locator('#pages .inspection-signatures .signature').allInnerTexts();
  expect(sigs).toHaveLength(3);
  expect(sigs[0]).toContain('ประธานกรรมการ');expect(sigs[0]).toContain('(นายประธาน ตรวจรับ)');expect(sigs[0]).toContain('หัวหน้าฝ่าย');
  expect(sigs[1]).toContain('กรรมการ');expect(sigs[1]).toContain('(นางสาวกรรมการ สอง)');expect(sigs[1]).toContain('นักวิชาการ');
  expect(sigs[2]).toContain('กรรมการ');expect(sigs[2]).toContain('(นายกรรมการ สาม)');expect(sigs[2]).toContain('เจ้าพนักงาน');
  await page.close();
  const word=await renderWord(doc112),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
  const savedText=Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),m=>m[1]).join('').replaceAll('\u2060','');
  expect(savedText).toContain('หัวหน้าฝ่าย');expect(savedText).toContain('นักวิชาการ');expect(savedText).toContain('เจ้าพนักงาน');

  const doc113=mapProcurementCaseToDrafts(input,defaultAgency).find(d=>d.docId==='11.3')!.draft;
  const photoBytes=new Uint8Array(fs.readFileSync('public/assets/garuda.png'));
  doc113.appendixImages=await Promise.all(Array.from({length:5},async(_,i)=>({...await createAppendixImage(new File([photoBytes],`c${i+1}.png`,{type:'image/png'})),caption:`ภาพตรวจรับ ${i+1}`,widthMm:70})));
  const {page:p113,count:c113}=await preview(doc113,'doc113-committee');
  expect(c113).toBe(2);
  await p113.locator('#pages .page').nth(1).screenshot({path:`${output}/doc113-committee-page2.png`});
  const certYs113=await p113.locator('#pages .page').evaluateAll(ps=>ps.map(p=>p.querySelector('.procurement-photo-certification')!.getBoundingClientRect().top-p.getBoundingClientRect().top));
  expect(Math.abs(certYs113[0]-certYs113[1])).toBeLessThan(2);
  const sigs113=await p113.locator('#pages .page').first().locator('.photo-signatures .signature').allInnerTexts();
  expect(sigs113).toHaveLength(3);
  expect(sigs113[0]).toContain('ประธานกรรมการ');expect(sigs113[0]).toContain('(นายประธาน ตรวจรับ)');expect(sigs113[0]).toContain('หัวหน้าฝ่าย');
  expect(sigs113[1]).toContain('กรรมการ');expect(sigs113[1]).toContain('(นางสาวกรรมการ สอง)');expect(sigs113[1]).toContain('นักวิชาการ');
  expect(sigs113[2]).toContain('กรรมการ');expect(sigs113[2]).toContain('(นายกรรมการ สาม)');expect(sigs113[2]).toContain('เจ้าพนักงาน');
  expect(await p113.locator('#pages .page').nth(1).locator('.photo-signatures .signature').count()).toBe(3);
  await p113.close();
},180000);

it('places snug full-width dot guides under every visual line of single- and multi-line memo headers',async()=>{
  const draft=mapProcurementCaseToDrafts(templateFixture(22890),defaultAgency).find(d=>d.docId==='1')!.draft;
  draft.subject='ขออนุมัติจัดซื้อวัสดุสำนักงานและอุปกรณ์สนับสนุนการปฏิบัติงานประจำปีงบประมาณ ๒๕๗๐ สำหรับให้บริการประชาชนของกองสวัสดิการสังคม เทศบาลตำบลฉลอง';
  draft.department='งานธุรการ ฝ่ายอำนวยการ กองสวัสดิการสังคม สำนักงานเทศบาลตำบลฉลอง อำเภอเมืองภูเก็ต จังหวัดภูเก็ต';
  const {page}=await preview(draft,'memo-multiline-dots');
  const fields=await page.locator('#pages .page:first-child .memo-value').evaluateAll(nodes=>nodes.map(field=>{
    const rect=field.getBoundingClientRect();
    const guides=Array.from(field.querySelectorAll<HTMLElement>('.memo-dot-guide')).map(g=>({
      top:g.getBoundingClientRect().top,
      width:g.getBoundingClientRect().width,
      dots:g.textContent?.length||0,
    }));
    const lineTops:number[]=[];
    const walker=document.createTreeWalker(field,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()){
      if(walker.currentNode.parentElement?.closest('.document-dot-guide'))continue;
      const range=document.createRange();range.selectNodeContents(walker.currentNode);
      for(const r of range.getClientRects()){if(r.height>=1&&!lineTops.some(t=>Math.abs(t-r.top)<4))lineTops.push(r.top);}
    }
    return {width:rect.width,lineCount:lineTops.length,lineTops:lineTops.sort((a,b)=>a-b),guides};
  }));
  expect(fields).toHaveLength(4);
  expect(fields[0].lineCount).toBeGreaterThanOrEqual(2); // ส่วนราชการ wraps
  expect(fields[3].lineCount).toBeGreaterThanOrEqual(2); // เรื่อง wraps
  for(const f of fields){
    expect(f.guides).toHaveLength(f.lineCount);
    for(let i=0;i<f.lineCount;i++){
      expect(f.guides[i].width).toBeGreaterThanOrEqual(f.width-2);
      const shift=f.guides[i].top-f.lineTops[i];
      expect(shift).toBeGreaterThan(0);
      expect(shift).toBeLessThan(4.5); // snug like an underline (~2pt = 2.67px), not 6pt below the box
    }
  }
  const rowMetrics=await page.locator('#pages .page:first-child .memo-row').evaluate(row=>{
    const numGuide=row.querySelector('p:first-child .memo-dot-guide')!.getBoundingClientRect();
    const dateLabel=row.querySelector('p:last-child b')!.getBoundingClientRect();
    const dateValue=row.querySelector('p:last-child .memo-value')!;
    return {gapBeforeDate:dateLabel.left-numGuide.right,datePadLeft:parseFloat(getComputedStyle(dateValue).paddingLeft)||0};
  });
  expect(rowMetrics.gapBeforeDate).toBeGreaterThan(0);
  expect(rowMetrics.gapBeforeDate).toBeLessThan(10);
  expect(rowMetrics.datePadLeft).toBeGreaterThanOrEqual(12);
  await page.close();
},180000);

it('places the spec-writer signature role line above name and position on Doc 3 in preview and Word',async()=>{
  const input=templateFixture(22890),doc3=mapProcurementCaseToDrafts(input,defaultAgency).find(d=>d.docId==='3')!.draft;
  const {page,count}=await preview(doc3,'doc03-spec-signature');
  expect(count).toBe(1);
  const sigParas=await page.locator('#pages .spec-signature > p').allInnerTexts();
  expect(sigParas).toHaveLength(3);
  expect(sigParas[0]).toMatch(/^\(ลงชื่อ\).+เจ้าหน้าที่กำหนดคุณลักษณะเฉพาะฯ$/);
  expect(sigParas[1]).toBe(`(${input.signatories.procurementOfficer.fullName})`);
  expect(sigParas[2]).toBe(input.signatories.procurementOfficer.position);
  await page.close();

  const word=await renderWord(doc3),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
  const savedText=Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),m=>m[1]).join('').replaceAll('\u2060','');
  const rolePos=savedText.indexOf('เจ้าหน้าที่กำหนดคุณลักษณะเฉพาะฯ'),namePos=savedText.indexOf(`(${input.signatories.procurementOfficer.fullName})`),posPos=savedText.indexOf(input.signatories.procurementOfficer.position);
  expect(rolePos).toBeGreaterThan(0);
  expect(namePos).toBeGreaterThan(rolePos);
  expect(posPos).toBeGreaterThan(namePos);
},180000);

it('renders inline item rows in Doc 6.1 as a borderless headerless aligned list in preview and Word',async()=>{
  const input=templateFixture(1520);
  input.itemDisplayMode='INLINE';
  input.items=[
    {id:randomUUID(),description:'ตลับเมตร',quantity:1,unit:'ชิ้น',unitPrice:340},
    {id:randomUUID(),description:'กล่องพลาสติกมีฝาปิด ขนาด 120 ลิตร',quantity:2,unit:'ใบ',unitPrice:590},
    {id:randomUUID(),description:'กระดาษถ่ายเอกสาร A4',quantity:20,unit:'รีม',unitPrice:120},
  ];
  const doc61=mapProcurementCaseToDrafts(input,defaultAgency).find(d=>d.docId==='6.1')!.draft;
  const {page}=await preview(doc61,'doc061-inline-items');
  const agencyHeader=await page.locator('#pages .memo-field').first().innerText();
  expect(agencyHeader).toContain('งานธุรการ กองสวัสดิการสังคม เทศบาลตำบลฉลอง');
  expect(agencyHeader).not.toContain('เทศบาลตำบลฉลอง  งานธุรการ');
  expect(await page.locator('#pages table.inline-item-list').count()).toBe(1);
  expect(await page.locator('#pages table.inline-item-list thead').count()).toBe(0);
  const rows=await page.locator('#pages table.inline-item-list tbody tr').evaluateAll(trs=>trs.map(tr=>Array.from(tr.children).map(td=>{
    const rect=td.getBoundingClientRect(),css=getComputedStyle(td);
    return {text:td.textContent?.trim()||'',x:rect.left,right:rect.right,borderTop:css.borderTopStyle};
  })));
  expect(rows).toHaveLength(3);
  for(const row of rows){
    expect(row).toHaveLength(5);
    expect(row[0].borderTop).toBe('none');
    expect(row[2].text).toBe('จำนวน');
    expect(Math.abs(row[2].x-rows[0][2].x)).toBeLessThan(0.5);
    expect(Math.abs(row[3].right-rows[0][3].right)).toBeLessThan(0.5);
    expect(Math.abs(row[4].x-rows[0][4].x)).toBeLessThan(0.5);
  }
  await page.close();

  const word=await renderWord(doc61),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
  expect(xml).toContain('<w:tbl>');
  expect(xml).toContain('w:val="none"');
  expect(xml).not.toMatch(/<w:tblBorders>[\s\S]*?w:val="single"/);
  expect(xml).not.toContain('w:tblHeader');
  const savedText=Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),m=>m[1]).join('').replaceAll('\u2060','');
  expect(savedText).toContain('งานธุรการ กองสวัสดิการสังคม เทศบาลตำบลฉลอง');
  expect(savedText).toContain('ตลับเมตร');expect(savedText).toContain('จำนวน');expect(savedText).toContain('รีม');
},180000);

it('renders Doc 13 budget ledger as an inset borderless headerless block in preview and Word',async()=>{
  const doc13=mapProcurementCaseToDrafts(templateFixture(1520),defaultAgency).find(d=>d.docId==='13')!.draft;
  expect(doc13.body).not.toContain('จำนวนเงิน (บาท)');
  const legacyDoc13={
    ...doc13,
    body:doc13.body.replace(
      /ตั้งไว้ \|[\s\S]*?คงเหลือ \| [^\n]+/,
      '| รายการ | จำนวนเงิน (บาท) | รายการ | จำนวนเงิน (บาท) |\n| --- | --- | --- | --- |\n| ตั้งไว้ | ๓๐๐,๐๐๐.๐๐ | โอนเพิ่ม | - |\n| โอนลด | - | รวมเป็นเงิน | ๓๐๐,๐๐๐.๐๐ |\n| เบิกจ่ายแล้ว | ๑,๐๐๐.๐๐ | คงเหลือ | ๒๙๙,๐๐๐.๐๐ |',
    ),
  };
  for(const [label,draft] of [['mapped',doc13],['legacy',legacyDoc13]] as const){
    const {page,count}=await preview(draft,`doc13-ledger-${label}`);
    expect(count,label).toBe(1);
    expect(await page.locator('#pages table.budget-ledger-summary').count(),label).toBe(1);
    expect(await page.locator('#pages table.budget-ledger-summary thead').count(),label).toBe(0);
    expect(await page.locator('#pages').innerText(),label).not.toContain('จำนวนเงิน (บาท)');
    const geometry=await page.locator('#pages table.budget-ledger-summary').evaluate(tbl=>{
      const t=tbl.getBoundingClientRect(),c=tbl.closest('.content')!.getBoundingClientRect();
      const firstCell=tbl.querySelector('td')!;
      return {leftInset:t.left-c.left,rightInset:c.right-t.right,borderTop:getComputedStyle(firstCell).borderTopStyle,rows:tbl.querySelectorAll('tbody tr').length};
    });
    expect(geometry.rows,label).toBe(3);
    expect(geometry.borderTop,label).toBe('none');
    expect(geometry.leftInset,label).toBeGreaterThan(95);
    expect(geometry.rightInset,label).toBeGreaterThan(60);
    await page.close();
  }
  const word=await renderWord(doc13),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
  expect(xml).toContain('<w:tbl>');
  expect(xml).toContain('w:val="none"');
  expect(xml).not.toMatch(/<w:tblBorders>[\s\S]*?w:val="single"/);
  expect(xml).not.toContain('w:tblHeader');
  const savedText=Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),m=>m[1]).join('').replaceAll('\u2060','');
  expect(savedText).toContain('ตั้งไว้');expect(savedText).toContain('โอนเพิ่ม');expect(savedText).toContain('คงเหลือ');
  expect(savedText).not.toContain('จำนวนเงิน (บาท)');
},180000);

it('lets users drag and corner-resize appendix photos freely and exports free-positioned photos to PDF and Word',async()=>{
  const doc113=mapProcurementCaseToDrafts(templateFixture(1520),defaultAgency).find(d=>d.docId==='11.3')!.draft;
  const photoBytes=new Uint8Array(fs.readFileSync('public/assets/garuda.png'));
  const img1={...await createAppendixImage(new File([photoBytes],'drag-1.png',{type:'image/png'})),caption:'ภาพลากอิสระ',widthMm:70};
  doc113.appendixImages=[img1];
  const {page}=await preview(doc113,'doc113-draggable');
  await page.evaluate(()=>{
    (window as unknown as {__events:unknown[]}).__events=[];
    const orig=window.parent.postMessage.bind(window.parent);
    window.parent.postMessage=(msg:unknown)=>{(window as unknown as {__events:unknown[]}).__events.push(msg);try{orig(msg,'*');}catch{}};
  });
  const fig=page.locator('#pages figure[data-appendix-id]').first();
  const capGap=await fig.evaluate(el=>{
    const img=el.querySelector('img')!.getBoundingClientRect(),cap=el.querySelector('figcaption')!.getBoundingClientRect();
    return cap.top-img.bottom;
  });
  expect(capGap).toBeGreaterThanOrEqual(0);
  expect(capGap).toBeLessThan(20);
  await fig.click();
  expect(await fig.getAttribute('class')).toContain('overlay-selected');
  const handle=fig.locator('.overlay-resize');
  expect(await handle.isVisible()).toBe(true);
  const hBox=(await handle.boundingBox())!;
  await page.mouse.move(hBox.x+hBox.width/2,hBox.y+hBox.height/2);
  await page.mouse.down();
  await page.mouse.move(hBox.x+hBox.width/2+45,hBox.y+hBox.height/2+45,{steps:5});
  await page.mouse.up();
  const afterResize=await page.evaluate(()=>((window as unknown as {__events:{source?:string;free?:boolean;widthMm?:number}[]}).__events).filter(e=>e?.source==='sarabun-appendix-position'));
  expect(afterResize.at(-1)?.free).toBe(false);
  expect(afterResize.at(-1)?.widthMm).toBeGreaterThan(75);

  const fBox=(await fig.boundingBox())!;
  await page.mouse.move(fBox.x+fBox.width/2,fBox.y+fBox.height/2);
  await page.mouse.down();
  await page.mouse.move(fBox.x+fBox.width/2-80,fBox.y+fBox.height/2-40,{steps:6});
  await page.mouse.up();
  expect(await page.locator('#pages figure.floating-appendix').count()).toBe(1);
  const afterDrag=await page.evaluate(()=>((window as unknown as {__events:{source?:string;free?:boolean;xMm?:number;yMm?:number;widthMm?:number;page?:number}[]}).__events).filter(e=>e?.source==='sarabun-appendix-position'));
  const drop=afterDrag.at(-1)!;
  expect(drop.free).toBe(true);
  expect(drop.page).toBe(1);
  expect(drop.xMm).toBeGreaterThanOrEqual(0);
  expect(drop.yMm).toBeGreaterThanOrEqual(0);
  await page.close();

  const freeDraft:Draft={...doc113,appendixImages:[{...img1,page:1,xMm:24,yMm:62,widthMm:85}]};
  const {page:pFree,count:cFree,text:tFree}=await preview(freeDraft,'doc113-free-positioned');
  expect(cFree).toBe(1);
  expect(tFree).not.toContain('ยังไม่มีรูปภาพประกอบ');
  const placed=pFree.locator('#pages figure.floating-appendix');
  expect(await placed.count()).toBe(1);
  expect(await placed.evaluate(el=>({left:el.style.left,top:el.style.top,width:el.style.width}))).toEqual({left:'24mm',top:'62mm',width:'85mm'});
  await pFree.close();

  const pdf=await renderPdf(freeDraft);
  expect((await PDFDocument.load(pdf)).getPageCount()).toBe(1);
  const word=await renderWord(freeDraft),zip=await JSZip.loadAsync(word),xml=await zip.file('word/document.xml')!.async('string');
  const savedText=Array.from(xml.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g),m=>m[1]).join('').replaceAll('\u2060','');
  expect(xml).toContain('<w:drawing>');
  expect(savedText).toContain('ภาพลากอิสระ');
  expect(savedText).toContain('ผู้ตรวจรับพัสดุ');
},180000);
