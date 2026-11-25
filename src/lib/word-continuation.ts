import JSZip from 'jszip';
export type ContinuationInfo={subject:string;number:string;date:string;memo:boolean};
const key='SarabunContinuationV2',marker='SARABUN-CONTINUATION-V2';
const escape=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]!));
const put=(zip:JSZip,name:string,xml:string)=>zip.file(name,xml,{date:zip.file(name)?.date||new Date('2000-01-01T00:00:00Z'),createFolders:false});
export async function tagContinuation(bytes:Buffer,info:ContinuationInfo){
 const zip=await JSZip.loadAsync(bytes),settings=zip.file('word/settings.xml');if(!settings)throw Error('แม่แบบไม่มี settings สำหรับใบต่อ');
 let xml=await settings.async('string');xml=xml.replace(new RegExp('<w:docVar\\b(?=[^>]*w:name="'+key+'")[^>]*/>','g'),'');
 const item='<w:docVar w:name="'+key+'" w:val="'+Buffer.from(JSON.stringify(info)).toString('base64')+'"/>';
 xml=xml.includes('</w:docVars>')?xml.replace('</w:docVars>',item+'</w:docVars>'):xml.replace('</w:settings>','<w:docVars>'+item+'</w:docVars></w:settings>');put(zip,'word/settings.xml',xml);
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
export async function continuationInfo(bytes:Buffer){
 const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/settings.xml')?.async('string'),value=xml?.match(new RegExp('<w:docVar\\b(?=[^>]*w:name="'+key+'")[^>]*w:val="([^"]+)"'))?.[1];
 if(!value)return null;const info=JSON.parse(Buffer.from(value,'base64').toString('utf8')) as ContinuationInfo;
 if(typeof info.subject!=='string'||typeof info.number!=='string'||typeof info.date!=='string'||info.subject.length>1000||info.number.length>160||info.date.length>100)throw Error('ข้อมูลใบต่อไม่ถูกต้อง');
 return {info,ready:!!(await zip.file('word/footer1.xml')?.async('string'))?.includes(marker)};
}
export function continuationCue(text:string){
 const clean=text.replace(/[\x00-\x1f\x7f]+/g,' ').replace(/\s+/g,' ').trim();if(!clean)return 'ส่วนลงนามและความเห็น...';
 const segments=[...new Intl.Segmenter('th',{granularity:'word'}).segment(clean)].filter(s=>s.isWordLike),last=segments[Math.min(2,segments.length-1)];
 return Array.from(clean.slice(0,last?last.index+last.segment.length:24).trim()).slice(0,40).join('')+'...';
}
const props='<w:rPr><w:rFonts w:ascii="TH SarabunIT๙" w:hAnsi="TH SarabunIT๙" w:cs="TH SarabunIT๙"/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr>';
const run=(text:string)=>'<w:r>'+props+'<w:t xml:space="preserve">'+escape(text)+'</w:t></w:r>';
const instruction=(s:string)=>'<w:r>'+props+'<w:instrText xml:space="preserve">'+escape(s)+'</w:instrText></w:r>';
const begin='<w:r><w:fldChar w:fldCharType="begin" w:dirty="true"/></w:r>',end='<w:r><w:fldChar w:fldCharType="end"/></w:r>';
const field=(name:string)=>begin+instruction(name+' \\* CHARFORMAT ')+'<w:r><w:fldChar w:fldCharType="separate"/></w:r>'+run('1')+end;
const conditional=(comparison:string,text:string,size=28)=>(begin+instruction(' IF ')+field('PAGE')+instruction(' '+comparison+' "'+text.replaceAll('"','“').replace(/\d/g,c=>'๐๑๒๓๔๕๖๗๘๙'[Number(c)])+'" "" \\* CHARFORMAT ')+'<w:r><w:fldChar w:fldCharType="separate"/></w:r>'+run('')+end).replaceAll('w:val="28"','w:val="'+size+'"');
/** Only managed footers/relationships and section footer space change; source artwork stays intact. */
export async function continuationFooter(bytes:Buffer,info:ContinuationInfo,pageTexts:string[],pageNumbers=true,excludedSections:number[]=[]){
 const zip=await JSZip.loadAsync(bytes),cues=pageTexts.slice(1).map(continuationCue),label=info.memo?'ใบต่อบันทึกข้อความ':'ใบต่อเอกสาร';
 const subject=label+' เรื่อง '+(info.subject||'[เรื่อง]'),reference=info.memo?'ที่ '+(info.number||'[เลขหนังสือ]')+' ลงวันที่ '+(info.date||'[วันที่]'):[info.number&&'ที่ '+info.number,info.date&&'ลงวันที่ '+info.date].filter(Boolean).join(' ');
 const note=[subject,reference].filter(Boolean).join(' ');
 const paragraph=(content:string,cue=false)=>'<w:p><w:pPr><w:jc w:val="'+(cue?'right':'left')+'"/><w:spacing w:before="0" w:after="'+(cue?'120':'0')+'" w:line="'+(cue?'360':'300')+'" w:lineRule="exact"/></w:pPr>'+content+'</w:p>';
 const footer='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><!--'+marker+'-->'+paragraph(cues.map((cue,i)=>conditional('= '+(i+1),cue,32)).join(''),true)+paragraph(conditional('> 1',note))+'</w:ftr>';
 put(zip,'word/footer1.xml',footer);
 const headerName='header-sarabun-continuation.xml',headerId='rIdSarabunContinuationHeader';
 const dynamicPageNumber=(begin+instruction(' IF ')+field('PAGE')+instruction(' > 1 "- ')+field('PAGE')+instruction(' -" "" \\* CHARFORMAT ')+'<w:r><w:fldChar w:fldCharType="separate"/></w:r>'+run('')+end).replaceAll('w:val="28"','w:val="32"');
 const pageNumber=pageTexts.length?pageTexts.slice(1).map((_,i)=>conditional('= '+(i+2),'- '+String(i+2).replace(/\d/g,c=>'๐๑๒๓๔๕๖๗๘๙'[Number(c)])+' -',32)).join(''):dynamicPageNumber;
 if(pageNumbers)put(zip,'word/'+headerName,'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="0" w:line="360" w:lineRule="exact"/></w:pPr>'+pageNumber+'</w:p></w:hdr>');
 const blankId='rIdSarabunEmptyContinuation',blankName='footer-sarabun-empty.xml';if(excludedSections.length)put(zip,'word/'+blankName,'<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:p/></w:ftr>');
 let rels=await zip.file('word/_rels/document.xml.rels')!.async('string');
 const old=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].find(m=>/Target="footer1.xml"/.test(m[0]));let id=old?.[0].match(/\bId="([^"]+)"/)?.[1];
 if(!id){id='rIdSarabunContinuation';if(rels.includes('Id="'+id+'"'))throw Error('รหัสความสัมพันธ์ใบต่อซ้ำ');rels=rels.replace('</Relationships>','<Relationship Id="'+id+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>');put(zip,'word/_rels/document.xml.rels',rels);}
 if(excludedSections.length&&!rels.includes('Id="'+blankId+'"'))rels=rels.replace('</Relationships>','<Relationship Id="'+blankId+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="'+blankName+'"/></Relationships>');
 if(pageNumbers&&!rels.includes('Id="'+headerId+'"'))rels=rels.replace('</Relationships>','<Relationship Id="'+headerId+'" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="'+headerName+'"/></Relationships>');put(zip,'word/_rels/document.xml.rels',rels);
 let types=await zip.file('[Content_Types].xml')!.async('string');if(!types.includes('PartName="/word/footer1.xml"')){types=types.replace('</Types>','<Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>');put(zip,'[Content_Types].xml',types);}
 if(pageNumbers&&!types.includes('PartName="/word/'+headerName+'"'))types=types.replace('</Types>','<Override PartName="/word/'+headerName+'" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/></Types>');put(zip,'[Content_Types].xml',types);
 if(excludedSections.length&&!types.includes('PartName="/word/'+blankName+'"'))put(zip,'[Content_Types].xml',types.replace('</Types>','<Override PartName="/word/'+blankName+'" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>'));
 const lines=Math.max(1,Math.ceil(note.length/75)),bottom=String(300+360+120+300*lines+300);
 let sectionIndex=0,document=await zip.file('word/document.xml')!.async('string');document=document.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/g,section=>{
  const index=sectionIndex++;if(excludedSections.includes(index))return section.replace(/<w:footerReference\b[^>]*\/>/g,'').replace(/(<w:sectPr\b[^>]*>)/,'$1'+['default','first','even'].map(type=>'<w:footerReference w:type="'+type+'" r:id="'+blankId+'"/>').join(''));
  if(pageNumbers){const first=index===0;if(/<w:pgNumType\b/.test(section))section=section.replace(/<w:pgNumType\b[^>]*\/>/,tag=>tag.replace(/\s+w:start="[^"]*"/g,'').replace('/>',first?' w:start="1"/>':'/>'));else if(first)section=section.replace(/(<w:cols\b|<w:docGrid\b|<\/w:sectPr>)/,'<w:pgNumType w:start="1"/>$1');}
  section=section.replace(pageNumbers?/<w:(?:footer|header)Reference\b[^>]*\/>/g:/<w:footerReference\b[^>]*\/>/g,'');section=section.replace(/<w:pgMar\b[^>]*\/>/,tag=>tag.replace(/w:bottom="(\d+)"/,(_,n)=>'w:bottom="'+Math.max(Number(n),Number(bottom))+'"').replace(/w:footer="\d+"/,'w:footer="300"').replace(/w:header="\d+"/,'w:header="400"'));
  return section.replace(/(<w:sectPr\b[^>]*>)/,'$1'+['default','first','even'].map(type=>(pageNumbers?'<w:headerReference w:type="'+type+'" r:id="'+headerId+'"/>':'')+'<w:footerReference w:type="'+type+'" r:id="'+id+'"/>').join(''));
 });put(zip,'word/document.xml',document);const settings=zip.file('word/settings.xml');if(settings){let xml=await settings.async('string');xml=xml.replace(/<w:updateFields\b[^>]*\/>/g,'');put(zip,'word/settings.xml',xml.replace('</w:settings>','<w:updateFields w:val="true"/></w:settings>'));}return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
