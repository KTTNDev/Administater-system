import 'server-only';
import JSZip from 'jszip';
import {DOMParser,type Element,type Node as XmlNode} from '@xmldom/xmldom';
import {createHash} from 'node:crypto';
import {SOFT_BREAK} from './body-typography';
import {wordImportFieldsSchema,WORD_IMPORT_LIMIT,type WordImportAnalysis} from './word-import-model';

const W=new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main','http://purl.oclc.org/ooxml/wordprocessingml/main']);
const is=(n:XmlNode,name:string)=>n.nodeType===1&&W.has((n as Element).namespaceURI||'')&&(n as Element).localName===name;
const children=(n:XmlNode)=>Array.from(n.childNodes||[]);
const descendants=(n:XmlNode,name:string):Element[]=>children(n).flatMap(c=>[...(is(c,name)?[c as Element]:[]),...descendants(c,name)]);
const attr=(n:Element,key:string)=>n.getAttributeNS('http://schemas.openxmlformats.org/wordprocessingml/2006/main',key)||n.getAttributeNS('http://purl.oclc.org/ooxml/wordprocessingml/main',key)||'';
const digits=(s:string)=>s.replace(/[๐-๙]/g,c=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c)));
const clean=(s:string)=>s.replace(/[\u200b\u2060\ufeff]/g,'').replaceAll('\u00a0',' ').trim();
function parseXml(xml:string){
 if(/<!DOCTYPE|<!ENTITY/i.test(xml))throw Error('ไฟล์มีคำสั่ง XML ที่ไม่รองรับ กรุณาบันทึกเป็น Word .docx ใหม่');
 const doc=new DOMParser({onError:()=>{throw Error('XML ไม่สมบูรณ์');}}).parseFromString(xml,'application/xml');
 // Bound depth before recursive traversal; never follow relationships or external URLs.
 const stack:{node:XmlNode;depth:number}[]=[{node:doc,depth:0}];let count=0;
 while(stack.length){const {node,depth}=stack.pop()!;if(++count>150000||depth>80)throw Error('โครงสร้างเอกสารซับซ้อนเกินขอบเขตการนำเข้า');for(const child of children(node))stack.push({node:child,depth:depth+1});}
 return doc;
}
async function readXml(entry:JSZip.JSZipObject,remaining:{bytes:number}){
 let size=0;const chunks:Buffer[]=[];
 // Check inflated bytes while reading, rather than allocating an unlimited decompressed ZIP entry.
 const stream=entry.nodeStream('nodebuffer') as NodeJS.ReadableStream & {destroy:()=>void};
 await new Promise<void>((resolve,reject)=>{
  stream.on('data',(chunk:Buffer)=>{const data=Buffer.from(chunk);size+=data.length;remaining.bytes-=data.length;if(size>5*1024*1024||remaining.bytes<0){stream.destroy();reject(Error('ข้อมูลภายใน Word ใหญ่เกินขอบเขตการนำเข้า'));return;}chunks.push(data);});
  stream.on('error',reject);stream.on('end',resolve);
 });
 return Buffer.concat(chunks).toString('utf8');
}
function textOf(n:XmlNode,styled=false):string{
 if(is(n,'t')||is(n,'delText'))return n.textContent||'';
 if(is(n,'tab'))return '\t';
 if(is(n,'br')||is(n,'cr'))return SOFT_BREAK;
 if(styled&&(is(n,'del')||is(n,'txbxContent')))return ''; // These remain in sourceText and carry warnings.
 let s=children(n).map(c=>textOf(c,styled)).join('');
 if(styled&&is(n,'r')&&s.trim()){
  const props=children(n).find(c=>is(c,'rPr'));
  const bold=props&&children(props).find(c=>is(c,'b')) as Element|undefined;
  if(bold&&!['0','false','off'].includes(attr(bold,'val')))s='**'+s+'**';
 }
 return s;
}
function dateOf(value:string){
 const normalized=digits(value).replace(/พ\.?\s*ศ\.?/g,'').trim();
 const months=['มกราคม','กุมภาพันธ์','มีนาคม','เมษายน','พฤษภาคม','มิถุนายน','กรกฎาคม','สิงหาคม','กันยายน','ตุลาคม','พฤศจิกายน','ธันวาคม'];
 const short=['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
 const named=normalized.match(/(\d{1,2})\s+([^\d]+?)\s+(\d{4})/),numeric=normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
 const day=Number(named?.[1]||numeric?.[1]);const month=named?Math.max(months.indexOf(named[2].trim()),short.indexOf(named[2].trim()))+1:Number(numeric?.[2]);let year=Number(named?.[3]||numeric?.[3]);if(year>2400)year-=543;
 if(!day||!month||year<1900||year>2199)return '';
 const iso=`${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,d=new Date(iso+'T00:00:00Z');return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso?iso:'';
}
type Block={plain:string;styled:string;table:boolean};
export async function analyzeWord(bytes:Buffer,name:string):Promise<WordImportAnalysis>{
 if(!/\.docx$/i.test(name))throw Error('รองรับไฟล์ .docx สำหรับบันทึกข้อความ / หนังสือภายในเท่านั้น กรุณาแปลง .doc เป็น .docx ก่อน');
 if(!bytes.length||bytes.length>WORD_IMPORT_LIMIT)throw Error('เลือกไฟล์ Word ขนาดไม่เกิน 10 MB');
 let zip:JSZip;try{zip=await JSZip.loadAsync(bytes);}catch{throw Error('เปิดไฟล์ Word ไม่ได้ กรุณาตรวจว่าเป็น .docx ที่สมบูรณ์และไม่ได้ตั้งรหัสผ่าน');}
 const names=Object.keys(zip.files);if(names.length>600)throw Error('ไฟล์มีองค์ประกอบมากเกินขอบเขตการนำเข้า');
 if(names.some(n=>/vbaProject|activeX\//i.test(n)))throw Error('ไม่รองรับเอกสารที่มีแมโครหรือส่วนควบคุมฝังในไฟล์');
 const entry=zip.file('word/document.xml');if(!entry||!zip.file('[Content_Types].xml'))throw Error('ไม่พบเนื้อหาเอกสาร Word .docx');
 const budget={bytes:20*1024*1024};let doc:ReturnType<typeof parseXml>;
 try{doc=parseXml(await readXml(entry,budget));}catch(error){throw Error('อ่านเนื้อหา Word ไม่สำเร็จ: '+(error instanceof Error?error.message:'รูปแบบไม่รองรับ'));}
 const body=descendants(doc,'body')[0];if(!body)throw Error('ไม่พบส่วนเนื้อหาของเอกสาร Word');
 const warnings=new Set<string>(['ระบบจัดหน้าใหม่ด้วยแบบฟอร์มของระบบ กรุณาตรวจเนื้อหา ลำดับย่อหน้า และตัวอย่างก่อนพิมพ์']);
 const blocks:Block[]=[];let tableCount=0;
 const paragraph=(n:XmlNode)=>({plain:clean(textOf(n)),styled:clean(textOf(n,true)),table:false});
 function collect(n:XmlNode){for(const c of children(n)){
  if(is(c,'p'))blocks.push(paragraph(c));
  else if(is(c,'tbl')){
   tableCount++;const rows=children(c).filter(r=>is(r,'tr')).map(r=>children(r).filter(cell=>is(cell,'tc')).map(cell=>descendants(cell,'p').map(p=>paragraph(p)).filter(p=>p.plain)));
   const plain=rows.map(row=>row.map(cell=>cell.map(p=>p.plain).join(SOFT_BREAK)).join('\t')).join('\n');
   const cols=Math.max(0,...rows.map(row=>row.length));
   if(descendants(c,'tbl').length||descendants(c,'gridSpan').length||descendants(c,'vMerge').length)warnings.add('พบตารางซ้อนหรือเซลล์ผสาน: แปลงเป็นตารางธรรมดา กรุณาจัดช่องและเทียบต้นฉบับ');
   if(plain.includes('|'))warnings.add('พบเครื่องหมาย | ในตาราง เปลี่ยนเป็นเครื่องหมายเส้นตั้งเต็มความกว้างเพื่อรักษาช่องตาราง');
   const lines=rows.map(row=>'| '+Array.from({length:cols},(_,i)=>(row[i]||[]).map(p=>p.styled).join(SOFT_BREAK).replaceAll('|','｜')).join(' | ')+' |');
   if(cols&&lines.length)lines.splice(1,0,'| '+Array(cols).fill('---').join(' | ')+' |');
   blocks.push({plain,styled:lines.join('\n'),table:true});
  }else if(!is(c,'sectPr'))collect(c);
 }}collect(body);
 let sourceText=blocks.map(b=>b.plain).filter(Boolean).join('\n\n');
 const images=descendants(body,'drawing').length+descendants(body,'pict').length;
 if(images)warnings.add(`พบภาพหรือวัตถุ ${images} จุด (อาจรวมตราครุฑ/ลายเซ็น): ยังไม่นำภาพจาก Word มาวางอัตโนมัติ กรุณาแนบภาพที่ต้องการในฟอร์ม`);
 if(descendants(body,'txbxContent').length)warnings.add('พบกล่องข้อความลอย: เก็บข้อความในต้นฉบับสำหรับเทียบ แต่ยังไม่วางตำแหน่งกล่องอัตโนมัติ');
 if(descendants(body,'ins').length||descendants(body,'del').length)warnings.add('พบการติดตามการแก้ไข: ร่างใช้ข้อความที่เพิ่มและไม่ใช้ข้อความที่ลบ โปรดเทียบต้นฉบับ');
 if(descendants(body,'numPr').length)warnings.add('พบรายการลำดับอัตโนมัติของ Word: ตรวจและเติมเลขข้อในร่างก่อนใช้');
 if(descendants(body,'br').some(n=>attr(n,'type')==='page'))warnings.add('พบตัวแบ่งหน้า: ระบบจะจัดหน้าใหม่ โปรดตรวจหน้าตัวอย่าง');
 for(const name of names.filter(n=>/^word\/(header\d*|footer\d*|footnotes|endnotes|comments)\.xml$/.test(n))){
  const extra=parseXml(await readXml(zip.file(name)!,budget));const text=descendants(extra,'p').map(p=>clean(textOf(p))).filter(Boolean).join('\n');
  if(text){sourceText+='\n\n['+name+']\n'+text;warnings.add('มีหัว/ท้ายกระดาษ เชิงอรรถ หรือความคิดเห็น: แสดงไว้ท้ายข้อความต้นฉบับ กรุณาตรวจว่าต้องเพิ่มในร่างหรือไม่');}
 }
 if(sourceText.length>100000)throw Error('ข้อความในไฟล์ยาวเกินขอบเขตการนำเข้าครั้งเดียว กรุณาแยกเอกสารก่อน');
 if(!sourceText.trim())throw Error('ไม่พบข้อความที่แก้ไขได้ ไฟล์อาจเป็นภาพสแกน ต้องแปลงภาพเป็นข้อความก่อน');
 if(names.some(n=>/^word\/(embeddings|charts)\//.test(n))||descendants(body,'altChunk').length)warnings.add('พบไฟล์หรือเนื้อหาฝัง: ยังไม่แปลงส่วนนี้ กรุณาเปิด Word ต้นฉบับเพื่อตรวจ');
 const fields=wordImportFieldsSchema.parse({});let bodyStart=-1;const remaining:Block[]=[];
 // Extract labels only in the header. Tables used for letterhead are flattened for review.
 for(let i=0;i<blocks.length;i++){
  const b=blocks[i],s=b.plain;
  if(bodyStart>=0){remaining.push(b);continue;}
  if(!s||/^บันทึกข้อความ\s*$/.test(s))continue;
  if(/^(ลับ|ลับมาก|ลับที่สุด)$/.test(s)){fields.confidentiality=s as typeof fields.confidentiality;continue;}
  if(/^(ด่วน|ด่วนมาก|ด่วนที่สุด)$/.test(s)){fields.urgency=s as typeof fields.urgency;continue;}
  const label=/^(ส่วนราชการ|ที่|เรื่อง|เรียน)(?:\s|[:：])/;
  if(label.test(s)){
   const parts=s.split(/\n|\u2028/).map(clean);
   for(const part of parts){
    let m:RegExpMatchArray|null;
    if((m=part.match(/^ส่วนราชการ\s*[:：]?\s*([\s\S]*)/)))fields.organization=m[1].trim();
    else if((m=part.match(/^ที่\s*[:：]?\s*([\s\S]*)/))){const split=m[1].search(/วันที่\s*[:：]?/);fields.number=(split<0?m[1]:m[1].slice(0,split)).trim();if(split>=0){fields.date=dateOf(m[1].slice(split).replace(/^วันที่\s*[:：]?\s*/,''));if(!fields.date)warnings.add('อ่านวันที่ไม่ชัดเจน กรุณาระบุวันที่จากต้นฉบับ');}}
    else if((m=part.match(/^วันที่\s*[:：]?\s*([\s\S]*)/)))fields.date=dateOf(m[1]);
    else if((m=part.match(/^เรื่อง\s*[:：]?\s*([\s\S]*)/)))fields.subject=m[1].trim();
    else if((m=part.match(/^เรียน\s*[:：]?\s*([\s\S]*)/))){fields.recipient=m[1].trim();bodyStart=i;}
    else if(part){remaining.push({plain:part,styled:part,table:false});warnings.add('พบข้อความแทรกในส่วนหัวที่แยกช่องไม่ได้ เก็บไว้ในเนื้อหาเพื่อให้ตรวจย้าย');}
   }
   if(b.table)warnings.add('ส่วนหัวอยู่ในตาราง: กรุณาเทียบการแยกหน่วยงาน เลขที่ วันที่ และเรื่องกับต้นฉบับ');
  }else if(/^วันที่(?:\s|[:：])/.test(s)){fields.date=dateOf(s.replace(/^วันที่\s*[:：]?\s*/,''));}
  else{remaining.push(b);if(fields.recipient||fields.subject)bodyStart=i;}
 }
 if(!sourceText.includes('บันทึกข้อความ')&&!fields.organization)warnings.add('ยังยืนยันไม่ได้ว่าเป็นบันทึกข้อความ กรุณาเลือกประเภทและตรวจข้อมูลทุกช่อง');
 // A name inside parentheses near the end is a candidate, not a trusted signature.
 const nonempty=remaining.map((b,i)=>({b,i})).filter(x=>x.b.plain.trim());
 const hasOpinions=remaining.some(b=>/^(?:ความเห็น|ข้อคิดเห็น)/.test(b.plain));
 if(hasOpinions)warnings.add('พบส่วนความเห็นท้ายหนังสือ: เก็บไว้ในเนื้อหาเพื่อให้ตรวจย้ายเข้าช่องความเห็นเอง ยังไม่แยกผู้ลงนามอัตโนมัติ');
 const candidate=!hasOpinions&&nonempty.findLast((x,index)=>index>=Math.max(0,nonempty.length-8)&&!x.b.table&&/^\((?:นาย|นาง|นางสาว|ดร\.|ว่าที่|ร้อย|พัน|น\.ส\.)[^()]{1,180}\)$/.test(x.b.plain));
 if(candidate){const tail=remaining.slice(candidate.i+1).filter(b=>b.plain);if(tail.length<=3&&tail.every(b=>!b.table&&b.plain.length<250)){
  fields.signer=candidate.b.plain.slice(1,-1);fields.position=tail.map(b=>b.plain).join('\n');remaining.splice(candidate.i);
  warnings.add('แยกชื่อและตำแหน่งท้ายเอกสารเป็นข้อมูลผู้ลงนาม โปรดตรวจความถูกต้อง');
 }}
 const close=remaining.findIndex(b=>/^ขอแสดงความนับถือ\s*$/.test(b.plain));if(close>=0){fields.closing=remaining[close].plain;remaining.splice(close,1);}
 const heading=/^(?:\d+[.)]\s*)?(?:เรื่องเดิม|ต้นเรื่อง|ข้อเท็จจริง|ข้อระเบียบ\s*\/\s*กฎหมาย|ข้อกฎหมาย|ข้อระเบียบ|ข้อพิจารณา|ข้อเสนอแนะ|ข้อพิจารณาและเสนอแนะ)$/;
 const secret=[...sourceText.matchAll(/^(?:ชั้นความลับ\s*[:：]?\s*)?(ลับที่สุด|ลับมาก|ลับ)\s*$/gm)].map(m=>m[1]).sort((a,b)=>b.length-a.length)[0];if(secret&&fields.confidentiality==='ปกติ'){fields.confidentiality=secret as typeof fields.confidentiality;warnings.add('พบชั้นความลับในต้นฉบับ กรุณาตรวจค่าที่แยกได้ก่อนนำเข้า');}
 fields.body=remaining.filter(b=>b.styled).map(b=>!b.table&&heading.test(digits(b.plain))?'## '+b.plain:b.styled).join('\n');
 for(const [key,label] of [['organization','ส่วนราชการ'],['date','วันที่'],['subject','เรื่อง'],['recipient','เรียน'],['signer','ผู้ลงนาม']] as const)if(!fields[key])warnings.add('ยังแยกช่อง '+label+' ไม่ได้ กรุณาตรวจและเติมเอง');
 for(const key of ['organization','number','subject','recipient','signer','position'] as const)fields[key]=fields[key].replace(/[.．…_]{3,}\s*$/g,'').trim();
 const parsed=wordImportFieldsSchema.safeParse(fields);if(!parsed.success)throw Error('ข้อมูลที่แยกได้ยาวเกินช่องของระบบ กรุณาแยกไฟล์หรือลดเนื้อหาก่อนนำเข้า');
 return {fields:parsed.data,sourceText,warnings:[...warnings],paragraphs:descendants(body,'p').length,tables:tableCount,images,sha256:createHash('sha256').update(bytes).digest('hex')};
}
