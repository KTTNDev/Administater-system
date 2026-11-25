import {describe,expect,it} from 'vitest';
import JSZip from 'jszip';
import {DOMParser} from '@xmldom/xmldom';
import {
  createEmptyInventoryState,
  createRequisitionDraft,
  recordStockIntake,
  transitionRequisitionStatus,
} from '../fifo-engine';
import {AssetItemSchema, AssetLoanSchema, MaterialItemSchema} from '../schema';
import {
  buildInv01RequisitionForm,
  buildInv02StockCardForm,
  buildInv03AssetLoanForm,
  buildInv04CutOffSummaryForm,
  buildInv05AnnualAudit213Form,
} from '../templates/build-forms';
import {packageInventoryDocxZip, renderInventoryDocx} from '../templates/docx/render-inv-docx';

async function parseDocxXml(docxBytes: Buffer) {
  const zip = await JSZip.loadAsync(docxBytes);
  const xml = await zip.file('word/document.xml')!.async('string');
  const stylesXml = await zip.file('word/styles.xml')!.async('string');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const textNodes = Array.from(doc.getElementsByTagName('w:t'));
  const visibleText = textNodes.map(n => n.textContent ?? '').join('');
  return {zip, xml, stylesXml, doc, visibleText};
}

function buildScenario() {
  const a4 = MaterialItemSchema.parse({
    id: 'mat-a4',
    ledgerSeqNo: 1,
    code: '01-001',
    name: 'กระดาษถ่ายเอกสาร เอสี่',
    categoryCode: '01',
    categoryType: 'วัสดุสำนักงาน',
    specification: 'แปดสิบ แกรม',
    unit: 'รีม',
    storageLocation: 'กองสวัสดิการสังคม',
    maxStockQty: 50,
    minStockQty: 5,
  });
  let state = {...createEmptyInventoryState(), materials: [a4]};
  state = recordStockIntake(state, {
    lotId: 'LOT-1',
    materialId: a4.id,
    fiscalYearBE: 2569,
    receivedDate: '2025-10-01',
    createdOrder: 1,
    sourceType: 'OPENING_BALANCE',
    referenceDocNo: 'ปี 2568',
    unitPrice: 115,
    initialQty: 2,
  }).state;
  state = recordStockIntake(state, {
    lotId: 'LOT-2',
    materialId: a4.id,
    fiscalYearBE: 2569,
    receivedDate: '2025-11-10',
    createdOrder: 2,
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านดินสอสี)',
    referenceDocNo: 'สว 05/2569',
    unitPrice: 120,
    initialQty: 30,
  }).state;

  const d = createRequisitionDraft(state, {
    id: 'req-1',
    requisitionRunningNo: '01',
    fiscalYearBE: 2569,
    requestDate: '2026-02-18',
    requesterName: 'นางสาวณกัญญา ดีเบา',
    requesterPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
    receiverName: 'นายชัยวัฒน์ สิทธิโชค',
    lines: [{materialId: a4.id, requestedQty: 12}],
  });
  state = transitionRequisitionStatus(d.state, 'req-1', 'SUBMIT_FOR_SIGNATURE').state;
  const committed = transitionRequisitionStatus(state, 'req-1', 'COMMIT_AFTER_SIGNATURE', {
    committedDate: '2026-02-18',
  });
  state = committed.state;

  const asset = AssetItemSchema.parse({
    id: 'asset-1',
    assetCode: '7440-001-0005/68',
    name: 'เครื่องพิมพ์เลเซอร์',
    brandModel: 'รุ่นมาตรฐาน',
    acquiredDate: '2025-05-01',
    acquisitionCost: 12500,
    custodianName: 'นายกิตตินันท์ พลรบ',
    condition: 'GOOD',
  });
  const loan = AssetLoanSchema.parse({
    id: 'loan-1',
    loanRunningNo: '01',
    fiscalYearBE: 2569,
    assetId: asset.id,
    borrowerName: 'นายชัยวัฒน์ สิทธิโชค',
    borrowerPosition: 'ผู้ช่วยนักพัฒนาชุมชน',
    borrowerDepartment: 'กองสวัสดิการสังคม',
    purpose: 'ใช้ในโครงการชุมชน',
    loanDate: '2026-03-01',
    dueReturnDate: '2026-03-10',
    status: 'ACTIVE_LOAN',
  });
  state = {...state, assets: [asset], assetLoans: [loan]};
  return {state, req: committed.requisition, a4, loan};
}

