import 'server-only';
import type {ComputedProcurementCase} from '../../types';
import type {buildBinderManifest} from '../../manifest';
import {paragraph, table, text} from '../../templates/helpers';
import {toThaiDigits} from '../../formatting';
import {stampReminder} from '../checklist';
import type {RenderedDocumentSpec} from '../../templates/ir';
import {renderDocumentPdf} from './render-doc-pdf';

export type BinderEntry = ReturnType<typeof buildBinderManifest>[number];
function sheet(title: string, blocks: RenderedDocumentSpec['pages'][number]['blocks']): RenderedDocumentSpec {
  return {docId: '1', family: 'TOR', title, copies: 1, header: {lines: [title]}, pages: [{purpose: 'body', blocks}], footerLines: [], continuationNote: `ใบต่อ${title}`, routingStrip: null, layout: {density: 'normal', singlePagePreferred: false, keepTrailingBodyLines: 2}};
}
export function buildDividerModel(c: ComputedProcurementCase, row: BinderEntry, filingIndex: number) {
  const from = row.source === 'VENDOR_EXTERNAL' ? 'ร้านค้า' : row.source === 'LAAS_EXTERNAL' ? 'ระบบ e-LAAS' : 'ระบบ e-GP / e-LAAS';
  const reference = row.docId === '5.1' ? c.docs.laasPurchaseReportNo : row.docId === '5.2' ? c.docs.laasContractNo : c.docs.egpProjectNo;
  return sheet('แผ่นคั่นเอกสารสำหรับเรียงแฟ้ม', [
    paragraph(`ลำดับที่ ${filingIndex} — เอกสารแทรกจาก${from}`, undefined, false),
    paragraph(`${row.docId} ${row.title}`, 'ชื่อเอกสาร', false),
    paragraph(stampReminder(c, row.docId), 'วันที่ต้องปั๊มหรือตรวจสอบ', false),
    ...(reference ? [paragraph(toThaiDigits(reference), 'เลขอ้างอิง', false)] : []),
    paragraph('☐ ใส่เอกสารตัวจริงแล้ว  ☐ ตรวจเลขที่และวันที่แล้ว', undefined, false),
    paragraph('(แผ่นคั่นสำหรับจัดเรียงแฟ้ม — ดึงออกหลังเสียบเอกสารตัวจริง)', 'หมายเหตุ', false),
  ]);
}
export async function renderDividerSheet(c: ComputedProcurementCase, row: BinderEntry, filingIndex: number) {
  return renderDocumentPdf(buildDividerModel(c, row, filingIndex));
}
export function buildCoverChecklist(c: ComputedProcurementCase, rows: BinderEntry[]) {
  const checklist = table(['ลำดับ', 'เอกสาร', 'จำนวนชุด', 'ตรวจครบ'], rows.map(row => [row.docId, row.title, row.source === 'GENERATED' ? String(row.copies) : 'เอกสารแทรก', '☐']));
  return sheet('รายการเรียงแฟ้มและเตือนวันที่', [paragraph(text(c.projectTitle), undefined, false), checklist, paragraph(stampReminder(c, '4.2'), undefined, false), paragraph(stampReminder(c, '11.4'), undefined, false)]);
}
