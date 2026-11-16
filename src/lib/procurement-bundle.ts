import 'server-only';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {readProcurement,readProcurementFile,procurementSnapshot} from './procurement-db';
import {suiteCodes} from './procurement-workflow-model';
import {documentContentHash} from './procurement-process';
import {nativeD07Pdf} from './procurement-preview';
import {createHash} from 'node:crypto';
import {procurementFolder} from './procurement-filenames';
export async function procurementSuiteZip(id:string){
 const data=readProcurement(id),files=procurementSnapshot().files.filter(f=>f.caseId===id),zip=new JSZip(),manifest=[];
 for(const code of suiteCodes){const config=data.documents[code];if(config?.required===false){manifest.push({code,exempt:true,reason:config.exemptionReason});continue;}
  const file=files.find(f=>f.id===config?.primaryFileId&&f.meta.code===code);if(!file)throw Error('ยังไม่ได้เลือกฉบับใช้งาน '+code);
  if(file.meta.origin==='draft'&&file.meta.contentHash!==await documentContentHash(data,code))throw Error(code+' ข้อมูลเปลี่ยนแล้ว สร้างฉบับใหม่ก่อนดาวน์โหลดทั้งชุด');
  zip.file(String(suiteCodes.indexOf(code)+1).padStart(2,'0')+'_'+procurementFolder(code)+'/'+file.name,readProcurementFile(file.id).bytes);manifest.push({code,id:file.id,sha256:file.sha256,name:file.name,origin:file.meta.origin});
 }
 zip.file('manifest.json',JSON.stringify({caseId:id,version:data.version,at:new Date().toISOString(),files:manifest},null,2));return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});
}
export function procurementPacket(id:string,packetId:string){const data=readProcurement(id),packet=data.workflow.packets.find(p=>p.id===packetId);if(!packet)throw Error('ไม่พบชุดส่งในงานนี้');return packet;}
function packetFile(id:string,entry:{id:string;sha256:string}){const file=readProcurementFile(entry.id);if(file.caseId!==id||createHash('sha256').update(file.bytes).digest('hex')!==entry.sha256)throw Error('ไฟล์ไม่ตรงกับหลักฐานในชุดส่ง');return file;}
export async function procurementPacketZip(id:string,packetId:string){const packet=procurementPacket(id,packetId),zip=new JSZip();for(const [index,entry] of packet.files.entries()){const file=packetFile(id,entry);zip.file(String(index+1).padStart(2,'0')+'-'+file.name,file.bytes);}zip.file('manifest.json',JSON.stringify(packet,null,2));return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});}
async function mergePrintFiles(id:string,files:{id:string;sha256:string;copies:number}[]){
 const pdf=await PDFDocument.create();
 for(const entry of files){const file=packetFile(id,entry);
  if(file.mime==='image/png'||file.mime==='image/jpeg'){const image=file.mime==='image/png'?await pdf.embedPng(file.bytes):await pdf.embedJpg(file.bytes),scale=Math.min(515/image.width,762/image.height);for(let copy=0;copy<entry.copies;copy++){const page=pdf.addPage([595.28,841.89]);page.drawImage(image,{x:(595.28-image.width*scale)/2,y:(841.89-image.height*scale)/2,width:image.width*scale,height:image.height*scale});}}
  else {const bytes=file.mime==='application/pdf'?file.bytes:(await nativeD07Pdf(file.bytes)).bytes,source=await PDFDocument.load(bytes),embedded=await pdf.embedPages(source.getPages());for(let copy=0;copy<entry.copies;copy++)for(const image of embedded){const page=pdf.addPage([595.28,841.89]),scale=Math.min(595.28/image.width,841.89/image.height);page.drawPage(image,{x:(595.28-image.width*scale)/2,y:(841.89-image.height*scale)/2,width:image.width*scale,height:image.height*scale});}}
 }
 return Buffer.from(await pdf.save());
}
export async function procurementPacketPdf(id:string,packetId:string){return mergePrintFiles(id,procurementPacket(id,packetId).files);}
export async function procurementFilePdf(id:string){const file=readProcurementFile(id);if(file.mime==='application/pdf')return file.bytes;if(file.mime.endsWith('wordprocessingml.document'))return (await nativeD07Pdf(file.bytes)).bytes;return mergePrintFiles(file.caseId,[{id,sha256:createHash('sha256').update(file.bytes).digest('hex'),copies:1}]);}
export async function procurementSuitePdf(id:string,version:number){
 const data=readProcurement(id);if(data.version!==version)throw Error('ข้อมูลเปลี่ยนแล้ว เปิดฉบับล่าสุดก่อนรวม PDF');const available=procurementSnapshot().files.filter(f=>f.caseId===id),files=[];
 for(const code of suiteCodes){const config=data.documents[code];if(config?.required===false)continue;const file=available.find(f=>f.id===config?.primaryFileId&&f.meta.code===code);if(!file)throw Error('เลือกฉบับใช้งาน '+code+' ก่อนรวมชุดพิมพ์');if(file.meta.origin==='draft'&&file.meta.contentHash!==await documentContentHash(data,code))throw Error(code+' เปลี่ยนแล้ว สร้างร่างใหม่ก่อนพิมพ์');files.push({id:file.id,sha256:file.sha256,copies:config?.copies||1});}
 const bytes=await mergePrintFiles(id,files);if(readProcurement(id).version!==version)throw Error('มีการแก้ข้อมูลระหว่างรวม PDF กรุณาสร้างจากฉบับล่าสุด');return bytes;
}
