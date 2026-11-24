import {documentSchema, type Draft} from '../../document';
import {computeProcurementCase} from '../calculations';
import {formatDocumentNumbers} from '../numbering';
import {AgencyConfigSchema} from '../schema';
import {buildAllCoreDocumentModels} from '../templates/build-all';
import type {DocumentBlock, GeneratedDocId, SignatureBlock} from '../templates/ir';
import type {AgencyConfig, ProcurementCaseInput} from '../types';
import {CORE_DOC_IDS} from './document-ids';
import {toThaiDigits} from '../formatting';
export {CORE_DOC_IDS} from './document-ids';

const registryKeys = {
  '1':'doc1_approvePrinciple','2':'doc2_assignSpec','3':'doc3_reportSpec',
  '6.1':'doc6_1_purchaseRequest','6.2':'doc6_2_inspectorOrder','7':'doc7_evalReport',
  '8':'doc8_winnerAnnouncement','9':'doc9_contractNotice','10':'doc10_purchaseOrder',
  '11.1':'doc11_1_inspectionReport','12':'doc12_finalSummary','13':'doc13_disbursement',
} as const;
export interface MappedProcurementDraft {docId:GeneratedDocId; copies:number; draft:Draft}

/** An explicit ownership boundary: presentation, overlays, annexes and files belong to the editor. */
export const SYNC_CONTENT_FIELDS = [
  'subject','headerSubtitle','number','date','organization','department','address','phone','recipient','salutation',
  'body','bodyMode','contentBlocks','background','facts','legalBasis','consideration','proposal',
  'closing','signer','position','proposers','opinions','procurementForm',
] as const satisfies readonly (keyof Draft)[];

/** Pure and non-mutating; callers must persist with the current Core document version. */
export function syncProcurementDraft<T extends Draft>(current:T, generated:Draft):T {
  if(current.procurementSource&&generated.procurementSource&&(current.procurementSource.caseId!==generated.procurementSource.caseId||current.procurementSource.docId!==generated.procurementSource.docId))throw new Error('ร่างหนังสือนี้ไม่ได้มาจากงานและเอกสารเดียวกัน ไม่สามารถ Sync ข้ามงานได้');
  const result=structuredClone(current);
  let changed=false;
  // Explicit Sync also upgrades previously linked generic forms, without replacing editor-owned media.
  if(current.layout==='standard'&&generated.layout.startsWith('procurement-')){
    result.layout=generated.layout;result.firstPageTop=generated.firstPageTop;changed=true;
  }
  // The photo sheet's title is generated content; annex titles added to other documents belong to the editor.
  const fields=[...SYNC_CONTENT_FIELDS,...generated.procurementSource?.docId==='11.3'?['appendixTitle'] as const:[]];
  for(const key of fields){
    if(JSON.stringify(current[key])!==JSON.stringify(generated[key]))changed=true;
    Object.assign(result,{[key]:structuredClone(generated[key])});
  }
  if(changed)result.status='draft';
  documentSchema.parse(result);
  return result;
}

const position=(s:SignatureBlock)=>[...s.lines,s.label].filter(Boolean).join('\n');
const cell=(text:string)=>text.replace(/\\/g,'\\\\').replace(/\|/g,'\\|').replace(/\r?\n/g,' ');
function blockText(block:DocumentBlock):string {
  switch(block.kind){
    case 'paragraph':return [block.heading?`## ${block.heading}`:'',block.text].filter(Boolean).join('\n');
    case 'metadata':return block.columns.map(column=>column.join('\n')).join('\n\n');
    case 'checkboxes':return block.groups.map(group=>[group.label,...group.choices.map(choice=>`${choice.checked?'☑':'☐'} ${choice.text}`)].join('\n')).join('\n\n');
    case 'table':{
      if(!block.bordered&&block.columns.length===4&&block.columns[0]==='รายการ'&&block.columns[1]==='จำนวนเงิน (บาท)'&&!block.footerRows.length){
        return block.rows.map(row=>row.map((v,idx)=>{const val=cell(v.text);return idx%2===1&&val&&val!=='-'&&!val.endsWith('บาท')?`${val} บาท`:val;}).join(' | ')).join('\n');
      }
      const rows=[...block.rows,...block.footerRows].map(row=>{
        const cells=row.flatMap(value=>[cell(value.text),...Array.from({length:(value.colspan??1)-1},()=> '')]);
        return `| ${Array.from({length:block.columns.length},(_,i)=>cells[i]??'').join(' | ')} |`;
      });
      return [block.caption?`## ${block.caption}`:'',`| ${block.columns.map(cell).join(' | ')} |`,`| ${block.columns.map(()=> '---').join(' | ')} |`,...rows].filter(Boolean).join('\n');
    }
    case 'signature-cluster':return block.closing.filter(line=>!line.startsWith('สั่ง ณ วันที่')&&!line.startsWith('ประกาศ ณ วันที่')&&line!=='ขอแสดงความนับถือ').join('\n');
    case 'photo-grid':return ''; // Binary photos are imported once by the binding service, never by Sync.
  }
}

