import 'server-only';
import fs from 'node:fs';import path from 'node:path';
import JSZip from 'jszip';
import {Document,Paragraph,Packer} from 'docx';
const fontName='TH Sarabun New',relation='http://schemas.openxmlformats.org/officeDocument/2006/relationships/font';
let packagePromise:Promise<{entry:string;files:{id:string;target:string;bytes:Buffer}[]}>|undefined;
async function fontPackage(){
 return packagePromise??=(async()=>{
  const fonts=path.join(process.cwd(),'public/fonts');
  const document=new Document({fonts:[{name:fontName,data:fs.readFileSync(path.join(fonts,'THSarabunNew.ttf')),bold:fs.readFileSync(path.join(fonts,'THSarabunNew-Bold.ttf'))}],sections:[{children:[new Paragraph('')]}]});
  const zip=await JSZip.loadAsync(await Packer.toBuffer(document)),table=await zip.file('word/fontTable.xml')!.async('string'),rels=await zip.file('word/_rels/fontTable.xml.rels')!.async('string');
  let entry=table.match(/<w:font\b[^>]*w:name="TH Sarabun New"[^>]*>[\s\S]*?<\/w:font>/)?.[0];if(!entry)throw Error('สร้างฟอนต์ฝังเอกสารไม่สำเร็จ');
  const files=[];for(const [index,match] of [...entry.matchAll(/r:id="([^"]+)"/g)].entries()){
   const old=match[1],rel=[...rels.matchAll(/<Relationship\b[^>]*\/>/g)].find(r=>r[0].includes('Id="'+old+'"'))?.[0],source=rel?.match(/Target="([^"]+)"/)?.[1];if(!source)throw Error('ข้อมูลฟอนต์ฝังไม่ครบ');
   const id='rIdSarabunEmbeddedFont'+index,target='fonts/sarabun-new-'+index+'.odttf',part=zip.file('word/'+source);if(!part)throw Error('ไม่พบข้อมูลฟอนต์ฝัง');files.push({id,target,bytes:await part.async('nodebuffer')});entry=entry.replace('r:id="'+old+'"','r:id="'+id+'"');
  }
  return {entry,files};
 })();
}
/** Use the same obfuscated font packaging as the normal letter Word exporter. */
export async function embedProcurementFont(bytes:Buffer){
 const zip=await JSZip.loadAsync(bytes),part=zip.file('word/fontTable.xml');if(!part)throw Error('แม่แบบไม่มีตารางฟอนต์');let table=await part.async('string');
 const existing=table.match(/<w:font\b[^>]*w:name="TH Sarabun New"[^>]*>[\s\S]*?<\/w:font>/)?.[0];if(existing?.includes('w:embedRegular'))return bytes;
 const packaged=await fontPackage(),date=new Date('2000-01-01T00:00:00Z');
 const put=(name:string,value:string|Buffer)=>zip.file(name,value,{date:zip.file(name)?.date||date,createFolders:false});
 if(existing)table=table.replace(existing,packaged.entry);else table=table.replace('</w:fonts>',packaged.entry+'</w:fonts>');if(!table.includes('xmlns:r='))table=table.replace('<w:fonts','<w:fonts xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"');put('word/fontTable.xml',table);
 const relName='word/_rels/fontTable.xml.rels';let rels=await zip.file(relName)?.async('string')||'<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';
 for(const file of packaged.files){if(rels.includes('Id="'+file.id+'"'))throw Error('รหัสฟอนต์ฝังซ้ำ');rels=rels.replace('</Relationships>','<Relationship Id="'+file.id+'" Type="'+relation+'" Target="'+file.target+'"/></Relationships>');put('word/'+file.target,file.bytes);}put(relName,rels);
 let types=await zip.file('[Content_Types].xml')!.async('string');if(!types.includes('Extension="odttf"'))types=types.replace('</Types>','<Default Extension="odttf" ContentType="application/vnd.openxmlformats-officedocument.obfuscatedFont"/></Types>');put('[Content_Types].xml',types);
 return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
