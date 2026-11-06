import {it,expect} from 'vitest';
import {officeSchema} from '../src/lib/office';
import {calculateTaskDue,taskAlertCandidate,taskAlertSettingsSchema} from '../src/lib/task-alerts';
it('counts calendar and business days with explicit start-day and holiday rules',()=>{
 expect(calculateTaskDue('2026-11-06',{days:3,count:'calendar',start:'include',reference:''})).toBe('2026-11-08');
 expect(calculateTaskDue('2026-11-06',{days:3,count:'business',start:'next',reference:''},['2026-11-09'])).toBe('2026-11-12');
 expect(calculateTaskDue('2026-11-07',{days:1,count:'business',start:'include',reference:''})).toBe('2026-11-09');
 expect(calculateTaskDue('2024-02-28',{days:2,count:'calendar',start:'next',reference:''})).toBe('2024-03-01');
 expect(()=>calculateTaskDue('',{days:7,count:'calendar',start:'next',reference:''})).toThrow();
 expect(()=>calculateTaskDue('9999-12-31',{days:2,count:'calendar',start:'next',reference:''})).toThrow();
});
it('keeps only the latest warning phase, including missed dates and specific reminders',()=>{
 const task={...officeSchema.parse({kind:'task',title:'ทดสอบ',due:'2026-11-10'}),id:'00000000-0000-4000-8000-000000000001',version:1,updatedAt:''};
 const settings=taskAlertSettingsSchema.parse({});
 expect(taskAlertCandidate(task,settings,'2026-11-06')).toBeNull();
 expect(taskAlertCandidate(task,settings,'2026-11-08')?.phase).toBe('before:3');
 expect(taskAlertCandidate(task,settings,'2026-11-09')?.phase).toBe('before:1');
 expect(taskAlertCandidate(task,settings,'2026-11-10')?.phase).toBe('due');
 expect(taskAlertCandidate(task,settings,'2026-11-13')?.phase).toBe('overdue');
 const custom={...task,taskReminder:{...task.taskReminder,dates:['2026-11-15']}};
 expect(taskAlertCandidate(custom,settings,'2026-11-16')?.phase).toBe('date:2026-11-15');
 expect(taskAlertCandidate({...task,due:'',taskReminder:{...task.taskReminder,dates:['2026-11-05']}},settings,'2026-11-06')?.remaining).toBeNull();
 for(const patch of [{status:'done' as const},{archived:true},{notApplicable:true},{taskReminder:{...task.taskReminder,enabled:false}}])expect(taskAlertCandidate({...task,...patch},settings,'2026-11-10')).toBeNull();
 expect(taskAlertCandidate(task,{...settings,owner:'คนอื่น'},'2026-11-10')).toBeNull();
});