describe('Phase 6 Inventory DOCX Exporter (docx + jszip + @xmldom/xmldom)', () => {
  it('renders INV-01 .docx with 5 exact columns, 4 signature roles, tblHeader/cantSplit/keepNext & zero Arabic digits', async () => {
    const {state, req} = buildScenario();
    const bytes = await renderInventoryDocx(buildInv01RequisitionForm(state, req));
    const {xml, stylesXml, doc, visibleText} = await parseDocxXml(bytes);

    expect(stylesXml).toContain('TH SarabunIT๙');
    expect(xml).toContain('<w:tblHeader');
    expect(xml).toContain('<w:cantSplit');
    expect(xml).toContain('<w:keepNext');
    expect(doc.getElementsByTagName('w:tbl').length).toBeGreaterThanOrEqual(2);

    for (const col of ['ลำดับ', 'รายการ', 'จำนวน', 'คงเหลือ', 'หมายเหตุ']) {
      expect(visibleText).toContain(col);
    }
    for (const role of ['ผู้เบิก', 'ผู้อนุมัติ', 'ผู้จ่ายวัสดุ', 'ผู้รับของ']) {
      expect(visibleText).toContain(role);
    }
    expect(visibleText).toContain('นายชัยวัฒน์ สิทธิโชค');
    expect(visibleText).toContain('๑๑๕.๐๐');
    expect(visibleText).toContain('๑๒๐.๐๐');
    expect(visibleText).not.toMatch(/[0-9]/);
  });

  it('renders INV-02 .docx with 10 header fields, 2-tier merged tblHeader, debit/expense notes & zero Arabic digits', async () => {
    const {state, a4} = buildScenario();
    const bytes = await renderInventoryDocx(buildInv02StockCardForm(state, 2569, {materialId: a4.id}));
    const {xml, doc, visibleText} = await parseDocxXml(bytes);

    // 2 header rows both marked <w:tblHeader/> + merged cells
    expect(doc.getElementsByTagName('w:tblHeader').length).toBe(2);
    expect(xml).toContain('<w:vMerge');
    expect(xml).toContain('<w:gridSpan w:val="3"');
    expect(xml).toContain('<w:cantSplit');

    for (const field of [
      'บัญชีวัสดุ', 'หน้าที่', 'ลำดับที่', 'แผ่นที่',
      'ชื่อหรือชนิดวัสดุ', 'ขนาดหรือลักษณะ', 'ที่เก็บ',
      'ประเภท', 'รหัส', 'หน่วยที่นับ', 'จำนวนอย่างสูง', 'จำนวนอย่างต่ำ',
    ]) {
      expect(visibleText).toContain(field);
    }
    expect(visibleText).toContain('บันทึกบัญชีเดบิท');
    expect(visibleText).toContain('ค่าวัสดุใช้ไป');
    expect(visibleText).not.toMatch(/[0-9]/);
  });

  it('renders INV-03, INV-04, INV-05 .docx and packages a multi-document ZIP archive cleanly', async () => {
    const {state, loan} = buildScenario();
    const inv03 = buildInv03AssetLoanForm(state, loan);
    const inv04 = buildInv04CutOffSummaryForm(state, 2569, {asOfDate: '2026-09-30'});
    const inv05 = buildInv05AnnualAudit213Form(state, 2569, {auditDate: '2026-09-30'});

    for (const [form, marker] of [
      [inv03, 'ใบยืมครุภัณฑ์'],
      [inv04, 'รายงานสรุปการรับ-จ่าย'],
      [inv05, 'ข้อ ๒๑๓'],
    ] as const) {
      const bytes = await renderInventoryDocx(form);
      const {visibleText, xml} = await parseDocxXml(bytes);
      expect(visibleText).toContain(marker);
      expect(visibleText).not.toMatch(/[0-9]/);
      expect(xml).toContain('<w:tblHeader');
    }

    const zipBytes = await packageInventoryDocxZip([
      {filename: 'INV-03-ใบยืมครุภัณฑ์.docx', form: inv03},
      {filename: 'INV-04-รายงานสรุปวัสดุ.docx', form: inv04},
      {filename: 'INV-05-รายงานตรวจนับข้อ213.docx', form: inv05},
    ]);
    const zip = await JSZip.loadAsync(zipBytes);
    expect(Object.keys(zip.files)).toHaveLength(3);
  });
});
