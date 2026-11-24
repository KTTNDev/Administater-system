import type { ComputedProcurementCase, ValidationIssue } from './types';
import { MEMO_TRACK } from './numbering';
import { isWorkingDay, nextWorkingDay, THAI_PUBLIC_HOLIDAYS, HOLIDAY_COVERAGE, type HolidayCalendar } from './holidays';
const ids: Record<string, string> = { doc1_approvePrinciple: '1', doc2_assignSpec: '2', doc3_reportSpec: '3', doc6_1_purchaseRequest: '6.1', doc6_2_inspectorOrder: '6.2', doc7_evalReport: '7', doc8_winnerAnnouncement: '8', doc9_contractNotice: '9', doc10_purchaseOrder: '10', doc11_1_inspectionReport: '11.1', doc12_finalSummary: '12', doc13_disbursement: '13', laasDate: '5.1' };
export function validateProcurementCase(c: ComputedProcurementCase, calendar: HolidayCalendar = THAI_PUBLIC_HOLIDAYS): ValidationIssue[] {
    const issues: ValidationIssue[] = [], add = (code: string, severity: ValidationIssue['severity'], docIds: string[], messageTh: string, suggestedFix?: string) => issues.push({ code, severity, docIds, messageTh, ...suggestedFix ? { suggestedFix } : {} });
    if (c.grandTotal > c.budgetRemainingBefore)
        add('BUDGET_EXCEEDED', 'ERROR', ['1', '6.1', '13'], 'วงเงินเกินงบคงเหลือก่อนรายการนี้');
    const roles = c.inspectors.map(i => i.role);
    if (c.grandTotal > 100000 && c.inspectorMode === 'SINGLE' || c.inspectorMode === 'COMMITTEE_3' && (roles.length !== 3 || roles.filter(r => r === 'CHAIRPERSON').length !== 1 || roles.filter(r => r === 'MEMBER').length !== 2) || c.inspectorMode === 'SINGLE' && (roles.length !== 1 || roles[0] !== 'INSPECTOR'))
        add('INSPECTOR_COMMITTEE_REQUIRED', 'ERROR', ['6.1', '6.2', '11.1', '11.2', '11.3'], 'ตรวจจำนวนและบทบาทผู้ตรวจรับ: วงเงินเกิน 100,000 บาทต้องมีประธาน 1 คน และกรรมการ 2 คน');
    if (c.penaltyRatePercent !== c.terms.defaultPenaltyRatePercent)
        add('PENALTY_RATE_NONSTANDARD', 'WARNING', ['4.1', '10'], 'อัตราค่าปรับต่างจากค่าเริ่มต้นของประเภทงาน โปรดตรวจและยืนยัน');
    if (c.workflowModeOverride !== 'AUTO' && c.workflowModeOverride !== (c.grandTotal <= 5000 ? 'MANUAL_UNDER_5000' : 'EGP_OVER_5000'))
        add('WORKFLOW_MODE_OVERRIDDEN', 'WARNING', [], 'แนวทางถูกเลือกต่างจากเกณฑ์วงเงินของสเปก');
    let previous: typeof MEMO_TRACK[number] | undefined;
    for (const key of MEMO_TRACK) {
        const row = c.docs[key];
        if (!row.runningNo)
            continue;
        if (previous) {
            const old = c.docs[previous];
            if (BigInt(row.runningNo) <= BigInt(old.runningNo!))
                add('MEMO_NUMBER_OUT_OF_ORDER', 'ERROR', [ids[previous], ids[key]], 'เลขหนังสือภายในซ้ำหรือย้อนลำดับ');
        }
        previous = key;
    }
    const pairs: [
        string,
        string
    ][] = [['doc1_approvePrinciple', 'doc2_assignSpec'], ['doc2_assignSpec', 'doc3_reportSpec'], ['doc3_reportSpec', 'laasDate'], ['laasDate', 'doc6_1_purchaseRequest'], ['doc3_reportSpec', 'doc6_1_purchaseRequest'], ['doc6_1_purchaseRequest', 'doc6_2_inspectorOrder'], ['doc6_1_purchaseRequest', 'doc7_evalReport'], ['doc7_evalReport', 'doc8_winnerAnnouncement'], ['doc7_evalReport', 'doc9_contractNotice'], ['doc9_contractNotice', 'doc10_purchaseOrder'], ['doc10_purchaseOrder', 'doc11_1_inspectionReport'], ['doc11_1_inspectionReport', 'doc12_finalSummary'], ['doc12_finalSummary', 'doc13_disbursement']];
    const date = (key: string) => key === 'laasDate' ? c.docs.laasDate : (c.docs[key as keyof typeof c.docs] as {
        date?: string;
    })?.date;
    for (const [a, b] of pairs)
        if (date(a) && date(b) && date(a)! > date(b)!)
            add('DATE_OUT_OF_ORDER', 'ERROR', [ids[a], ids[b]], 'วันที่เอกสารย้อนลำดับกระบวนงาน');
    for (const key of Object.keys(ids)) {
        const value = date(key);
        if (!value)
            continue;
        if (value < HOLIDAY_COVERAGE.from || value > HOLIDAY_COVERAGE.to) {
            add('HOLIDAY_CALENDAR_UNAVAILABLE', 'WARNING', [ids[key]], 'วันที่อยู่นอกปฏิทินที่รองรับ');
            continue;
        }
        if (!isWorkingDay(value, calendar))
            add('DATE_ON_NON_WORKING_DAY', 'WARNING', [ids[key]], 'วันที่ตรงกับ' + (calendar[value] || THAI_PUBLIC_HOLIDAYS[value] || ([0, 6].includes(new Date(value).getUTCDay()) ? 'วันเสาร์/อาทิตย์' : 'วันหยุด')), nextWorkingDay(value, calendar));
        if (HOLIDAY_COVERAGE.provisionalYears.includes(Number(value.slice(0, 4)) as 2027 | 2028 | 2029))
            add('HOLIDAY_CALENDAR_PROVISIONAL', 'WARNING', [ids[key]], 'ปฏิทินอนาคตเป็นข้อมูลฐาน โปรดตรวจประกาศวันหยุดพิเศษเพิ่มเติม');
    }
    if (c.due?.shiftedForHoliday)
        add('DUE_DATE_ON_HOLIDAY', 'INFO', ['10', '11.1'], 'วันครบกำหนดตรงวันหยุด เลื่อนไปวันทำการถัดไป', c.due.effectiveDueDate);
    if (c.lateDays && !c.inspectionResult.hasPenalty)
        add('LATE_DELIVERY_PENALTY_CHECK', 'WARNING', ['10', '11.1'], 'ส่งมอบล่าช้า ' + c.lateDays + ' วัน ค่าปรับวันละ ' + c.dailyPenalty + ' บาท รวม ' + c.totalPenalty + ' บาท');
    if (c.vendor.isSmeRegistered && c.vendor.smeExpiryDate && c.vendor.smeExpiryDate < c.docs.doc3_reportSpec.date)
        add('VENDOR_SME_EXPIRED', 'WARNING', ['4.2', '11.5'], 'หนังสือรับรอง SME หมดอายุก่อนวันรายงานกำหนดคุณลักษณะ');
    add('EXTERNAL_STAMP_REMINDER', 'INFO', ['4.2', '11.5'], 'ประทับวันที่ใบเสนอราคาผู้ชนะและคู่เทียบ 2 ร้านให้ตรงเอกสาร 3', c.docs.doc3_reportSpec.date);
    add('EXTERNAL_STAMP_REMINDER', 'INFO', ['11.4'], 'วันที่บิลส่งของให้ตรงกับใบตรวจรับ', c.docs.doc11_1_inspectionReport.date);
    return issues;
}
