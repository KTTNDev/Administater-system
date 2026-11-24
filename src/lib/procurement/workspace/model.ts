import {z} from 'zod';
import {AgencyConfigSchema, BudgetLineSchema, PersonSchema, VendorSchema, ProcurementCaseInputSchema} from '../schema';
import {defaultAgency} from '../presets/default-agency';
import {computeProcurementCase} from '../calculations';
import {validateProcurementCase} from '../validator';
import {MEMO_TRACK, suggestNextNumber, type NumberTrack} from '../numbering';
import {addCalendarDays, nextWorkingDay} from '../holidays';
import {BINDER_IDS, buildBinderManifest} from '../manifest';
import type {AgencyConfig, ProcurementCaseInput, ValidationIssue} from '../types';

// Drafts deliberately permit blanks. Only the unmodified Phase 1 schema can authorize export.
export const SIGNATORIES = {procurementOfficer:'ผู้เสนอ',divisionDirector:'ผู้อำนวยการกอง',municipalClerk:'ปลัด / ผู้ปฏิบัติราชการแทน',mayor:'นายก / ผู้ปฏิบัติราชการแทน'} as const;
const blankPerson = (id:string) => ({id,fullName:'',position:''});
const draftPerson = PersonSchema.extend({fullName:z.string(),position:z.string()});
const draftEntry = z.object({runningNo:z.string().regex(/^\d*$/).optional(),date:z.string().optional()});
const blankOrDate = z.string().refine(s=>!s||/^\d{4}-\d{2}-\d{2}$/.test(s));
export const DraftCaseSchema = ProcurementCaseInputSchema.extend({
  purposeText:z.string(),projectTitleShort:z.string().optional(),
  budgetLine:BudgetLineSchema.extend({planName:z.string(),workName:z.string(),categoryGroup:z.string(),categoryType:z.string()}),
  vendor:VendorSchema.extend({shopName:z.string(),contactPersonName:z.string(),address:z.string(),phone:z.string(),taxId:z.string().regex(/^\d{0,13}$/),smeExpiryDate:blankOrDate.optional()}),
  items:z.array(z.object({id:z.string().min(1),description:z.string(),quantity:z.number().finite().nonnegative(),unit:z.string(),unitPrice:z.number().finite().nonnegative()})).max(1000),
  inspectors:z.array(z.object({personId:z.string().optional(),fullName:z.string(),position:z.string(),role:z.enum(['INSPECTOR','CHAIRPERSON','MEMBER'])})).max(3),
  signatories:z.object({procurementOfficer:draftPerson,divisionDirector:draftPerson,municipalClerk:draftPerson,mayor:draftPerson}),
  docs:z.object({
    ...Object.fromEntries(MEMO_TRACK.map(k=>[k,draftEntry])) as Record<typeof MEMO_TRACK[number],typeof draftEntry>,
    doc6_2_inspectorOrder:draftEntry.extend({yearBE:z.number().optional()}),
    doc8_winnerAnnouncement:z.object({registryLogNo:z.string().regex(/^\d*$/).optional(),date:blankOrDate.optional()}),
    doc9_contractNotice:draftEntry,doc10_purchaseOrder:draftEntry.extend({fiscalYearBE:z.number().optional()}),
    laasPurchaseReportNo:z.string().optional(),laasContractNo:z.string().optional(),laasDate:blankOrDate.optional(),egpProjectNo:z.string().optional(),inspectionControlNo:z.string().optional(),
  }),
  inspectionResult:z.object({isCorrect:z.boolean(),isComplete:z.boolean(),hasPenalty:z.boolean(),deliveryDate:blankOrDate.optional()}),
});
export type DraftCase = z.infer<typeof DraftCaseSchema>;
export const MasterSchema = z.object({agency:AgencyConfigSchema,people:z.array(PersonSchema),vendors:z.array(VendorSchema),budgetLines:z.array(BudgetLineSchema),signatories:z.object({procurementOfficer:z.string(),divisionDirector:z.string(),municipalClerk:z.string(),mayor:z.string()})});
export type WorkspaceMaster = z.infer<typeof MasterSchema>;
export const emptyMaster = ():WorkspaceMaster => ({agency:structuredClone(defaultAgency),people:[],vendors:[],budgetLines:[],signatories:{procurementOfficer:'',divisionDirector:'',municipalClerk:'',mayor:''}});
export const PdfDefaultsSchema = z.object({duplicateCopies:z.boolean(),includeDividers:z.boolean(),includeCoverChecklist:z.boolean(),includeExternalFiles:z.boolean().default(true),routingStripMode:z.enum(['FIRST_COPY_ONLY','ALL_COPIES','NONE'])});
export const pdfDefaults = {duplicateCopies:true,includeDividers:true,includeCoverChecklist:false,includeExternalFiles:true,routingStripMode:'FIRST_COPY_ONLY' as const};
export const EXTERNAL_DOC_SLOTS = [...BINDER_IDS, 'OTHER'] as const;
export type ExternalDocSlot = typeof EXTERNAL_DOC_SLOTS[number];
export const ExternalFileSchema = z.object({
  id: z.string().uuid(),
  slotId: z.enum(EXTERNAL_DOC_SLOTS),
  name: z.string().min(1).max(240),
  originalName: z.string().min(1).max(240).optional(),
  label: z.string().max(240).default(''),
  pages: z.number().int().positive().max(200),
  bytes: z.number().int().positive(),
  uploadedAt: z.string(),
  includeInExport: z.boolean().default(true),
});
export type ExternalFile = z.infer<typeof ExternalFileSchema>;
export const CaseWorkStatusSchema = z.enum(['RESERVING_NUMBERS','READY_TO_GENERATE','DRAFTED','COMPLETED']);
export type CaseWorkStatus = z.infer<typeof CaseWorkStatusSchema>;
export const CaseTrackerSchema = z.object({
  status:CaseWorkStatusSchema.default('RESERVING_NUMBERS'),
  workMonth:z.string().regex(/^(\d{4}-\d{2})?$/).default(''),
  note:z.string().max(1000).default(''),
});
export type CaseTracker = z.infer<typeof CaseTrackerSchema>;
export const defaultCaseTracker = ():CaseTracker => ({status:'RESERVING_NUMBERS',workMonth:'',note:''});
export const StoredCaseSchema = z.object({caseInput:DraftCaseSchema,agency:AgencyConfigSchema,version:z.number().int().nonnegative(),updatedAt:z.string(),dueAcknowledged:z.boolean().default(false),pdfDefaults:PdfDefaultsSchema.default(pdfDefaults),tracker:CaseTrackerSchema.default({status:'RESERVING_NUMBERS',workMonth:'',note:''}),externalFiles:z.array(ExternalFileSchema).max(100).default([])});
export type StoredCase = z.infer<typeof StoredCaseSchema>;
export interface RegistryEntry {track:NumberTrack;yearBE:number;runningNo:string}
export const RegistrySchema = z.array(z.object({track:z.enum(['INTERNAL_MEMO','MUNICIPAL_ORDER','ANNOUNCEMENT','EXTERNAL_LETTER','PURCHASE_ORDER']),yearBE:z.number().int(),runningNo:z.string().regex(/^\d+$/)}));
export const defaultPurposeForType = (type:'BUY'|'HIRE', divisionName:string) =>
  type==='BUY'
    ? `เพื่อใช้ในการปฏิบัติงานและให้บริการประชาชนของ${divisionName}`
    : `เพื่อให้การดำเนินงานและบำรุงรักษาทรัพย์สินของ${divisionName} เป็นไปด้วยความเรียบร้อย`;
