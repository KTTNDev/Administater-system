import {wordJoin} from './thai-dictionary';
import {MissingOverlayPageError} from "./export-validation";
import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { chromium, type Page } from 'playwright';
import { Document, Packer, Paragraph, TextRun, Tab, Table, TableRow, TableCell, ImageRun, AlignmentType, BorderStyle, WidthType, TableLayoutType, SectionType, LineRuleType, HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, TextWrappingType, type IParagraphOptions, type ISectionOptions } from 'docx';
import { ShapeRun } from 'docx/shapes';
import pdfjsPackage from 'pdfjs-dist/package.json';
const pdfjsVersion=pdfjsPackage.version;
import {thaiDate,numerals,type Draft} from './document';
import {continuationFooter} from './word-continuation';
import { documentHtml } from './render-document';
import { documentAssets } from './assets';
import { appendixSources, validateAppendixImages } from './appendix';
import { readAttachment, validateAttachments } from './attachments';
import { extractWordPages, type WordPage, type WordParagraph, type WordImage, type WordRun } from './word-layout';

const font = { ascii:'TH SarabunIT๙',hAnsi:'TH SarabunIT๙',cs:'TH SarabunIT๙',eastAsia:'TH SarabunIT๙' };
const twip = (px: number) => Math.round(px * 15);
const emu = (px: number) => Math.round(px * 9525);
const decode = (source: string) => Buffer.from(source.slice(source.indexOf(',')+1),'base64');
function textRuns(runs: WordRun[]) {
  // Word owns paragraph wrapping. Invisible word joiners preserve explicit compound-word groups.
  return runs.flatMap((run,index) => run.softBreak?[new TextRun({break:1})] : (run.keepGroup ? wordJoin(run.text)+(runs[index+1]?.keepGroup===run.keepGroup?'\u2060':'') : run.text).split(/(\t)/).filter(Boolean).map(text => new TextRun({
    ...(text==='\t'?{children:[new Tab()]}:{text}),
    font,size:Math.round(run.size*2),sizeComplexScript:Math.round(run.size*2),bold:run.bold,boldComplexScript:run.bold,italics:run.italic||undefined,italicsComplexScript:run.italic||undefined,
    characterSpacing:Math.round((run.tracking||0)*20),color:run.color,underline:run.underline?{}:undefined,noProof:true,language:{value:'th-TH',eastAsia:'th-TH',bidirectional:'th-TH'},
  })));
}
function guideOffsetY(p: WordParagraph, guide: WordParagraph, rowYs: number[]) {
  if (p.runs.length === 0 || rowYs.length === 0) return guide.y;
  // Recover the exact first-line offset (g0.y - b.y) by cancelling word-layout's (p.height - p.line)
  // subtraction — fixing both single-line rows with inner bottom margin (e.g. budget memos) and
  // multi-line wrapped headers where Word applies exact p.line height to every visual line.
  const firstRowBase = rowYs[0] + Math.max(0, p.height - p.line);
  const rowIndex = rowYs.findIndex(y => Math.abs(y - guide.y) < 4);
  const idx = rowIndex >= 0 ? rowIndex : rowYs.length - 1;
  // +1 px (~0.75 pt) extra clearance so Thai low vowels (ุ/ู) sit cleanly above the dots.
  return firstRowBase + 1 - (rowYs.length - 1 - idx) * p.line;
}
function paragraph(p: WordParagraph, before = 0, left = 0, width = p.width) {
  const rowYs: number[] = [];
  for (const g of p.guides || []) {
    if (!rowYs.some(y => Math.abs(y - g.y) < 4)) rowYs.push(g.y);
  }
  rowYs.sort((a, b) => a - b);
  const options: IParagraphOptions = {
    children:[...textRuns(p.runs),...(p.guides||[]).map(guide=>new ShapeRun({
      type:'rectangle',transformation:{width:guide.width+2,height:guide.height},fill:'none',line:'none',
      children:paragraphs({...guide,x:0,guides:undefined},0,0,guide.width),
      textOptions:{verticalAlignment:'top',margins:{top:0,bottom:0,left:0,right:0},resizeShapeToFitText:true},
      floating:{horizontalPosition:{relative:HorizontalPositionRelativeFrom.PAGE,offset:emu(guide.x)},verticalPosition:{relative:VerticalPositionRelativeFrom.LINE,offset:emu(guideOffsetY(p, guide, rowYs))},allowOverlap:true,behindDocument:true,layoutInCell:false,wrap:{type:TextWrappingType.NONE}}
    }))],alignment:p.align==='center'?AlignmentType.CENTER:p.align==='right'?AlignmentType.RIGHT:p.align==='justify'?AlignmentType.THAI_DISTRIBUTE:AlignmentType.LEFT,
    spacing:{before:twip(before),after:0,line:twip(p.border?p.height:p.line),lineRule:LineRuleType.EXACT},
    indent:{left:twip(Math.max(0,p.x-left)),right:twip(Math.max(0,width-(p.x-left)-p.width-(p.align==='center'?0:4))),firstLine:twip(p.indent)},
    tabStops:p.tabs.map(position=>({type:'left' as const,position:twip(position)})),
    keepNext:p.keep,keepLines:p.keep||p.border,widowControl:false,
    border:p.border?{bottom:{style:BorderStyle.DOTTED,color:'555555',size:4}}:undefined,

  };
  return new Paragraph(options);
}
function paragraphs(p: WordParagraph, before = 0, left = 0, width = p.width) {
  // Explicit newlines (addresses, acting positions, text boxes) start real
  // paragraphs, never Shift+Enter breaks inside a distributed paragraph.
  const groups: WordRun[][] = [[]];
  for(const run of p.runs) {if(run.softBreak){groups.at(-1)!.push(run);continue;}run.text.split(/\r\n|[\r\n\u2028\u2029]/).forEach((text,index)=>{
    if(index) groups.push([]);
    if(text) groups.at(-1)!.push({...run,text});
  });
  }
  return groups.map((runs,index)=>paragraph({...p,runs,guides:index===groups.length-1?p.guides:undefined,keep:index<groups.length-1||p.keep},index===0?before:0,left,width));
}
function image(img: WordImage) {
  return new ImageRun({type:img.source.startsWith('data:image/jpeg')?'jpg':'png',data:decode(img.source),transformation:{width:img.width,height:img.height},crop:img.crop,
    altText:{name:img.alt,title:img.alt,description:img.alt},floating:{horizontalPosition:{relative:HorizontalPositionRelativeFrom.PAGE,offset:emu(img.x)},verticalPosition:{relative:VerticalPositionRelativeFrom.PAGE,offset:emu(img.y)},allowOverlap:true,behindDocument:false,layoutInCell:false,wrap:{type:TextWrappingType.NONE}}});
}
function section(page: WordPage,restartNumbering=false): ISectionOptions {
  const children: (Paragraph | Table)[] = [];
  const overlays=page.overlays.map(item=>item.kind==='image'?image(item):new ShapeRun({type:'rectangle',transformation:{width:item.width+2,height:Math.max(item.height,item.line)},fill:'none',line:item.outline?'555555':'none',children:paragraphs({...item,x:0},0,0,item.width),textOptions:{verticalAlignment:item.outline?'center':'top',margins:{top:0,bottom:0,left:0,right:0},resizeShapeToFitText:true},floating:{horizontalPosition:{relative:HorizontalPositionRelativeFrom.PAGE,offset:emu(item.x)},verticalPosition:{relative:VerticalPositionRelativeFrom.PAGE,offset:emu(item.y)},allowOverlap:true,behindDocument:false,layoutInCell:false,wrap:{type:TextWrappingType.NONE}}}));
  children.push(new Paragraph({children:overlays,spacing:{before:0,after:0,line:1,lineRule:LineRuleType.EXACT}}));
  let bottom=page.top;
  for(const block of page.blocks) {
    const gap=Math.max(0,block.y-bottom);
    if(block.kind==='paragraph') {
      // Word 2013+ measures relativeFrom="line" from the top of spaceBefore, which pulls dot guides
      // upward straight through the text whenever before > 0 (e.g. ส่วนราชการ, budget headers, opinion lines).
      // Emit any leading gap as an exact spacer paragraph so guided paragraphs always have w:before="0".
      if(twip(gap)>0 && block.guides?.length) {
        children.push(new Paragraph({keepNext:true,spacing:{before:0,after:0,line:twip(gap),lineRule:LineRuleType.EXACT}}));
        children.push(...paragraphs(block,0,page.left,page.width-page.left-page.right));
      } else {
        children.push(...paragraphs(block,block.guides?.length?0:gap,page.left,page.width-page.left-page.right));
      }
    }
    else {
      if(gap>0) children.push(new Paragraph({spacing:{before:0,after:0,line:twip(gap),lineRule:LineRuleType.EXACT}}));
      const border={style:block.bordered===false?BorderStyle.NONE:BorderStyle.SINGLE,size:4,color:block.plainHeader?'000000':'555555'};
      children.push(new Table({width:{size:twip(block.width),type:WidthType.DXA},indent:{size:twip(block.x-page.left),type:WidthType.DXA},layout:TableLayoutType.FIXED,borders:block.bordered===false?{top:border,bottom:border,left:border,right:border,insideHorizontal:border,insideVertical:border}:undefined,
        columnWidths:block.columnWidths?.map(twip)??block.rows[0]?.cells.map(cell=>twip(cell.width)),
        rows:block.rows.map(row=>new TableRow({...(row.header?{tableHeader:true}:{}),cantSplit:true,children:row.cells.map(cell=>new TableCell({columnSpan:cell.colSpan,rowSpan:cell.rowSpan,verticalAlign:cell.verticalAlign==='middle'?'center':undefined,width:{size:twip(cell.width),type:WidthType.DXA},margins:block.bordered===false&&!block.rows.some(r=>r.header)?{top:0,bottom:0,left:0,right:100}:block.plainHeader?{top:40,bottom:40,left:60,right:60}:{top:80,bottom:80,left:120,right:120},borders:{top:border,bottom:border,left:border,right:border},shading:row.header&&!block.plainHeader?{fill:'F2F2F2'}:undefined,children:paragraphs({...cell,x:0,width:cell.width,indent:0,keep:false},0,0,cell.width)}))}))}));
      children.push(new Paragraph({spacing:{before:0,after:0,line:1,lineRule:LineRuleType.EXACT}}));
    }
    bottom=block.y+block.height;
  }
  return {properties:{type:SectionType.NEXT_PAGE,page:{...(restartNumbering?{pageNumbers:{start:1}}:{}),size:{width:twip(page.width),height:twip(page.height)},margin:{top:twip(page.top),bottom:twip(20*96/25.4),left:twip(page.left),right:twip(page.right),header:0,footer:0}}},children};
}

