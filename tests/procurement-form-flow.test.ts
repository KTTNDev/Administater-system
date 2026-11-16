import {it,expect} from 'vitest';
import {procurementReadiness,procurementSteps} from '../src/lib/procurement-form-flow';
import {newProcurement} from '../src/lib/procurement';
import {templateSlots} from '../src/lib/procurement-lab/template-model';
it('counts readiness for the selected document without changing case data',()=>{
 const data=newProcurement(),before=JSON.stringify(data);const d07=procurementReadiness(data,'D07');expect(d07.percent).toBeLessThan(100);expect(d07.missing).toContain('รายชื่อผู้ยื่นข้อเสนอ');expect(JSON.stringify(data)).toBe(before);
 for(const slot of templateSlots)data.common[slot.key]='ทดสอบ';expect(procurementReadiness(data,'D07').percent).toBe(100);expect(procurementReadiness(data,'D01').percent).toBeLessThan(100);
});
it('keeps unresolved bindings incomplete and provides eight distinct workflow sections',()=>{
 const data=newProcurement();for(const slot of templateSlots)data.common[slot.key]='ทดสอบ';data.common.consideration='พิจารณา {{vendor}}';data.common.vendor='';expect(procurementReadiness(data,'D07').percent).toBeLessThan(100);expect(procurementSteps.map(step=>step.id)).toEqual(['details','header','body','signing','documents','contract','evidence','finance']);
});
