import { z } from "zod";
import { templates, type DocumentType } from "./templates";
const text = z.string().max(2000).default("");
export const documentSchema = z.object({
  type: z.enum(templates.map(t => t.id) as [DocumentType, ...DocumentType[]]),
  subject: z.string().trim().min(1, "กรุณาระบุเรื่อง").max(300),
  number: text, date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => {
    const d = new Date(v + "T00:00:00Z"); return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v && +v.slice(0,4) >= 1900 && +v.slice(0,4) < 2200;
  }, "วันที่ไม่ถูกต้อง (บันทึกปี ค.ศ. และแสดงผลเป็น พ.ศ.)"),
  organization: text, department: text, address: text, phone: text, email: text,
  salutation: z.string().max(80).default("เรียน"), recipient: text, reference: text, attachments: text, copies: text,
  attachmentFiles: z.array(z.object({originalAvailable:z.boolean().default(false),id:z.string().uuid(),name:z.string().min(1).max(240),description:z.string().trim().min(1).max(300),pages:z.number().int().positive().max(200),bytes:z.number().int().positive().max(15*1024*1024),quantity:z.number().int().min(1).max(999).default(1),unit:z.enum(["ฉบับ","ชุด","แผ่น"]).default("ฉบับ")})).max(10).default([]),
  attachmentPhrase: z.enum(["ตามเอกสารที่แนบมาพร้อมนี้","รายละเอียดตามเอกสารแนบ","พร้อมนี้ได้แนบเอกสารประกอบการพิจารณา"]).default("ตามเอกสารที่แนบมาพร้อมนี้"),
  body: z.string().max(40000).default(""), closing: z.string().max(200).default("ขอแสดงความนับถือ"),
  layout:z.enum(['standard','budget-reference']).default('standard'),
  contentBlocks:z.array(z.object({kind:z.enum(['paragraph','heading','line','budget-money','budget-detail','budget-spec']),label:z.string().max(100).default(''),text:z.string().max(10000)})).max(500).default([]),
  signer: text, position: text,
  numeralStyle: z.enum(["original", "thai", "arabic"]).default("original"),
  copyMark: z.enum(["none", "สำเนา", "สำเนาคู่ฉบับ"]).default("none"),
  productionMark: z.boolean().default(false), drafter: text, typist: text, checker: text,
  bodyMode: z.enum(["free", "structured"]).default("free"),
  background: z.string().max(10000).default(""), legalBasis: z.string().max(10000).default(""),
  consideration: z.string().max(10000).default(""), proposal: z.string().max(10000).default(""),
  sectionHeadings: z.boolean().default(true),
  memoGuides: z.boolean().default(true),
  proposers: z.array(z.object({name:text,position:text})).max(5).default([]),
  opinions: z.array(z.object({title:text,comment:z.string().max(3000).default(""),name:text,position:text,lines:z.number().int().min(2).max(3).default(3)})).max(5).default([]),
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
export type SavedDraft = Draft & { id: string; version: number; createdAt: string; updatedAt: string; driveFileId: string | null; syncedVersion: number | null };
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
export function reviewIssues(d: Draft): string[] {
  const issues: string[] = [];
  if (!d.organization.trim()) issues.push("ระบุส่วนราชการเจ้าของหนังสือ");
  if (!bodySections(d).some(s=>s.text.trim())) issues.push("ระบุเนื้อหาหนังสือ");
  if (d.proposers.some(p=>!p.name.trim()||!p.position.trim())) issues.push("ระบุชื่อและตำแหน่งผู้เสนอเพิ่มเติมให้ครบ");
  if (d.opinions.some(p=>!p.title.trim())) issues.push("ระบุหัวข้อความเห็นทุกส่วน");
  if (d.confidentiality!=="ปกติ"&&d.secretSetNumber>d.secretSetTotal) issues.push("เลขที่ชุดต้องไม่เกินจำนวนชุดทั้งหมด");
  if (["external", "internal", "stamped", "memorandum"].includes(d.type) && !d.recipient.trim()) issues.push("ระบุผู้รับหนังสือ");
  if (["external", "internal", "stamped", "order", "certificate"].includes(d.type) && !d.number.trim()) issues.push("ตรวจและระบุเลขที่หนังสือจากทะเบียนของหน่วยงาน");
  if (!["stamped", "news", "statement", "minutes", "other"].includes(d.type)) {
    if (!d.signer.trim()) issues.push("ระบุชื่อผู้ลงนาม");
    if (!d.position.trim()) issues.push("ระบุตำแหน่งผู้ลงนาม");
  }
  if (d.type === "external" && !d.address.trim()) issues.push("ระบุที่อยู่ส่วนราชการ");
  if (d.type === "external" && !d.closing.trim()) issues.push("ตรวจคำลงท้ายตามฐานะผู้รับ");
  if (d.type === "minutes") {
    for (const [field, label] of [["meetingNo", "ครั้งที่ประชุม"], ["location", "สถานที่ประชุม"], ["attendees", "ผู้มาประชุม"], ["startTime", "เวลาเริ่มประชุม"], ["endTime", "เวลาเลิกประชุม"], ["recorder", "ผู้จดรายงานการประชุม"]] as const) if (!d[field].trim()) issues.push("ระบุ" + label);
  }
  return issues;
}
export const statusLabels = { draft: "ฉบับร่าง", reviewed: "ตรวจทานแล้ว" };
export function numerals(value:string,style:Draft["numeralStyle"]) {
  if(style==="original") return value;
  const latin=value.replace(/[๐-๙]/g,c=>String("๐๑๒๓๔๕๖๗๘๙".indexOf(c)));
  return style==="arabic"?latin:latin.replace(/[0-9]/g,c=>"๐๑๒๓๔๕๖๗๘๙"[Number(c)]);
}
export function bodySections(d:Draft) { return d.bodyMode==="free"?[{title:"",text:d.body}]:[
  {title:"เรื่องเดิม / ข้อเท็จจริง",text:d.background},{title:"ข้อกฎหมาย / ระเบียบที่เกี่ยวข้อง",text:d.legalBasis},
  {title:"ข้อพิจารณา",text:d.consideration},{title:"ข้อเสนอ / ข้อสรุป",text:d.proposal}]; }
