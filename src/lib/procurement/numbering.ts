import type { AgencyConfig, DocRegistry } from './types';
export const MEMO_TRACK = ['doc1_approvePrinciple', 'doc2_assignSpec', 'doc3_reportSpec', 'doc6_1_purchaseRequest', 'doc7_evalReport', 'doc11_1_inspectionReport', 'doc12_finalSummary', 'doc13_disbursement'] as const;
export type NumberTrack = 'INTERNAL_MEMO' | 'MUNICIPAL_ORDER' | 'ANNOUNCEMENT' | 'EXTERNAL_LETTER' | 'PURCHASE_ORDER';
export function suggestNextNumber(entries: ReadonlyArray<{
    track: NumberTrack;
    yearBE: number;
    runningNo: string;
}>, track: NumberTrack, yearBE: number, start = 1) { if (!Number.isSafeInteger(start) || start < 1)
    throw new RangeError('เลขเริ่มต้นไม่ถูกต้อง'); let next = BigInt(start); for (const e of entries) {
    if (!/^\d+$/.test(e.runningNo))
        throw new Error('เลขทะเบียนต้องเป็นตัวเลขอารบิก');
    if (e.track === track && e.yearBE === yearBE && BigInt(e.runningNo) >= next)
        next = BigInt(e.runningNo) + 1n;
} return String(next); }
type FormattableRegistry = Omit<DocRegistry,typeof MEMO_TRACK[number]> & {[K in typeof MEMO_TRACK[number]]:Partial<DocRegistry[K]>};
export function formatDocumentNumbers(docs: FormattableRegistry, agency: AgencyConfig) {
    const memos = Object.fromEntries(MEMO_TRACK.map(k => [k, docs[k].runningNo ? `${agency.codes.internalMemoPrefix}/${docs[k].runningNo}` : ''])) as Record<typeof MEMO_TRACK[number], string>;
    return { ...memos, doc6_2_inspectorOrder: docs.doc6_2_inspectorOrder.runningNo && docs.doc6_2_inspectorOrder.yearBE ? `${docs.doc6_2_inspectorOrder.runningNo}/${docs.doc6_2_inspectorOrder.yearBE}` : '', doc8_winnerAnnouncement: '', announcementRegistryLogNo: docs.doc8_winnerAnnouncement.registryLogNo ?? '', doc9_contractNotice: docs.doc9_contractNotice.runningNo ? `${agency.codes.externalLetterPrefix}/${docs.doc9_contractNotice.runningNo}` : '', doc10_purchaseOrder: docs.doc10_purchaseOrder.runningNo && docs.doc10_purchaseOrder.fiscalYearBE ? `${agency.codes.poPrefix} ${docs.doc10_purchaseOrder.runningNo}/${docs.doc10_purchaseOrder.fiscalYearBE}` : '' };
}
