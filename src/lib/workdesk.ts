import type {OfficeInput,OfficeItem} from './office';
export function bangkokDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(now)}
export function fiscalYearOf(day:string){const [year,month]=day.split('-').map(Number);return year+543+(month>=10?1:0)}
export function fiscalBounds(year:number){return {start:`${year-544}-10-01`,end:`${year-543}-09-30`}}
export function shiftAnnualDate(day:string,delta:number){if(!day)return '';const [y,m,d]=day.split('-').map(Number);const year=y+delta;const last=new Date(Date.UTC(year,m,0)).getUTCDate();return [year,String(m).padStart(2,'0'),String(Math.min(d,last)).padStart(2,'0')].join('-')}
export function annualCopy(item:OfficeItem,targetYear:number):OfficeInput {
 const from=item.fiscalYear||fiscalYearOf(item.due||item.date||bangkokDay());
 return {...item,status:'new',archived:false,completedAt:'',number:'',documentId:'',url:'',notApplicable:false,exclusionReason:'',projectProfile:item.projectProfile?{...item.projectProfile,approval:'',outputs:'',outcomes:'',evaluation:'',problems:'',recommendations:'',reviewer:'',reviewNote:'',actualBudget:null,indicators:item.projectProfile.indicators.map(i=>({...i,actual:null}))}:undefined,originId:item.originId||item.id,fiscalYear:targetYear,date:shiftAnnualDate(item.date,targetYear-from),due:shiftAnnualDate(item.due,targetYear-from)};
}
export function projectProgress(projectId:string,items:OfficeItem[]){const tasks=items.filter(i=>i.kind==='task'&&i.projectId===projectId&&!i.archived&&!i.notApplicable);const done=tasks.filter(i=>i.status==='done').length;return {total:tasks.length,done,percent:tasks.length?Math.round(done/tasks.length*100):0}}
export function activeTasks(items:OfficeItem[]){const hidden=new Set(items.filter(i=>i.kind==='project'&&i.archived).map(i=>i.id));return items.filter(i=>i.kind==='task'&&!i.archived&&!i.notApplicable&&!hidden.has(i.projectId))}
export function dailyTasks(items:OfficeItem[],day:string){return activeTasks(items).filter(t=>!t.fiscalYear||t.fiscalYear<=fiscalYearOf(day)||!!t.due&&t.due<=day)}
export function taskSort(a:OfficeItem,b:OfficeItem){return Number(a.status==='done')-Number(b.status==='done')||(a.due||'9999').localeCompare(b.due||'9999')||Number(b.priority==='urgent')-Number(a.priority==='urgent')||(a.sortOrder||1000001)-(b.sortOrder||1000001)||b.updatedAt.localeCompare(a.updatedAt)||a.id.localeCompare(b.id)}
export function safeCsv(rows:(string|number)[][]){return '\ufeff'+rows.map(row=>row.map(value=>{const s=String(value);return '"'+(/^[=+@\-\t\r\n]/.test(s)?"'":"")+s.replaceAll('"','""')+'"'}).join(',')).join('\r\n')}

export const projectStarters=[
 {id:'seniors',title:'กิจกรรมส่งเสริมคุณภาพชีวิตผู้สูงอายุ',description:'ตัวอย่างเพื่อเตรียมความพร้อมก่อนรับงานจริง',tasks:['สอบถามขอบเขตงานและผู้รับผิดชอบกับหัวหน้ากอง','ตรวจแผนโครงการและงบประมาณที่ได้รับอนุมัติ','ประสานกลุ่มเป้าหมายและหน่วยงานที่เกี่ยวข้อง','เตรียมหนังสือ สถานที่ และวัสดุตามแผน','ดำเนินกิจกรรมและรวบรวมหลักฐาน','สรุปผลและจัดเก็บแฟ้มโครงการ']},
 {id:'career',title:'กิจกรรมส่งเสริมอาชีพชุมชน',description:'ปรับกลุ่มเป้าหมายและขั้นตอนให้ตรงแผนของกอง',tasks:['สำรวจงานที่ได้รับมอบหมายและความต้องการกลุ่มเป้าหมาย','ตรวจโครงการและงบประมาณที่ได้รับอนุมัติ','ประสานวิทยากรและผู้เข้าร่วม','เตรียมเอกสารและอุปกรณ์','ดำเนินกิจกรรมและบันทึกผล','สรุปรายงานและจัดเก็บหลักฐาน']},
 {id:'annual',title:'เตรียมแผนงานประจำปีของกอง',description:'ใช้รวบรวมงานจริงจากเจ้าหน้าที่แต่ละฝ่าย',tasks:['ขอแผนงานและปฏิทินโครงการฉบับปัจจุบัน','ยืนยันรายชื่อโครงการและเจ้าของงาน','รวบรวมกำหนดส่งเอกสารและรายงาน','ทบทวนทรัพยากรและงบประมาณกับผู้รับผิดชอบ','เสนอผู้บังคับบัญชาตรวจทาน','บันทึกแผนที่ยืนยันแล้วและนัดติดตามผล']}
] as const;