async function attachedPages(page: Page, draft: Draft): Promise<WordPage[]> {
  if(!draft.attachmentFiles.length)return [];
  if(draft.attachmentFiles.reduce((n,file)=>n+file.pages,0)>200) throw new Error('Word รองรับไฟล์แนบรวมไม่เกิน 200 หน้า กรุณาแบ่งเอกสารหรือส่งออกเป็น PDF');
  const base=path.join(process.cwd(),'public/vendor/pdfjs',pdfjsVersion);
  // A private, in-memory origin serves only the bundled PDF renderer. No outbound requests.
  await page.unroute('**/*');
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!=='http://word-export.local')return route.abort();
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><script type="module">import * as pdfjs from "/pdf.min.mjs";window.wordPdfjs=pdfjs;</script></body></html>' });
    const relative=decodeURIComponent(url.pathname).slice(1),target=path.resolve(base,relative);
    if(!target.startsWith(path.resolve(base)+path.sep)||!fs.existsSync(target)||!fs.statSync(target).isFile())return route.abort();
    await route.fulfill({body:fs.readFileSync(target),contentType:target.endsWith('.mjs')?'text/javascript':'application/octet-stream'});
  });
  await page.goto('http://word-export.local/');
  await page.waitForFunction(()=>!!(window as unknown as {wordPdfjs:unknown}).wordPdfjs);
  const result: WordPage[]=[];
  for(const attachment of draft.attachmentFiles) {
    const bytes=readAttachment(attachment.id).file.toString('base64');
    // Render one attachment at a time so decoded canvases are not retained across files.
    const images = await page.evaluate(async ({bytes})=>{
      const pdfjs=(window as unknown as {wordPdfjs:typeof import('pdfjs-dist')}).wordPdfjs;
      pdfjs.GlobalWorkerOptions.workerSrc='http://word-export.local/pdf.worker.min.mjs';
      const loadingTask=pdfjs.getDocument({data:Uint8Array.from(atob(bytes),c=>c.charCodeAt(0)),cMapUrl:'/cmaps/',cMapPacked:true,standardFontDataUrl:'/standard_fonts/',wasmUrl:'/wasm/'});
      const pdf=await loadingTask.promise;
      const pages: {source:string;width:number;height:number}[]=[];
      try { for(let n=1;n<=pdf.numPages;n++) {
        const pdfPage=await pdf.getPage(n),viewport=pdfPage.getViewport({scale:1.5}),canvas=document.createElement('canvas');
        canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
        await pdfPage.render({canvasContext:canvas.getContext('2d')!,canvas,viewport}).promise;
        pages.push({source:canvas.toDataURL('image/jpeg',.9),width:viewport.width/1.5*96/72,height:viewport.height/1.5*96/72});
        canvas.width=0;canvas.height=0;pdfPage.cleanup();
      } } finally {await loadingTask.destroy();}
      return pages;
    },{bytes});
    for(const item of images)result.push({width:item.width,height:item.height,top:0,left:0,right:0,copy:false,appendix:true,blocks:[],overlays:[{...item,kind:'image',x:0,y:0,alt:`หน้าเอกสารแนบ ${attachment.showNameInDocument?attachment.description:''}`.trim()}]});
  }
  return result;
}

