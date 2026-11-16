import "server-only";
import {createHash} from "node:crypto";
import JSZip from "jszip";
import {DOMParser} from "@xmldom/xmldom";
import {z} from "zod";
import {templateSlots,templateOutputVersion,type TemplateValues} from "./procurement-lab/template-model";
import {tagContinuation} from './procurement-pagination';
export const D07_REFERENCE_SHA256="3b6d0541a216951bf48f0e51f8c227aa34ab947f8ab6646083bd4fc818a7ef31";
export const TEMPLATE_OUTPUT_VERSION=templateOutputVersion;
export const blackReminderText=(xml:string)=>xml.replace(/<w:color\b[^>]*\bw:val="(?:FF0000|ff0000|red)"[^>]*\/>/g,tag=>tag.replace(/w:val="[^"]*"/,'w:val="000000"').replace(/\s+w:theme(?:Color|Tint|Shade)="[^"]*"/g,"")).replace(/<w:highlight\b[^>]*\bw:val="yellow"[^>]*\/>/g,'');
const W="http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const unescapeXml=(s:string)=>s.replace(/&#(x[0-9a-f]+|\d+);|&(amp|lt|gt|quot|apos);/gi,(_,n,k)=>n?String.fromCodePoint(n.startsWith("x")?parseInt(n.slice(1),16):Number(n)):({amp:"&",lt:"<",gt:">",quot:'"',apos:"'"} as Record<string,string>)[k]);
const escapeXml=(s:string)=>s.replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[c]!));
export async function inspect(bytes:Buffer){
  const zip=await JSZip.loadAsync(bytes),xml=await zip.file("word/document.xml")!.async("string");
  const doc=new DOMParser({onError:()=>{throw Error("XML แม่แบบไม่สมบูรณ์");}}).parseFromString(xml,"application/xml");
  const paragraphs=Array.from(doc.getElementsByTagNameNS(W,"p")),texts=Array.from(doc.getElementsByTagNameNS(W,"t"));
  const matches=[...xml.matchAll(/<w:t\b[^>]*>([\s\S]*?)<\/w:t>/g)];
  if(matches.length!==texts.length)throw Error("โครงสร้างช่องข้อความแม่แบบเปลี่ยนไป");
  function locations(p:number,indexes?:number[]){const nodes=Array.from(paragraphs[p]?.getElementsByTagNameNS(W,"t")||[]);const selected=indexes?indexes.map(i=>nodes[i]):nodes;if(!selected.length||selected.some(n=>!n))throw Error("ไม่พบช่องที่ตรวจไว้ในแม่แบบ");return selected.map(n=>{const index=texts.indexOf(n);if(index<0||unescapeXml(matches[index][1])!==(n.textContent||""))throw Error("ตำแหน่ง XML ไม่ตรงแม่แบบ");return index;});}
  function value(p:number,indexes?:number[]){return locations(p,indexes).map(i=>texts[i].textContent||"").join("");}
  function ownNodes(index:number){const paragraph=paragraphs[index];return Array.from(paragraph?.getElementsByTagNameNS(W,'t')||[]).flatMap((node,i)=>{let parent=node.parentNode;while(parent&&!(parent.nodeType===1&&(parent as unknown as {namespaceURI:string;localName:string}).namespaceURI===W&&(parent as unknown as {localName:string}).localName==='p'))parent=parent.parentNode;return parent===paragraph?[i]:[];});}
  return {zip,xml,matches,locations,value,ownNodes,paragraphCount:paragraphs.length,leafParagraphs:paragraphs.map((_,index)=>index).filter(index=>ownNodes(index).length)};
}
export async function wordContentHash(bytes:Buffer){const zip=await JSZip.loadAsync(bytes),hash=createHash('sha256');for(const name of Object.keys(zip.files).sort())if(!zip.files[name].dir){hash.update(name+'\0');hash.update(await zip.file(name)!.async('nodebuffer'));}return hash.digest('hex');}
export async function replaceTemplateText(reference:Buffer,changes:{p:number;nodes?:number[];text:string}[]){
 const i=await inspect(reference),replacements=new Map<number,string>();
 for(const change of changes){const locations=i.locations(change.p,change.nodes),old=locations.map(n=>unescapeXml(i.matches[n][1]));if(old.join('')===change.text)continue;let offset=0;const chars=Array.from(change.text);locations.forEach((n,j)=>{const length=j===locations.length-1?chars.length-offset:Array.from(old[j]).length;replacements.set(n,chars.slice(offset,offset+length).join(''));offset+=length;});}
 let xml=i.xml;for(const [index,value] of [...replacements].sort(([a],[b])=>b-a)){const m=i.matches[index],start=m.index!+m[0].indexOf('>')+1;xml=xml.slice(0,start)+escapeXml(value)+xml.slice(start+m[1].length);}
 i.zip.file('word/document.xml',blackReminderText(xml),{date:i.zip.file('word/document.xml')!.date,createFolders:false});
 const bytes=await i.zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),out=await JSZip.loadAsync(bytes);let preservedParts=0;
 for(const name of Object.keys(i.zip.files))if(name!=='word/document.xml'&&!i.zip.files[name].dir){if(!Buffer.from(await out.file(name)!.async('nodebuffer')).equals(await i.zip.file(name)!.async('nodebuffer')))throw Error('ส่วนที่ต้องคงไว้เปลี่ยนไป: '+name);preservedParts++;}
 return {bytes,preservedParts};
}
export async function linkContinuationFooter(bytes:Buffer,values:TemplateValues,memo=true){
 const info={subject:values.subject||'[เรื่อง]',number:values.number||(memo?'[เลขหนังสือ]':''),date:!memo&&!values.day&&!values.month&&!values.year?'':`${values.day||'…'} ${values.month||'…'} ${values.year||'…'}`,memo};
 const zip=await JSZip.loadAsync(bytes),footer=zip.file('word/footer1.xml');if(!footer)return tagContinuation(bytes,info);
 const text=`ใบต่อบันทึกข้อความ เรื่อง ${values.subject||'[เรื่อง]'} ที่ ${values.number||'[เลขหนังสือ]'} ลงวันที่ ${values.day||'…'} ${values.month||'…'} ${values.year||'…'}`;let first=true;
 zip.file(footer.name,(await footer.async('string')).replace(/(<w:t\b[^>]*>)[\s\S]*?(<\/w:t>)/g,(_,a,b)=>{const value=first?escapeXml(text):'';first=false;return a+value+b;}),{date:footer.date,createFolders:false});
 return tagContinuation(await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),info);
}
export async function templateInitial(reference:Buffer){
  const i=await inspect(reference),values:TemplateValues={};
  for(const f of templateSlots){const v=f.targets.map(t=>{const s=i.value(t.p,t.nodes);return t.parentheses?s.replace(/^\(/,"").replace(/\)$/,""):t.prefix&&s.startsWith(t.prefix)?s.slice(t.prefix.length):s;});if(v.some(x=>x!==v[0]))throw Error("ช่องคู่สำรองของแม่แบบไม่ตรงกัน: "+f.key);values[f.key]=v[0];}
  return {values,sourceHash:D07_REFERENCE_SHA256,sourceName:"7.รายงานพิจารณาผล.docx",referencePages:1};
}
const clean=(max:number)=>z.string().min(1).max(max).regex(/^[^\x00-\x1f\x7f]*$/,"แก้ข้อความในย่อหน้าเดิมได้ ยังไม่เพิ่มบรรทัดหรือย่อหน้าใหม่");
export function validateD07Values(input:unknown){const shape=Object.fromEntries(templateSlots.map(f=>[f.key,["secretaryActing","authorityActing"].includes(f.key)?z.string().max(f.max).regex(/^[^\x00-\x1f\x7f]*$/):clean(f.max)]));const v=z.object(shape).strict().parse(input) as TemplateValues;
  if(!/^\d{1,2}$/.test(v.day)||!/^\d{4}$/.test(v.year)||!/^\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?$/.test(v.offered)||!/^\d{1,9}(?:,\d{3})*(?:\.\d{1,2})?$/.test(v.agreed))throw Error("ตรวจวันที่ ปี และจำนวนเงินให้เป็นตัวเลข");
  const month=["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"].indexOf(v.month)+1;
  const date=new Date(Date.UTC(Number(v.year)-543,month-1,Number(v.day)));if(!month||date.getUTCDate()!==Number(v.day)||date.getUTCMonth()!==month-1||Number(v.year)<2443||Number(v.year)>2742)throw Error("วันที่ไม่ถูกต้อง");
  return v;
}
function cents(v:string){const [a,b=""]=v.replaceAll(",","").split(".");return BigInt(a)*100n+BigInt(b.padEnd(2,"0"));}
const money=(v:bigint)=>{const n=v.toString().padStart(3,"0");return n.slice(0,-2).replace(/\B(?=(\d{3})+(?!\d))/g,",")+"."+n.slice(-2);};
export async function fillD07Template(input:unknown,reference:Buffer){
  if(createHash("sha256").update(reference).digest("hex")!==D07_REFERENCE_SHA256)throw Error("แม่แบบ D07 ไม่ตรงต้นฉบับที่ตรวจไว้");
  const values=validateD07Values(input),initial=await templateInitial(reference),changed=templateSlots.filter(f=>values[f.key]!==initial.values[f.key]).map(f=>f.key);
  const i=await inspect(reference),replacements=new Map<number,string>();
  function replace(p:number,nodes:number[]|undefined,next:string){const locations=i.locations(p,nodes),old=locations.map(n=>unescapeXml(i.matches[n][1]));if(old.join("")===next)return;let offset=0;const chars=Array.from(next);locations.forEach((n,j)=>{const length=j===locations.length-1?chars.length-offset:Array.from(old[j]).length;replacements.set(n,chars.slice(offset,offset+length).join(""));offset+=length;});}
  for(const f of templateSlots)if(changed.includes(f.key))for(const t of f.targets)replace(t.p,t.nodes,t.parentheses?"("+values[f.key]+")":(t.prefix||"")+values[f.key]);
  if(changed.includes("agreed")){const gross=cents(values.agreed),net=(gross*100n+53n)/107n;replace(16,undefined,money(net));replace(18,undefined,money(gross-net));}
  let xml=i.xml;
  for(const [index,v] of [...replacements.entries()].sort(([a],[b])=>b-a)){const m=i.matches[index],start=m.index!+m[0].indexOf(">")+1;xml=xml.slice(0,start)+escapeXml(v)+xml.slice(start+m[1].length);}
  xml=blackReminderText(xml);
  i.zip.file("word/document.xml",xml,{date:i.zip.file("word/document.xml")!.date,createFolders:false});const bytes=await i.zip.generateAsync({type:"nodebuffer",compression:"DEFLATE"});
  const out=await JSZip.loadAsync(bytes);for(const name of Object.keys(i.zip.files))if(name!=="word/document.xml"&&!i.zip.files[name].dir){if(!Buffer.from(await out.file(name)!.async("nodebuffer")).equals(await i.zip.file(name)!.async("nodebuffer")))throw Error("ส่วนที่ต้องคงไว้เปลี่ยนไป: "+name);}
  return {bytes,changed,sourceHash:D07_REFERENCE_SHA256,preservedParts:18};
}
