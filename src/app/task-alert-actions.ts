"use server";
import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {db} from '@/lib/db';
import {listOffice} from '@/lib/office-db';
import {activeTasks,bangkokDay} from '@/lib/workdesk';
import {taskAlertCandidate,alertDate} from '@/lib/task-alerts';
import {readTaskAlertSettings,writeTaskAlertSettings,listTaskAlertStates,taskAlertKey,updateTaskAlertState} from '@/lib/task-alert-db';
function snapshot(){
 const {settings,version}=readTaskAlertSettings(),items=listOffice(),today=bangkokDay(),states=listTaskAlertStates();
 const alerts=activeTasks(items).map(task=>taskAlertCandidate(task,settings,today)).filter(v=>v!==null).map(candidate=>{
  const id=taskAlertKey(candidate,settings),state=states.get(id);
  return {id,phase:candidate.phase,trigger:candidate.trigger,remaining:candidate.remaining,task:candidate.task,acknowledged:!!state?.acknowledged.includes(candidate.phase),snoozeUntil:state?.snoozeUntil||'',snoozed:!!state?.snoozeUntil&&state.snoozeUntil>today};
 }).sort((a,b)=>(a.task.due||'9999').localeCompare(b.task.due||'9999')||a.task.title.localeCompare(b.task.title,'th'));
 return {settings,version,today,alerts,owners:[...new Set(activeTasks(items).map(t=>t.owner.trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'th'))};
}
export async function getTaskAlerts(){await requireUser();return snapshot()}
export async function getTaskAlertSettings(){await requireUser();return readTaskAlertSettings()}
export async function saveTaskAlertSettings(input:unknown,version:number){
 try{await requireUser();writeTaskAlertSettings(input,z.number().int().nonnegative().parse(version));return {ok:true as const,data:snapshot()}}catch(e){return {ok:false as const,error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'บันทึกตั้งค่าไม่สำเร็จ'}}
}
const operationSchema=z.object({id:z.string().regex(/^notice:[a-f0-9]{64}$/),taskId:z.string().uuid(),phase:z.string().max(50),operation:z.enum(['ack','snooze','resume']),until:z.union([z.literal(''),alertDate]).default('')});
export async function updateTaskAlert(input:unknown){
 try{
  await requireUser();const action=operationSchema.parse(input);
  db().transaction(()=>{
   const latest=snapshot(),alert=latest.alerts.find(v=>v.id===action.id&&v.task.id===action.taskId&&v.phase===action.phase);
   if(!alert)throw Error('กำหนดงานเปลี่ยนแล้ว กรุณาโหลดการแจ้งเตือนล่าสุด');
   if(action.operation==='snooze'&&(!action.until||action.until<=latest.today))throw Error('เลือกวันเตือนอีกครั้งหลังวันนี้');
   updateTaskAlertState(action.id,action.taskId,action.phase,action.operation,action.until);
  })();
  return {ok:true as const,data:snapshot()};
 }catch(e){return {ok:false as const,error:e instanceof z.ZodError?e.issues[0].message:e instanceof Error?e.message:'อัปเดตแจ้งเตือนไม่สำเร็จ'}}
}
export type TaskAlertSnapshot=Awaited<ReturnType<typeof getTaskAlerts>>;
