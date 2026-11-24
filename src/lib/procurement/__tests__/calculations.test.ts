import { describe, it, expect } from 'vitest';
import { computeProcurementCase, validateProcurementCase, buildBinderManifest, getProcurementTerms } from '../index';
import { fixture } from './fixtures';
describe('financial acceptance', () => {
    it.each([
        [1520, 1420.56, 99.44, 'MANUAL_UNDER_5000', 15, 2],
        [22890, 21392.52, 1497.48, 'EGP_OVER_5000', 6, 7],
    ] as const)('computes the %s baht case without mutating input', (total, net, vat, mode, count, items) => {
        const input = fixture(total), before = JSON.stringify(input), result = computeProcurementCase(input);
        expect(result.grandTotal).toBe(total);
        expect(result.subtotalExclVat).toBe(net);
        expect(result.vatAmount).toBe(vat);
        expect(Math.round((result.subtotalExclVat + result.vatAmount) * 100)).toBe(total * 100);
        expect(result.itemCount).toBe(items);
        expect(result.workflowMode).toBe(mode);
        expect(buildBinderManifest(result).filter(r => r.source === 'GENERATED')).toHaveLength(count);
        expect(validateProcurementCase(result).filter(i => i.severity === 'ERROR')).toEqual([]);
        expect(JSON.stringify(input)).toBe(before);
        expect(result.penaltyBindings['4.1']).toBe(result.penaltyBindings['10']);
        for (const key of ['6.1', '6.2', '11.1', '11.2', '11.3'])
            expect(result.inspectorBindings[key]).toEqual(input.inspectors);
        expect(result.amountInWords).toBe(total === 1520 ? 'หนึ่งพันห้าร้อยยี่สิบบาทถ้วน' : 'สองหมื่นสองพันแปดร้อยเก้าสิบบาทถ้วน');
        expect(result.grandTotalThai).toBe(total === 1520 ? '๑๕๒๐.๐๐' : '๒๒๘๙๐.๐๐');
    });
    it('rounds each line before summing and supports non-VAT vendors and transfers', () => {
        const input = fixture();
        input.vendor.isVatRegistered = false;
        input.items = ['a', 'b'].map(id => ({ id, description: 'เศษหน่วย', quantity: 0.5, unit: 'ชิ้น', unitPrice: 0.01 }));
        input.budgetLine.transferInAmount = 20;
        input.budgetLine.transferOutAmount = 10;
        const result = computeProcurementCase(input);
        expect(result.lineTotals).toEqual([0.01, 0.01]);
        expect(result.grandTotal).toBe(0.02);
        expect(result.subtotalExclVat).toBe(0.02);
        expect(result.vatAmount).toBe(0);
        expect(result.totalBudget).toBe(300010);
        expect(result.budgetRemainingBefore).toBe(299010);
        expect(result.budgetRemainingAfter).toBe(299009.98);
    });
    it.each([[5000, 'MANUAL_UNDER_5000'], [5000.01, 'EGP_OVER_5000']] as const)('selects the exact %s threshold', (amount, mode) => {
        const input = fixture();
        input.items = [{ ...input.items[0], quantity: 1, unitPrice: amount }];
        expect(computeProcurementCase(input).workflowMode).toBe(mode);
    });
    it('warns when an explicit workflow selection overrides the threshold', () => {
        const input = fixture();
        input.workflowModeOverride = 'EGP_OVER_5000';
        const result = computeProcurementCase(input);
        expect(result.workflowMode).toBe('EGP_OVER_5000');
        expect(validateProcurementCase(result).some(i => i.code === 'WORKFLOW_MODE_OVERRIDDEN')).toBe(true);
    });
    it('shares the chosen BUY/HIRE penalty across TOR and PO and computes late fines', () => {
        const buy = computeProcurementCase(fixture());
        const input = fixture();
        input.procurementType = 'HIRE';
        const hire = computeProcurementCase(input);
        expect(buy.penaltyRatePercent).toBe(0.2);
        expect(hire.penaltyRatePercent).toBe(0.1);
        expect(hire.dailyPenalty).toBe(100);
        expect(hire.totalPenalty).toBe(hire.lateDays * 100);
        expect(hire.penaltyBindings).toEqual({ '4.1': 0.1, '10': 0.1 });
        expect(getProcurementTerms('HIRE').orderDocTitle).toBe('ใบสั่งจ้าง');
        input.items = [{ ...input.items[0], quantity: 1, unitPrice: 200000 }];
        expect(computeProcurementCase(input).dailyPenalty).toBe(200);
    });
});
