import 'server-only';
import {randomUUID} from 'node:crypto';
import {db,readDraft,writeDraftBatch} from '../../db';
import type {Draft, SavedDraft} from '../../document';
import {appendixImageTable} from '../../appendix';
import {prepareInspectionPhotos} from '../media/photo-processor';
import {buildAllCoreDocumentModels} from '../templates/build-all';
import {computeProcurementCase} from '../calculations';
import {ProcurementCaseInputSchema} from '../schema';
import {sqliteRepository,ConflictError} from '../storage/sqlite';
import {domainSql} from '../storage/sql-schema';
import {cleanForExport} from '../workspace/model';
import {CORE_DOC_IDS,mapProcurementCaseToDrafts,syncProcurementDraft} from './mapper';
import type {GeneratedDocId} from '../templates/ir';
import {CoreBindingSchema,type CoreBinding} from './model';
export {CoreBindingSchema} from './model';
export type LinkedCoreDraft=CoreBinding&{draft:SavedDraft|null;localFileWarning?:string|null};
export class CoreSyncConflict extends Error {}
function connection(){const c=db();c.exec(`CREATE TABLE IF NOT EXISTS procurement_core_drafts (${domainSql.procurement_core_drafts})`);return c;}
export function listCoreDraftBindings(caseId:string):LinkedCoreDraft[]{
  return connection().prepare('SELECT * FROM procurement_core_drafts WHERE case_id=?').all(caseId).map(row=>{
    const link=CoreBindingSchema.parse(row);
    let draft:SavedDraft|null=null;
    // A soft-deleted document remains bound, so create cannot silently replace it.
    if(db().prepare('SELECT id FROM documents WHERE id=? AND deleted_at IS NULL').get(link.draft_id))draft=readDraft(link.draft_id);
    return {...link,draft};
  }).sort((a,b)=>CORE_DOC_IDS.indexOf(a.doc_id)-CORE_DOC_IDS.indexOf(b.doc_id));
}

/** Creates missing links once, or explicitly refreshes existing content. Whole bundle is atomic. */
export async function bindProcurementCoreDrafts(caseId:string,caseVersion:number,mode:'create'|'sync',expectedVersions:Partial<Record<GeneratedDocId,number>>={}) {
  const record=sqliteRepository.getCase(caseId);
  if(!record)throw new Error('ไม่พบงานจัดซื้อจัดจ้าง');
  if(record.version!==caseVersion)throw new ConflictError();
  const input=ProcurementCaseInputSchema.parse(cleanForExport(record.caseInput));
  const mapped=mapProcurementCaseToDrafts(input,record.agency);
  const links=listCoreDraftBindings(caseId),byDoc=new Map(links.map(link=>[link.doc_id,link]));
  if(links.some(link=>!link.draft))throw new CoreSyncConflict('มีร่างที่ผูกไว้อยู่ในถังขยะ กรุณากู้คืนร่างเดิมก่อนสร้างหรืออัปเดต');
  if(mode==='sync'&&links.length!==CORE_DOC_IDS.length)throw new CoreSyncConflict('กรุณาสร้างร่างเอกสารทั้ง 15 ฉบับก่อนอัปเดต');
  if(mode==='sync')for(const link of links)if(expectedVersions[link.doc_id]!==link.draft!.version)throw new CoreSyncConflict('ร่างหนังสือเปลี่ยนไปแล้ว กรุณาโหลดรายการล่าสุดและตรวจทานก่อนอัปเดต');

  const work=mapped.filter(item=>mode==='sync'||!byDoc.has(item.docId));
  const photos:Array<{meta:Draft['appendixImages'][number];buffer:Buffer}>=[];
  // Initial import only. Sync never reads or modifies any Core image, overlay or attachment.
  if(work.some(item=>item.docId==='11.3')&&!byDoc.has('11.3')){
    const c=computeProcurementCase(cleanForExport(record.caseInput));
    const model=buildAllCoreDocumentModels(c,record.agency).find(model=>model.docId==='11.3')!;
    if(c.attachments.photoPaths.length>20)throw new Error('Core Draft รองรับภาพแนบท้ายไม่เกิน 20 ภาพ กรุณาลดจำนวนภาพก่อนสร้างร่าง');
    const prepared=await prepareInspectionPhotos(model);
    let total=0;
    for(const [index,source] of c.attachments.photoPaths.entries()){
      const image=prepared.get(source)!;total+=image.buffer.length;
      if(image.buffer.length>10*1024*1024||total>50*1024*1024)throw new Error('รูปภาพเกินขนาดที่ Core Draft รองรับ');
      photos.push({buffer:image.buffer,meta:{id:randomUUID(),name:`ภาพประกอบ ${index+1}.jpg`,mime:'image/jpeg',bytes:image.buffer.length,width:image.width,height:image.height,caption:c.attachments.photoCaptionOverride??'',widthMm:image.width>=image.height?165:80}});
    }
    work.find(item=>item.docId==='11.3')!.draft.appendixImages=photos.map(photo=>photo.meta);
  }
  if(!work.length)return links;
  if(photos.length)appendixImageTable();
  const saved=writeDraftBatch(work.map(item=>{
    const linked=byDoc.get(item.docId);
    const reservationOwner={caseId,docId:item.docId};
    return linked?{input:syncProcurementDraft(linked.draft!,item.draft),id:linked.draft_id,version:linked.draft!.version,reservationOwner}:{input:item.draft,reservationOwner};
  }),saved=>{
    // Check source/link versions after acquiring the write lock as well as before async photo work.
    const latest=sqliteRepository.getCase(caseId);
    if(!latest||latest.version!==caseVersion)throw new ConflictError();
    const now=new Date().toISOString();
    for(const [i,item] of work.entries()){
      const old=byDoc.get(item.docId);
      if(old){
        const changed=connection().prepare('UPDATE procurement_core_drafts SET source_version=?,synced_at=? WHERE id=? AND draft_id=? AND source_version=? AND synced_at=?').run(caseVersion,now,old.id,old.draft_id,old.source_version,old.synced_at);
        if(!changed.changes)throw new CoreSyncConflict('การเชื่อมโยงถูกแก้ไขจากหน้าต่างอื่น กรุณาโหลดรายการล่าสุด');
      }else connection().prepare('INSERT INTO procurement_core_drafts VALUES(?,?,?,?,?,?,?)').run(randomUUID(),caseId,item.docId,saved[i].id,item.copies,caseVersion,now);
    }
    for(const photo of photos)db().prepare('INSERT INTO document_appendix_images VALUES(?,?,?,?,?,?,?)').run(photo.meta.id,photo.meta.name,photo.meta.mime,photo.meta.width,photo.meta.height,photo.buffer,now);
  });
  const warnings=new Map(saved.map(draft=>[draft.id,draft.localFileWarning]));
  return listCoreDraftBindings(caseId).map(link=>({...link,localFileWarning:warnings.get(link.draft_id)}));
}
