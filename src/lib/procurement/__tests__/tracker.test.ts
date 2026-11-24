import {describe,expect,it} from 'vitest';
import {cloneCaseSafely,StoredCaseSchema} from '../workspace/model';
import {sampleCase,sampleHireCase} from '../workspace/samples';
import {
  deriveCaseFiscalYear,
  deriveCaseMonthKey,
  fiscalYearFromMonthKey,
  formatThaiMonthYear,
  groupCasesByFiscalMonth,
  summarizeCaseNumbers,
} from '../workspace/tracker';

describe('procurement case tracker, fiscal year & month grouping',()=>{
  it('parses legacy StoredCase payloads without tracker using safe defaults',()=>{
    const legacy=sampleCase(1520) as unknown as Record<string,unknown>;
    delete legacy.tracker;
    const parsed=StoredCaseSchema.parse(legacy);
    expect(parsed.tracker).toEqual({status:'RESERVING_NUMBERS',workMonth:'',note:''});
  });

  it('clears tracker status, workMonth and note when cloning safely',()=>{
    const src=sampleCase(1520);
    src.tracker={status:'COMPLETED',workMonth:'2026-11',note:'เบิกจ่ายเรียบร้อยแล้ว'};
    const cloned=cloneCaseSafely(src);
    expect(cloned.tracker).toEqual({status:'RESERVING_NUMBERS',workMonth:'',note:''});
  });

  it('computes Thai fiscal years across October–September boundaries',()=>{
    expect(fiscalYearFromMonthKey('2026-09')).toBe(2569);
    expect(fiscalYearFromMonthKey('2026-10')).toBe(2570);
    expect(fiscalYearFromMonthKey('2026-11')).toBe(2570);
    expect(fiscalYearFromMonthKey('2027-01')).toBe(2570);
    expect(formatThaiMonthYear('2026-11')).toBe('พฤศจิกายน 2569');
    expect(formatThaiMonthYear('2026-11',true)).toBe('พ.ย. 69');
  });

  it('derives month from explicit tracker.workMonth first, then doc dates, then updatedAt',()=>{
    const c=sampleCase(1520);
    expect(deriveCaseMonthKey(c)).toBe('2026-11');
    c.tracker.workMonth='2026-12';
    expect(deriveCaseMonthKey(c)).toBe('2026-12');
    c.tracker.workMonth='';
    c.caseInput.docs.doc1_approvePrinciple={runningNo:'',date:''};
    c.caseInput.docs.doc6_1_purchaseRequest={runningNo:'',date:''};
    c.caseInput.docs.doc10_purchaseOrder={};
    c.caseInput.docs.doc11_1_inspectionReport={runningNo:'',date:''};
    c.caseInput.docs.doc13_disbursement={runningNo:'',date:''};
    c.updatedAt='2027-02-15T09:00:00Z';
    expect(deriveCaseMonthKey(c)).toBe('2027-02');
  });

  it('counts reserved manual ledger numbers and lists exact missing doc IDs',()=>{
    const complete=sampleCase(1520);
    expect(summarizeCaseNumbers(complete)).toEqual({filled:12,total:12,missingDocIds:[],complete:true});

    const partial=cloneCaseSafely(complete);
    partial.caseInput.docs.doc1_approvePrinciple={runningNo:'101',date:'2026-11-02'};
    partial.caseInput.docs.doc2_assignSpec={runningNo:'102',date:'2026-11-03'};
    partial.caseInput.docs.doc3_reportSpec={runningNo:'103',date:'2026-11-03'};
    const summary=summarizeCaseNumbers(partial);
    expect(summary.filled).toBe(3);
    expect(summary.total).toBe(12);
    expect(summary.complete).toBe(false);
    expect(summary.missingDocIds).toEqual(['6.1','6.2','7','8','9','10','11.1','12','13']);
  });

  it('groups cases by fiscal year and month sorted newest first',()=>{
    const oct70=sampleCase(1520);
    oct70.caseInput.budgetLine.fiscalYearBE=2570;
    oct70.tracker.workMonth='2026-10';

    const nov70=sampleHireCase();
    nov70.caseInput.budgetLine.fiscalYearBE=2570;
    nov70.tracker.workMonth='2026-11';

    const sep69=sampleCase(22890);
    sep69.caseInput.budgetLine.fiscalYearBE=2569;
    sep69.tracker.workMonth='2026-09';

    expect(deriveCaseFiscalYear(sep69)).toBe(2569);
    const groups=groupCasesByFiscalMonth([sep69,oct70,nov70]);
    expect(groups.map(g=>`${g.fiscalYearBE}:${g.monthKey}`)).toEqual(['2570:2026-11','2570:2026-10','2569:2026-09']);
    expect(groups[0].label).toBe('พฤศจิกายน 2569 · ปีงบประมาณ 2570');
  });
});