/** Uses Phase 1 calculations and the existing resolved templates; no Word process or I/O. */
export function mapProcurementCaseToDrafts(input:ProcurementCaseInput, agency:AgencyConfig):MappedProcurementDraft[] {
  const c=computeProcurementCase(input),a=AgencyConfigSchema.parse(agency),numbers=formatDocumentNumbers(c.docs,a);
  const models=buildAllCoreDocumentModels(c,a,{poTableMode:'ITEMIZED',showRoutingStrip:false});
  return CORE_DOC_IDS.map(docId=>{
    const model=models.find(model=>model.docId===docId)!;
    const allBlocks=model.pages.flatMap(page=>page.blocks);
    const clusters=allBlocks.filter(block=>block.kind==='signature-cluster');
    const signatures=clusters.flatMap(cluster=>cluster.signatures),first=signatures[0];
    const key=docId in registryKeys?registryKeys[docId as keyof typeof registryKeys]:null;
    const date=key?c.docs[key].date??'':docId==='4.1'?c.docs.doc3_reportSpec.date:c.docs.doc11_1_inspectionReport.date??'';
    const type:Draft['type']=model.family==='MEMO'?'internal':model.family==='ORDER'?'order':model.family==='ANNOUNCEMENT'?'announcement':model.family==='EXTERNAL_LETTER'?'external':'other';
    const subject=docId==='6.2'?model.header.lines[2].replace(/^เรื่อง\s*/,''):docId==='8'?model.header.lines[1].replace(/^เรื่อง\s*/,''):model.header.subject??model.title;
    const layout=({'4.1':'procurement-tor','10':'procurement-po','11.2':'procurement-inspection','11.3':'procurement-photos'} as const)[docId as '4.1'|'10'|'11.2'|'11.3'];
    const headerSubtitle=toThaiDigits((docId==='6.2'?model.header.lines.slice(3,-1):docId==='8'?model.header.lines.slice(2,-1):[]).join('\n'));
    // Core already adds paragraph spacing. Empty separator paragraphs would double it.
    const body=toThaiDigits(model.pages.map((page,i)=>[i&&page.heading&&model.family!=='PHOTO_SHEET'?`## ${page.heading.join(' ')}`:'',...page.blocks.filter(block=>!layout||block.kind!=='metadata').map(blockText)].filter(Boolean).join('\n')).filter(Boolean).join('\n'));
    const autoSigner=['internal','external','order','announcement'].includes(type)||docId==='11.2'||docId==='11.3';
    const inspectionSigners=docId==='11.2'||docId==='11.3'?signatures:[];
    const draft=documentSchema.parse({
      type,subject,headerSubtitle,number:key&&key!=='doc8_winnerAnnouncement'?numbers[key]:'',date,procurementSource:{caseId:c.id,docId},
      organization:type==='external'?a.officeTitle:a.municipalityName,department:type==='internal'?docId==='11.1'?(c.inspectorMode==='SINGLE'?'ผู้ตรวจรับพัสดุ':'คณะกรรมการตรวจรับพัสดุ'):[a.sectionName,a.divisionName].join(' '):type==='external'?[a.divisionName,a.subDepartmentFooter].join('\n'):a.divisionName,
      address:a.externalAddressLine,phone:type==='internal'?(docId==='11.1'?'':a.phoneDisplay):type==='external'?[a.phoneShort,a.fax?`โทรสาร ${a.fax}`:''].filter(Boolean).join('\n'):a.phoneShort,recipient:model.header.recipient??'',
      body,bodyMode:'free',numeralStyle:'thai',firstPageTop:layout&&layout!=='procurement-po'?'25':'15',
      ...(layout?{layout,procurementForm:{headingLines:model.header.lines.slice(1).map(toThaiDigits),metadataColumns:allBlocks.filter(block=>block.kind==='metadata').flatMap(block=>block.columns).map(column=>column.map(toThaiDigits)),signatureDates:signatures.map(s=>toThaiDigits(s.date??''))}}:{}),
      closing:type==='external'?'ขอแสดงความนับถือ':'',otherShowSignatures:type==='other',
      // Memo proposers, order/announcement/external authorities, and inspection-sheet inspectors (with position) are automatic; other signers use text boxes.
      signer:autoSigner?first?.name??'':'',position:autoSigner&&first?position(first):(docId==='11.2'||docId==='11.3'?'ผู้ตรวจรับพัสดุ':''),
      proposers:inspectionSigners.slice(1).map(s=>({name:s.name,position:position(s)||'กรรมการ'})),opinions:[],
      appendixTitle:docId==='11.3'?model.header.lines.join('\n'):'',
    });
    return {docId,copies:model.copies,draft};
  });
}
