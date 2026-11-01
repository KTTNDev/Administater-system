import {z} from 'zod';
import type {OfficeItem} from './office';

// Shared by the editor, completeness checks and report exporters.
export const projectStages={planning:'ที่มาและแผนงาน',approval:'เสนออนุมัติ',preparation:'เตรียมงาน',delivery:'ดำเนินงาน',finance:'การเงินและหลักฐาน',evaluation:'ประเมินและสรุปผล'} as const;
export type ProjectStage=keyof typeof projectStages;
export const stageSchema=z.enum(['planning','approval','preparation','delivery','finance','evaluation']);
const text=z.string().trim().max(20000).default('');
export const projectProfileSchema=z.object({
  category:z.enum(['general','training','public']).default('general'),
  department:text,rationale:text,authority:text,alignment:text,objectives:text,targetGroup:text,
  location:text,method:text,budgetSource:text,budgetDetail:text,approval:text,outputs:text,outcomes:text,
  evaluation:text,problems:text,recommendations:text,reviewer:text,reviewNote:text,
  actualBudget:z.number().finite().min(0).max(1e12).nullable().default(null),
  indicators:z.array(z.object({id:z.string().uuid(),label:z.string().trim().min(1).max(300),target:z.number().finite().min(0),actual:z.number().finite().min(0).nullable(),unit:z.string().max(100),method:z.string().max(1000)})).max(50).default([]),
});
export type ProjectProfile=z.infer<typeof projectProfileSchema>;
export const projectFields=[
  ['rationale','หลักการและเหตุผล','planning'],['authority','อำนาจหน้าที่และระเบียบที่ใช้','planning'],['alignment','ความเชื่อมโยงแผนพัฒนา / แผนงาน','planning'],['objectives','วัตถุประสงค์','planning'],['targetGroup','กลุ่มเป้าหมายและจำนวน','planning'],['location','สถานที่ดำเนินงาน','planning'],
  ['approval','การเสนอและอนุมัติโครงการ / เลขที่หนังสือ','approval'],['method','วิธีดำเนินงานและกำหนดการ','preparation'],['outputs','ผลผลิต / กิจกรรมที่ดำเนินการจริง','delivery'],['budgetSource','แหล่งงบประมาณ','finance'],['budgetDetail','รายละเอียดงบประมาณและค่าใช้จ่ายจริง','finance'],['outcomes','ผลลัพธ์และประโยชน์ที่เกิดขึ้น','evaluation'],['evaluation','วิธีประเมินและผลการประเมิน','evaluation'],['problems','ปัญหาและอุปสรรค','evaluation'],['recommendations','ข้อเสนอแนะและการติดตามต่อ','evaluation'],
] as const;
export type ProjectField=typeof projectFields[number][0];
export type ProjectFile={id:string;projectId:string;taskId:string;stage:ProjectStage;name:string;mime:string;bytes:number;caption:string;includeInReport:boolean;createdAt:string};
export const projectFilesSql='id TEXT PRIMARY KEY,project_id TEXT NOT NULL,task_id TEXT NOT NULL,stage TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,file BLOB NOT NULL,caption TEXT NOT NULL,include_report INTEGER NOT NULL,created_at TEXT NOT NULL';

// These are editable review prompts, not an automatic legal approval.
export const projectChecklist:readonly {key:string;stage:ProjectStage;title:string;evidence:boolean}[]=[
 {key:'authority',stage:'planning',title:'ตรวจอำนาจหน้าที่ แผนพัฒนา และแหล่งงบประมาณ',evidence:true},
 {key:'proposal',stage:'approval',title:'จัดทำและเสนอขออนุมัติโครงการ',evidence:true},
 {key:'assignment',stage:'preparation',title:'กำหนดผู้รับผิดชอบ กำหนดการ และประสานผู้เกี่ยวข้อง',evidence:true},
 {key:'procurement',stage:'preparation',title:'ตรวจว่ามีการจัดซื้อจัดจ้าง / จัดเตรียมวัสดุหรือไม่',evidence:true},
 {key:'activity',stage:'delivery',title:'ดำเนินกิจกรรม เก็บรายชื่อผู้เข้าร่วมและภาพประกอบ',evidence:true},
 {key:'payment',stage:'finance',title:'ตรวจหลักฐานค่าใช้จ่าย การเบิกจ่าย และเงินยืม (ถ้ามี)',evidence:true},
 {key:'evaluation',stage:'evaluation',title:'ประเมินตัวชี้วัด ผลลัพธ์ และข้อเสนอแนะ',evidence:true},
 {key:'report',stage:'evaluation',title:'จัดทำรายงานผลและเสนอผู้บังคับบัญชา',evidence:true},
];
export function checklistFor(category:ProjectProfile['category']){
 return [...projectChecklist,...(category==='training'?[{key:'training-course',stage:'preparation' as const,title:'ตรวจหลักสูตร กำหนดการ วิทยากร และหลักฐานค่าใช้จ่ายฝึกอบรม',evidence:true}]:category==='public'?[{key:'public-scope',stage:'planning' as const,title:'ตรวจขอบเขตกิจกรรมสาธารณะและหลักเกณฑ์ค่าใช้จ่ายที่ใช้',evidence:true}]:[])];
}
export function projectChecks(project:OfficeItem,items:OfficeItem[],files:ProjectFile[]){
 const p=projectProfileSchema.parse(project.projectProfile||{}),tasks=items.filter(t=>t.kind==='task'&&t.projectId===project.id&&(!t.archived||t.required));
 const checks:{key:string;label:string;done:boolean;stage:ProjectStage;taskId?:string}[]=projectFields.map(([key,label,stage])=>({key,label,stage,done:!!p[key].trim()}));
 checks.push({key:'department',label:'หน่วยงาน / กอง',stage:'planning',done:!!p.department.trim()});
 checks.push({key:'owner',label:'ผู้รับผิดชอบโครงการ',stage:'planning',done:!!project.owner.trim()}, {key:'dates',label:'วันเริ่มและกำหนดเสร็จ',stage:'planning',done:!!project.date&&!!project.due}, {key:'review',label:'ชื่อผู้ตรวจทานและบันทึกผลตรวจ',stage:'evaluation',done:!!p.reviewer.trim()&&!!p.reviewNote.trim()}, {key:'budget',label:'ยอดใช้จ่ายจริง (ระบุ 0 ได้)',stage:'finance',done:p.actualBudget!==null}, {key:'indicators',label:'ตัวชี้วัด เป้าหมาย ผลจริง และวิธีประเมิน',stage:'evaluation',done:p.indicators.length>0&&p.indicators.every(i=>i.actual!==null&&!!i.method.trim())});
 if(!tasks.length)checks.push({key:'tasks',label:'จัดรายการงานของโครงการ',stage:'planning',done:false});
 for(const t of tasks.filter(t=>t.required))checks.push({key:t.id,taskId:t.id,stage:t.taskStage,label:t.title,done:t.notApplicable?!!t.exclusionReason.trim():t.status==='done'&&!!t.owner.trim()&&(!t.evidenceRequired||files.some(f=>f.taskId===t.id))});
 const done=checks.filter(c=>c.done).length;
 return {checks,done,total:checks.length,percent:Math.round(done/checks.length*100)};
}
