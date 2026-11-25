import {describe,expect,it} from 'vitest';
import {defaultAgency} from '../presets/default-agency';
import {newCase} from '../workspace/model';
import {formatThaiShortDate,getBinderDocControl} from '../workspace/binder-control';

describe('binder-control',()=>{
  it('formats booked numbers and short Thai dates',()=>{
    expect(formatThaiShortDate('2027-01-04')).toBe('4 ม.ค. 2570');
    const s=newCase(),d=s.caseInput.docs;
    d.doc1_approvePrinciple={runningNo:'0001',date:'2027-01-04'};
    d.doc6_2_inspectorOrder={runningNo:'1',yearBE:2570,date:'2027-01-06'};
    d.doc8_winnerAnnouncement={registryLogNo:'01',date:'2027-01-06'};
    d.doc9_contractNotice={runningNo:'001',date:'2027-01-06'};
    d.doc10_purchaseOrder={runningNo:'1',fiscalYearBE:2570,date:'2027-01-06'};
    expect(getBinderDocControl('1',s.caseInput,defaultAgency,'GENERATED').status).toBe('COMPLETE');
    expect(getBinderDocControl('6.2',s.caseInput,defaultAgency,'GENERATED').numberText).toBe('คำสั่ง 1/2570');
    expect(getBinderDocControl('8',s.caseInput,defaultAgency,'GENERATED').numberText).toBe('ทะเบียนประกาศ 01');
    expect(getBinderDocControl('9',s.caseInput,defaultAgency,'GENERATED').numberText).toContain('/001');
    expect(getBinderDocControl('10',s.caseInput,defaultAgency,'GENERATED').numberText).toContain('1/2570');
  });

  it('flags missing numbers/dates and handles inherited/LAAS slots',()=>{
    const s=newCase(),d=s.caseInput.docs;
    d.doc1_approvePrinciple={runningNo:'',date:'2027-01-04'};
    d.doc2_assignSpec={runningNo:'0002',date:''};
    d.doc3_reportSpec={runningNo:'0003',date:'2027-01-05'};
    d.doc6_2_inspectorOrder={runningNo:'1',date:'2027-01-06'};
    d.laasPurchaseReportNo='L-99';
    d.laasDate='2027-01-06';
    expect(getBinderDocControl('1',s.caseInput,defaultAgency,'GENERATED')).toMatchObject({status:'MISSING_NUMBER',needsAttention:true,jumpField:'docs.doc1_approvePrinciple.runningNo'});
    expect(getBinderDocControl('2',s.caseInput,defaultAgency,'GENERATED')).toMatchObject({status:'MISSING_DATE',needsAttention:true,jumpField:'docs.doc2_assignSpec.date'});
    expect(getBinderDocControl('6.2',s.caseInput,defaultAgency,'GENERATED')).toMatchObject({status:'MISSING_NUMBER',jumpField:'docs.doc6_2_inspectorOrder.yearBE'});
    expect(getBinderDocControl('10',s.caseInput,defaultAgency,'EGP_EXTERNAL')).toMatchObject({required:true,status:'MISSING_BOTH',needsAttention:true});
    expect(getBinderDocControl('7',s.caseInput,defaultAgency,'EGP_EXTERNAL')).toMatchObject({required:false,needsAttention:false});
    expect(getBinderDocControl('4.1',s.caseInput,defaultAgency,'GENERATED')).toMatchObject({status:'INHERITED',dateText:'5 ม.ค. 2570'});
    expect(getBinderDocControl('5.1',s.caseInput,defaultAgency,'LAAS_EXTERNAL')).toMatchObject({status:'COMPLETE',numberText:'LAAS L-99'});
    expect(getBinderDocControl('14',s.caseInput,defaultAgency,'LAAS_EXTERNAL')).toMatchObject({required:false,needsAttention:false,contextNote:'อัปโหลดฎีกาจาก e-LAAS'});
  });
});