export async function renderWord(draft: Draft): Promise<Buffer> {
  validateAppendixImages(draft);validateAttachments(draft);
  const assets=documentAssets();
  const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
  const browser=await chromium.launch({headless:true,executablePath});
  try {
    const page=await browser.newPage();await page.route('**/*',route=>route.abort());
    // Dedicated forms use the same physical paragraph breaks as preview/PDF.
    // General correspondence retains Word's existing logical-paragraph editing behavior.
    await page.setContent(documentHtml(draft,assets,appendixSources(draft),{wordParagraphs:!draft.layout.startsWith('procurement-')}),{waitUntil:'load'});
    await page.waitForFunction(()=> (window as unknown as {__paginationDone:boolean}).__paginationDone,undefined,{timeout:15000});
    const missing=await page.evaluate(()=> (window as unknown as {__missingOverlayPages:number[]}).__missingOverlayPages);
    if(missing.length)throw new MissingOverlayPageError(missing);
    if(await page.evaluate(()=> (window as unknown as {__overflow:boolean}).__overflow))throw new Error('มีเนื้อหาบางส่วนเกินหน้ากระดาษ กรุณาตรวจตัวอย่างก่อนส่งออก Word');
    // Memos use a real Word footer. Specialized forms retain the measured page-specific note.
    if(['internal','memorandum'].includes(draft.type))await page.locator('.continuation-note').evaluateAll(notes=>notes.forEach(note=>note.remove()));
    const pages=await page.evaluate(extractWordPages);
    const attachments=await attachedPages(page,draft);
    const ordered=[...pages.filter(p=>!p.copy),...attachments,...pages.filter(p=>p.copy),...(pages.some(p=>p.copy)?attachments:[])];
    const document=new Document({compatibility:{version:15,applyBreakingRules:true},creator:'Sarabun',title:draft.subject,description:'ข้อความและตารางแก้ไขได้ใน Word; ไฟล์ PDF ที่แนบแสดงเป็นภาพแต่ละหน้า',
      styles:{default:{document:{run:{font,size:32,sizeComplexScript:32,noProof:true,language:{value:'th-TH',eastAsia:'th-TH',bidirectional:'th-TH'}},paragraph:{spacing:{after:0}}}}},
      fonts:[{name:'TH SarabunIT๙',data:decode(assets.regular),bold:decode(assets.bold),italic:assets.italic?decode(assets.italic):undefined,boldItalic:assets.boldItalic?decode(assets.boldItalic):undefined}],sections:ordered.map((page,index)=>section(page,page.copy&&(index===0||!ordered[index-1].copy)))});
    const bytes=await Packer.toBuffer(document);
    return ['internal','memorandum'].includes(draft.type)?continuationFooter(bytes,{subject:numerals(draft.subject||'[เรื่อง]',draft.numeralStyle),number:numerals(draft.number||'[เลขหนังสือ]',draft.numeralStyle),date:numerals(thaiDate(draft.date),draft.numeralStyle),memo:true},[],false,ordered.flatMap((page,index)=>page.appendix?[index]:[])):bytes;
  } finally {await browser.close();}
}


