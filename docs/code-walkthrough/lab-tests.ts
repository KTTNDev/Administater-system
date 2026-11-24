import assert from 'node:assert/strict';
import {reportYear, changeSubject, saveMessage, nextVersion, lineTotal, overlaps} from './answer';
import type {Draft} from './lab-types';
let checks=0;
const equal=(actual:unknown, expected:unknown)=>{assert.deepEqual(actual,expected);checks++;};
equal(reportYear('2026-09-30','fiscal'),2569);
equal(reportYear('2026-10-01','fiscal'),2570);
equal(reportYear('2026-10-01','calendar'),2569);
const original:Draft={subject:'เดิม',body:'รายละเอียด',status:'draft'};
const changed=changeSubject(original,'ใหม่');
equal(changed.subject,'ใหม่');equal(original.subject,'เดิม');
equal(changed.body,'รายละเอียด');equal(changed===original,false);
equal(saveMessage({ok:false,error:'ข้อมูลไม่ครบ'}),'ข้อมูลไม่ครบ');
equal(saveMessage({ok:true,data:{...original,id:'example',version:2}}),'บันทึกฉบับที่ 2');
const item={version:2,name:'A'},next=nextVersion(item,2);
equal(next,{version:3,name:'A'});equal(item.version,2);
assert.throws(()=>nextVersion(item,1),/stale version/);checks++;
equal(lineTotal('2','3.5'),7);equal(lineTotal('2','0'),0);
equal(lineTotal('2',''),null);equal(lineTotal(' ','5'),null);
equal(lineTotal('x','5'),null);equal(lineTotal('Infinity','5'),null);
equal(lineTotal('-1','5'),null);
equal(overlaps({start:540,end:600,buffer:0},{start:600,end:660,buffer:0}),false);
equal(overlaps({start:540,end:600,buffer:15},{start:600,end:660,buffer:0}),true);
equal(overlaps({start:540,end:600,buffer:0},{start:570,end:630,buffer:0}),true);
// These intentional mistakes must be rejected by TypeScript (not executed).
if(false){
 // @ts-expect-error YearMode excludes arbitrary strings.
 reportYear('2026-10-01','budget');
 // @ts-expect-error The generic requires a numeric version.
 nextVersion({name:'A'},1);
 // @ts-expect-error Failure cannot be passed as a success with no data.
 saveMessage({ok:true,error:'x'});
}
console.log(JSON.stringify({runtimeChecks:checks,typeErrorExpectations:3,status:'passed'}));
