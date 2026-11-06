import {z} from 'zod';
import type {OfficeItem} from './office';
const validDate=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const d=new Date(value);return !isNaN(+d)&&d.toISOString().slice(0,10)===value;},'วันที่ไม่ถูกต้อง');
export const alertDate=validDate;
const offsets=z.array(z.number().int().min(0).max(365)).max(12).refine(v=>new Set(v).size===v.length,'วันเตือนซ้ำกัน');
export const taskReminderSchema=z.object({enabled:z.boolean().default(true),offsets:offsets.nullable().default(null),dates:z.array(validDate).max(12).default([]),cycle:z.number().int().nonnegative().default(0)}).default({enabled:true,offsets:null,dates:[],cycle:0});
export const deadlineRuleSchema=z.object({days:z.number().int().min(1).max(3660).default(7),count:z.enum(['calendar','business']).default('calendar'),start:z.enum(['include','next']).default('next'),reference:z.string().trim().max(2000).default('')});
export const taskDeadlineSchema=deadlineRuleSchema.extend({mode:z.enum(['manual','duration']).default('manual'),ruleId:z.string().max(80).default('')}).default({mode:'manual',days:7,count:'calendar',start:'next',reference:'',ruleId:''});
export const taskAlertSettingsSchema=z.object({
 enabled:z.boolean().default(true),owner:z.string().trim().max(500).default(''),offsets:offsets.default([3,1,0]),overdue:z.boolean().default(true),
 holidays:z.array(validDate).max(1000).default([]),
 rules:z.array(deadlineRuleSchema.extend({id:z.string().uuid(),label:z.string().trim().min(1).max(120)})).max(30).default([]),
});
export type TaskAlertSettings=z.infer<typeof taskAlertSettingsSchema>;
export const taskAlertRecordSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('settings'),value:taskAlertSettingsSchema}),
 z.object({kind:z.literal('notice'),taskId:z.string().uuid(),acknowledged:z.array(z.string().max(50)).max(40),snoozeUntil:z.union([z.literal(''),validDate])}),
]);
export const taskAlertsSql='id TEXT PRIMARY KEY,data TEXT NOT NULL,version INTEGER NOT NULL,updated_at TEXT NOT NULL';
export function shiftDay(day:string,days:number){const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);const iso=d.toISOString();if(iso.startsWith('-'))return '0000-01-01';if(iso.startsWith('+'))throw Error('วันที่เกินช่วงที่รองรับ');return iso.slice(0,10)}
export function dayDifference(first:string,second:string){return Math.round((Date.parse(first+'T12:00:00Z')-Date.parse(second+'T12:00:00Z'))/86400000)}
export function calculateTaskDue(day:string,rule:z.infer<typeof deadlineRuleSchema>,holidays:readonly string[]=[]){
 if(!validDate.safeParse(day).success)throw Error('ระบุวันเริ่มนับก่อนคำนวณกำหนดเสร็จ');
 const parsed=deadlineRuleSchema.parse(rule);
 if(parsed.count==='calendar')return shiftDay(day,parsed.days-(parsed.start==='include'?1:0));
 const excluded=new Set(holidays);let remaining=parsed.days,current=parsed.start==='include'?day:shiftDay(day,1);
 while(remaining){
  const weekday=new Date(current+'T12:00:00Z').getUTCDay();
  if(weekday!==0&&weekday!==6&&!excluded.has(current))remaining--;
  if(remaining)current=shiftDay(current,1);
 }
 return current;
}
export type TaskAlertCandidate={task:OfficeItem;phase:string;trigger:string;remaining:number|null};
export function taskAlertCandidate(task:OfficeItem,settings:TaskAlertSettings,today:string):TaskAlertCandidate|null{
 if(!settings.enabled||!task.taskReminder.enabled||task.status==='done'||task.archived||task.notApplicable||settings.owner&&task.owner.trim()!==settings.owner)return null;
 const choices:{phase:string;trigger:string}[]=[];
 if(task.due){
  for(const offset of task.taskReminder.offsets??settings.offsets)choices.push({phase:offset===0?'due':'before:'+offset,trigger:shiftDay(task.due,-offset)});
  if(settings.overdue&&task.due<'9999-12-31')choices.push({phase:'overdue',trigger:shiftDay(task.due,1)});
 }
 for(const date of task.taskReminder.dates)choices.push({phase:'date:'+date,trigger:date});
 const event=choices.filter(v=>v.trigger<=today).sort((a,b)=>b.trigger.localeCompare(a.trigger)||a.phase.localeCompare(b.phase))[0];
 return event?{task,...event,remaining:task.due?dayDifference(task.due,today):null}:null;
}
