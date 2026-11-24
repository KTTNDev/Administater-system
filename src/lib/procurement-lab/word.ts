import "server-only";
import JSZip from "jszip";
import type {Readable} from "node:stream";
import {DOMParser,type Node as XmlNode,type Element} from "@xmldom/xmldom";
import {Document,Packer,Paragraph,Footer,Header,SimpleField,TextRun,PageNumber} from "docx";
import {fieldDefinitions,fieldValues,thaiDate,totals,formatMoney,signerRoles,normalizedText,type LabDocument,type FieldValues} from "./model";
import {labAssets} from "./assets";

const W="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
const kids=(n:XmlNode)=>Array.from(n.childNodes||[]);
const is=(n:XmlNode,name:string)=>n.nodeType===1&&(n as Element).namespaceURI===W&&(n as Element).localName===name;
const all=(n:XmlNode,name:string):Element[]=>kids(n).flatMap(c=>[...(is(c,name)?[c as Element]:[]),...all(c,name)]);
const attr=(n:Element,key:string)=>n.getAttributeNS(W,key)||"";
function xml(s:string){
  if(/<!DOCTYPE|<!ENTITY/i.test(s))throw Error("ไม่รองรับ XML ที่มี DTD");
  const doc=new DOMParser({onError:()=>{throw Error("XML ของ Word ไม่สมบูรณ์");}}).parseFromString(s,"application/xml");
  const stack=[{node:doc as XmlNode,depth:0}];let count=0;
  while(stack.length){const {node,depth}=stack.pop()!;if(++count>150000||depth>80)throw Error("โครงสร้าง Word ซับซ้อนเกินขอบเขต");for(const c of kids(node))stack.push({node:c,depth:depth+1});}
  return doc;
}
async function readEntry(entry:JSZip.JSZipObject,budget:{size:number}){
  const parts:Buffer[]=[];let length=0;
  await new Promise<void>((resolve,reject)=>{const stream=entry.nodeStream() as Readable;stream.on("data",(chunk:Buffer)=>{length+=chunk.length;budget.size+=chunk.length;if(length>5_000_000||budget.size>20_000_000){stream.destroy();reject(Error("เนื้อหา Word ใหญ่เกินขอบเขต"));return;}parts.push(chunk);}).on("error",reject).on("end",resolve);});
  return Buffer.concat(parts).toString("utf8");
}
const text=(n:XmlNode):string=>kids(n).map(c=>is(c,"t")?c.textContent||"":is(c,"tab")?"\t":is(c,"br")?"\n":text(c)).join("");
function controlText(n:XmlNode){const ps=all(n,"p");return normalizedText(ps.length?ps.map(p=>text(p)).join("\n"):text(n));}
export type RoundtripMeta={format:"sarabun-procurement/1";documentId:string;exportId:string;baseHash:string};
export type ParsedLabWord={meta:RoundtripMeta|null;fields:FieldValues;outsideText:string[];warnings:string[];plainText:string};
export async function parseLabWord(bytes:Buffer):Promise<ParsedLabWord>{
  if(!bytes.length||bytes.length>10_000_000)throw Error("Word ต้องมีขนาดไม่เกิน 10 MB");
  const zip=await JSZip.loadAsync(bytes);const names=Object.keys(zip.files);
  if(names.length>500||names.some(n=>/vbaProject|activeX|embeddings\//i.test(n)))throw Error("ไม่รองรับ Word ที่มีแมโครหรือวัตถุฝัง");
  const entry=zip.file("word/document.xml");if(!entry)throw Error("ไม่พบเนื้อหา Word .docx");
  const budget={size:0},doc=xml(await readEntry(entry,budget)),body=all(doc,"body")[0];if(!body)throw Error("ไม่มีเนื้อหาเอกสาร");
  if(all(body,"ins").length||all(body,"del").length)throw Error("กรุณาตรวจและยอมรับหรือปฏิเสธ Track Changes ใน Word ก่อนนำกลับ");
  const fields:FieldValues={},warnings:string[]=[];
  for(const control of all(body,"sdt")){
    const tag=all(control,"tag")[0],key=tag&&attr(tag,"val").replace(/^sarabun:/,"");if(!tag||!attr(tag,"val").startsWith("sarabun:"))continue;
    if(key in fields)throw Error("Word มีรหัสช่องซ้ำ: "+key+" กรุณาตรวจช่องที่คัดลอกเพิ่ม");
    fields[key]=controlText(all(control,"sdtContent")[0]||control);
  }
  const outsideText=all(body,"p").filter(p=>{let n:XmlNode|null=p;while(n&&n!==body){if(is(n,"sdt"))return false;n=n.parentNode;}return true;}).map(p=>{
    function staticText(n:XmlNode):string{return kids(n).map(c=>is(c,"sdt")?"":is(c,"t")?c.textContent||"":staticText(c)).join("");}
    return normalizedText(staticText(p));
  }).filter(Boolean);
  if(all(body,"drawing").length||all(body,"pict").length)warnings.push("พบรูปภาพที่เพิ่มใน Word: ยังไม่รวมในร่าง เก็บไว้ในไฟล์นำกลับต้นฉบับ");
  if(all(body,"txbxContent").length)warnings.push("พบกล่องข้อความลอย: ตรวจเทียบไฟล์นำกลับต้นฉบับด้วย");
  if(all(body,"altChunk").length)throw Error("ไม่รองรับเนื้อหาฝัง altChunk");
  let meta:RoundtripMeta|null=null;
  const props=zip.file("docProps/custom.xml");if(props){const p=xml(await readEntry(props,budget));const nodes=Array.from(p.getElementsByTagNameNS("*","property"));const m=nodes.find(n=>n.getAttribute("name")==="SarabunRoundtrip");if(m){try{const v=JSON.parse(m.textContent||"");if(v.format!=="sarabun-procurement/1"||typeof v.documentId!=="string"||typeof v.exportId!=="string"||typeof v.baseHash!=="string")throw Error();meta=v;}catch{throw Error("ข้อมูลฉบับฐานใน Word ไม่ถูกต้อง");}}}
  for(const n of names.filter(n=>/^word\/(comments|footnotes|endnotes)\.xml$/.test(n))){const extra=xml(await readEntry(zip.file(n)!,budget));if(text(extra).trim())warnings.push("พบความคิดเห็นหรือเชิงอรรถเพิ่มเติม เก็บในไฟล์ต้นฉบับและตรวจเองก่อนรวม");}
  return {meta,fields,outsideText,warnings,plainText:all(body,"p").map(p=>text(p)).filter(Boolean).join("\n").slice(0,100000)};
}

export async function makeLabWord(d:LabDocument,meta:RoundtripMeta){
  const defs=new Map(fieldDefinitions(d).map(f=>[f.key,f]));let seq=1;
  const run=(v:string,bold=false)=>`<w:r><w:rPr><w:rFonts w:ascii="TH SarabunIT๙" w:hAnsi="TH SarabunIT๙" w:cs="TH SarabunIT๙"/><w:sz w:val="32"/><w:szCs w:val="32"/>${bold?"<w:b/>":""}</w:rPr><w:t xml:space="preserve">${esc(v)}</w:t></w:r>`;
  const para=(content:string,options="")=>`<w:p><w:pPr>${options.includes("<w:spacing")?"":'<w:spacing w:after="80" w:line="260" w:lineRule="auto"/>'}${options}</w:pPr>${content}</w:p>`;
  const field=(key:string,block=false)=>{
    const f=defs.get(key)!;let value=f.value;
    if(f.kind==="date")value=thaiDate(value);
    if(key==="taxMode")value={included:"รวมภาษีในราคา",excluded:"ไม่รวมภาษีในราคา",none:"ไม่มีภาษี"}[d.taxMode];
    const content=block?value.split("\n").map(v=>para(run(v),'<w:ind w:firstLine="1417"/>'+(key==="proposal"?'<w:keepNext/>':""))).join(""):value.split("\n").map(v=>run(v)).join("<w:r><w:br/></w:r>");
    const control=`<w:sdt><w:sdtPr><w:alias w:val="${esc(f.label)}"/><w:tag w:val="sarabun:${esc(key)}"/><w:id w:val="${seq++}"/></w:sdtPr><w:sdtContent>${content}</w:sdtContent></w:sdt>`;
    const bookmark=({subject:["DocSubject",10001],number:["DocNumber",10002],date:["DocDate",10003]} as Record<string,[string,number]>)[key];
    return bookmark?`<w:bookmarkStart w:id="${bookmark[1]}" w:name="${bookmark[0]}"/>${control}<w:bookmarkEnd w:id="${bookmark[1]}"/>`:control;
  };
  const center='<w:jc w:val="center"/>',keep='<w:keepNext/>',heading=(v:string)=>para(run(v,true),keep);
  const cell=(content:string,width:number)=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="top"/></w:tcPr>${content}</w:tc>`;
  const widths=[3050,850,850,2150,2150];
  const border='<w:tblBorders>'+["top","left","bottom","right","insideH","insideV"].map(n=>`<w:${n} w:val="single" w:sz="4" w:color="888888"/>`).join("")+"</w:tblBorders>";
  const table=(rows:string[],borders=true)=>`<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/><w:tblLayout w:type="fixed"/>${borders?border:""}</w:tblPr><w:tblGrid>${widths.map(w=>`<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows.join("")}</w:tbl>`;
  const header='<w:tr><w:trPr><w:tblHeader/></w:trPr>'+["รายการ","จำนวน","หน่วย","ราคาต่อหน่วยที่เสนอ","ราคาต่อหน่วยที่ตกลง"].map((v,i)=>cell(para(run(v,true),center),widths[i])).join("")+"</w:tr>";
  const rows=d.lines.map(l=>'<w:tr><w:trPr><w:cantSplit/></w:trPr>'+["name","quantity","unit","offeredPrice","agreedPrice"].map((k,i)=>cell(para(field("line."+l.id+"."+k)),widths[i])).join("")+"</w:tr>");
  const t=totals(d);
  const totalsXml=["รวมราคาที่เสนอ: "+formatMoney(t.offered),"มูลค่าก่อนภาษี: "+formatMoney(t.base),"ภาษี: "+formatMoney(t.tax),"รวมที่ตกลง (บาท): "+formatMoney(t.gross)].map(v=>para(run(v),'<w:jc w:val="right"/>')).join("");
  function signer(i:number){return para(run(signerRoles[i]),keep)+para(field(`signer.${i}.opinion`),keep)+para(run(""),keep+'<w:spacing w:before="420"/>')+para(run("(")+field(`signer.${i}.name`)+run(")"),center+keep)+para(field(`signer.${i}.position`),center+(i<3?keep:""));}
  const blank=para(run(""),keep);
  const signRow=(a:number|null,b:number|null)=>'<w:tr><w:trPr><w:cantSplit/></w:trPr>'+cell(a===null?blank:signer(a),4525)+cell(b===null?blank:signer(b),4525)+"</w:tr>";
  const signs=table(d.signingLayout==="columns"?[signRow(0,1),signRow(2,3)]:[signRow(null,0),signRow(1,2),signRow(3,null)],false);
  const assets=labAssets(),decode=(v:string)=>Buffer.from(v.split(",")[1],"base64");
  const document=new Document({fonts:[{name:"TH SarabunIT๙",data:decode(assets.regular),bold:decode(assets.bold)}],compatibility:{version:15,applyBreakingRules:true},creator:"Sarabun procurement lab",features:{updateFields:true},customProperties:[{name:"SarabunRoundtrip",value:JSON.stringify(meta)},{name:"DocSubject",value:d.subject},{name:"DocNumber",value:d.number},{name:"DocDate",value:thaiDate(d.date)}],styles:{default:{document:{run:{font:"TH SarabunIT๙",size:32,sizeComplexScript:32,language:{value:"th-TH",eastAsia:"th-TH",bidirectional:"th-TH"}},paragraph:{spacing:{after:80,line:260}}}},paragraphStyles:[{id:"LabFooter",name:"Lab Footer",run:{font:"TH SarabunIT๙",size:24,sizeComplexScript:24},paragraph:{spacing:{after:0,line:240}}}]},sections:[{
    properties:{titlePage:true,page:{size:{width:11906,height:16838},margin:{top:1417,bottom:1984,left:1701,right:1134,footer:680}}},
    headers:{first:new Header({children:[new Paragraph("")]}),default:new Header({children:[new Paragraph({alignment:"center",children:[new TextRun({children:["- ",PageNumber.CURRENT," -"]})]})]})},
    footers:{first:new Footer({children:[new Paragraph("")]}),default:new Footer({children:[new Paragraph({style:"LabFooter",children:[new TextRun("ใบต่อบันทึกข้อความ เรื่อง "),new SimpleField("REF DocSubject",d.subject)]}),new Paragraph({style:"LabFooter",children:[new TextRun("ที่ "),new SimpleField("REF DocNumber",d.number),new TextRun(" ลงวันที่ "),new SimpleField("REF DocDate",thaiDate(d.date))]})]})},children:[new Paragraph("")],
  }]});
  const zip=await JSZip.loadAsync(await Packer.toBuffer(document));const main=await zip.file("word/document.xml")!.async("string");const section=main.match(/<w:sectPr[\s\S]*?<\/w:sectPr>/)?.[0];if(!section)throw Error("สร้างหน้ากระดาษ Word ไม่สำเร็จ");
  const body=para(run("บันทึกข้อความ",true).replaceAll('w:val="32"','w:val="58"'),center)+para(run("ส่วนราชการ ",true)+field("department")+run(" ")+field("organization")+run(" โทร. ")+field("phone"))+para(run("ที่ ",true)+field("number")+run("     วันที่ ",true)+field("date"))+para(run("เรื่อง ",true)+field("subject"))+para(run("เรียน ",true)+field("recipient"))+heading("เรื่องเดิม / ข้อเท็จจริง")+field("background",true)+para(run("ผู้เสนอราคา: ")+field("vendorName"))+table([header,...rows])+para(run("รูปแบบภาษี: ")+field("taxMode")+run(" อัตราที่ระบุ ")+field("taxRate")+run("%"))+totalsXml+heading("ผลการพิจารณา")+field("consideration",true)+heading("ข้อพิจารณาและข้อเสนอ")+field("proposal",true)+signs;
  zip.file("word/document.xml",main.replace(/<w:body>[\s\S]*<\/w:body>/,"<w:body>"+body+section+"</w:body>"));
  const bytes=await zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"});const parsed=await parseLabWord(bytes);
  if(Object.keys(parsed.fields).length!==Object.keys(fieldValues(d)).length)throw Error("ตรวจช่องข้อมูลใน Word ไม่ครบ");
  return {bytes,outsideText:parsed.outsideText};
}
