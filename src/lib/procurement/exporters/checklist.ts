import type {ComputedProcurementCase} from '../types';
import {dateText} from '../templates/helpers';

export function stampReminder(c: ComputedProcurementCase, id: string): string {
  if (['4.2', '11.5'].includes(id)) return `ต้องปั๊มวันที่เดียวกับข้อ ๓: ${dateText(c.docs.doc3_reportSpec.date)}`;
  if (id === '11.4') return `วันที่บิลส่งของต้องตรงกับใบตรวจรับ: ${dateText(c.docs.doc11_1_inspectionReport.date)}`;
  return 'ตรวจเลขที่ วันที่ และรายละเอียดให้ตรงกับเอกสารต้นทางก่อนเข้าแฟ้ม';
}
