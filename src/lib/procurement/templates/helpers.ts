import {toThaiOfficialText, toThaiDigits, toThaiBahtText, formatThaiDate, formatThaiSignatureDate} from '../formatting';
import {formatDocumentNumbers} from '../numbering';
import type {AgencyConfig, ComputedProcurementCase, Person} from '../types';
import type {ApprovalBox, DocumentBlock, DocumentFamily, GeneratedDocId, ParagraphBlock, RenderedDocumentSpec, SignatureBlock, SignatureCluster, TableBlock, TemplateOptions} from './ir';
import {prefersSinglePage, SARABUN_RULES} from './sarabun-rules';

export const text = (value: string | number) => toThaiOfficialText(String(value));
export const moneyText = (amount: number) => toThaiDigits(amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}));
export const dateText = (iso?: string) => iso ? formatThaiDate(iso) : '................';
export const paragraph = (value: string, heading?: string, indent = true): ParagraphBlock => ({kind: 'paragraph', text: text(value), ...(heading ? {heading: text(heading)} : {}), indent});
export const table = (columns: string[], rows: string[][], bordered = true): TableBlock => ({kind: 'table', columns: columns.map(text), rows: rows.map(row => row.map(value => ({text: text(value)}))), footerRows: [], bordered, repeatHeader: true, continuationCaption: 'ตารางรายการ (ต่อ)'});
export function signatory(person: Person, label = '', date?: string, showSignatureLine = true): SignatureBlock {
  const acting = person.actingLine?.trim();
  // A position and its acting capacity form one official role line. Keep the
  // target office underneath; do not duplicate a position already in actingLine.
  const role = acting ? acting.startsWith(person.position) ? acting : `${person.position} ${acting}` : person.position;
  return {kind: 'signature', name: text(person.fullName), lines: [role, person.actingTarget].filter((v): v is string => Boolean(v)).map(text), label: text(label), ...(date ? {date: formatThaiSignatureDate(date)} : {}), showSignatureLine};
}
export function context(c: ComputedProcurementCase, agency: AgencyConfig, options: TemplateOptions = {}) {
  const numbers = formatDocumentNumbers(c.docs, agency);
  const budgetBasis = text(`เทศบัญญัติงบประมาณรายจ่ายประจำปี พ.ศ. ${c.budgetLine.fiscalYearBE} ${agency.divisionName} ${c.budgetLine.planName} ${c.budgetLine.workName} ${c.budgetLine.categoryGroup} ประเภท${c.budgetLine.categoryType} ตั้งไว้ ${moneyText(c.budgetLine.allocatedAmount)} บาท`);
  return {
    c, agency, options, numbers,
    terms: {...c.terms, shortVerb: c.terms.actionVerb, penaltyBaseLabel: c.procurementType === 'BUY' ? 'พัสดุ' : 'งานจ้าง'},
    title: text(c.projectTitle), count: toThaiDigits(c.itemCount), total: moneyText(c.grandTotal),
    amountWords: c.amountInWords,
    inspectorTitle: c.inspectorMode === 'SINGLE' ? 'ผู้ตรวจรับพัสดุ' : 'คณะกรรมการตรวจรับพัสดุ',
    poNumber: text(numbers.doc10_purchaseOrder || `${agency.codes.poPrefix} ........`),
    budgetBasis,
    budgetNarrative: `ตาม${budgetBasis} (${toThaiBahtText(c.budgetLine.allocatedAmount)}) นั้น`,
    vatInclusionPhrase: c.vendor.isVatRegistered ? 'ซึ่งรวมภาษีมูลค่าเพิ่มและภาษีอื่น ค่าขนส่ง ค่าจดทะเบียน และค่าใช้จ่ายอื่น ๆ ทั้งปวงไว้ด้วยแล้ว' : 'ซึ่งรวมภาษีอื่น ค่าขนส่ง ค่าจดทะเบียน และค่าใช้จ่ายอื่น ๆ ทั้งปวงไว้ด้วยแล้ว (ผู้ประกอบการไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม)',
  };
}
export type TemplateContext = ReturnType<typeof context>;

export function inspectorSignatures(x: TemplateContext) {
  return x.c.inspectors.map((member, i) => signatory({id: member.personId ?? String(i), ...member}, member.role === 'CHAIRPERSON' ? 'ประธานกรรมการ' : member.role === 'MEMBER' ? 'กรรมการ' : 'ผู้ตรวจรับพัสดุ'));
}
export function inspectorList(x: TemplateContext): ParagraphBlock[] {
  return x.c.inspectors.map((member, i) => paragraph(`${toThaiDigits(i + 1)}. ${member.fullName} ตำแหน่ง ${member.position} เป็น${member.role === 'CHAIRPERSON' ? 'ประธานกรรมการ' : member.role === 'MEMBER' ? 'กรรมการ' : 'ผู้ตรวจรับพัสดุ'}`, undefined, false));
}
export function approvalBoxes(x: TemplateContext, tiers: 2 | 3, doc: GeneratedDocId): ApprovalBox[] {
  const {signatories: s} = x.c;
  const clerk: ApprovalBox = {heading: text(`เรียน นายก${x.agency.municipalityName}`), comments: [doc === '1' || doc === '2' ? '- เพื่อโปรดพิจารณาอนุมัติ' : '- เพื่อโปรดพิจารณา'], signature: signatory(s.municipalClerk)};
  const mayor: ApprovalBox = {heading: 'อนุมัติ', comments: [], signature: signatory(s.mayor)};
  return tiers === 2 ? [clerk, mayor] : [{heading: text(`เรียน ปลัด${x.agency.municipalityName}`), comments: [doc === '1' ? '- เพื่อโปรดพิจารณาอนุมัติ' : '- เพื่อโปรดทราบ/พิจารณา', '- เห็นควรอนุมัติ'], signature: signatory(s.divisionDirector)}, clerk, mayor];
}
export const cluster = (closing: string[], signatures: SignatureBlock[], approvals: ApprovalBox[] = [], approvalLayout: 'grid' | 'vertical' = 'grid'): SignatureCluster => ({kind: 'signature-cluster', closing: closing.map(text), signatures, approvals: approvals.map(box => ({...box, heading: text(box.heading), comments: box.comments.map(text)})), approvalLayout, keepWithPrevious: true});

