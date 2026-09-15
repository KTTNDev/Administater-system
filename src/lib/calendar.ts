import { z } from "zod";
export const eventKinds={meeting:"ประชุม",visit:"ศึกษาดูงาน",training:"อบรม / สัมมนา",appointment:"นัดหมาย",deadline:"กำหนดส่งงาน"} as const;
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v=>{const d=new Date(v);return Number.isFinite(+d)&&d.toISOString().slice(0,10)===v;},"วันที่ไม่ถูกต้อง");
export const calendarSchema=z.object({
 title:z.string().trim().min(1,"กรุณาระบุเรื่อง").max(300),kind:z.enum(["meeting","visit","training","appointment","deadline"]),
 date,endDate:date,allDay:z.boolean(),start:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),end:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
 location:z.string().max(500),owner:z.string().max(300),notes:z.string().max(20000),
 documentId:z.union([z.literal(""),z.string().uuid()]),sourceOfficeId:z.union([z.literal(""),z.string().uuid()]),
 attachments:z.array(z.object({name:z.string().trim().min(1).max(200),url:z.string().url().refine(v=>/^https?:\/\//i.test(v),"ใช้ลิงก์ http หรือ https เท่านั้น")})).max(10),
 status:z.enum(["scheduled","done","cancelled"]),
}).refine(v=>v.endDate>=v.date,"วันสิ้นสุดต้องไม่ก่อนวันเริ่ม").refine(v=>v.allDay||v.endDate>v.date||v.end>v.start,"เวลาสิ้นสุดต้องหลังเวลาเริ่ม");
export type CalendarInput=z.infer<typeof calendarSchema>;
export type CalendarEvent=CalendarInput&{id:string;version:number};
export function blankEvent(date:string):CalendarInput{return {title:"",kind:"meeting",date,endDate:date,allDay:false,start:"09:00",end:"10:00",location:"",owner:"",notes:"",documentId:"",sourceOfficeId:"",attachments:[],status:"scheduled"};}
export function onDay(e:Pick<CalendarInput,"date"|"endDate">,day:string){return e.date<=day&&e.endDate>=day;}
