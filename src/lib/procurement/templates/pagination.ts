import type {TableBlock} from './ir';

export interface TableMeasurements {
  headerHeight: number; continuationCaptionHeight: number; rowHeights: readonly number[];
  footerHeight: number; firstPageHeight: number; continuationPageHeight: number;
}
/** Phase 3 supplies actual browser measurements. Units may be px or pt, but must be consistent. */
export function splitTableByMeasuredRows(table: TableBlock, measurements: TableMeasurements): TableBlock[] {
  const {headerHeight, continuationCaptionHeight, rowHeights, footerHeight, firstPageHeight, continuationPageHeight} = measurements;
  const all = [headerHeight, continuationCaptionHeight, footerHeight, firstPageHeight, continuationPageHeight, ...rowHeights];
  if (all.some(n => !Number.isFinite(n) || n < 0) || firstPageHeight <= 0 || continuationPageHeight <= 0 || rowHeights.length !== table.rows.length) throw new RangeError('ข้อมูลวัดตารางไม่ถูกต้อง');
  const result: TableBlock[] = [];
  let start = 0, used = headerHeight, capacity = firstPageHeight;
  for (let i = 0; i < rowHeights.length; i++) {
    const required = rowHeights[i] + (i === rowHeights.length - 1 ? footerHeight : 0);
    if (used + required > capacity) {
      if (i > start) result.push({...table, rows: table.rows.slice(start, i), footerRows: [], continued: result.length > 0});
      else throw new RangeError('แถวตารางสูงเกินพื้นที่หน้ากระดาษ ต้องย้ายตารางหรือจัดหน้าก่อนแบ่งแถว');
      start = i;
      used = headerHeight + continuationCaptionHeight;
      capacity = continuationPageHeight;
      if (used + required > capacity) throw new RangeError('แถวตารางสูงเกินพื้นที่หน้ากระดาษ');
    }
    used += rowHeights[i];
  }
  if (!rowHeights.length && headerHeight + footerHeight > firstPageHeight) throw new RangeError('ตารางสูงเกินพื้นที่หน้ากระดาษ');
  result.push({...table, rows: table.rows.slice(start), footerRows: table.footerRows, continued: result.length > 0});
  return result;
}
