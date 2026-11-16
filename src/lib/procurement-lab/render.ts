import type {LabAssets} from "./assets";
import {totals,formatMoney,decimalCents,thaiDate,signerRoles,type LabDocument} from "./model";
const e=(v:string)=>v.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const paragraphs=(value:string)=>value.split("\n").filter(p=>p.trim()).map(p=>'<p class="body-text">'+e(p)+"</p>").join("");
export function procurementHtml(d:LabDocument,assets:LabAssets){
  const t=totals(d);
  const footer='<footer class="continuation"><div>ใบต่อบันทึกข้อความ เรื่อง '+e(d.subject)+'</div><div>ที่ '+e(d.number||"[ยังไม่ระบุเลข]")+" ลงวันที่ "+e(thaiDate(d.date))+' · หน้า <span class="local-page"></span></div></footer>';
  const signs='<section class="signing '+d.signingLayout+'">'+d.signers.map((s,i)=>'<div class="signer"><div class="role">'+e(signerRoles[i])+'</div>'+(i?'<p class="opinion">'+(s.opinion.trim()?e(s.opinion).replace(/\n/g,"<br>"):"................................................")+"</p>":"")+'<div class="sign-space"></div><p>('+e(s.name||"................................")+")</p><p>"+e(s.position).replace(/\n/g,"<br>")+"</p></div>").join("")+"</section>";
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
  @font-face{font-family:LabThai;src:url(${assets.regular})}@font-face{font-family:LabThai;src:url(${assets.bold});font-weight:700}
  *{box-sizing:border-box}html,body{margin:0;padding:0}body{font:16pt/1.1 LabThai,serif;color:#111;background:#eaece8}
  .page{position:relative;isolation:isolate;contain:paint;width:210mm;height:297mm;margin:0 0 4mm;background:#fff;break-after:page}.page:last-child{break-after:auto}
  .content{position:absolute;top:25mm;left:30mm;right:20mm;bottom:20mm}
  h1{font-size:29pt;text-align:center;margin:0 0 5mm;line-height:1.1}p{margin:0 0 4pt;white-space:pre-wrap;overflow-wrap:anywhere}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:4mm}.meta p{min-width:0}.body-text{text-align:justify;text-indent:25mm}
  h2{font-size:16pt;margin:4pt 0 3pt;text-indent:25mm;break-after:avoid}table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:15pt;margin:5pt 0}
  th,td{border:1px solid #777;padding:3pt;vertical-align:top;overflow-wrap:anywhere}th{text-align:center;font-weight:700}.money{text-align:right}.totals{margin-left:auto;width:85mm;font-size:16pt}.totals td{border:0;padding:1pt 0}
  .signing{display:grid;grid-template-columns:1fr 1fr;gap:3mm 5mm;margin-top:4mm;break-inside:avoid}
  .signer{text-align:center;min-width:0;break-inside:avoid}.signer p{margin:0}.role,.opinion{text-align:left}.sign-space{height:10mm}
  .staggered .signer:nth-child(1){grid-column:2;grid-row:1}.staggered .signer:nth-child(2){grid-column:1;grid-row:2}.staggered .signer:nth-child(3){grid-column:2;grid-row:2;padding-top:8mm}.staggered .signer:nth-child(4){grid-column:1;grid-row:3}
  .continuation{position:absolute;left:30mm;right:20mm;bottom:12mm;font-size:12pt;line-height:1.1;overflow-wrap:anywhere;transform:translateZ(0)}
  .page-number{position:absolute;top:14mm;left:0;right:0;text-align:center}
  #source{display:none}.layout-error{font:16px Tahoma,sans-serif;color:#a22;padding:12px;background:#fff}
  @media print{@page{size:A4;margin:0}body{background:white}.page{margin:0}}
  </style></head><body><template id="footer-template">${footer}</template><div id="source">
  <div class="memo-heading"><h1>บันทึกข้อความ</h1><p><b>ส่วนราชการ</b> ${e(d.department)} ${e(d.organization)}${d.phone?" โทร. "+e(d.phone):""}</p><div class="meta"><p><b>ที่</b> ${e(d.number)}</p><p><b>วันที่</b> ${e(thaiDate(d.date))}</p></div><p><b>เรื่อง</b> ${e(d.subject)}</p><p><b>เรียน</b> ${e(d.recipient)}</p></div>
  <h2>เรื่องเดิม / ข้อเท็จจริง</h2>${paragraphs(d.background)}
  <p>ผู้เสนอราคาที่นำมาพิจารณา: ${e(d.vendorName)}</p>
  <table class="items"><colgroup><col style="width:34%"><col style="width:10%"><col style="width:10%"><col style="width:23%"><col style="width:23%"></colgroup><thead><tr><th>รายการ</th><th>จำนวน</th><th>หน่วย</th><th>ราคาต่อหน่วยที่เสนอ</th><th>ราคาต่อหน่วยที่ตกลง</th></tr></thead><tbody>${d.lines.map(l=>"<tr><td>"+e(l.name)+"</td><td class=money>"+e(l.quantity)+"</td><td>"+e(l.unit)+"</td><td class=money>"+formatMoney(decimalCents(l.offeredPrice))+"</td><td class=money>"+formatMoney(decimalCents(l.agreedPrice))+"</td></tr>").join("")}</tbody></table>
  <table class="totals"><tbody><tr><td>รวมราคาที่เสนอ</td><td class="money">${formatMoney(t.offered)}</td></tr><tr><td>มูลค่าก่อนภาษี</td><td class="money">${formatMoney(t.base)}</td></tr><tr><td>ภาษีตามที่ระบุ ${e(d.taxRate)}%</td><td class="money">${formatMoney(t.tax)}</td></tr><tr><td><b>รวมที่ตกลง (บาท)</b></td><td class="money"><b>${formatMoney(t.gross)}</b></td></tr></tbody></table>
  <h2>ผลการพิจารณา</h2>${paragraphs(d.consideration)}<h2>ข้อพิจารณาและข้อเสนอ</h2>${paragraphs(d.proposal)}${signs}
  </div><main id="pages"></main><script>${paginationScript}</script></body></html>`;
}
const paginationScript=String.raw`
(async function(){
  function report(){parent.postMessage({source:'sarabun-procurement-lab',pages:window.__pageCount,height:document.body.scrollHeight,overflow:window.__overflow},'*');}
  addEventListener('message',e=>{if(e.source===parent&&e.data?.source==='sarabun-procurement-lab-parent'&&e.data.type==='measure'&&window.__procurementReady)report();});
  await Promise.all([document.fonts.load('16pt LabThai'),document.fonts.load('bold 16pt LabThai')]);await document.fonts.ready;
  const root=document.getElementById('pages');let content,page,overflow=false,count=0;
  function next(){
    page=document.createElement('section');page.className='page';count++;page.dataset.page=String(count);
    if(count>1){const number=document.createElement('div');number.className='page-number';number.textContent='- '+count+' -';page.append(number);const footer=document.getElementById('footer-template').content.firstElementChild.cloneNode(true);page.append(footer);}
    content=document.createElement('div');content.className='content';page.append(content);root.append(page);
    const footer=page.querySelector('.continuation');if(footer)content.style.bottom=Math.max(35,12+footer.getBoundingClientRect().height/(96/25.4)+5)+'mm';
  }
  const fits=()=>{const area=content.getBoundingClientRect();return Array.from(content.children).every(n=>n.getBoundingClientRect().bottom<=area.bottom+0.5);};
  const nodes=Array.from(document.getElementById('source').children);
  next();
  // React may attach srcDoc while its iframe has no layout box yet. Measuring
  // then would put every block on one page. Wait for a real A4 content area.
  while(content.getBoundingClientRect().width<100||content.getBoundingClientRect().height<100)await new Promise(resolve=>requestAnimationFrame(resolve));
  for(let index=0;index<nodes.length;index++){
    const node=nodes[index];content.append(node);
    if(node.tagName==='H2'){
      const probe=document.createElement('div');probe.style.height='13mm';content.append(probe);const room=fits();probe.remove();if(!room&&content.children.length>1){node.remove();next();content.append(node);}continue;
    }
    if(fits())continue;
    node.remove();
    if(node.classList.contains('signing')){
      const previous=content.lastElementChild;
      const carry=previous&&previous.classList.contains('body-text')?previous:null;
      if(carry)carry.remove();const heading=carry&&content.lastElementChild?.tagName==='H2'?content.lastElementChild:null;
      if(heading)heading.remove();if(content.children.length)next();if(heading)content.append(heading);if(carry)content.append(carry);content.append(node);if(!fits())overflow=true;continue;
    }
    if(node.tagName==='TABLE'){
      const rows=Array.from(node.querySelectorAll('tbody tr'));const head=node.querySelector('thead'),cols=node.querySelector('colgroup');
      function part(){const table=node.cloneNode(false);if(cols)table.append(cols.cloneNode(true));if(head)table.append(head.cloneNode(true));const body=document.createElement('tbody');table.append(body);content.append(table);return {table,body};}
      let current=part();for(const row of rows){current.body.append(row);if(fits())continue;row.remove();if(!current.body.children.length)current.table.remove();next();current=part();current.body.append(row);if(!fits())overflow=true;}continue;
    }
    if(node.tagName!=='P'){if(content.children.length)next();content.append(node);if(!fits())overflow=true;continue;}
    const text=node.textContent;
    const parts=Array.from(new Intl.Segmenter('th',{granularity:'word'}).segment(text),s=>s.segment);
    let offset=0;
    while(offset<parts.length){
      const p=node.cloneNode(false);content.append(p);let low=1,high=parts.length-offset,best=0;
      while(low<=high){const mid=Math.floor((low+high)/2);p.textContent=parts.slice(offset,offset+mid).join('');if(fits()){best=mid;low=mid+1;}else high=mid-1;}
      if(!best){p.remove();if(!content.children.length){p.textContent=parts[offset++];content.append(p);overflow=true;}next();continue;}
      p.textContent=parts.slice(offset,offset+best).join('');if(offset>0)p.style.textIndent='0';offset+=best;if(offset<parts.length)next();
    }
  }
  root.querySelectorAll('.local-page').forEach(n=>n.textContent=n.closest('.page').dataset.page+'/'+count);
  document.getElementById('source').remove();root.dataset.ready='true';window.__procurementReady=true;window.__pageCount=count;window.__overflow=overflow;
  report();
})().catch(function(e){console.error('Procurement pagination failed',e);window.__procurementError=true;parent.postMessage({source:'sarabun-procurement-lab',error:true},'*');});
`;
