import {DOMParser,type Element as XmlElement} from '@xmldom/xmldom';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',WP='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';
const elements=(p:XmlElement,name:string)=>Array.from(p.getElementsByTagNameNS(W,name));
const ownText=(p:XmlElement)=>Array.from(p.childNodes).filter(n=>n.nodeName==='w:r').map(r=>Array.from(r.childNodes).filter(n=>n.nodeName==='w:t').map(n=>n.textContent||'').join('')).join('');
/** Put the memo heading and signature blocks into measurable document flow.
 * Source image bytes and the wording of each approval are retained. */
export function procurementMemoFlow(xml:string){
 const doc=new DOMParser({onError:()=>{throw Error('โครงสร้างบันทึกข้อความไม่สมบูรณ์');}}).parseFromString(xml,'application/xml'),body=doc.getElementsByTagNameNS(W,'body')[0];
 if(!body)return xml;
 const node=(name:string,attrs:Record<string,string>={})=>{const e=doc.createElementNS(W,'w:'+name);for(const [key,value] of Object.entries(attrs))e.setAttribute('w:'+key,value);return e;};
 const outer=()=>Array.from(body.childNodes).filter(n=>n.nodeName==='w:p') as XmlElement[];
 const pr=(p:XmlElement,changes:Record<string,Record<string,string>|null>)=>{let props=Array.from(p.childNodes).find(n=>n.nodeName==='w:pPr') as XmlElement|undefined;if(!props){props=node('pPr');p.insertBefore(props,p.firstChild);}for(const [key,value]of Object.entries(changes)){for(const old of Array.from(props.childNodes).filter(n=>n.nodeName==='w:'+key))props.removeChild(old);if(value)props.appendChild(node(key,value));}};
 const paragraphs=outer(),heading=paragraphs.find(p=>ownText(p).trim()==='บันทึกข้อความ');
 if(heading){
  const art=paragraphs.find(p=>p!==heading&&p.getElementsByTagNameNS(WP,'anchor').length&&!elements(p,'txbxContent').length);
  if(art){pr(art,{pStyle:null,spacing:{before:'0',after:'0',line:'1',lineRule:'exact'},keepNext:{}});for(const anchor of Array.from(art.getElementsByTagNameNS(WP,'anchor'))){const vertical=anchor.getElementsByTagNameNS(WP,'positionV')[0];if(vertical){vertical.setAttribute('relativeFrom','page');const offset=vertical.getElementsByTagNameNS(WP,'posOffset')[0];if(offset)offset.textContent='540000';}}}
  for(const tab of elements(heading,'tab'))if(tab.parentNode?.nodeName==='w:r')tab.parentNode.removeChild(tab);
  pr(heading,{pStyle:null,tabs:null,ind:{left:'0',right:'0',firstLine:'0'},jc:{val:'center'},spacing:{before:'0',after:'0',line:'700',lineRule:'exact'},keepNext:{}});
  for(const run of Array.from(heading.childNodes).filter(n=>n.nodeName==='w:r') as XmlElement[]){let props=Array.from(run.childNodes).find(n=>n.nodeName==='w:rPr') as XmlElement|undefined;if(!props){props=node('rPr');run.insertBefore(props,run.firstChild);}for(const key of ['b','bCs','sz','szCs','position'])for(const old of Array.from(props.childNodes).filter(n=>n.nodeName==='w:'+key))props.removeChild(old);props.appendChild(node('b'));props.appendChild(node('bCs'));props.appendChild(node('sz',{val:'58'}));props.appendChild(node('szCs',{val:'58'}));props.appendChild(node('position',{val:'4'}));}
  for(const p of paragraphs.filter(p=>ownText(p).trim().startsWith('ส่วนราชการ')))pr(p,{spacing:{before:'0',after:'0',line:'400',lineRule:'exact'},keepNext:{}});
  for(const margin of Array.from(body.getElementsByTagNameNS(W,'pgMar')))margin.setAttribute('w:top','850');
 }
 const names=outer(),nameIndex=names.findIndex(p=>/^\([^()]+\)$/.test(ownText(p).trim())&&!ownText(p).includes('ลงชื่อ'));
 if(nameIndex<0)return doc.toString();
 const name=names[nameIndex],position=names[nameIndex+1];
 let start=name;
 const previous=names[nameIndex-1];if(previous&&/^\(?ลงชื่อ/.test(ownText(previous).trim()))start=previous;
 // Replace inherited blank paragraphs, keeping four actual blank lines with
 // the first signer's name/position even when Word moves them to a new page.
 let before=start.previousSibling;
 while(before?.nodeName==='w:p'&&!ownText(before as XmlElement).trim()&&!(before as XmlElement).getElementsByTagNameNS(W,'drawing').length&&!(before as XmlElement).getElementsByTagNameNS(W,'pict').length){const previous=before.previousSibling;body.removeChild(before);before=previous;}
 for(let i=0;i<4;i++){const p=node('p');pr(p,{keepNext:{},keepLines:{},spacing:{before:'0',after:'0',line:'320',lineRule:'exact'}});if(i===0){p.appendChild(node('bookmarkStart',{id:'190022',name:'SarabunSignatureGapV2'}));p.appendChild(node('bookmarkEnd',{id:'190022'}));}body.insertBefore(p,start);}
 if(start!==name)pr(start,{keepNext:{},keepLines:{},spacing:{before:'0',after:'0',line:'320',lineRule:'exact'}});
 pr(name,{keepNext:{},keepLines:{},spacing:{before:'0',after:'0',line:'320',lineRule:'exact'}});
 if(position)pr(position,{keepNext:null,keepLines:{},spacing:{before:'0',after:'0',line:'320',lineRule:'exact'}});
 const approvals:{x:number;paragraphs:XmlElement[]}[]=[];
 for(const anchor of Array.from(body.getElementsByTagNameNS(WP,'anchor'))){
  const content=anchor.getElementsByTagNameNS(W,'txbxContent')[0];if(!content)continue;
  const horizontal=anchor.getElementsByTagNameNS(WP,'positionH')[0],x=Number(horizontal?.getElementsByTagNameNS(WP,'posOffset')[0]?.textContent||0);
  approvals.push({x,paragraphs:Array.from(content.childNodes).filter(n=>n.nodeName==='w:p').map(n=>n.cloneNode(true) as XmlElement)});
  let remove=anchor.parentNode!;while(remove.parentNode&&remove.nodeName!=='mc:AlternateContent'&&remove.parentNode.nodeName!=='w:r')remove=remove.parentNode;remove.parentNode?.removeChild(remove);
 }
 if(approvals.length){
  // Borderless columns preserve the staggered route while letting the signer
  // above finish on the preceding page. No giant floating-space placeholder.
  const section=body.getElementsByTagNameNS(W,'sectPr')[0],margin=section?.getElementsByTagNameNS(W,'pgMar')[0],size=section?.getElementsByTagNameNS(W,'pgSz')[0],width=Number(size?.getAttribute('w:w')||11906)-Number(margin?.getAttribute('w:left')||1701)-Number(margin?.getAttribute('w:right')||1134),column=Math.floor(width/3);
  const table=node('tbl'),props=node('tblPr');props.appendChild(node('tblW',{w:String(width),type:'dxa'}));props.appendChild(node('tblLayout',{type:'fixed'}));const borders=node('tblBorders');for(const side of ['top','left','bottom','right','insideH','insideV'])borders.appendChild(node(side,{val:'nil'}));props.appendChild(borders);table.appendChild(props);const grid=node('tblGrid');Array.from({length:3},()=>grid.appendChild(node('gridCol',{w:String(column)})));table.appendChild(grid);
  const row=node('tr'),rowPr=node('trPr');rowPr.appendChild(node('cantSplit'));row.appendChild(rowPr);
  const slots=new Map<number,typeof approvals[number]>();approvals.sort((a,b)=>a.x-b.x).forEach((card,index)=>{let slot=approvals.length===3?index:Math.min(2,Math.max(0,Math.round(card.x/(column*635))));if(slots.has(slot))slot=[0,1,2].find(n=>!slots.has(n))!;slots.set(slot,card);});
  Array.from({length:3},(_,index)=>{const card=slots.get(index)||{x:0,paragraphs:[]},cell=node('tc'),cellPr=node('tcPr');cellPr.appendChild(node('tcW',{w:String(column),type:'dxa'}));cellPr.appendChild(node('vAlign',{val:'top'}));const margins=node('tcMar');for(const [side,value] of Object.entries({top:String(index*360),left:'50',right:'50',bottom:'0'}))margins.appendChild(node(side,{w:value,type:'dxa'}));cellPr.appendChild(margins);cell.appendChild(cellPr);
   while(card.paragraphs.length&&!card.paragraphs.at(-1)!.textContent?.trim())card.paragraphs.pop();
   card.paragraphs.forEach((p,i)=>{const text=ownText(p).trim();for(const tab of elements(p,'tab'))if(tab.parentNode?.nodeName==='w:r')tab.parentNode.removeChild(tab);pr(p,{pStyle:null,tabs:null,ind:{left:'0',right:'0',firstLine:'0'},jc:{val:/^(เรียน|[-–])/.test(text)?'left':'center'},spacing:{before:'0',after:'0',line:'320',lineRule:'exact'},keepNext:i<card.paragraphs.length-1?{}:null,keepLines:{}});cell.appendChild(p);});if(!card.paragraphs.length)cell.appendChild(node('p'));row.appendChild(cell);
  });table.appendChild(row);
  let after=(position||name).nextSibling;while(after&&after.nodeName==='w:p'&&!ownText(after as XmlElement).trim()&&!elements(after as XmlElement,'drawing').length&&!elements(after as XmlElement,'pict').length){const next=after.nextSibling;body.removeChild(after);after=next;}
  body.insertBefore(table,after);if(!after||after.nodeName==='w:sectPr')body.insertBefore(node('p'),after);
 }
 return doc.toString();
}
