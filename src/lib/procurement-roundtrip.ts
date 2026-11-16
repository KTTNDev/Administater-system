import 'server-only';
import {inspect} from './procurement-template';
import {readProcurement,readProcurementFile,procurementSnapshot,validateProcurementUpload,attachProcurementFile} from './procurement-db';
import {documentTemplates,type DraftDocumentCode} from './procurement-documents';
import {buildLivePreview} from './procurement-live-preview';
export async function compareProcurementWord(id:string,baseId:string,bytes:Buffer,name:string){
 const base=readProcurementFile(baseId),meta=procurementSnapshot().files.find(f=>f.id===baseId)?.meta;
 if(base.caseId!==id||meta?.origin!=='draft'||!documentTemplates[meta.code as DraftDocumentCode]||!base.name.endsWith('.docx'))throw Error('เลือกไฟล์ Word ที่ระบบสร้างจากงานเดียวกัน');
 if(await validateProcurementUpload(bytes,name)!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document')throw Error('นำกลับได้เฉพาะ DOCX');
 const [before,after]=await Promise.all([inspect(base.bytes),inspect(bytes)]);
 // Indices are safe only while the paragraph structure is retained. Additions stay as an attached original.
 const record=readProcurement(id),importedFileId=await attachProcurementFile(id,record.version,bytes,name,{code:meta.code,origin:'word',caseVersion:null,baseFileId:baseId});
 if(before.paragraphCount!==after.paragraphCount)return {code:meta.code,baseId,importedFileId,structural:true,diffs:[],warning:'Word เปลี่ยนโครงสร้างย่อหน้า จึงเก็บไฟล์ทั้งฉบับแยกไว้ ให้เลือกใช้ Word ที่แนบเป็นฉบับใช้งานและตรวจทาน หรือคงแม่แบบเดิมเพื่อแก้ข้อความเป็นรายย่อหน้า การเปลี่ยนข้อมูลกลางจะไม่เขียนทับไฟล์ Word ภายนอก'};
 const current=await inspect(await buildLivePreview(record,meta.code as DraftDocumentCode));
 const count=Number(meta.values?.itemCount||1),start=meta.code==='D09'?20:meta.code==='D07'?11:meta.code==='D04'?14:meta.code==='D05'?9:-1,width=meta.code==='D09'?6:meta.code==='D07'?4:1,delta=['D04','D05'].includes(meta.code)?count-2:(count-1)*width;
 const currentCount=record.bill.items.length||1,currentDelta=['D04','D05'].includes(meta.code)?currentCount-2:(currentCount-1)*width;
 const diffs=[];for(const p of before.leafParagraphs){const left=before.value(p,before.ownNodes(p)),right=after.value(p,after.ownNodes(p));if(left===right)continue;const shared=start>=0&&p>=start&&p<start+count*width,index=start>=0&&p>=start+count*width?p-delta:p,currentIndex=start>=0&&p>=start+count*width?index+currentDelta:p;let now='';try{now=current.value(currentIndex,current.ownNodes(currentIndex));}catch{}diffs.push({p:index,before:left,after:right,current:now,conflict:now!==left&&now!==right,shared});}
 return {code:meta.code,baseId,importedFileId,diffs,warning:'เก็บ Word ที่นำกลับเป็นต้นฉบับอ้างอิงแยกแล้ว นำกลับเฉพาะข้อความที่เลือก รูปแบบใช้แม่แบบเดิม ตรวจจุดที่ข้อมูลปัจจุบันเปลี่ยนต่างจาก Word ต้นทางด้วย ส่วนรายการสินค้าแก้ที่บิลกลาง'};
}
