import 'server-only';
import {createHash} from 'node:crypto';
import {db} from './db';
import {taskAlertRecordSchema,taskAlertSettingsSchema,taskAlertsSql,type TaskAlertSettings,type TaskAlertCandidate} from './task-alerts';
function connection(){const c=db();c.exec('CREATE TABLE IF NOT EXISTS task_alerts ('+taskAlertsSql+')');return c}
export function readTaskAlertSettings(){
 const row=connection().prepare("SELECT data,version FROM task_alerts WHERE id='settings'").get();
 const data=row?taskAlertRecordSchema.parse(JSON.parse(String(row.data))):null;
 return {settings:data?.kind==='settings'?data.value:taskAlertSettingsSchema.parse({}),version:row?Number(row.version):0};
}
export function writeTaskAlertSettings(input:unknown,expected:number){
 const settings=taskAlertSettingsSchema.parse(input),c=connection();
 c.transaction(()=>{
  if(readTaskAlertSettings().version!==expected)throw Error('ตั้งค่าถูกแก้ไขจากหน้าต่างอื่น โหลดใหม่ก่อนบันทึก');
  c.prepare("INSERT INTO task_alerts VALUES('settings',?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at").run(JSON.stringify({kind:'settings',value:settings}),expected+1,new Date().toISOString());
 })();
 return readTaskAlertSettings();
}
export function taskAlertKey(candidate:TaskAlertCandidate,settings:TaskAlertSettings){
 const task=candidate.task;
 const signature=JSON.stringify([task.id,task.due,task.taskReminder.cycle,[...(task.taskReminder.offsets??settings.offsets)].sort((a,b)=>a-b),[...task.taskReminder.dates].sort(),settings.overdue]);
 return 'notice:'+createHash('sha256').update(signature).digest('hex');
}
export function listTaskAlertStates(){
 return new Map(connection().prepare("SELECT id,data FROM task_alerts WHERE id<>'settings'").all().map(row=>{
  const data=taskAlertRecordSchema.parse(JSON.parse(String(row.data)));
  return [String(row.id),data.kind==='notice'?data:null] as const;
 }));
}
export function updateTaskAlertState(key:string,taskId:string,phase:string,operation:'ack'|'snooze'|'resume',until:string){
 const c=connection(),row=c.prepare('SELECT data,version FROM task_alerts WHERE id=?').get(key);
 const old=row?taskAlertRecordSchema.parse(JSON.parse(String(row.data))):null;
 const notice=old?.kind==='notice'?old:{kind:'notice' as const,taskId,acknowledged:[],snoozeUntil:''};
 if(operation==='ack')notice.acknowledged=[...new Set([...notice.acknowledged,phase])];
 // Snoozing asks for a fresh reminder, including an already acknowledged phase.
 if(operation==='snooze'){notice.snoozeUntil=until;notice.acknowledged=notice.acknowledged.filter(v=>v!==phase)}
 if(operation==='resume'){notice.snoozeUntil='';notice.acknowledged=notice.acknowledged.filter(v=>v!==phase)}
 const parsed=taskAlertRecordSchema.parse(notice);
 c.prepare('INSERT INTO task_alerts VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data,version=excluded.version,updated_at=excluded.updated_at').run(key,JSON.stringify(parsed),Number(row?.version||0)+1,new Date().toISOString());
}
