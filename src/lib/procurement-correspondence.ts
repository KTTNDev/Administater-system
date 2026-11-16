import {DOMParser,type Element as XmlElement} from '@xmldom/xmldom';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
type Span={start:number;openEnd:number;end:number;children:Span[]};
function paragraphSpans(xml:string){
 const spans:Span[]=[],stack:Span[]=[];
 for(const tag of xml.matchAll(/<\/?w:p\b[^>]*>/g)){
  const start=tag.index!,end=start+tag[0].length;
  if(tag[0].startsWith('</')){const current=stack.pop();if(current)current.end=end;}
  else {const span:Span={start,openEnd:end,end,children:[]};stack.at(-1)?.children.push(span);spans.push(span);if(!tag[0].endsWith('/>'))stack.push(span);}
 }
 return spans;
}
function ownText(p:XmlElement){return Array.from(p.getElementsByTagNameNS(W,'t')).filter(node=>{let parent=node.parentNode;while(parent&&!(parent.nodeType===1&&(parent as XmlElement).namespaceURI===W&&(parent as XmlElement).localName==='p'))parent=parent.parentNode;return parent===p;}).map(node=>node.textContent||'').join('');}
function setProperties(block:string,properties:string,remove:string[]){
 const opening=block.match(/^<w:p\b[^>]*>/)![0],match=block.slice(opening.length).match(/^<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>|^<w:pPr\s*\/>/);
 let pPr=match?.[0]||'<w:pPr></w:pPr>';if(pPr.endsWith('/>'))pPr='<w:pPr></w:pPr>';
 for(const name of remove)pPr=pPr.replace(new RegExp('<w:'+name+'\\b[^>]*(?:/>|>[\\s\\S]*?</w:'+name+'>)','g'),'');
 const at=pPr.indexOf('<w:rPr');pPr=at<0?pPr.replace('</w:pPr>',properties+'</w:pPr>'):pPr.slice(0,at)+properties+pPr.slice(at);
 return opening+pPr+block.slice(opening.length+(match?.[0].length||0));
}
/** Local corrections to copied source XML; the source template and drawings stay intact. */
export function procurementCorrespondence(xml:string){
 const doc=new DOMParser({onError:()=>{throw Error('โครงสร้างแบบบันทึกข้อความไม่สมบูรณ์');}}).parseFromString(xml,'application/xml');
 const paragraphs=Array.from(doc.getElementsByTagNameNS(W,'p')),spans=paragraphSpans(xml),changes=new Map<number,string>();
 if(paragraphs.length!==spans.length)throw Error('ตำแหน่งย่อหน้าบันทึกข้อความไม่ตรงกัน');
 const body=doc.getElementsByTagNameNS(W,'body')[0],outer=paragraphs.flatMap((p,i)=>p.parentNode===body?[i]:[]);
 const section=doc.getElementsByTagNameNS(W,'sectPr')[0],size=section?.getElementsByTagNameNS(W,'pgSz')[0],margins=section?.getElementsByTagNameNS(W,'pgMar')[0];
 const width=Number(size?.getAttribute('w:w')||11906)-Number(margins?.getAttribute('w:left')||1701)-Number(margins?.getAttribute('w:right')||1134);
 const header=outer.find(i=>ownText(paragraphs[i]).trim().startsWith('ส่วนราชการ'));
 if(header!==undefined){
  let block=xml.slice(spans[header].start,spans[header].end);
  block=block.replace(/<w:tab\s*\/>/g,'');
  let textIndex=0;block=block.replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,(tag,a,text,b)=>{if(textIndex++!==1||/^\s/.test(text))return tag;return (a.includes('xml:space=')?a:a.replace('>',' xml:space="preserve">'))+' '+text+b;});
  block=setProperties(block,`<w:tabs><w:tab w:val="right" w:pos="${width-1}"/></w:tabs>`,['tabs']);
  // An underlined tab reaches the right text margin, even with a short value.
  block=block.replace(/<\/w:p>$/,'<w:r><w:rPr><w:rFonts w:ascii="TH SarabunIT๙" w:hAnsi="TH SarabunIT๙" w:cs="TH SarabunIT๙"/><w:sz w:val="32"/><w:szCs w:val="32"/><w:u w:val="dotted"/><w:color w:val="000000"/></w:rPr><w:tab/></w:r></w:p>');
  changes.set(header,block);
 }
 for(let n=0;n<outer.length-1;n++){
  const nameIndex=outer[n],positionIndex=outer[n+1],name=ownText(paragraphs[nameIndex]).trim(),position=ownText(paragraphs[positionIndex]).trim();
  if(!/^\([^()]{2,}\)$/.test(name)||name.includes('ลงชื่อ')||!position||/^(?:เรียน|วันที่|ที่\s|เรื่อง|[-–]|\()/.test(position))continue;
  const namePr=paragraphs[nameIndex].getElementsByTagNameNS(W,'pPr')[0],oldTab=namePr?.getElementsByTagNameNS(W,'tab')[0],oldIndent=namePr?.getElementsByTagNameNS(W,'ind')[0];
  const centered=namePr?.getElementsByTagNameNS(W,'jc')[0]?.getAttribute('w:val')==='center';
  const center=centered?(width+Number(oldIndent?.getAttribute('w:left')||0)-Number(oldIndent?.getAttribute('w:right')||0))/2:Math.min(width-2200,Math.max(2200,Number(oldTab?.getAttribute('w:pos')||width/2-900)+900));
  const left=Math.round(Math.max(0,center-2200)),right=Math.round(Math.max(0,width-center-2200));
  for(const [index,keepNext] of [[nameIndex,true],[positionIndex,false]] as const){
   const span=spans[index];let block=xml.slice(span.start,span.end);
   // Only remove tabs belonging to this paragraph, never tabs in its anchored textboxes.
   const edits=[...block.matchAll(/<w:tab\s*\/>|(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g)].filter(m=>!span.children.some(child=>span.start+m.index!>=child.start&&span.start+m.index!<child.end));
   const texts=edits.filter(m=>m[1]&&m[2].trim()),first=texts[0],last=texts.at(-1);
   for(const edit of edits.reverse()){let text=edit[2];if(edit[1]){if(!first||edit.index!<first.index!)text='';else if(edit.index!>last!.index!)text='';else{if(edit===first)text=text.trimStart();if(edit===last)text=text.trimEnd();}}const value=edit[1]?edit[1]+text+edit[3]:'';block=block.slice(0,edit.index!)+value+block.slice(edit.index!+edit[0].length);}
   block=setProperties(block,`<w:keepLines/>${keepNext?'<w:keepNext/>':''}<w:ind w:left="${left}" w:right="${right}" w:firstLine="0"/><w:jc w:val="center"/>`,['tabs','ind','jc','keepNext','keepLines']);
   changes.set(index,block);
  }
 }
 // Floating approval boxes are anchored to the final paragraph. Word does
 // not count their height in pagination: reserve it as part of that group.
 const last=outer.at(-1);
 if(last!==undefined){
  const WP='http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing';let height=0,firstAnchor=outer.length;
  for(let n=0;n<outer.length;n++)for(const anchor of Array.from(paragraphs[outer[n]].getElementsByTagNameNS(WP,'anchor'))){
    if(!anchor.getElementsByTagNameNS(W,'txbxContent').length)continue;
    const vertical=anchor.getElementsByTagNameNS(WP,'positionV')[0];if(vertical?.getAttribute('relativeFrom')!=='paragraph')continue;
    const offset=Number(vertical.getElementsByTagNameNS(WP,'posOffset')[0]?.textContent||0),extent=Number(anchor.getElementsByTagNameNS(WP,'extent')[0]?.getAttribute('cy')||0);
    firstAnchor=Math.min(firstAnchor,n);height=Math.max(height,Math.ceil((offset+extent)/635)-(outer.length-1-n)*320);
  }
  if(height>400){
   let first=firstAnchor;if(first>0&&/^\([^()]+\)$/.test(ownText(paragraphs[outer[first-1]]).trim()))first--;
   for(let n=first;n<outer.length;n++){const index=outer[n],block=changes.get(index)||xml.slice(spans[index].start,spans[index].end);changes.set(index,setProperties(block,'<w:keepNext/>',['keepNext']));}
   const block=changes.get(last)||xml.slice(spans[last].start,spans[last].end);
   const spacer='<w:p><w:pPr><w:spacing w:before="0" w:after="0" w:line="'+(height-240)+'" w:lineRule="exact"/></w:pPr><w:bookmarkStart w:id="190021" w:name="SarabunSignatureSpaceV1"/><w:bookmarkEnd w:id="190021"/></w:p>';
   changes.set(last,setProperties(block,'<w:keepNext/>',['keepNext'])+spacer);
  }
 }
 for(const [index,value] of [...changes].sort(([a],[b])=>b-a)){const span=spans[index];xml=xml.slice(0,span.start)+value+xml.slice(span.end);}
 return xml;
}
