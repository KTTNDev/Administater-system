import { it, expect } from 'vitest';
import { isWorkingDay, nextWorkingDay, calculateDeliveryDueDate, addCalendarDays, computeProcurementCase } from '../index';
import { fixture } from './fixtures';

it.each([2025, 2026, 2027, 2028, 2029])('contains the fixed official holidays in %s', year => {
    for (const day of ['01-01', '04-06', '04-13', '04-14', '04-15', '05-04', '06-03', '07-28', '08-12', '10-13', '10-23', '12-05', '12-10', '12-31']) {
        expect(isWorkingDay(`${year}-${day}`)).toBe(false);
    }
});
it('moves the acceptance-case Sunday deadline to Monday', () => {
    expect(computeProcurementCase(fixture(22890)).due).toMatchObject({ rawDueDate: '2026-11-22', effectiveDueDate: '2026-11-23', shiftedForHoliday: true });
});
it('handles substitute holidays, leap years and additive calendar extensions', () => {
    expect(isWorkingDay('2025-05-12')).toBe(false);
    expect(isWorkingDay('2026-12-07')).toBe(false);
    expect(isWorkingDay('2026-05-13')).toBe(false);
    expect(isWorkingDay('2026-05-01')).toBe(true);
    expect(nextWorkingDay('2026-11-22')).toBe('2026-11-23');
    const extension = { '2026-11-23': 'วันหยุดเพิ่มเติม' };
    expect(calculateDeliveryDueDate('2026-11-19', 3, extension).effectiveDueDate).toBe('2026-11-24');
    expect(isWorkingDay('2026-05-04', extension)).toBe(false);
    expect(addCalendarDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(() => isWorkingDay('2030-01-02')).toThrow();
    expect(() => calculateDeliveryDueDate('2026-11-19', 0)).toThrow();
});
