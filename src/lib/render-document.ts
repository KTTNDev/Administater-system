import { type Draft, thaiDate, documentYear, numerals, bodySections } from "./document";
import { template } from "./templates";
export type DocumentAssets = { regular: string; bold: string; garuda: string };
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export function documentHtml(d: Draft, assets: DocumentAssets): string {
  const e=(s:string)=>escapeHtml(numerals(s,d.numeralStyle)), t=template(d.type), date=thaiDate(d.date), blocks:string[]=[];
  const p=(content:string,cls="") => blocks.push(`<p class="${cls}">${content || "&nbsp;"}</p>`);
  const field=(label:string,value:string,cls="") => p(`<span class="label">${e(label)}</span> ${cls==="memo-field"?`<span class="memo-value">${e(value)||'&nbsp;'}</span>`:e(value)}`,cls);
  const body=() => d.contentBlocks.length?d.contentBlocks.forEach(b=>{
    if(b.kind==='line')p(`<span class="budget-label">${e(b.label)}</span><span>${e(b.text)}</span>`,"budget-line");
    else if(b.kind==='budget-money')p(`<span>${e(b.label)}</span><span>เป็นเงิน</span><span>${e(b.text)}</span><span>บาท</span>`,"budget-money");
    else p(e(b.text),b.kind==='heading'?"title budget-heading":b.kind==='budget-detail'?"budget-detail":b.kind==='budget-spec'?"budget-spec":"body-text");
  }):bodySections(d).filter(s=>s.text.trim()).forEach(s=>{if(s.title&&d.sectionHeadings)p(e(s.title),"title");s.text.split(/\n/).forEach(line=>p(e(line),"body-text"));});
  const signature=() => blocks.push(`<div class="signature"><div class="sign-space"></div><p>(${e(d.signer)})</p><p>${e(d.position)}</p></div>`);
  const contact=() => { if(d.department) p(e(d.department),"contact"); if(d.phone) field("โทร.",d.phone); if(d.email) p(`<span class="label">ไปรษณีย์อิเล็กทรอนิกส์</span> ${escapeHtml(d.email)}`); };
  const emblem = `<img class="garuda" src="${assets.garuda}" alt="ตราครุฑ" />`;
  switch(d.type) {
    case "external":
      blocks.push(`<div class="letter-head">${emblem}<div class="letter-number">ที่ ${e(d.number)}</div><div class="letter-agency">${e(d.organization)}<br>${e(d.address)}</div></div>`);
      p(e(date),"date"); field("เรื่อง",d.subject); field(d.salutation,d.recipient);
      if(d.reference) field("อ้างถึง",d.reference); if(d.attachmentFiles.length) field("สิ่งที่ส่งมาด้วย",d.attachmentFiles.map((a,i)=>`${i+1}. ${a.description} จำนวน ${a.quantity} ${a.unit}`).join("\n"));
      body(); p(e(d.closing),"closing"); signature(); contact(); if(d.copies) field("สำเนาส่ง",d.copies); break;
    case "internal": case "memorandum":
      blocks.push(`<div class="memo-head">${d.type==="internal"?emblem:""}<strong>บันทึกข้อความ</strong></div>`);
      field("ส่วนราชการ",[...(d.layout==='budget-reference'?[d.department,d.organization]:[d.organization,d.department]),d.phone?"โทร. "+d.phone:""].filter(Boolean).join("  "),"memo-field");
      blocks.push(`<div class="memo-row"><p class="memo-field"><b>ที่</b><span class="memo-value">${e(d.number)||'&nbsp;'}</span></p><p class="memo-field"><b>วันที่</b><span class="memo-value">${e(date)}</span></p></div>`);
      field("เรื่อง",d.subject,"memo-field"); field(d.salutation,d.recipient); body(); if(d.attachmentFiles.length)p(e(d.attachmentPhrase+" ได้แก่ "+d.attachmentFiles.map((a,i)=>`${i+1}. ${a.description} จำนวน ${a.quantity} ${a.unit}`).join("; ")),"body-text"); signature(); break;
    case "stamped":
      blocks.push(`<div class="letter-head">${emblem}<div class="letter-number">ที่ ${e(d.number)}</div></div>`);
      field("ถึง",d.recipient); body(); p(e(d.organization),"closing"); p(e(date),"closing");
      p("[พื้นที่ประทับตราส่วนราชการ และลงชื่อย่อกำกับตรา]","stamp-placeholder"); contact(); break;
    case "order": case "regulation": case "rule": case "announcement": case "statement": case "news":
      if(t.mark) blocks.push(`<div class="center-emblem">${emblem}</div>`);
      p(`${e(t.name)}${e(d.organization)}`,"center title");
      if(d.type==="order") p(`ที่ ${e(d.number)}`,"center");
      p(`เรื่อง ${e(d.subject)}`,"center title");
      if(d.type==="regulation" || d.type==="rule") p(`พ.ศ. ${e(String(documentYear(d.date,"calendar")))}`,"center");
      if(d.type==="statement" && d.number) p(`ฉบับที่ ${e(d.number)}`,"center");
      p("____________________","center divider"); body();
      if(d.effectiveDate) p(e(d.effectiveDate),"body-text");
      if(d.type==="news" || d.type==="statement") { p(e(d.organization),"closing"); p(e(date),"closing"); }
      else { p(`${d.type==="order"?"สั่ง": "ประกาศ"} ณ วันที่ ${e(date)}`,"issued"); signature(); } break;
    case "certificate":
      blocks.push(`<div class="letter-head">${emblem}<div class="letter-number">ที่ ${e(d.number)}</div><div class="letter-agency">${e(d.organization)}<br>${e(d.address)}</div></div>`);
      body(); p(`ให้ไว้ ณ วันที่ ${e(date)}`,"issued"); signature(); break;
    case "minutes":
      p(`รายงานการประชุม${e(d.subject)}`,"center title"); p(`ครั้งที่ ${e(d.meetingNo)}`,"center"); p(`เมื่อ ${e(date)}`,"center"); p(`ณ ${e(d.location)}`,"center"); p("____________________","center divider");
      field("ผู้มาประชุม",d.attendees); field("ผู้ไม่มาประชุม",d.absentees||"ไม่มี"); field("ผู้เข้าร่วมประชุม",d.participants||"ไม่มี");
      field("เริ่มประชุมเวลา",d.startTime); body(); field("เลิกประชุมเวลา",d.endTime); p(`${e(d.recorder)}\nผู้จดรายงานการประชุม`,"closing"); break;
    case "other": p(e(d.subject),"center title"); p(e(d.organization),"center"); p(e(date),"center"); body(); break;
  }
  if(["internal","memorandum"].includes(d.type)) {
    for(const person of d.proposers) blocks.push(`<div class="signature"><div class="sign-space"></div><p>(${e(person.name)})</p><p>${e(person.position)}</p></div>`);
    for(const opinion of d.opinions) blocks.push(`<div class="opinion"><p class="title">${e(opinion.title)}</p>${opinion.comment?`<p>${e(opinion.comment)}</p>`:Array.from({length:opinion.lines},()=>'<div class="opinion-line"></div>').join('')}<div class="opinion-sign"><p>ลงชื่อ ................................................</p><p>(${e(opinion.name)||'................................................'})</p><p>${e(opinion.position)}</p><p>วันที่ ................................................</p></div></div>`);
  }
  if(d.productionMark) blocks.push(`<div class="production"><p>........................ ${e(d.drafter)} / ร่าง</p><p>........................ ${e(d.typist)} / พิมพ์</p><p>........................ ${e(d.checker)} / ตรวจ</p></div>`);
  const compact=d.type==="internal"||d.type==="memorandum";
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(d.subject)}</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
  <style>
  @font-face{font-family:DocumentThai;src:url('${assets.regular}') format('truetype');font-weight:400;font-display:block}
  @font-face{font-family:DocumentThai;src:url('${assets.bold}') format('truetype');font-weight:700;font-display:block}
  *{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#e8edec;color:#111;font-family:DocumentThai,serif;font-size:16pt;line-height:1.15}
  .page{position:relative;width:210mm;height:297mm;background:white;margin:0 auto 7mm;padding:25mm 20mm 20mm 30mm;break-after:page;overflow:hidden}
  .page:first-child{padding-top:${d.copyMark!=="none"?28:15}mm}.page:last-child{margin-bottom:0;break-after:auto}
  .content{height:240mm;display:flow-root}.page:first-child .content{height:${d.copyMark!=="none"?237:250}mm}
  p{margin:0 0 6pt;white-space:pre-wrap;overflow-wrap:anywhere;orphans:2;widows:2}.body-text{text-indent:25mm;text-align:justify;white-space:pre-wrap}
  .garuda{height:30mm;width:auto;object-fit:contain}.letter-head{position:relative;min-height:38mm;padding-top:23mm;margin-bottom:6pt;display:flex;justify-content:space-between;gap:8mm}
  .letter-head .garuda{position:absolute;top:0;left:calc(50% - 5mm);transform:translateX(-50%)}.letter-number{max-width:50%}.letter-agency{width:65mm;padding-left:10mm;white-space:pre-wrap;overflow-wrap:anywhere}
  .date{margin-left:75mm}.memo-head{position:relative;height:${d.urgency!=="ปกติ"?27:18}mm;display:flex;align-items:flex-end;justify-content:center;margin-bottom:3pt}
  .memo-head strong{font-size:29pt;line-height:1.2}.memo-head .garuda{position:absolute;height:15mm;left:0;top:0}
  .memo-field{display:flex;align-items:baseline;gap:2mm}.memo-value{flex:1;min-width:0;position:relative;white-space:pre-wrap;overflow-wrap:anywhere}.memo-value:after{content:"";position:absolute;left:0;right:0;bottom:2pt;${d.memoGuides?"border-bottom:1px dotted #888":""};pointer-events:none}.memo-field .label,.memo-field b{font-size:20pt;font-weight:700;white-space:nowrap}.memo-row{display:flex;gap:5mm}.memo-row p:first-child{width:49%}.memo-row p:last-child{flex:1}
  .closing,.signature{margin-left:70mm;text-align:center;white-space:pre-wrap}.closing{margin-top:12pt}.signature{break-inside:avoid}.sign-space{height:20mm}.signature p{margin:0;white-space:pre-wrap}.contact{margin-top:16mm}
  .budget-line{display:flex;gap:4mm;text-indent:0}.budget-label{flex:0 0 53mm;font-weight:bold}.budget-line>span:last-child{flex:1;min-width:0}.center{text-align:center}.title{font-weight:700}.center-emblem{text-align:center;margin-left:-10mm;margin-bottom:8pt}.issued{text-indent:25mm;margin-top:12pt}.divider{margin-bottom:12pt}
  .urgency{font-weight:bold;font-size:32pt;color:#f00;position:absolute;left:${compact?52:30}mm;top:${d.copyMark!=="none"?29:16}mm;line-height:1}.copy-mark{position:absolute;left:0;right:0;top:12mm;text-align:center;font-size:24pt;font-weight:bold}.opinion{margin-top:8mm;break-inside:avoid}.opinion-line{height:8mm;border-bottom:1px dotted #555}.opinion-sign{margin-top:8mm;text-align:center;margin-left:70mm}.opinion-sign p{margin-bottom:0}.production{margin:12mm 0 0 auto;width:85mm;break-inside:avoid}.production p{margin-bottom:2mm}.stamp-placeholder{margin:8mm 0 0 70mm;text-align:center;color:#777;font-size:14pt}
  .continuation-cue{position:absolute;right:20mm;bottom:20mm;max-width:90mm;text-align:right;white-space:nowrap;font-size:16pt;line-height:1.15}.page-number{position:absolute;top:14mm;left:0;right:0;text-align:center}.security{position:absolute;top:1mm;left:0;right:0;text-align:center;color:#f00;font-weight:700;font-size:32pt;line-height:1}.security.bottom{top:auto;bottom:2mm}
  .budget-document{line-height:18.1pt}.budget-document p{margin-bottom:0}.budget-document .body-text{text-indent:25.4mm}
  .budget-document .memo-field{margin-bottom:6pt}.budget-document .memo-row .memo-field{margin-bottom:6pt}.budget-document .memo-head{margin-bottom:6pt}
  .budget-document .budget-heading{margin-top:6pt;text-indent:25.4mm}.budget-document .budget-line{margin-left:25.4mm;gap:0;line-height:18.1pt}.budget-document .budget-label{flex-basis:25.4mm;font-weight:400}
  .budget-money{display:grid;grid-template-columns:50.8mm 15mm minmax(0,1fr) 8mm;column-gap:2mm;margin-left:50.8mm;text-indent:0}.budget-money>span:nth-child(3){text-align:right}
  .budget-detail{margin-left:50.8mm;text-indent:0}.budget-spec{margin-left:55mm;text-indent:0}
  .budget-document .opinion{margin-top:5mm}.budget-document .opinion-line{height:6mm}.budget-document .opinion-sign{margin-top:10mm}.budget-document .opinion-sign p:first-child,.budget-document .opinion-sign p:last-child{display:none}
  #source{display:none}@media print{@page{size:A4;margin:0}body{background:white}.page{margin:0;box-shadow:none}}
  .security-control{position:absolute;bottom:13mm;left:30mm;right:20mm;font-size:12pt;line-height:1;display:flex;justify-content:space-between;gap:5mm}.security-control span:first-child{max-width:100mm;overflow-wrap:anywhere}
  </style></head><body class="${d.layout==='budget-reference'?'budget-document':''}"><div id="security-owner" hidden>${e(d.organization)}</div><div id="source">${blocks.join("")}</div><main id="pages"></main>
  <script>
  window.addEventListener('message',event=>{if(event.source===parent&&event.data==='sarabun-print')window.print()});
  (async()=>{ await Promise.all([document.fonts.load('16pt DocumentThai'),document.fonts.load('bold 16pt DocumentThai')]); await document.fonts.ready; await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})));
  const root=document.getElementById('pages');let content;let count=0;let overflow=false;
  const next=()=>{count++;const page=document.createElement('section');page.className='page';if(count>1){const n=document.createElement('div');n.className='page-number';n.textContent='- '+count+' -';page.append(n)}
  ${d.confidentiality!=="ปกติ"?`for(const cls of ['security','security bottom']){const s=document.createElement('div');s.className=cls;s.textContent=${JSON.stringify(d.confidentiality)};page.append(s)}`:""}
  ${d.urgency!=="ปกติ"?`if(count===1){const s=document.createElement('div');s.className='urgency';s.textContent=${JSON.stringify(d.urgency)};page.append(s)}`:""}
  ${d.copyMark!=="none"?`if(count===1){const s=document.createElement('div');s.className='copy-mark';s.textContent=${JSON.stringify(d.copyMark)};page.append(s)}`:""}
  if(${JSON.stringify(d.numeralStyle)}==='thai'){const n=page.querySelector('.page-number');if(n)n.textContent=n.textContent.replace(/[0-9]/g,c=>'๐๑๒๓๔๕๖๗๘๙'[Number(c)])}
  content=document.createElement('div');content.className='content';page.append(content);root.append(page)};
  const fits=()=>content.scrollHeight<=content.clientHeight+1;
  next(); const nodes=Array.from(document.getElementById('source').children);
  for(let node of nodes){content.append(node);if(fits())continue;node.remove();if(!node.classList.contains('body-text')){if(content.children.length)next();content.append(node);if(fits())continue;node.remove();}
    if(node.tagName!=='P'){content.append(node);overflow=true;continue}
    const words=Array.from(new Intl.Segmenter('th',{granularity:'word'}).segment(node.textContent),s=>s.segment);node.remove();let offset=0;
    while(offset<words.length){const part=node.cloneNode(false);content.append(part);let low=1,high=words.length-offset,best=0;
      while(low<=high){const mid=Math.floor((low+high)/2);part.textContent=words.slice(offset,offset+mid).join('');if(fits()){best=mid;low=mid+1}else high=mid-1}
      if(best===0){part.remove();if(!content.children.length){overflow=true;part.textContent=words[offset];content.append(part);offset++}next();continue}
      part.textContent=words.slice(offset,offset+best).join('');if(offset>0)part.style.textIndent='0';offset+=best;if(offset<words.length)next();
    }
  }
  ${d.confidentiality!=="ปกติ"?`Array.from(root.children).forEach((page,index)=>{const c=document.createElement('div');c.className='security-control';const owner=document.createElement('span');owner.textContent=document.getElementById('security-owner').textContent;const info=document.createElement('span');info.textContent='ชุดที่ ${d.secretSetNumber}/${d.secretSetTotal} · หน้า '+(index+1)+'/'+count;if(${JSON.stringify(d.numeralStyle)}==='thai')info.textContent=info.textContent.replace(/[0-9]/g,c=>'๐๑๒๓๔๕๖๗๘๙'[Number(c)]);c.append(owner,info);page.append(c);if(c.getBoundingClientRect().top<page.querySelector('.content').getBoundingClientRect().bottom)overflow=true})`:""}
  document.getElementById('security-owner').remove();
  const pageList=Array.from(root.children);
  for(let i=0;i<pageList.length-1;i++){
    const following=pageList[i+1].querySelector('.content');
    const first=Array.from(following.querySelectorAll('p,b,strong')).find(n=>n.textContent.trim());
    const text=(first?first.textContent:following.textContent).trim();
    const segments=Array.from(new Intl.Segmenter('th',{granularity:'word'}).segment(text)).filter(s=>s.isWordLike);
    if(text){const end=segments[Math.min(2,segments.length-1)];const cue=document.createElement('div');cue.className='continuation-cue';cue.textContent=text.slice(0,end?end.index+end.segment.length:24).trim()+'...';pageList[i].append(cue);
    while(cue.scrollWidth>cue.clientWidth+1&&cue.textContent.length>4){const chars=Array.from(cue.textContent.slice(0,-3));chars.pop();cue.textContent=chars.join('')+'...';}}
  }
  const production=root.querySelector('.production');if(production){const parentBox=production.parentElement.getBoundingClientRect(),box=production.getBoundingClientRect();const gap=parentBox.bottom-box.bottom;if(gap>0)production.style.marginTop=(parseFloat(getComputedStyle(production).marginTop)+gap)+'px'}
  document.getElementById('source').remove();window.__paginationDone=true;window.__pageCount=count;window.__overflow=overflow;
  parent.postMessage({source:'sarabun-preview',pages:count,height:document.body.scrollHeight,overflow},'*');
  })().catch(()=>{window.__paginationError=true;parent.postMessage({source:'sarabun-preview',error:true},'*')});
  </script></body></html>`;
}
