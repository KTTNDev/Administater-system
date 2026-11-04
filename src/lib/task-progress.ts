import {z} from 'zod';
import type {OfficeInput} from './office';

// Defaults let every existing office record load without a data migration.
// These fields live in office_items.data and travel with its existing backups.
export const taskTrackingFields={
 taskTracking:z.enum(['manual','checklist']).default('manual'),
 taskPercent:z.number().int().min(0).max(100).default(0),
 taskChecklist:z.array(z.object({id:z.string().uuid(),title:z.string().trim().min(1,'ระบุชื่อรายการย่อยให้ครบ').max(300),done:z.boolean()})).max(50).default([]),
 nextStep:z.string().trim().max(2000).default(''),
 waitingFor:z.string().trim().max(2000).default(''),
};
type Tracked=Pick<OfficeInput,'status'|'taskTracking'|'taskPercent'|'taskChecklist'>;
export function taskProgress(item:Tracked){
 const total=item.taskChecklist.length,done=item.taskChecklist.filter(s=>s.done).length;
 const percent=item.status==='done'?100:item.taskTracking==='checklist'?(total?Math.round(done/total*100):0):item.taskPercent;
 return {percent,total,done,automatic:item.taskTracking==='checklist'};
}
export function normalizeTaskProgress(input:OfficeInput):OfficeInput {
 if(input.kind!=='task')return input;
 if(new Set(input.taskChecklist.map(s=>s.id)).size!==input.taskChecklist.length)throw Error('มีรหัสรายการย่อยซ้ำกัน');
 if(input.taskTracking==='checklist'){
  if(!input.taskChecklist.length)throw Error('เพิ่มรายการย่อยอย่างน้อย 1 รายการ หรือเลือกกำหนดเปอร์เซ็นต์เอง');
  if(input.status==='done'&&input.taskChecklist.some(s=>!s.done))throw Error('ยังมีรายการย่อยไม่เสร็จ กรุณาตรวจรายการย่อยก่อนปิดงาน');
 }
 const started=input.taskTracking==='checklist'?input.taskChecklist.some(s=>s.done):input.taskPercent>0;
 return {...input,status:input.status==='new'&&started?'working':input.status};
}
