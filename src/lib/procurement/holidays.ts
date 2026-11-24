// Special holidays: https://www.bot.or.th/th/news-and-media/news/news-20241127.html
// 2026-12-16 cabinet holiday: https://www.bot.or.th/th/news-and-media/news/news-20261117.html
// Ploughing dates: https://udh.moph.go.th/udh/wp-content/uploads/wpforo_4/default_attachments/1733467897-2568.pdf
// https://library.nhrc.or.th/th/opening-hours-close-calendar
import { ISODateSchema } from './schema';
export type HolidayCalendar = Readonly<Record<string, string>>;
export const HOLIDAY_COVERAGE = { from: '2025-01-01', to: '2029-12-31', provisionalYears: [2027, 2028, 2029], note: 'ปฏิทินฐานราชการ ไม่ใช่วันหยุดธนาคาร; วันจันทรคติและวันหยุดพิเศษอนาคตต้องตรวจประกาศเพิ่ม' } as const;
const lunar: Record<number, string[]> = { 2025: ['02-12', '05-11', '07-10', '07-11'], 2026: ['03-03', '05-31', '07-29', '07-30'], 2027: ['02-21', '05-20', '07-18', '07-19'], 2028: ['02-10', '05-08', '07-06', '07-07'], 2029: ['02-28', '05-27', '07-25', '07-26'] };
export function addCalendarDays(iso: string, days: number) { ISODateSchema.parse(iso); if (!Number.isInteger(days) || Math.abs(days) > 10000)
    throw new RangeError('จำนวนวันไม่ถูกต้อง'); const d = new Date(iso + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); }
const weekend = (d: string) => [0, 6].includes(new Date(d + 'T00:00:00Z').getUTCDay());
const makeCalendar = () => {
    const c: Record<string, string> = {};
    for (let y = 2025; y <= 2029; y++) {
        for (const [date, name] of Object.entries({ '01-01': 'วันขึ้นปีใหม่', '04-06': 'วันจักรี', '04-13': 'วันสงกรานต์', '04-14': 'วันสงกรานต์', '04-15': 'วันสงกรานต์', '05-04': 'วันฉัตรมงคล', '06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี', '07-28': 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว', '08-12': 'วันแม่แห่งชาติ', '10-13': 'วันนวมินทรมหาราช', '10-23': 'วันปิยมหาราช', '12-05': 'วันพ่อแห่งชาติ', '12-10': 'วันรัฐธรรมนูญ', '12-31': 'วันสิ้นปี' }))
            c[`${y}-${date}`] = name;
        lunar[y].forEach((d, i) => c[`${y}-${d}`] = ['วันมาฆบูชา', 'วันวิสาขบูชา', 'วันอาสาฬหบูชา', 'วันเข้าพรรษา'][i]);
    }
    for (const [d, n] of Object.entries({ ...c })) {
        if (!weekend(d))
            continue;
        let next = addCalendarDays(d, 1);
        while (weekend(next) || c[next])
            next = addCalendarDays(next, 1);
        c[next] = 'ชดเชย' + n;
    }
    Object.assign(c, { '2025-05-09': 'วันพืชมงคล', '2026-05-13': 'วันพืชมงคล', '2025-06-02': 'วันหยุดราชการพิเศษ', '2025-08-11': 'วันหยุดราชการพิเศษ', '2026-01-02': 'วันหยุดราชการพิเศษ', '2026-12-16': 'วันหยุดราชการพิเศษ' });
    return Object.freeze(c);
};
export const THAI_PUBLIC_HOLIDAYS = makeCalendar();
export function isWorkingDay(iso: string, calendar: HolidayCalendar = THAI_PUBLIC_HOLIDAYS) { ISODateSchema.parse(iso); if (iso < HOLIDAY_COVERAGE.from || iso > HOLIDAY_COVERAGE.to)
    throw new RangeError('วันที่อยู่นอกปฏิทินที่รองรับ'); return !weekend(iso) && !(calendar[iso] ?? THAI_PUBLIC_HOLIDAYS[iso]); }
export function nextWorkingDay(iso: string, calendar: HolidayCalendar = THAI_PUBLIC_HOLIDAYS) { let d = ISODateSchema.parse(iso); while (!isWorkingDay(d, calendar))
    d = addCalendarDays(d, 1); return d; }
export function calculateDeliveryDueDate(poDate: string, deliveryDays: number, calendar: HolidayCalendar = THAI_PUBLIC_HOLIDAYS) { if (!Number.isInteger(deliveryDays) || deliveryDays <= 0)
    throw new RangeError('จำนวนวันต้องเป็นจำนวนเต็มบวก'); const rawDueDate = addCalendarDays(poDate, deliveryDays), effectiveDueDate = nextWorkingDay(rawDueDate, calendar); return { rawDueDate, effectiveDueDate, shiftedForHoliday: rawDueDate !== effectiveDueDate }; }
