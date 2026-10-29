import { z } from "zod";
import {torDetailSections} from "./minutes-presets";
import { templates, type DocumentType } from "./templates";
const text = z.string().max(2000).default("");
export const documentSchema = z.object({
  type: z.enum(templates.map(t => t.id) as [DocumentType, ...DocumentType[]]),
  subject: z.string().trim().min(1, "กรุณาระบุเรื่อง").max(300),
  number: text, date: z.string().refine(v => {
    if (v === "") return true; // Keep older in-progress drafts readable; review still requires a valid date.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    const d = new Date(v + "T00:00:00Z"); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && +v.slice(0,4) >= 1900 && +v.slice(0,4) < 2200;
  }, "วันที่ไม่ถูกต้อง (บันทึกปี ค.ศ. และแสดงผลเป็น พ.ศ.)").default(""),
  organization: text, department: text, address: text, phone: text, email: text,
  salutation: z.string().max(80).default("เรียน"), recipient: text, reference: text, attachments: text, copies: text,
  additionalEnclosures: z.string().max(2000).default(""),
  attachmentFiles: z.array(z.object({originalAvailable:z.boolean().default(false),id:z.string().uuid(),name:z.string().min(1).max(240),description:z.string().trim().min(1).max(300),showNameInDocument:z.boolean().default(true),pages:z.number().int().positive().max(200),bytes:z.number().int().positive().max(15*1024*1024),quantity:z.number().int().min(1).max(999).default(1),unit:z.enum(["ฉบับ","ชุด","แผ่น"]).default("ฉบับ")})).max(10).default([]),
  attachmentPhrase: z.enum(["ตามเอกสารที่แนบมาพร้อมนี้","รายละเอียดตามเอกสารแนบ","พร้อมนี้ได้แนบเอกสารประกอบการพิจารณา"]).default("ตามเอกสารที่แนบมาพร้อมนี้"),
  appendixTitle: z.string().trim().max(200).default(""),
  appendixLayout: z.enum(["auto","stack","columns"]).default("auto"),
  appendixPages: z.array(z.object({id:z.string().uuid(),title:z.string().max(200).default(''),body:z.string().max(20000).default('')})).max(20).default([]),
  appendixImages: z.array(z.object({id:z.string().uuid(),name:z.string().min(1).max(240),mime:z.enum(["image/png","image/jpeg"]),bytes:z.number().int().positive().max(10*1024*1024),width:z.number().int().positive().max(30000),height:z.number().int().positive().max(30000),caption:z.string().max(500).default(""),widthMm:z.number().min(30).max(180).default(150)})).max(20).default([]),
  floatingItems: z.array(z.discriminatedUnion("kind",[
    z.object({kind:z.literal("text"),id:z.string().uuid(),page:z.number().int().min(1).max(100),xMm:z.number().min(0).max(195),yMm:z.number().min(0).max(285),widthMm:z.number().min(10).max(190),fontPt:z.number().min(8).max(48),bold:z.boolean().default(false),text:z.string().max(4000)}),
    z.object({kind:z.literal("image"),purpose:z.literal("signature").optional(),id:z.string().uuid(),page:z.number().int().min(1).max(100),xMm:z.number().min(0).max(195),yMm:z.number().min(0).max(285),widthMm:z.number().min(10).max(180),image:z.object({id:z.string().uuid(),name:z.string().min(1).max(240),mime:z.enum(["image/png","image/jpeg"]),bytes:z.number().int().positive().max(10*1024*1024),width:z.number().int().positive().max(30000),height:z.number().int().positive().max(30000)})}),
  ])).max(30).default([]),
  body: z.string().max(40000).default(""), closing: z.string().max(200).default("ขอแสดงความนับถือ"),
  layout:z.enum(['standard','budget-reference']).default('standard'),
  firstPageTop:z.enum(['15','25']).default('15'),
  memoEmblem:z.boolean().default(false),
  orderReceivedBy:z.string().max(200).default(''),
  certificatePhotoArea:z.boolean().default(false),
  certificateRecipient:text,
  minutesMode:z.enum(['free','agenda']).default('free'),
  minutesPreset:z.enum(['general','tor-purchase','tor-service']).default('general'),
  minutesTitle:z.string().max(300).default(''),
  minutesAttendanceMode:z.enum(['text','table']).default('text'),
  meetingMembers:z.array(z.object({name:z.string().max(300),position:z.string().max(500),role:z.string().max(200),status:z.enum(['present','absent','participant']),note:z.string().max(1000)})).max(60).default([]),
  recorderPosition:z.string().max(500).default(''),
  recorderRole:z.string().max(200).default('ผู้จดรายงานการประชุม'),
  meetingSigners:z.array(z.object({name:z.string().max(300),position:z.string().max(500),role:z.string().max(200)})).max(20).default([]),
  minutesTor:z.object({
    appointmentNumber:z.string().max(200).default(''),appointmentDate:z.string().max(10).refine(v=>!v||(/^\d{4}-\d{2}-\d{2}$/.test(v)&&!isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v),'วันที่คำสั่งไม่ถูกต้อง').default(''),
    authority:z.string().max(500).default(''),budget:z.string().max(500).default(''),priceReference:z.string().max(2000).default(''),
    sections:z.array(z.object({title:z.string().max(300),body:z.string().max(20000)})).max(30).default([])
  }).default({appointmentNumber:'',appointmentDate:'',authority:'',budget:'',priceReference:'',sections:[]}),
  minutesIntroduction:z.string().max(10000).default(''),
  meetingAgenda:z.array(z.object({
    title:z.string().max(300).default(''),
    discussion:z.string().max(10000).default(''),
    torDetails:z.boolean().optional(),
    speeches:z.array(z.object({speaker:z.string().max(300),role:z.string().max(200),text:z.string().max(10000)})).max(50).optional(),
    resolution:z.string().max(5000).default(''),
    resolutionLabel:z.enum(['มติที่ประชุม','ข้อยุติ','ข้อสรุป']).default('มติที่ประชุม'),
  })).max(50).default([]),
  contentBlocks:z.array(z.object({kind:z.enum(['paragraph','heading','line','budget-money','budget-detail','budget-spec']),label:z.string().max(100).default(''),text:z.string().max(10000)})).max(500).default([]),
  signer: text, position: text,
  numeralStyle: z.enum(["original", "thai", "arabic"]).default("original"),
  copyMark: z.enum(["none", "สำเนา", "สำเนาคู่ฉบับ"]).default("none"),
  productionMark: z.boolean().default(false), drafter: text, typist: text, checker: text,
  bodyMode: z.enum(["free", "structured"]).default("free"),
  background: z.string().max(20001).default(""), legalBasis: z.string().max(10000).default(""), facts: z.string().max(10000).default(""),
  consideration: z.string().max(10000).default(""), proposal: z.string().max(10000).default(""),
  sectionHeadings: z.boolean().default(true),
  memoGuides: z.boolean().default(true),
  proposers: z.array(z.object({name:text,position:text})).max(5).default([]),
  opinions: z.array(z.object({title:text,comment:z.string().max(3000).default(""),name:text,position:text,showDate:z.boolean().default(true),lines:z.number().int().min(1).max(3).default(3)})).max(5).default([]),
  legalReferenceIds: z.array(z.string().uuid()).max(30).default([]),
  urgency: z.enum(["ปกติ", "ด่วน", "ด่วนมาก", "ด่วนที่สุด"]).default("ปกติ"),
  confidentiality: z.enum(["ปกติ", "ลับ", "ลับมาก", "ลับที่สุด"]).default("ปกติ"),
  secretSetNumber: z.number().int().min(1).max(9999).default(1),
  secretSetTotal: z.number().int().min(1).max(9999).default(1),
  yearMode: z.enum(["calendar", "fiscal"]).default("fiscal"),
  status: z.enum(["draft", "reviewed"]).default("draft"),
  meetingNo: text, location: text, attendees: text, absentees: text, participants: text,
  startTime: text, endTime: text, recorder: text, effectiveDate: text,
});
export type Draft = z.infer<typeof documentSchema>;
export type SavedDraft = Draft & { id: string; version: number; createdAt: string; updatedAt: string; driveFileId: string | null; syncedVersion: number | null; signedScanCount: number };
export function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
export function newDraft(type: DocumentType = "external"): Draft {
  return documentSchema.parse({ type, subject: "ร่างหนังสือใหม่", date: today() });
}
export function thaiDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const d = new Date(value + "T00:00:00+07:00");
  return isNaN(d.getTime()) ? "" : new Intl.DateTimeFormat("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "long", year: "numeric" }).format(d).replace("พ.ศ. ", "");
}
export function documentYear(date: string, mode: "calendar" | "fiscal") {
  const [year, month] = date.split("-").map(Number);
  return year + 543 + (mode === "fiscal" && month >= 10 ? 1 : 0);
}
export type DocumentCheck={id:string;section:string;label:string;complete:boolean};
export const NUMBER_REQUIRED_ISSUE="ตรวจและระบุเลขที่หนังสือจากทะเบียนของหน่วยงาน";
/** ใช้เกณฑ์เดียวกันสำหรับเปอร์เซ็นต์ หน้าตรวจทาน และการส่ง Drive; ช่องถ้ามีไม่นับจนเริ่มเพิ่มรายการ */
export function documentChecks(d:Draft):DocumentCheck[]{
 const checks:DocumentCheck[]=[];
 const check=(section:string,label:string,complete:unknown)=>checks.push({id:label,section,label,complete:!!complete});
 check('header','ระบุเรื่องหนังสือ',d.subject.trim());
 check('header','ระบุวันที่หนังสือก่อนตรวจทานและส่งออก',d.date);
 check(d.type==='stamped'?'signing':'header','ระบุส่วนราชการเจ้าของหนังสือ',d.organization.trim());
 check('body','ระบุเนื้อหาหนังสือ',bodySections(d).some(s=>s.text.trim()));
 if(d.proposers.length)check('signing','ระบุชื่อและตำแหน่งผู้เสนอเพิ่มเติมให้ครบ',d.proposers.every(p=>p.name.trim()&&p.position.trim()));
 if(d.opinions.length)check('signing','ระบุหัวข้อความเห็นทุกส่วน',d.opinions.every(p=>p.title.trim()));
 if(d.confidentiality!=='ปกติ')check('header','เลขที่ชุดต้องไม่เกินจำนวนชุดทั้งหมด',d.secretSetNumber<=d.secretSetTotal);
 if(['external','internal','stamped','memorandum'].includes(d.type))check('header','ระบุผู้รับหนังสือ',d.recipient.trim());
 if(['external','internal','stamped','order','certificate'].includes(d.type))check('header',NUMBER_REQUIRED_ISSUE,d.number.trim());
 if(!['stamped','news','statement','minutes','other'].includes(d.type)){
  check('signing','ระบุชื่อผู้ลงนาม',d.signer.trim());check('signing','ระบุตำแหน่งผู้ลงนาม',d.position.trim());
 }
 if(d.type==='external'){
  check('header','ระบุที่อยู่ส่วนราชการ',d.address.trim());check('signing','ตรวจคำลงท้ายตามฐานะผู้รับ',d.closing.trim());
 }
 if(d.type==='minutes'){
  if(d.minutesMode==='agenda'){
   check('body','เพิ่มอย่างน้อยหนึ่งวาระการประชุม',d.meetingAgenda.length);
   for(const [i,a] of d.meetingAgenda.entries()){
    check('body',`วาระที่ ${i+1}: ระบุหัวข้อและข้ออภิปราย`,a.title.trim()&&(a.discussion.trim()||a.speeches?.some(s=>s.text.trim())||(a.torDetails&&d.minutesTor.sections.some(s=>s.body.trim()))));
    for(const [j,s] of (a.speeches||[]).entries())check('body',`วาระที่ ${i+1} ผู้พูดที่ ${j+1}: ระบุชื่อและบทพูด`,s.speaker.trim()&&s.text.trim());
   }
   if(d.meetingAgenda.some(a=>a.torDetails))for(const [i,s] of d.minutesTor.sections.entries())check('body',`TOR หัวข้อที่ ${i+1}: ระบุหัวข้อและรายละเอียด`,s.title.trim()&&s.body.trim());
  }
  if(d.minutesAttendanceMode==='table'){
   check('attendees','เพิ่มผู้มาประชุมอย่างน้อยหนึ่งคนในตาราง',d.meetingMembers.some(m=>m.status==='present'&&m.name.trim()));
   for(const [i,m] of d.meetingMembers.entries())check('attendees',`ผู้เข้าประชุมที่ ${i+1}: ระบุชื่อและตำแหน่ง`,m.name.trim()&&m.position.trim());
  }else check('attendees','ระบุผู้มาประชุม',d.attendees.trim());
  for(const [i,m] of d.meetingSigners.entries())check('signing',`ผู้ลงนามท้ายรายงานที่ ${i+1}: ระบุชื่อและบทบาท`,m.name.trim()&&m.role.trim());
  for(const [field,label,section] of [['meetingNo','ครั้งที่ประชุม','header'],['location','สถานที่ประชุม','header'],['startTime','เวลาเริ่มประชุม','attendees'],['endTime','เวลาเลิกประชุม','signing'],['recorder','ผู้จดรายงานการประชุม','signing']] as const)check(section,'ระบุ'+label,d[field].trim());
 }
 if(d.type==='certificate'&&d.certificatePhotoArea)check('signing','ระบุชื่อผู้ได้รับการรับรองใต้ช่องรูปถ่าย',d.certificateRecipient.trim());
 return checks;
}
export function reviewIssues(d:Draft):string[]{return documentChecks(d).filter(c=>!c.complete).map(c=>c.label);}
/** อนุญาตเฉพาะขาดเลขทะเบียนอย่างเดียว ต้องเลือกยืนยันเอง และยังเป็นฉบับร่าง */
export function canUploadUnnumberedDraft(d:Draft){const issues=reviewIssues(d);return d.confidentiality==='ปกติ'&&!d.number.trim()&&issues.length===1&&issues[0]===NUMBER_REQUIRED_ISSUE;}
export function driveUploadAllowed(d:Draft,allowUnnumberedDraft=false){return d.confidentiality==='ปกติ'&&((d.status==='reviewed'&&reviewIssues(d).length===0)||(allowUnnumberedDraft&&canUploadUnnumberedDraft(d)));}
export const statusLabels = { draft: "ฉบับร่าง", reviewed: "ตรวจทานแล้ว" };
export function numerals(value:string,style:Draft["numeralStyle"]) {
  if(style==="original") return value;
  const latin=value.replace(/[๐-๙]/g,c=>String("๐๑๒๓๔๕๖๗๘๙".indexOf(c)));
  return style==="arabic"?latin:latin.replace(/[0-9]/g,c=>"๐๑๒๓๔๕๖๗๘๙"[Number(c)]);
}
export type BodySection={title:string;text:string;speaker?:{name:string;role:string}};
export function bodySections(d:Draft):BodySection[] {
  if(d.type==='minutes'&&d.minutesMode==='agenda') return [
    ...((d.minutesTor.appointmentNumber||d.minutesTor.appointmentDate||d.minutesTor.authority||d.minutesTor.budget||d.minutesTor.priceReference)&&d.meetingAgenda.some(a=>a.torDetails)?[{title:'ข้อมูลประกอบการพิจารณา',text:[d.minutesTor.appointmentNumber?'คำสั่งแต่งตั้งเลขที่ '+d.minutesTor.appointmentNumber:'',d.minutesTor.appointmentDate?'ลงวันที่ '+thaiDate(d.minutesTor.appointmentDate):'',d.minutesTor.authority?'ผู้แต่งตั้ง / หน่วยงาน '+d.minutesTor.authority:'',d.minutesTor.budget?'วงเงินงบประมาณ '+d.minutesTor.budget:'',d.minutesTor.priceReference?'แหล่งอ้างอิงราคา / มาตรฐาน '+d.minutesTor.priceReference:''].filter(Boolean).join('\n')}]:[]),
    {title:'',text:d.minutesIntroduction},
    ...d.meetingAgenda.flatMap((a,i)=>[
      {title:`ระเบียบวาระที่ ${i+1}  ${a.title}`,text:a.discussion},
      ...(a.torDetails?torDetailSections(d):[]),
      ...(a.speeches||[]).map(s=>({speaker:{name:s.speaker,role:s.role},title:[s.role,s.speaker?'('+s.speaker+')':''].filter(Boolean).join(' '),text:s.text})),
      ...(a.resolution.trim()?[{title:a.resolutionLabel,text:a.resolution}]:[]),
    ]),
  ];
  return d.bodyMode==="free"?[{title:"",text:d.body}]:[
  {title:"เรื่องเดิม",text:d.background},
  {title:"ข้อเท็จจริง",text:d.facts},
  {title:"ข้อระเบียบ/กฎหมาย",text:d.legalBasis},
  {title:"ข้อพิจารณา",text:d.consideration},
  {title:"",text:d.proposal}]; }