// Inventory documents share the measured paper, Thai typography and editable Word writer.
export async function renderWordHtml(html:string,title:string):Promise<Buffer>{
 const assets=documentAssets();
 const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
 const browser=await chromium.launch({headless:true,executablePath});
 try{
  const page=await browser.newPage();await page.route('**/*',route=>route.abort());await page.setContent(html,{waitUntil:'load'});
  await page.waitForFunction(()=>(window as unknown as {__paginationDone:boolean}).__paginationDone,undefined,{timeout:15000});
  if(await page.evaluate(()=>(window as unknown as {__overflow:boolean}).__overflow))throw new Error('มีรายการสูงเกินหน้ากระดาษ กรุณาตรวจตัวอย่างก่อนส่งออก Word');
  const pages=await page.evaluate(extractWordPages);
  return await Packer.toBuffer(new Document({compatibility:{version:15,applyBreakingRules:true},creator:'Sarabun',title,
   styles:{default:{document:{run:{font,size:32,sizeComplexScript:32,noProof:true,language:{value:'th-TH',eastAsia:'th-TH',bidirectional:'th-TH'}},paragraph:{spacing:{after:0}}}}},
   fonts:[{name:'TH SarabunIT๙',data:decode(assets.regular),bold:decode(assets.bold),italic:assets.italic?decode(assets.italic):undefined,boldItalic:assets.boldItalic?decode(assets.boldItalic):undefined}],sections:pages.map(page=>section(page))}));
 }finally{await browser.close();}
}
