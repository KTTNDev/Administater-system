import { it, expect } from 'vitest';
import { computeProcurementCase, validateProcurementCase, suggestNextNumber, formatDocumentNumbers, defaultAgency, MEMO_TRACK } from '../index';
import { fixture } from './fixtures';

it.each(MEMO_TRACK.slice(1))('rejects duplicate or backward memo numbers at %s', key => {
    const input = fixture();
    input.docs[key].runningNo = '0001';
    expect(validateProcurementCase(computeProcurementCase(input)).some(i => i.code === 'MEMO_NUMBER_OUT_OF_ORDER')).toBe(true);
});

it.each([
    ['doc1_approvePrinciple', 'doc2_assignSpec'],
    ['doc2_assignSpec', 'doc3_reportSpec'],
    ['doc3_reportSpec', 'doc6_1_purchaseRequest'],
    ['doc6_1_purchaseRequest', 'doc6_2_inspectorOrder'],
    ['doc6_1_purchaseRequest', 'doc7_evalReport'],
    ['doc7_evalReport', 'doc8_winnerAnnouncement'],
    ['doc7_evalReport', 'doc9_contractNotice'],
    ['doc9_contractNotice', 'doc10_purchaseOrder'],
    ['doc10_purchaseOrder', 'doc11_1_inspectionReport'],
    ['doc11_1_inspectionReport', 'doc12_finalSummary'],
    ['doc12_finalSummary', 'doc13_disbursement'],
] as const)('detects dates moving backward from %s to %s', (first, second) => {
    const input = fixture();
    input.docs[first].date = '2026-11-25';
    input.docs[second].date = '2026-11-24';
    expect(validateProcurementCase(computeProcurementCase(input)).some(i => i.code === 'DATE_OUT_OF_ORDER')).toBe(true);
});

it.each(['2026-11-12', '2026-11-18'])('validates the LAAS date boundary at %s', date => {
    const input = fixture(); input.docs.laasDate = date;
    expect(validateProcurementCase(computeProcurementCase(input)).some(i => i.code === 'DATE_OUT_OF_ORDER' && i.docIds.includes('5.1'))).toBe(true);
});

it('accepts 100,000 baht with a single inspector and suppresses an acknowledged penalty warning', () => {
    const input = fixture(); input.items = [{...input.items[0], quantity: 1, unitPrice: 100000}];
    input.inspectionResult.hasPenalty = true;
    const issues = validateProcurementCase(computeProcurementCase(input));
    expect(issues.some(i => i.code === 'INSPECTOR_COMMITTEE_REQUIRED')).toBe(false);
    expect(issues.some(i => i.code === 'LATE_DELIVERY_PENALTY_CHECK')).toBe(false);
});

it('permits incomplete later steps without inventing document dates or numbers', () => {
    const input = fixture();
    for (const key of ['doc6_1_purchaseRequest', 'doc7_evalReport', 'doc11_1_inspectionReport', 'doc12_finalSummary', 'doc13_disbursement'] as const) input.docs[key] = {};
    input.docs.doc10_purchaseOrder = {};
    const computed = computeProcurementCase(input);
    expect(computed.due).toBeNull();
    expect(computed.lateDays).toBe(0);
    expect(validateProcurementCase(computed).filter(i => i.severity === 'ERROR')).toEqual([]);
});
it('detects wrong numbers, chronology, holiday, budget, SME and penalty settings', () => {
    const input = fixture();
    input.docs.doc6_1_purchaseRequest.runningNo = '1484';
    input.docs.doc9_contractNotice.date = '2026-11-22';
    input.budgetLine.allocatedAmount = 1;
    input.vendor.isSmeRegistered = true;
    input.vendor.smeExpiryDate = '2026-01-01';
    input.penaltyRatePercent = 0.4;
    const issues = validateProcurementCase(computeProcurementCase(input));
    for (const code of ['MEMO_NUMBER_OUT_OF_ORDER', 'DATE_OUT_OF_ORDER', 'DATE_ON_NON_WORKING_DAY', 'BUDGET_EXCEEDED', 'PENALTY_RATE_NONSTANDARD', 'VENDOR_SME_EXPIRED', 'EXTERNAL_STAMP_REMINDER', 'LATE_DELIVERY_PENALTY_CHECK'])
        expect(issues.some(i => i.code === code)).toBe(true);
    expect(issues.find(i => i.code === 'DATE_ON_NON_WORKING_DAY')?.suggestedFix).toBe('2026-11-23');
    expect(issues.filter(i => i.code === 'EXTERNAL_STAMP_REMINDER').map(i => i.docIds)).toEqual([['4.2', '11.5'], ['11.4']]);
});
it('requires one chair and two members above 100,000 baht', () => {
    const input = fixture();
    input.items = [{ ...input.items[0], quantity: 1, unitPrice: 100000.01 }];
    const codes = () => validateProcurementCase(computeProcurementCase(input)).filter(i => i.severity === 'ERROR').map(i => i.code);
    expect(codes()).toContain('INSPECTOR_COMMITTEE_REQUIRED');
    input.inspectorMode = 'COMMITTEE_3';
    expect(codes()).toContain('INSPECTOR_COMMITTEE_REQUIRED');
    input.inspectors = (['CHAIRPERSON', 'MEMBER', 'MEMBER'] as const).map((role, i) => ({ fullName: `ผู้ตรวจ ${i}`, position: 'เจ้าหน้าที่', role }));
    expect(codes()).toEqual([]);
});
it('keeps five numbering tracks and years independent and never prints announcement registry numbers', () => {
    const entries = [{ track: 'INTERNAL_MEMO' as const, yearBE: 2569, runningNo: '0010' }, { track: 'ANNOUNCEMENT' as const, yearBE: 2569, runningNo: '999' }];
    expect(suggestNextNumber(entries, 'INTERNAL_MEMO', 2569)).toBe('11');
    expect(suggestNextNumber(entries, 'INTERNAL_MEMO', 2570)).toBe('1');
    expect(() => suggestNextNumber([], 'PURCHASE_ORDER', 2570, 0)).toThrow();
    const numbers = formatDocumentNumbers(fixture().docs, defaultAgency);
    expect(numbers.doc9_contractNotice).toBe('ภก 52806/4511');
    expect(numbers.doc6_2_inspectorOrder).toBe('2295/2569');
    expect(numbers.doc10_purchaseOrder).toBe('สว 13/2570');
    expect(numbers.doc8_winnerAnnouncement).toBe('');
    expect(numbers.announcementRegistryLogNo).toBe('12');
});
