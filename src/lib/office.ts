import { z } from "zod";
import {projectProfileSchema,stageSchema} from './project';
import {taskTrackingFields} from './task-progress';
export const officeKinds = { incoming: "ทะเบียนหนังสือรับ", outgoing: "ทะเบียนหนังสือส่ง", task: "งานและกำหนดส่ง", meeting: "การประชุม", contact: "ทำเนียบหน่วยงาน", supplies: "วัสดุสำนักงาน", archive: "ดัชนีแฟ้มเอกสาร", project: "โครงการประจำปี" } as const;
export type OfficeKind = keyof typeof officeKinds;
const short = z.string().trim().max(500).default("");
const date = z.union([z.literal(""),z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v);return !isNaN(+d)&&d.toISOString().slice(0,10)===v;})]).default("");
export const officeSchema = z.object({
  ...taskTrackingFields,
  kind:z.enum(["incoming","outgoing","task","meeting","contact","supplies","archive","project"]),
  title:z.string().trim().min(1,"กรุณาระบุชื่อเรื่อง").max(300),
  number:short, party:short, owner:short, date, due:date,
  status:z.enum(["new","working","waiting","done"]).default("new"),
  priority:z.enum(["normal","urgent"]).default("normal"),
  notes:z.string().max(20000).default(""),
  documentId:z.union([z.literal(""),z.string().uuid()]).default(""),
  url:z.union([z.literal(""),z.string().url().refine(v=>/^https?:\/\//.test(v),"ใช้ลิงก์ http หรือ https เท่านั้น")]).default(""),
  // Shared task/project metadata. Defaults keep existing office records readable.
  projectId:z.union([z.literal(""),z.string().uuid()]).default(""),
  fiscalYear:z.number().int().refine(v=>v===0||(v>=2400&&v<=2800),"ปีงบประมาณไม่ถูกต้อง").default(0),
  annual:z.boolean().default(false), archived:z.boolean().default(false),
  completedAt:z.union([z.literal(""),z.string().datetime()]).default(""),
  originId:z.union([z.literal(""),z.string().uuid()]).default(""),
  sortOrder:z.number().int().min(0).max(1000000).default(0),
  budget:z.number().finite().min(0).max(1e12).default(0),
  projectProfile:projectProfileSchema.optional(),
  taskStage:stageSchema.default('planning'),
  required:z.boolean().default(false),evidenceRequired:z.boolean().default(false),
  notApplicable:z.boolean().default(false),exclusionReason:z.string().trim().max(2000).default(''),
  checklistKey:z.string().max(100).default(''),
  quantity:z.number().min(0).max(100000000).default(0), minimum:z.number().min(0).max(100000000).default(0), unit:short,
});
export type OfficeInput=z.infer<typeof officeSchema>;
export type OfficeItem=OfficeInput & {id:string;version:number;updatedAt:string};
export const officeStatuses={new:"รับเรื่อง / ยังไม่เริ่ม",working:"กำลังดำเนินการ",waiting:"รอผล / รอประสาน",done:"เสร็จสิ้น"};
export const routineTasks=["ตรวจหนังสือเข้าและช่องทางรับเรื่อง","ลงทะเบียนและเสนอผู้บังคับบัญชา","ติดตามหนังสือที่ใกล้ครบกำหนด","ตรวจความครบถ้วนก่อนส่งหนังสือ","จัดแฟ้มและตรวจไฟล์สำรอง"];