export function newCase(master=emptyMaster(), procurementType:'BUY'|'HIRE'='BUY'):StoredCase {
  const defaultFiscalYear=new Date().getFullYear()+543+(new Date().getMonth()>=9?1:0);
  const buyCategories=new Set(['ค่าวัสดุ','ค่าครุภัณฑ์']);
  const hireCategories=new Set(['ค่าใช้สอย','ค่าที่ดินและสิ่งก่อสร้าง']);
  const matchedBudget=master.budgetLines.find(b=>procurementType==='BUY'?buyCategories.has(b.categoryGroup):hireCategories.has(b.categoryGroup));
  const fallbackBudget=master.budgetLines[0];
  const budgetLine=matchedBudget
    ? structuredClone(matchedBudget)
    : procurementType==='BUY'&&fallbackBudget
      ? structuredClone(fallbackBudget)
      : {
          id:crypto.randomUUID(),
          fiscalYearBE:fallbackBudget?.fiscalYearBE??defaultFiscalYear,
          planName:fallbackBudget?.planName??'',
          workName:fallbackBudget?.workName??'',
          categoryGroup:procurementType==='BUY'?'ค่าวัสดุ':'ค่าใช้สอย',
          categoryType:procurementType==='BUY'?'':'รายจ่ายเพื่อให้ได้มาซึ่งบริการ',
          allocatedAmount:0,transferInAmount:0,transferOutAmount:0,
        };
  const input:DraftCase = {
    id:crypto.randomUUID(),procurementType,penaltyRatePercent:procurementType==='BUY'?.2:.1,workflowModeOverride:'AUTO',itemDisplayMode:'AUTO',manualDocumentOverrides:[],
    budgetLine,
    budgetSpentBefore:0,purposeText:defaultPurposeForType(procurementType,master.agency.divisionName),
    items:[{id:crypto.randomUUID(),description:'',quantity:1,unit:procurementType==='BUY'?'ชิ้น':'งาน',unitPrice:0}],
    vendor:structuredClone(master.vendors[0]??{id:crypto.randomUUID(),shopName:'',contactPersonName:'',contactPersonTitle:'ผู้จัดการ',businessTypeTag:procurementType==='BUY'?'ขายส่ง,ขายปลีก,ให้บริการ,ผู้ผลิต':'ให้บริการ',address:'',phone:'',taxId:'',isVatRegistered:true,isSmeRegistered:false}),
    deliveryDays:3,warrantyYears:null,minPenaltyPerDay:100,inspectorMode:'SINGLE',inspectors:[{fullName:'',position:'',role:'INSPECTOR'}],
    inspectionResult:{isCorrect:true,isComplete:true,hasPenalty:false},
    signatories:Object.fromEntries(Object.keys(SIGNATORIES).map(k=>[k,structuredClone(master.people.find(p=>p.id===master.signatories[k as keyof typeof SIGNATORIES])??blankPerson(k))])) as DraftCase['signatories'],
    docs:{...Object.fromEntries(MEMO_TRACK.map(k=>[k,{runningNo:'',date:''}])) as Pick<DraftCase['docs'],typeof MEMO_TRACK[number]>,doc6_2_inspectorOrder:{},doc8_winnerAnnouncement:{},doc9_contractNotice:{},doc10_purchaseOrder:{}},attachments:{photoPaths:[]},
  };
  return {caseInput:input,agency:structuredClone(master.agency),version:0,updatedAt:'',dueAcknowledged:false,pdfDefaults:{...pdfDefaults},tracker:defaultCaseTracker(),externalFiles:[]};
}
export const TIMELINE = [
  ['1','doc1_approvePrinciple','ขออนุมัติหลักการ',1,'INTERNAL_MEMO'],['2','doc2_assignSpec','มอบหมายกำหนดคุณลักษณะ',1,'INTERNAL_MEMO'],['3','doc3_reportSpec','รายงานกำหนดคุณลักษณะ',1,'INTERNAL_MEMO'],
  ['6.1','doc6_1_purchaseRequest','รายงานขอซื้อ / จ้าง',2,'INTERNAL_MEMO'],['6.2','doc6_2_inspectorOrder','คำสั่งแต่งตั้งผู้ตรวจรับ',2,'MUNICIPAL_ORDER'],['7','doc7_evalReport','รายงานพิจารณาผล',2,'INTERNAL_MEMO'],['8','doc8_winnerAnnouncement','ทะเบียนประกาศ (ไม่พิมพ์เลข)',2,'ANNOUNCEMENT'],['9','doc9_contractNotice','หนังสือแจ้งผู้ชนะ',2,'EXTERNAL_LETTER'],['10','doc10_purchaseOrder','ใบสั่งซื้อ / จ้าง',2,'PURCHASE_ORDER'],
  ['11.1','doc11_1_inspectionReport','รายงานผลตรวจรับ',3,'INTERNAL_MEMO'],['12','doc12_finalSummary','รายละเอียดวิธีการ / ตั้งหนี้',3,'INTERNAL_MEMO'],['13','doc13_disbursement','ขออนุมัติเบิกจ่าย / ฎีกา',4,'INTERNAL_MEMO'],
] as const;
export type TimelineKey = typeof TIMELINE[number][1];
export function cleanForExport(input:DraftCase):unknown {
  // Optional blanks are omitted, never replaced with fake dates or numbers.
  const clean=(v:unknown):unknown=>Array.isArray(v)?v.map(clean):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k,val])=>val!==''||!['date','runningNo','registryLogNo','laasDate','laasPurchaseReportNo','laasContractNo','egpProjectNo','inspectionControlNo','deliveryDate','smeExpiryDate','projectTitleShort'].includes(k)).map(([k,val])=>[k,clean(val)])):v;
  return clean(input);
}
export function evaluateDraft(input:DraftCase){
  const parsed=ProcurementCaseInputSchema.safeParse(cleanForExport(input));
  const issues:ValidationIssue[]=parsed.success?[]:parsed.error.issues.map(i=>({code:'MISSING_OR_INVALID',severity:'ERROR',docIds:[],field:i.path.join('.'),messageTh:`${fieldLabel(i.path.join('.'))}: ยังไม่ครบหรือรูปแบบไม่ถูกต้อง กรุณาตรวจข้อมูล`}));
  let computed:ReturnType<typeof computeProcurementCase>|null=null;
  if(parsed.success)try{computed=computeProcurementCase(parsed.data);issues.push(...validateProcurementCase(computed));}catch(e){issues.push({code:'CALCULATION',severity:'ERROR',docIds:['10'],field:'docs.doc10_purchaseOrder.date',messageTh:e instanceof Error?e.message:'คำนวณไม่ได้'});}
  if(computed){
    const generated=new Set(buildBinderManifest(computed).filter(r=>r.source==='GENERATED').map(r=>String(r.docId)));
    for(const [docId,key] of TIMELINE)if(generated.has(docId)||['6.2','10'].includes(docId)){
      const row=input.docs[key],number='registryLogNo' in row?row.registryLogNo:('runningNo' in row?row.runningNo:undefined);
      for(const [field,value] of [['date',row.date],['runningNo',number]])if(!value)issues.push({code:'MISSING_REFERENCE',severity:'ERROR',docIds:[docId],field:`docs.${key}.${key==='doc8_winnerAnnouncement'&&field==='runningNo'?'registryLogNo':field}`,messageTh:`เอกสาร ${docId} ยังไม่ระบุ${field==='date'?'วันที่':'เลขที่ / เลขทะเบียน'}`});
    }
    if(!input.docs.doc6_2_inspectorOrder.yearBE)issues.push({code:'MISSING_REFERENCE',severity:'ERROR',docIds:['6.2'],field:'docs.doc6_2_inspectorOrder.yearBE',messageTh:'กรอกปี พ.ศ. ของคำสั่งแต่งตั้งผู้ตรวจรับ'});
    if(!input.docs.doc10_purchaseOrder.fiscalYearBE)issues.push({code:'MISSING_REFERENCE',severity:'ERROR',docIds:['10'],field:'docs.doc10_purchaseOrder.fiscalYearBE',messageTh:'กรอกปีงบประมาณของใบสั่งซื้อ / จ้าง'});
  }
  return {computed,issues};
}
export function fieldLabel(path:string){
  const fields:Record<string,string>={fullName:'ชื่อ-สกุล',position:'ตำแหน่ง',shopName:'ชื่อร้าน',contactPersonName:'ผู้ติดต่อ',address:'ที่อยู่',phone:'โทรศัพท์',taxId:'เลขผู้เสียภาษี 13 หลัก',fiscalYearBE:'ปีงบประมาณ',yearBE:'ปี พ.ศ.',planName:'แผนงาน',workName:'งาน',categoryGroup:'หมวดรายจ่าย',categoryType:'ประเภทรายจ่าย',allocatedAmount:'วงเงินตั้งไว้',transferInAmount:'โอนเพิ่ม',transferOutAmount:'โอนลด',description:'รายละเอียดสินค้า',quantity:'จำนวน',unit:'หน่วย',unitPrice:'ราคาต่อหน่วย',purposeText:'เหตุผลและความจำเป็น',budgetSpentBefore:'เบิกแล้วก่อนรายการนี้',date:'วันที่',runningNo:'เลขที่หนังสือ',deliveryDays:'จำนวนวันส่งมอบ',penaltyRatePercent:'อัตราค่าปรับ',minPenaltyPerDay:'ค่าปรับขั้นต่ำ',deliveryDate:'วันที่ส่งมอบจริง',smeExpiryDate:'วันหมดอายุ SME'};
  const parts=path.split('.'),last=parts.at(-1)!,prefix=parts[0]==='signatories'?SIGNATORIES[parts[1] as keyof typeof SIGNATORIES]:parts[0]==='items'?`รายการ ${Number(parts[1])+1}`:parts[0]==='inspectors'?`ผู้ตรวจรับ ${Number(parts[1])+1}`:parts[0]==='docs'?`เอกสาร ${TIMELINE.find(r=>r[1]===parts[1])?.[0]??'LAAS / e-GP'}`:parts[0]==='vendor'?'ร้านค้า':parts[0]==='budgetLine'?'งบประมาณ':'';
  return [prefix,fields[last]??'ข้อมูลหลัก'].filter(Boolean).join(' · ');
}
export function cloneCaseSafely(source:StoredCase):StoredCase {
  const result=structuredClone(source),blank=newCase();result.caseInput.id=crypto.randomUUID();result.caseInput.docs=blank.caseInput.docs;result.caseInput.attachments={photoPaths:[]};result.caseInput.inspectionResult={isCorrect:true,isComplete:true,hasPenalty:false};result.caseInput.budgetSpentBefore=0;result.version=0;result.updatedAt='';result.dueAcknowledged=false;result.tracker=defaultCaseTracker();result.externalFiles=[];return result;
}
export function registryEntries(input:DraftCase):RegistryEntry[]{
  return TIMELINE.flatMap(([,key,, ,track])=>{const row=input.docs[key],runningNo=key==='doc8_winnerAnnouncement'?input.docs.doc8_winnerAnnouncement.registryLogNo:('runningNo' in row?row.runningNo:undefined),yearBE=key==='doc10_purchaseOrder'?input.docs.doc10_purchaseOrder.fiscalYearBE:key==='doc6_2_inspectorOrder'?input.docs.doc6_2_inspectorOrder.yearBE:row.date?Number(row.date.slice(0,4))+543:undefined;return runningNo&&/^\d+$/.test(runningNo)&&yearBE?[{track,yearBE,runningNo}]:[];});
}
export function suggestNumbers(input:DraftCase,registry:RegistryEntry[]){
  const result=structuredClone(input),used=[...registry,...registryEntries(input)];
  for(const [,key,,,track] of TIMELINE){
    const row=result.docs[key],f=key==='doc8_winnerAnnouncement'?'registryLogNo':'runningNo',record=row as Record<string,string|number|undefined>;
    if(record[f])continue;
    const year=key==='doc10_purchaseOrder'?(result.docs.doc10_purchaseOrder.fiscalYearBE??result.budgetLine.fiscalYearBE):key==='doc6_2_inspectorOrder'?(result.docs.doc6_2_inspectorOrder.yearBE??(row.date?Number(row.date.slice(0,4))+543:undefined)):row.date?Number(row.date.slice(0,4))+543:undefined;
    if(!year)continue;const runningNo=suggestNextNumber(used,track,year);record[f]=runningNo;used.push({track,yearBE:year,runningNo});
  }return result;
}
export function smartTimeline(input:DraftCase){
  const result=structuredClone(input),start=result.docs.doc1_approvePrinciple.date;
  if(!start)throw Error('กรอกวันเริ่มต้นของเอกสาร 1 ก่อน');
  let prior=start;
  for(const [,key,,stage] of TIMELINE){const row=result.docs[key];if(!row.date){const target=stage===1?prior:stage===2?result.docs.doc3_reportSpec.date!:stage===3?addCalendarDays(result.docs.doc10_purchaseOrder.date!,result.deliveryDays):result.docs.doc12_finalSummary.date!;row.date=nextWorkingDay(target>prior?target:prior);}prior=row.date;}
  result.docs.laasDate ||= result.docs.doc6_1_purchaseRequest.date;
  result.docs.doc6_2_inspectorOrder.yearBE ||= Number(result.docs.doc6_2_inspectorOrder.date!.slice(0,4))+543;
  result.docs.doc10_purchaseOrder.fiscalYearBE ||= result.budgetLine.fiscalYearBE;
  return result;
}
