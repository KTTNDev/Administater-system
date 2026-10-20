import {z} from 'zod';
import {documentSchema} from './document';
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'ระบุวันที่').refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'วันที่ไม่ถูกต้อง');
const required=z.string().trim().min(1,'กรอกข้อมูลให้ครบ').max(500);
export const registerSchema=z.object({
 department:required,direction:z.enum(['incoming','outgoing']),registeredDate:day,
 registeredTime:z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/,'ระบุเวลา 00:00–23:59'),
 number:z.string().trim().max(200),documentDate:day,from:required,to:required,subject:required,
 practice:z.string().trim().max(10000),notes:z.string().trim().max(10000),owner:z.string().trim().max(200),
 status:z.enum(['new','working','done','cancelled']),urgency:z.enum(['normal','urgent','very-urgent','immediate']),
 documentId:z.union([z.literal(''),z.string().uuid()]),relatedId:z.union([z.literal(''),z.string().uuid()]),
 attachmentFiles:documentSchema.shape.attachmentFiles,
});
export type RegisterInput=z.infer<typeof registerSchema>;
export type RegisterEntry=RegisterInput&{id:string;serial:number;year:number;version:number;createdAt:string;updatedAt:string;createdBy:string;updatedBy:string;historyText?:string};
export type RegisterEvent={id:string;entryId:string;action:string;actor:string;at:string;reason:string;snapshot:RegisterEntry};
export const statusLabels={new:'ลงทะเบียนแล้ว',working:'อยู่ระหว่างดำเนินการ',done:'ดำเนินการแล้ว',cancelled:'ยกเลิก'};
export const directionLabels={incoming:'รับ',outgoing:'ส่ง'};
export const urgencyLabels={normal:'ปกติ',urgent:'ด่วน','very-urgent':'ด่วนมาก',immediate:'ด่วนที่สุด'};
export const todayBangkok=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
export const fiscalYear=(date:string)=>Number(date.slice(0,4))+(Number(date.slice(5,7))>=10?1:0)+543;
export const fiscalRange=(year:number)=>({start:`${year-544}-10-01`,end:`${year-543}-09-30`});
export const thaiDay=(value:string)=>value&&!Number.isNaN(Date.parse(value))?new Intl.DateTimeFormat('th-TH',{day:'numeric',month:'long',year:'numeric',timeZone:'Asia/Bangkok'}).format(new Date(value.length===10?value+'T00:00:00+07:00':value)):'';
export const thaiTime=(value:string)=>new Intl.DateTimeFormat('th-TH',{dateStyle:'medium',timeStyle:'medium',timeZone:'Asia/Bangkok'}).format(new Date(value));
export function newRegister(department:string,direction:RegisterInput['direction']='incoming'):RegisterInput{return {department,direction,registeredDate:todayBangkok(),registeredTime:new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Bangkok'}).format(new Date()),number:'',documentDate:todayBangkok(),from:direction==='outgoing'?department:'',to:direction==='incoming'?department:'',subject:'',practice:'',notes:'',owner:'',status:'new',urgency:'normal',documentId:'',relatedId:'',attachmentFiles:[]};}
export type RegisterFilter={direction?:string;department?:string;start?:string;end?:string;query?:string;status?:string};
export const normalizeSearch=(s:string)=>s.normalize('NFKC').replace(/[๐-๙]/g,c=>String('๐๑๒๓๔๕๖๗๘๙'.indexOf(c))).toLocaleLowerCase('th').replace(/\s+/g,' ').trim();
export function filterRegister(entries:RegisterEntry[],f:RegisterFilter){const terms=normalizeSearch(f.query||'').split(' ').filter(Boolean);return entries.filter(e=>{
 if(f.direction&&e.direction!==f.direction||f.department&&e.department!==f.department||f.start&&e.registeredDate<f.start||f.end&&e.registeredDate>f.end||f.status&&e.status!==f.status)return false;
 const dates=[e.registeredDate,e.documentDate].flatMap(d=>[d,thaiDay(d),`${d.slice(8,10)}/${d.slice(5,7)}/${Number(d.slice(0,4))+543}`]);
 const text=normalizeSearch([e.serial,e.year+543,...Object.values(e).filter(x=>typeof x==='string'),...dates,statusLabels[e.status],e.attachmentFiles.map(a=>a.name+' '+a.description).join(' ')].join(' '));return terms.every(t=>text.includes(t));
});}
export function registerStats(entries:RegisterEntry[]){const months=new Map<string,{month:string;incoming:number;outgoing:number;done:number;pending:number;cancelled:number}>();for(const e of entries){const month=e.registeredDate.slice(0,7);const row=months.get(month)||{month,incoming:0,outgoing:0,done:0,pending:0,cancelled:0};if(e.status==='cancelled')row.cancelled++;else{row[e.direction]++;if(e.status==='done')row.done++;else row.pending++;}months.set(month,row);}return [...months.values()].sort((a,b)=>a.month.localeCompare(b.month));}
export const registerTableSql=`id TEXT PRIMARY KEY,department_key TEXT NOT NULL,direction TEXT NOT NULL,year INTEGER NOT NULL,serial INTEGER NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,created_by TEXT NOT NULL,updated_by TEXT NOT NULL,request_id TEXT NOT NULL UNIQUE,UNIQUE(department_key,direction,year,serial)`;
export const registerEventSql=`id TEXT PRIMARY KEY,entry_id TEXT NOT NULL,action TEXT NOT NULL,actor TEXT NOT NULL,at TEXT NOT NULL,reason TEXT NOT NULL,snapshot TEXT NOT NULL`;
