import {z} from 'zod';
export const defaultThaiPairs=['ข้อเท็จจริง','ข้อพิจารณา','ข้อเสนอแนะ','งบประมาณ','ปีงบประมาณ','ดำเนินการ','พิจารณา','อนุมัติ','อนุญาต','สำนักงาน','ส่วนราชการ','หน่วยงาน','นายกเทศมนตรี','ปลัดเทศบาล','หัวหน้าสำนักปลัด','เครื่องปรับอากาศ','กล้องวีดิทัศน์','วัสดุสำนักงาน','ทรัพย์สิน','ครุภัณฑ์'];
export const commonThaiCorrections:Record<string,string>={'อนุญาติ':'อนุญาต','สังเกตุ':'สังเกต','กฏหมาย':'กฎหมาย','กระเพรา':'กะเพรา','ผูกพันธ์':'ผูกพัน','คำนวน':'คำนวณ'};
export const thaiTermSchema=z.object({
 word:z.string().trim().min(1,'ระบุคำหรือคำคู่').max(80,'ใช้คำหรือวลีสั้น ๆ ไม่เกิน 80 ตัวอักษร').refine(s=>!/[\r\n\t\u200b\u2060<>]/.test(s),'ใช้คำบรรทัดเดียว ไม่ใส่เครื่องหมาย < > หรืออักขระซ่อน'),
 keepTogether:z.boolean().default(true),
 correction:z.string().trim().max(80).default('').refine(s=>!/[\r\n\t\u200b\u2060<>]/.test(s),'คำแนะนำต้องอยู่บรรทัดเดียว')
}).refine(d=>!d.correction||d.word!==d.correction,'คำที่แนะนำต้องต่างจากคำเดิม');
export type ThaiTermInput=z.infer<typeof thaiTermSchema>;
export type ThaiTerm=ThaiTermInput&{id:string;version:number;updatedAt:string};
export const thaiDictionarySql='id TEXT PRIMARY KEY,word TEXT NOT NULL UNIQUE,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL';
export function thaiKeepTerms(entries:ThaiTermInput[]){return [...new Set([...defaultThaiPairs.filter(word=>!entries.some(e=>e.word===word)),...entries.filter(e=>e.keepTogether&&!e.correction).map(e=>e.word)])].sort((a,b)=>b.length-a.length);}
export function wordJoin(text:string){return Array.from(new Intl.Segmenter('th',{granularity:'grapheme'}).segment(text),s=>s.segment).join('\u2060');}