const memoKeys = {'1': 'doc1_approvePrinciple', '2': 'doc2_assignSpec', '3': 'doc3_reportSpec', '6.1': 'doc6_1_purchaseRequest', '7': 'doc7_evalReport', '11.1': 'doc11_1_inspectionReport', '12': 'doc12_finalSummary', '13': 'doc13_disbursement'} as const;
export function documentModel(x: TemplateContext, id: GeneratedDocId, family: DocumentFamily, title: string, blocks: DocumentBlock[]): RenderedDocumentSpec {
  const key = family === 'MEMO' ? memoKeys[id as keyof typeof memoKeys] : undefined;
  const entry = key ? x.c.docs[key] : undefined;
  // A final paragraph carries the measured two-line keep contract; do not glue the whole body to the signature.
  const lastParagraph = [...blocks].reverse().find((b): b is ParagraphBlock => b.kind === 'paragraph');
  if (lastParagraph) lastParagraph.keepTrailingLines = 2;
  const subject = text(title);
  const number = key ? text(x.numbers[key] || `${x.agency.codes.internalMemoPrefix}/........`) : undefined;
  return {
    docId: id, family, title: subject, copies: ['6.2', '8', '9'].includes(id) ? 3 : ['10', '11.2'].includes(id) ? 2 : 1,
    header: family === 'MEMO' ? {lines: ['บันทึกข้อความ'], department: text(id === '11.1' ? `${x.inspectorTitle} ${x.agency.municipalityName}` : `${x.agency.sectionName} ${x.agency.divisionName} ${x.agency.municipalityName} โทร. ${x.agency.phoneDisplay}`), number, date: dateText(entry?.date), subject, recipient: text(`นายก${x.agency.municipalityName}`)} : {lines: [subject]},
    pages: [{purpose: 'body', blocks}], footerLines: [], routingStrip: null,
    continuationNote: text(`ใบต่อ${family === 'MEMO' ? 'บันทึกข้อความ' : 'เอกสาร'} เรื่อง ${subject}${number ? ` ที่ ${number}` : ''}${entry?.date ? ` ลงวันที่ ${dateText(entry.date)}` : ''}`),
    layout: {density: x.options.density ?? 'normal', singlePagePreferred: prefersSinglePage(id), keepTrailingBodyLines: 2},
  };
}
export const memo = (x: TemplateContext, id: keyof typeof memoKeys, subject: string, blocks: DocumentBlock[]) => documentModel(x, id, 'MEMO', subject, blocks);
export function routingStrip(x: TemplateContext): RenderedDocumentSpec['routingStrip'] {
  return x.options.showRoutingStrip === false ? null : {visibility: x.options.routingStripCopies ?? 'FIRST_COPY', lines: ['รองนายกเทศมนตรี', 'ปลัดเทศบาล', 'รองปลัดเทศบาล', `ผอ.${x.agency.divisionName}`, 'หัวหน้าฝ่าย', 'หัวหน้างาน', 'จนท./ร่าง/พิมพ์/ทาน'].map(v => text(`........ ${v}`))};
}
export function needsAttachment(x: TemplateContext) {
  if (x.c.itemDisplayMode === 'INLINE') return false;
  if (x.c.itemDisplayMode === 'ATTACHED') return true;
  return x.c.items.length > SARABUN_RULES.attachment.maxInlineItems || x.c.items.reduce((n, i) => n + [...i.description].length, 0) > SARABUN_RULES.attachment.maxInlineDescriptionChars;
}
export const itemsTable = (x: TemplateContext) => ({...table(['ลำดับ', 'รายละเอียด', 'จำนวน', 'หน่วย'], x.c.items.map((item, i) => [toThaiDigits(i + 1), item.description, toThaiDigits(item.quantity), item.unit])), columnWidths: [8, 62, 15, 15]});
export const law21 = () => [paragraph('๑. พระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐', 'ข้อระเบียบและกฎหมาย'), paragraph('๒. ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๒๑')];
export function vatFooter(x: TemplateContext, columns: number): TableBlock['footerRows'] {
  const row = (label: string, value: number, bold = false) => [{text: label, colspan: columns - 1, align: 'right' as const, bold}, {text: moneyText(value), align: 'right' as const, bold}];
  return [...(x.c.vendor.isVatRegistered ? [row(x.c.procurementType === 'HIRE' ? 'รวมมูลค่างานจ้าง' : 'รวมมูลค่าสินค้า', x.c.subtotalExclVat), row('ภาษีมูลค่าเพิ่ม ๗%', x.c.vatAmount)] : []), row('รวมเป็นเงินทั้งสิ้น', x.c.grandTotal, true)];
}
