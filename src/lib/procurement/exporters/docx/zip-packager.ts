import 'server-only';
import JSZip from 'jszip';
import {buildDocumentModels} from '../../templates/build-all';
import {buildBinderManifest} from '../../manifest';
import {toThaiDigits} from '../../formatting';
import type {AgencyConfig, ComputedProcurementCase} from '../../types';
import type {GeneratedDocId,Density} from '../../templates/ir';
import {stampReminder} from '../checklist';
import {renderDocumentDocx} from './render-doc-docx';

export const WORD_FILENAMES: Record<GeneratedDocId, string> = {
  '1': '01_บันทึกข้อความ_ขออนุมัติจัดซื้อจัดจ้าง.docx',
  '2': '02_บันทึกข้อความ_ขออนุมัติมอบหมายกำหนดคุณลักษณะ.docx',
  '3': '03_บันทึกข้อความ_รายงานผลกำหนดคุณลักษณะ.docx',
  '4.1': '04-1_รายละเอียดคุณลักษณะเฉพาะ_TOR.docx',
  '6.1': '06-1_บันทึกข้อความ_รายงานขอซื้อขอจ้าง.docx',
  '6.2': '06-2_คำสั่งแต่งตั้งผู้ตรวจรับพัสดุ.docx',
  '7': '07_บันทึกข้อความ_รายงานผลการพิจารณา.docx',
  '8': '08_ประกาศผู้ชนะการเสนอราคา.docx',
  '9': '09_หนังสือแจ้งลงนามในสัญญา.docx',
  '10': '10_ใบสั่งซื้อใบสั่งจ้าง.docx',
  '11.1': '11-1_บันทึกข้อความ_รายงานผลการตรวจรับพัสดุ.docx',
  '11.2': '11-2_ใบตรวจรับพัสดุ.docx',
  '11.3': '11-3_รูปภาพประกอบการตรวจรับ.docx',
  '12': '12_บันทึกข้อความ_รายงานผลการพิจารณา_ส่งตั้งหนี้.docx',
  '13': '13_บันทึกข้อความ_ขออนุมัติเบิกจ่ายเงิน.docx',
};
export function binderChecklistText(c: ComputedProcurementCase) {
  return ['รายการเรียงแฟ้มและเตือนวันที่', ...buildBinderManifest(c).map(row => `${toThaiDigits(row.docId)} ${row.title} — ${row.source === 'GENERATED' ? `พิมพ์ ${toThaiDigits(row.copies)} ชุด` : 'แทรกเอกสารจากร้านค้าหรือระบบต้นทาง'}`), '', stampReminder(c, '4.2'), stampReminder(c, '11.4')].join('\r\n');
}
export async function packageDocxZip(c: ComputedProcurementCase, agency: AgencyConfig, density?:Density) {
  const zip = new JSZip();
  zip.file('00_รายการเรียงแฟ้มและเตือนวันที่.txt', '\uFEFF' + binderChecklistText(c));
  // Native DOCX building is cheap; serialize to avoid retaining fifteen embedded-font buffers at once.
  for (const model of buildDocumentModels(c, agency,{density})) zip.file(WORD_FILENAMES[model.docId], await renderDocumentDocx(model));
  return zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: {level: 6}});
}
