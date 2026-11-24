import { ProcurementCaseInputSchema } from './schema';
import { toThaiBahtText, toThaiDigits } from './formatting';
import { calculateDeliveryDueDate, type HolidayCalendar } from './holidays';
import type { ProcurementType, WorkflowMode } from './types';
export function getProcurementTerms(type: ProcurementType) { return type === 'BUY' ? { actionVerb: 'ซื้อ', action: 'จัดซื้อ', orderDocTitle: 'ใบสั่งซื้อ', counterpartyLabel: 'ผู้ขาย', buyerLabel: 'ผู้ซื้อ', orderingPartyLabel: 'ผู้สั่งซื้อ', deliveryObject: 'พัสดุ', defaultPenaltyRatePercent: 0.20 } : { actionVerb: 'จ้าง', action: 'จัดจ้าง', orderDocTitle: 'ใบสั่งจ้าง', counterpartyLabel: 'ผู้รับจ้าง', buyerLabel: 'ผู้ว่าจ้าง', orderingPartyLabel: 'ผู้สั่งจ้าง', deliveryObject: 'งาน', defaultPenaltyRatePercent: 0.10 }; }
// Decimal strings -> rational arithmetic, rounded half up only at line/money boundaries.
function rational(n: number): [
    bigint,
    bigint
] { if (!Number.isFinite(n) || n < 0)
    throw new RangeError('จำนวนไม่ถูกต้อง'); const [coefficient, exponent = '0'] = String(n).toLowerCase().split('e'), [a, b = ''] = coefficient.split('.'), power = Number(exponent) - b.length; return power >= 0 ? [BigInt(a + b) * 10n ** BigInt(power), 1n] : [BigInt(a + b), 10n ** BigInt(-power)]; }
const rounded = (n: bigint, d: bigint) => (n * 2n + d) / (2n * d);
const cents = (n: number) => { const [a, b] = rational(n); return rounded(a * 100n, b); };
const money = (n: bigint) => { if (n > BigInt(Number.MAX_SAFE_INTEGER) || n < BigInt(-Number.MAX_SAFE_INTEGER))
    throw new RangeError('ยอดรวมเกินขอบเขตที่คำนวณได้'); return Number(n) / 100; };
/** The form can calculate totals before a draft has book numbers or dates. */
export function calculateDraftAmounts(items: ReadonlyArray<{quantity:number;unitPrice:number}>, vatRegistered:boolean) {
    const lines=items.map(i=>{const [a,b]=rational(i.quantity),[c,d]=rational(i.unitPrice);return rounded(a*c*100n,b*d);});
    const gross=lines.reduce((a,b)=>a+b,0n),net=vatRegistered?rounded(gross*100n,107n):gross;
    return {grandTotal:money(gross),subtotalExclVat:money(net),vatAmount:money(gross-net),lineTotals:lines.map(money)};
}
export function computeProcurementCase(input: unknown, calendar?: HolidayCalendar) {
    const data = ProcurementCaseInputSchema.parse(input), terms = getProcurementTerms(data.procurementType), lineCents = data.items.map(i => { const [a, b] = rational(i.quantity), [c, d] = rational(i.unitPrice); return rounded(a * c * 100n, b * d); }), gross = lineCents.reduce((a, b) => a + b, 0n), net = data.vendor.isVatRegistered ? rounded(gross * 100n, 107n) : gross, totalBudget = cents(data.budgetLine.allocatedAmount) + cents(data.budgetLine.transferInAmount) - cents(data.budgetLine.transferOutAmount), before = totalBudget - cents(data.budgetSpentBefore), grandTotal = money(gross), penaltyRatePercent = data.penaltyRatePercent ?? terms.defaultPenaltyRatePercent;
    if (grandTotal > 999999999.99)
        throw new RangeError('ยอดรวมเกินขอบเขตจำนวนเงิน');
    const due = data.docs.doc10_purchaseOrder.date ? calculateDeliveryDueDate(data.docs.doc10_purchaseOrder.date, data.deliveryDays, calendar) : null, deliveryDate = data.inspectionResult.deliveryDate ?? data.docs.doc11_1_inspectionReport.date, lateDays = due && deliveryDate ? Math.max(0, Math.round((Date.parse(deliveryDate) - Date.parse(due.effectiveDueDate)) / 86400000)) : 0, [rateN, rateD] = rational(penaltyRatePercent), daily = cents(data.minPenaltyPerDay) > rounded(gross * rateN, rateD * 100n) ? cents(data.minPenaltyPerDay) : rounded(gross * rateN, rateD * 100n);
    const workflowMode: WorkflowMode = data.workflowModeOverride === 'AUTO' ? (gross <= 500000n ? 'MANUAL_UNDER_5000' : 'EGP_OVER_5000') : data.workflowModeOverride;
    return { ...data, grandTotal, lineTotals: lineCents.map(money), subtotalExclVat: money(net), vatAmount: money(gross - net), totalBudget: money(totalBudget), budgetRemainingBefore: money(before), budgetRemainingAfter: money(before - gross), itemCount: data.items.length, projectTitle: data.projectTitleShort ?? data.budgetLine.categoryType, workflowMode, terms, penaltyRatePercent, dailyPenalty: money(daily), lateDays, totalPenalty: money(daily * BigInt(lateDays)), due, deliveryDate, amountInWords: toThaiBahtText(grandTotal), grandTotalThai: toThaiDigits(grandTotal.toFixed(2)), inspectorBindings: Object.fromEntries(['6.1', '6.2', '11.1', '11.2', '11.3'].map(id => [id, data.inspectors.map(p => ({ ...p }))])), penaltyBindings: { '4.1': penaltyRatePercent, '10': penaltyRatePercent } };
}
