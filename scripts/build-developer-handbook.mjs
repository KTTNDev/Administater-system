/** Build the Thai developer handbook. Reads source only; never imports app DB. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url)));
const version='1.4.1';
const commit='ce439486e3c824eecc31f496279bc055ad471335';
const out=path.join(root,'output/pdf');
const qa=path.join(root,'tmp/pdfs/developer-handbook');
fs.mkdirSync(out,{recursive:true});fs.mkdirSync(qa,{recursive:true});
const source=fs.readFileSync(path.join(root,`docs/DEVELOPER-HANDBOOK-${version}.md`),'utf8');
const chapters=source.trim().split(/\n\s*<!-- page -->\s*\n/);
const titles=chapters.map(s=>s.match(/^# (.+)/m)?.[1]||'');
if(titles.some(t=>!t))throw Error('Every chapter needs a title');
const escape=s=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function codeLink(x){
 const file=path.resolve(root,x);
 const isSource=(/^(src\/|scripts\/|docs\/|public\/)/.test(x)||['package.json','tsconfig.json','next.config.mjs','.gitignore','CHANGELOG.md','playwright.config.ts','vitest.config.ts','AGENTS.md','QUICK-START-TH.md'].includes(x)) && !x.includes('developer') && !x.includes('DEVELOPER');
 const code=`<code>${escape(x)}</code>`;
 return isSource&&fs.existsSync(file)&&fs.statSync(file).isFile()?`<a href="https://github.com/KTTNDev/Administater-system/blob/${commit}/${x}">${code}</a>`:code;
}
function inline(raw){
 const tokens=[];
 const hold=html=>{tokens.push(html);return `\u0001${tokens.length-1}\u0002`;};
 let s=raw.replace(/`([^`]+)`/g,(_,x)=>hold(codeLink(x)));
 s=s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g,(_,label,url)=>hold(`<a href="${escape(url)}">${escape(label)}</a>`));
 s=escape(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
 return s.replace(/\u0001(\d+)\u0002/g,(_,i)=>tokens[Number(i)]);
}
const cells=line=>line.trim().replace(/^\||\|$/g,'').split(/(?<!\\)\|/).map(x=>x.trim().replace(/\\\|/g,'|'));
function markdown(md){
 const lines=md.split(/\r?\n/),html=[];let i=0;
 while(i<lines.length){
  const l=lines[i];if(!l.trim()){i++;continue;}
  if(l.startsWith('```')){
   const lang=l.slice(3).trim(),code=[];i++;while(i<lines.length&&!lines[i].startsWith('```'))code.push(lines[i++]);i++;
   if(lang==='flow')html.push('<div class="flow">'+code.map(row=>`<div class="${row.trim()==='↓'?'arrow':''}">${escape(row)}</div>`).join('')+'</div>');
   else html.push(`<div class="code-label">${escape(lang||'code')}</div><pre><code>${escape(code.join('\n'))}</code></pre>`);
   continue;
  }
  if(l.startsWith('|')&&lines[i+1]?.match(/^\|[\s:|\-]+\|$/)){
   const head=cells(l);i+=2;const rows=[];while(lines[i]?.startsWith('|'))rows.push(cells(lines[i++]));
   html.push(`<table data-cols="${head.length}" class="${['ลำดับ','id'].includes(head[0])?'numbered':''}"><thead><tr>`+head.map(x=>'<th>'+inline(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+inline(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table>');continue;
  }
  if(/^## /.test(l)){html.push('<h2>'+inline(l.slice(3))+'</h2>');i++;continue;}
  if(/^# /.test(l)){i++;continue;}
  if(/^(- |\d+\. )/.test(l)){
   const ordered=/^\d/.test(l),items=[];
   while(i<lines.length&&/^(?:- |\d+\. )/.test(lines[i]))items.push(lines[i++].replace(/^(?:- |\d+\. )/,''));
   html.push(`<${ordered?'ol':'ul'}>`+items.map(x=>'<li>'+inline(x.replace(/^\[ \]/,'□'))+'</li>').join('')+`</${ordered?'ol':'ul'}>`);continue;
  }
  const text=[l];i++;while(i<lines.length&&lines[i].trim()&&!/^(#|```|\||- |\d+\. )/.test(lines[i]))text.push(lines[i++]);
  const joined=text.join(' ');html.push(`<p${joined.startsWith('**อ่านโค้ด:')?' class="source"':''}>${inline(joined)}</p>`);
 }
 return html.join('\n');
}
function group(n){return n<=6?'เข้าใจระบบ':n<=13?'TypeScript และ React':n<=16?'ข้อมูลและความถูกต้อง':n<=24?'เครื่องมือสร้างเอกสาร':n<=31?'ระบบงานและการดูแล':n<=37?'ลงมือพัฒนาต่อ':'ทดสอบและส่งมอบ';}
const total=chapters.length+3;
const footer=n=>`<footer><span>SARABUN / DEVELOPER HANDBOOK / ${version}</span><span>${String(n).padStart(2,'0')} / ${total}</span></footer>`;
const sheets=[`<section class="sheet cover" id="cover"><div class="cover-kicker">SARABUN · ENGINEERING SERIES</div><div class="cover-rule"></div><h1>เข้าใจระบบ<br>แล้วพัฒนาต่อ</h1><div class="cover-sub">คู่มือนักพัฒนาระบบสารบรรณ</div><div class="cover-version">VERSION ${version}</div><div class="cover-bottom"><p>สถาปัตยกรรม · TypeScript · ฐานข้อมูล<br>ตัวจัดหน้า · PDF / Word · งานพัสดุ<br>เพิ่มฟีเจอร์ · ทดสอบ · ส่งมอบโปรแกรม</p><div class="cover-meta">คู่มือส่งต่องานและแบบเรียนจากโค้ดจริง<br>24 ตุลาคม 2569 · ${chapters.length} บท<br>Source snapshot: ${commit.slice(0,7)}</div></div>${footer(1)}</section>`];
for(let part=0;part<2;part++){
 const start=part*22,end=Math.min(start+22,titles.length);
 sheets.push(`<section class="sheet toc"><header>แผนที่การอ่าน / ${part+1}</header><h1>สารบัญ${part?' (ต่อ)':''}</h1><p class="intro">กดชื่อบทเพื่อไปยังเนื้อหา เลขหน้าตรงกับหน้าในไฟล์ PDF</p><div class="toc-list">${titles.slice(start,end).map((t,j)=>`<a href="#chapter-${start+j+1}"><span class="toc-index">${String(start+j+1).padStart(2,'0')}</span><span>${escape(t)}</span><b>${start+j+4}</b></a>`).join('')}</div><div class="toc-note">อ่านเพื่อรับงาน: บท 1-6, 14-16, 30-31, 38-44<br>อ่านเพื่อฝึกเขียน: บท 7-13, 33-34, 41</div>${footer(part+2)}</section>`);
}
chapters.forEach((md,i)=>sheets.push(`<section class="sheet chapter ${[2,4,37,43].includes(i)?'compact':''}" id="chapter-${i+1}"><header><span>${escape(group(i+1))}</span><span>บท ${String(i+1).padStart(2,'0')}</span></header><h1><span class="chapter-number">${String(i+1).padStart(2,'0')}</span>${escape(titles[i])}</h1><main>${markdown(md)}</main>${footer(i+4)}</section>`));
const regular=fs.readFileSync(path.join(root,'public/fonts/THSarabunNew.ttf')).toString('base64');
const bold=fs.readFileSync(path.join(root,'public/fonts/THSarabunNew-Bold.ttf')).toString('base64');
const html=`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>คู่มือนักพัฒนาสารบรรณ ${version}</title><style>
@font-face{font-family:Thai;src:url(data:font/ttf;base64,${regular})} @font-face{font-family:Thai;src:url(data:font/ttf;base64,${bold});font-weight:700}
*{box-sizing:border-box}html,body{margin:0;padding:0}body{font-family:Thai,sans-serif;font-size:16pt;line-height:1.22;color:#1d2c36;background:#e9e9e7} @page{size:A4;margin:0}
.sheet{position:relative;width:210mm;height:297mm;padding:17mm 19mm 18mm;background:#fff;break-after:page;margin:0 auto 5mm;overflow:hidden}.sheet:last-child{break-after:auto}header{display:flex;justify-content:space-between;color:#497078;border-bottom:1px solid #cddbdc;padding-bottom:3mm;margin-bottom:5mm;font-size:13pt}footer{position:absolute;bottom:9mm;left:19mm;right:19mm;display:flex;justify-content:space-between;font:8pt/1.2 Arial,sans-serif;letter-spacing:.5px;color:#65757b;border-top:1px solid #dbe3e4;padding-top:3mm}h1{font-size:25pt;line-height:1.08;margin:0 0 5mm;letter-spacing:0;color:#132f3d}h2{font-size:19pt;line-height:1.12;margin:4mm 0 2mm;color:#1c5963}p{margin:0 0 3mm}strong{font-weight:700}a{color:#176879;text-decoration:none}ul,ol{margin:2mm 0 3mm;padding-left:6mm}li{margin-bottom:1.8mm}table{border-collapse:collapse;width:100%;margin:3mm 0 4mm;font-size:14.2pt;line-height:1.17;table-layout:fixed}th{text-align:left;background:#e9f0f1;color:#183e48;font-weight:700;padding:2.4mm}td{padding:2.2mm 2.4mm;vertical-align:top;border-bottom:1px solid #dfe6e7;overflow-wrap:anywhere}th:first-child,td:first-child{width:34%}code{font-family:Consolas,Thai,monospace;font-size:.73em;background:#f0f3f4;border-radius:2px;padding:0 .6mm;overflow-wrap:anywhere}pre{font:9.4pt/1.5 Consolas,Thai,monospace;background:#f1f4f5;border-left:2px solid #43808b;padding:3mm;margin:0 0 4mm;white-space:pre-wrap;overflow-wrap:anywhere}pre code{font:inherit;background:none;padding:0}.code-label{font:7.5pt Arial,sans-serif;color:#486970;background:#f1f4f5;padding:2mm 3mm 0;margin-top:3mm;border-left:2px solid #43808b;text-transform:uppercase}.source{font-size:13pt;line-height:1.2;color:#50636c;border-top:1px solid #dde6e7;padding-top:3mm;margin-top:4mm}.source code{font-size:.82em}.chapter-number{display:block;font:10pt Arial,sans-serif;color:#53828a;letter-spacing:2px;margin-bottom:2mm}.flow{border:1px solid #d6e2e4;border-radius:2mm;padding:3mm 4mm;background:#f6f9f9;text-align:center;font-size:15pt;margin:3mm 0 4mm;line-height:1.2}.flow .arrow{color:#5c8d96;line-height:1}
.cover{background:#f7f5ef;padding:24mm 22mm}.cover-kicker{font:10pt Arial,sans-serif;letter-spacing:2px;color:#416773}.cover-rule{width:30mm;height:2mm;background:#236779;margin:15mm 0 9mm}.cover h1{font-size:53pt;line-height:1.04;margin:0 0 8mm}.cover-sub{font-size:25pt;color:#45626b}.cover-version{display:inline-block;font:11pt Arial,sans-serif;color:#196073;border:1px solid #86a6ad;padding:3mm 4mm;margin-top:9mm;letter-spacing:1.4px}.cover-bottom{margin-top:28mm;padding-top:8mm;border-top:1px solid #c5d1d2}.cover-bottom p{font-size:22pt;line-height:1.32}.cover-meta{font-size:15pt;color:#5b7078;margin-top:8mm}.toc .intro{color:#6a7981;font-size:15pt}.toc-list{margin-top:6mm}.toc-list a{display:grid;grid-template-columns:9mm 1fr 8mm;gap:2mm;align-items:baseline;border-bottom:1px solid #e3e9e9;padding:1.25mm 0;font-size:14.5pt;line-height:1.15;color:#233e48}.toc-list b{text-align:right;font-size:14pt}.toc-index{font:9pt Arial,sans-serif;color:#64919a}.toc-note{margin-top:5mm;color:#587079;font-size:14pt;line-height:1.25}
table[data-cols="3"] th:first-child,table[data-cols="3"] td:first-child{width:20%}table.numbered th:first-child,table.numbered td:first-child{width:10%}table.numbered[data-cols="3"] th:nth-child(2),table.numbered[data-cols="3"] td:nth-child(2){width:43%}.compact main{font-size:15.5pt;line-height:1.18}.compact td,.compact th{padding:1.65mm 2.4mm}.compact table{font-size:14pt;line-height:1.14}.compact li{margin-bottom:1.5mm}@media print{body{background:white}.sheet{margin:0}a{color:inherit}}
</style></head><body>${sheets.join('\n')}</body></html>`;
const stem=`Sarabun-Developer-Handbook-${version}`;
fs.writeFileSync(path.join(out,stem+'.html'),html);
const executablePath=process.env.CHROMIUM_EXECUTABLE_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p=>fs.existsSync(p));
const browser=await chromium.launch({headless:true,executablePath});
try{
 const page=await browser.newPage({viewport:{width:1000,height:1250},deviceScaleFactor:1});
 await page.route('**/*',route=>route.abort());
 await page.setContent(html,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
 const issues=await page.evaluate(()=>Array.from(document.querySelectorAll('.sheet')).flatMap((sheet,i)=>{
  const footer=sheet.querySelector('footer').getBoundingClientRect();
  const nodes=Array.from(sheet.querySelectorAll('main,main>*,.toc-list,.toc-note,.cover-bottom'));
  return nodes.filter(el=>el.getBoundingClientRect().bottom>footer.top-8||el.scrollWidth>el.clientWidth+2).map(el=>({page:i+1,tag:el.tagName,text:el.textContent.slice(0,90),bottom:Math.round(el.getBoundingClientRect().bottom-sheet.getBoundingClientRect().top),limit:Math.round(footer.top-sheet.getBoundingClientRect().top-8)}));
 }));
 fs.writeFileSync(path.join(qa,'layout-check.json'),JSON.stringify({pages:total,issues},null,2));
 if(issues.length){console.error(JSON.stringify(issues));throw Error('Handbook layout overflow');}
 await page.pdf({path:path.join(out,stem+'.pdf'),preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false,tagged:true,outline:true});
 for(const n of [1,2,3,10,13,18,22,29,36,41,47].filter(n=>n<=total))await page.locator('.sheet').nth(n-1).screenshot({path:path.join(qa,`html-page-${n}.png`)});
 console.log(JSON.stringify({pdf:path.join(out,stem+'.pdf'),pages:total,chapters:chapters.length,layoutIssues:0}));
}finally{await browser.close();}
