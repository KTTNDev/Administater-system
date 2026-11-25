import {afterAll,describe,expect,it} from 'vitest';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {closeProcurementBrowser} from '../../procurement/exporters/pdf/browser-pool';
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
import {mergeInventoryPdfs, renderInventoryPdf} from '../templates/html/render-inv-pdf';

async function extractPdfPageTexts(pdfBytes: Buffer): Promise<string[]> {
  const doc = await getDocument({data: new Uint8Array(pdfBytes), useSystemFonts: true}).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map(item => ('str' in item ? item.str : ''))
        .join('')
        .replace(/\u0e4d([\u0e48-\u0e4b]?)\u0e32/g, '$1\u0e33'),
    );
  }
  await doc.cleanup();
  return pages;
}

function buildTestScenario() {
  const a4 = MaterialItemSchema.parse({
    id: 'mat-a4',
    ledgerSeqNo: 1,
    code: '01-001',
    name: 'กระดาษถ่ายเอกสาร เอสี่ แปดสิบ แกรม',
    categoryCode: '01',
    categoryType: 'วัสดุสำนักงาน',
    specification: 'ขนาดมาตรฐาน ห้าร้อย แผ่น',
    unit: 'รีม',
    storageLocation: 'กองสวัสดิการสังคม',
    maxStockQty: 50,
    minStockQty: 5,
  });
  const postIt = MaterialItemSchema.parse({
    id: 'mat-postit',
    ledgerSeqNo: 28,
    code: '',
    name: 'กระดาษโพสอิท คั่นหน้า กองสวัสดิการสังคม',
    categoryCode: '01',
    categoryType: 'วัสดุสำนักงาน',
    specification: 'เนื้อเทป ขนาด 0.5 x 1.7 นิ้ว',
    unit: 'แผง',
    storageLocation: 'กองสวัสดิการสังคม',
    maxStockQty: 40,
    minStockQty: 5,
  });

  let state = {...createEmptyInventoryState(), materials: [a4, postIt]};
  state = recordStockIntake(state, {
    lotId: 'LOT-A4-1',
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
    lotId: 'LOT-A4-2',
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

  // Multi-lot FIFO requisition with separate proxy receiver
  const reqDraft = createRequisitionDraft(state, {
    id: 'req-01',
    requisitionRunningNo: '01',
    fiscalYearBE: 2569,
    requestDate: '2026-02-18',
    requesterName: 'นางสาวณกัญญา ดีเบา',
    requesterPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
    receiverName: 'นายชัยวัฒน์ สิทธิโชค',
    lines: [{materialId: a4.id, requestedQty: 12}],
  });
  state = transitionRequisitionStatus(reqDraft.state, 'req-01', 'SUBMIT_FOR_SIGNATURE').state;
  const committed = transitionRequisitionStatus(state, 'req-01', 'COMMIT_AFTER_SIGNATURE', {
    committedDate: '2026-02-18',
  });
  state = committed.state;

  // Seed 35 ledger entries on Post-it so INV-02 spans 2+ real PDF pages!
  state = recordStockIntake(state, {
    lotId: 'LOT-PI-1',
    materialId: postIt.id,
    fiscalYearBE: 2569,
    receivedDate: '2025-10-01',
    createdOrder: 3,
    sourceType: 'OPENING_BALANCE',
    referenceDocNo: 'ปี 2568',
    unitPrice: 65,
    initialQty: 100,
  }).state;
  for (let i = 1; i <= 34; i++) {
    const day = String(((i - 1) % 25) + 1).padStart(2, '0');
    const month = i <= 17 ? '01' : '02';
    const d = createRequisitionDraft(state, {
      requisitionRunningNo: String(i + 1).padStart(2, '0'),
      fiscalYearBE: 2569,
      requestDate: `2026-${month}-${day}`,
      requesterName: 'นางสาวณกัญญา ดีเบา',
      requesterPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
      lines: [{materialId: postIt.id, requestedQty: 1}],
    });
    state = transitionRequisitionStatus(d.state, d.requisition.id, 'SUBMIT_FOR_SIGNATURE').state;
    state = transitionRequisitionStatus(state, d.requisition.id, 'COMMIT_AFTER_SIGNATURE', {
      committedDate: `2026-${month}-${day}`,
    }).state;
  }

  const asset = AssetItemSchema.parse({
    id: 'asset-1',
    assetCode: '7440-001-0005/68',
    name: 'เครื่องคอมพิวเตอร์ตั้งโต๊ะ',
    brandModel: 'รุ่นมาตรฐาน',
    acquiredDate: '2025-05-01',
    acquisitionCost: 22000,
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
    purpose: 'ใช้ปฏิบัติงานลงพื้นที่',
    loanDate: '2026-03-01',
    dueReturnDate: '2026-03-10',
    status: 'ACTIVE_LOAN',
  });
  state = {...state, assets: [asset], assetLoans: [loan]};

  return {state, req: committed.requisition, a4, postIt, loan};
}

afterAll(async () => {
  await closeProcurementBrowser();
});

describe('Phase 6 Inventory PDF Exporter (Playwright + pdfjs-dist)', () => {
  it('renders INV-01 with exact 5 Chalong columns, 4 signature roles, FIFO split & zero Arabic digits', async () => {
    const {state, req} = buildTestScenario();
    const ir = buildInv01RequisitionForm(state, req);
    const {pdfBytes, pageCount} = await renderInventoryPdf(ir);

    expect(pageCount).toBe(1);
    const pages = await extractPdfPageTexts(pdfBytes);
    const text = pages.join('\n').replace(/\s+/g, ' ');

    // Exact 5 Chalong columns
    for (const col of ['ลำดับ', 'รายการ', 'จำนวน', 'คงเหลือ', 'หมายเหตุ']) {
      expect(text).toContain(col);
    }
    // All 4 signature roles & proxy receiver
    for (const role of ['ผู้เบิก', 'ผู้อนุมัติ', 'ผู้จ่ายวัสดุ', 'ผู้รับของ']) {
      expect(text).toContain(role);
    }
    expect(text).toContain('นายชัยวัฒน์ สิทธิโชค');
    expect(text).toContain('๑๑๕.๐๐');
    expect(text).toContain('๑๒๐.๐๐');
    expect(text).toContain('๐๑/๒๕๖๙');
    // Zero Arabic digits
    expect(text).not.toMatch(/[0-9]/);
  }, 60000);

  it('renders INV-02 multi-page Stock Card with all 10 header fields, accounting notes, and repeated thead', async () => {
    const {state, postIt} = buildTestScenario();
    const ir = buildInv02StockCardForm(state, 2569, {materialId: postIt.id});
    const {pdfBytes, pageCount} = await renderInventoryPdf(ir);

    expect(pageCount).toBeGreaterThanOrEqual(2);
    const pages = await extractPdfPageTexts(pdfBytes);
    const page1 = pages[0].replace(/\s+/g, ' ');
    const page2 = pages[1].replace(/\s+/g, ' ');
    const full = pages.join('\n').replace(/\s+/g, ' ');

    // All 10 official header fields + title
    for (const field of [
      'บัญชีวัสดุ', 'หน้าที่', 'ลำดับที่', 'แผ่นที่',
      'ชื่อหรือชนิดวัสดุ', 'ขนาดหรือลักษณะ', 'ที่เก็บ',
      'ประเภท', 'รหัส', 'หน่วยที่นับ', 'จำนวนอย่างสูง', 'จำนวนอย่างต่ำ',
    ]) {
      expect(page1).toContain(field);
    }
    expect(full).toContain('บันทึกบัญชีเดบิท');
    expect(full).toContain('ค่าวัสดุใช้ไป');
    // Repeated thead on page 2!
    expect(page2).toContain('วัน เดือน ปี');
    expect(page2).toContain('รับจาก/จ่ายให้');
    expect(page2).toContain('คงเหลือ');
    expect(page2).toContain('หมายเหตุ');
    // Zero Arabic digits
    expect(full).not.toMatch(/[0-9]/);
  }, 60000);

  it('renders INV-03, INV-04, INV-05 and merges an annual audit PDF binder with zero Arabic digits', async () => {
    const {state, loan} = buildTestScenario();
    const inv03 = buildInv03AssetLoanForm(state, loan);
    const inv04 = buildInv04CutOffSummaryForm(state, 2569, {asOfDate: '2026-09-30'});
    const inv05 = buildInv05AnnualAudit213Form(state, 2569, {auditDate: '2026-09-30'});

    const merged = await mergeInventoryPdfs([inv03, inv04, inv05]);
    expect(merged.pageCount).toBeGreaterThanOrEqual(3);
    const full = (await extractPdfPageTexts(merged.pdfBytes)).join('\n').replace(/\s+/g, ' ');

    expect(full).toContain('ใบยืมครุภัณฑ์');
    expect(full).toContain('ส่วนที่ ๒ การส่งคืนครุภัณฑ์');
    expect(full).toContain('รายงานสรุปการรับ-จ่าย');
    expect(full).toContain('รวมทั้งสิ้น');
    expect(full).toContain('บันทึกข้อความ');
    expect(full).toContain('ข้อ ๒๑๓');
    expect(full).not.toMatch(/[0-9]/);
  }, 90000);
});
