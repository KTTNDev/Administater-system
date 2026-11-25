import {
  carryForwardFiscalYear,
  createEmptyInventoryState,
  createRequisitionDraft,
  recordStockIntake,
  transitionAssetLoanStatus,
  transitionRequisitionStatus,
  type CarryForwardResult,
} from './fifo-engine';
import {buildAnnualAudit213Report, buildFiscalYearSummary, buildQuarterlyCutOffReport} from './reports';
import {AssetItemSchema, AssetLoanSchema, MaterialItemSchema} from './schema';
import type {InventoryDomainState} from './types';

function commitReq(
  state: InventoryDomainState,
  input: {
    id: string;
    runningNo: string;
    fiscalYearBE: number;
    requestDate: string;
    committedDate: string;
    requesterName: string;
    requesterPosition: string;
    receiverName?: string;
    purpose: string;
    lines: Array<{materialId: string; requestedQty: number}>;
  },
): InventoryDomainState {
  const draft = createRequisitionDraft(state, {
    id: input.id,
    requisitionRunningNo: input.runningNo,
    fiscalYearBE: input.fiscalYearBE,
    requestDate: input.requestDate,
    requesterName: input.requesterName,
    requesterPosition: input.requesterPosition,
    receiverName: input.receiverName,
    purpose: input.purpose,
    lines: input.lines,
  });
  const pending = transitionRequisitionStatus(draft.state, input.id, 'SUBMIT_FOR_SIGNATURE');
  const committed = transitionRequisitionStatus(pending.state, input.id, 'COMMIT_AFTER_SIGNATURE', {
    committedDate: input.committedDate,
  });
  return committed.state;
}

export interface FullYearDemoBundle {
  state: InventoryDomainState;
  carryForward: CarryForwardResult;
  fy2569Summary: ReturnType<typeof buildFiscalYearSummary>;
  fy2569Quarters: Array<ReturnType<typeof buildQuarterlyCutOffReport>>;
  fy2569Audit: ReturnType<typeof buildAnnualAudit213Report>;
  fy2570Summary: ReturnType<typeof buildFiscalYearSummary>;
}

/**
 * Generates a realistic 10-material + 4-asset Chalong full fiscal-year lifecycle:
 *  - Opening balances (1 ต.ค. 2568 / ต้นปีงบ 2569)
 *  - Q1–Q4 multi-lot procurement intakes & FIFO requisitions (FY 2569)
 *  - Year-end cut-off & reconciliation (30 ก.ย. 2569)
 *  - Carry-Forward (`ยอดยกมา`) to FY 2570 (1 ต.ค. 2569) preserving exact multi-lot FIFO price layers
 *  - Early FY 2570 stock-in, committed requisition, AND 1 live `PENDING_SIGNATURE` requisition (with proxy receiver)
 */
export function buildFullFiscalYearDemoState(): FullYearDemoBundle {
  const materials = [
    MaterialItemSchema.parse({
      id: 'demo-mat-01-a4',
      ledgerSeqNo: 1,
      code: '01-001',
      name: 'กระดาษถ่ายเอกสาร A4 80 แกรม',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      specification: 'ขนาด A4 ความหนา 80 แกรม (500 แผ่น/รีม)',
      unit: 'รีม',
      storageLocation: 'ห้องพัสดุ กองสวัสดิการสังคม',
      maxStockQty: 60,
      minStockQty: 10,
    }),
    MaterialItemSchema.parse({
      id: 'demo-mat-02-postit',
      ledgerSeqNo: 2,
      code: '01-002',
      name: 'กระดาษโพสอิท คั่นหน้า กองสวัสดิการสังคม',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      specification: 'เนื้อเทป ขนาด 0.5 x 1.7 นิ้ว คละสี',
      unit: 'แผง',
      storageLocation: 'ห้องพัสดุ กองสวัสดิการสังคม',
      maxStockQty: 50,
      minStockQty: 5,
    }),
    MaterialItemSchema.parse({
      id: 'demo-mat-03-pen',
      ledgerSeqNo: 3,
      code: '01-003',
      name: 'ปากกาลูกลื่น หมึกน้ำเงิน 0.5 มม.',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      specification: 'หัวเข็ม 0.5 มม. หมึกน้ำเงิน',
      unit: 'ด้าม',
      storageLocation: 'ห้องพัสดุ กองสวัสดิการสังคม',
      maxStockQty: 100,
      minStockQty: 12,
    }),
    MaterialItemSchema.parse({
      id: 'demo-mat-04-folder',
      ledgerSeqNo: 4,
      code: '01-004',
      name: 'แฟ้มสันกว้าง 3 นิ้ว สีดำ',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      specification: 'ปกแข็งกันน้ำ ขนาด F4 สันกว้าง 3 นิ้ว',
      unit: 'แฟ้ม',
      storageLocation: 'ห้องพัสดุ กองสวัสดิการสังคม',
      maxStockQty: 40,
      minStockQty: 5,
    }),
    MaterialItemSchema.parse({
      id: 'demo-mat-05-staples',
      ledgerSeqNo: 5,
      code: '01-005',
      name: 'ลวดเย็บกระดาษ เบอร์ 10',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      specification: 'มาตรฐานเบอร์ 10 (1,000 เข็ม/กล่อง)',
      unit: 'กล่อง',
      storageLocation: 'ห้องพัสดุ กองสวัสดิการสังคม',
      maxStockQty: 60,
      minStockQty: 10,
    }),
    MaterialItemSchema.parse({
      id: 'demo-mat-06-toner',
      ledgerSeqNo: 6,
      code: '12-001',
      name: 'หมึกพิมพ์เลเซอร์ สีดำ (Toner)',
      categoryCode: '12',
      categoryType: 'วัสดุคอมพิวเตอร์',
      specification: 'ตลับหมึกแท้ สำหรับเครื่องพิมพ์ HP LaserJet',
      unit: 'ตลับ',
      storageLocation: 'ตู้เก็บวัสดุคอมพิวเตอร์ กองสวัสดิการสังคม',
      maxStockQty: 10,
      minStockQty: 2,
    }),
    MaterialItemSchema.parse({
      id: 'demo-mat-07-usb',
      ledgerSeqNo: 7,
      code: '12-002',
      name: 'แฟลชไดรฟ์ 64 GB USB 3.0',
      categoryCode: '12',
      categoryType: 'วัสดุคอมพิวเตอร์',
      specification: 'ความจุ 64 GB มาตรฐาน USB 3.0',
      unit: 'อัน',
      storageLocation: 'ตู้เก็บวัสดุคอมพิวเตอร์ กองสวัสดิการสังคม',
      maxStockQty: 15,
      minStockQty: 2,
    }),
    MaterialItemSchema.parse({
      id: 'demo-mat-08-tissue',
      ledgerSeqNo: 8,
      code: '03-001',
      name: 'กระดาษชำระม้วนใหญ่ (JRT)',
      categoryCode: '03',
      categoryType: 'วัสดุงานบ้านงานครัว',
      specification: 'ความหนา 2 ชั้น ความยาว 300 เมตร/ม้วน',
      unit: 'ม้วน',
      storageLocation: 'ห้องเก็บพัสดุชั้นล่าง',
      maxStockQty: 30,
      minStockQty: 6,
    }),
    MaterialItemSchema.parse({
      id: 'demo-mat-09-battery',
      ledgerSeqNo: 9,
      code: '02-001',
      name: 'ถ่านอัลคาไลน์ ขนาด AA (แพ็ค 4 ก้อน)',
      categoryCode: '02',
      categoryType: 'วัสดุไฟฟ้าและวิทยุ',
      specification: 'แรงดัน 1.5V แพ็คละ 4 ก้อน',
      unit: 'แพ็ค',
      storageLocation: 'ห้องพัสดุ กองสวัสดิการสังคม',
      maxStockQty: 24,
      minStockQty: 4,
    }),
    MaterialItemSchema.parse({
      id: 'demo-mat-10-box',
      ledgerSeqNo: 10,
      code: '04-001',
      name: 'กล่องพลาสติกอเนกประสงค์ มีฝาปิด 120 ลิตร',
      categoryCode: '04',
      categoryType: 'วัสดุก่อสร้าง',
      specification: 'พร้อมล้อเลื่อน ขนาด 120 ลิตร',
      unit: 'ใบ',
      storageLocation: 'ห้องเก็บพัสดุชั้นล่าง',
      maxStockQty: 10,
      minStockQty: 2,
    }),
  ];

  const assets = [
    AssetItemSchema.parse({
      id: 'demo-asset-01',
      assetCode: '7440-001-0001/67',
      name: 'เครื่องคอมพิวเตอร์โน้ตบุ๊ก',
      brandModel: 'Lenovo ThinkPad E14 Gen 5',
      acquiredDate: '2024-03-15',
      acquisitionCost: 28500,
      assignedLocation: 'กองสวัสดิการสังคม',
      custodianName: 'นางสาวณกัญญา ดีเบา',
      condition: 'GOOD',
      note: 'ใช้งานราชการและลงพื้นที่สำรวจข้อมูล',
    }),
    AssetItemSchema.parse({
      id: 'demo-asset-02',
      assetCode: '7440-004-0002/68',
      name: 'กล้องถ่ายภาพดิจิทัลพร้อมเลนส์',
      brandModel: 'Canon EOS R50 Kit 18-45mm',
      acquiredDate: '2025-02-20',
      acquisitionCost: 24900,
      assignedLocation: 'กองสวัสดิการสังคม',
      custodianName: 'นายกิตตินันท์ พลรบ',
      condition: 'GOOD',
      note: 'ใช้บันทึกภาพกิจกรรมผู้สูงอายุและสวัสดิการชุมชน',
    }),
    AssetItemSchema.parse({
      id: 'demo-asset-03',
      assetCode: '7110-003-0005/65',
      name: 'เครื่องพิมพ์เลเซอร์สี',
      brandModel: 'Brother HL-L3270CDW',
      acquiredDate: '2022-06-10',
      acquisitionCost: 14200,
      assignedLocation: 'กองสวัสดิการสังคม',
      custodianName: 'นางสาวศิริวรรณ ไทยมิตรชอบ',
      condition: 'DAMAGED_REPAIRABLE',
      note: 'ชุดดึงกระดาษชำรุด อยู่ระหว่างส่งซ่อม',
    }),
    AssetItemSchema.parse({
      id: 'demo-asset-04',
      assetCode: '7110-001-0011/60',
      name: 'ตู้เก็บเอกสารเหล็ก 4 ลิ้นชัก',
      brandModel: 'Lucky World รุ่น K-4',
      acquiredDate: '2017-08-05',
      acquisitionCost: 6800,
      assignedLocation: 'ห้องเก็บเอกสาร กองสวัสดิการสังคม',
      custodianName: 'นายกิตตินันท์ พลรบ',
      condition: 'UNSERVICEABLE_DISPOSE',
      note: 'รางลิ้นชักผุกร่อน เสนอขอจำหน่ายประจำปี',
    }),
  ];

  let state: InventoryDomainState = {
    ...createEmptyInventoryState(),
    materials,
    assets,
  };

  // =========================================================================
  // 1. ต้นปีงบประมาณ พ.ศ. 2569 (1 ต.ค. 2568) — ตั้งยอดยกมา (OPENING_BALANCE)
  // =========================================================================
  const openingIntakes = [
    {id: 'demo-mat-01-a4', qty: 10, price: 120},
    {id: 'demo-mat-02-postit', qty: 20, price: 65},
    {id: 'demo-mat-03-pen', qty: 24, price: 12},
    {id: 'demo-mat-04-folder', qty: 10, price: 55},
    {id: 'demo-mat-05-staples', qty: 15, price: 12},
    {id: 'demo-mat-08-tissue', qty: 12, price: 45},
    {id: 'demo-mat-09-battery', qty: 6, price: 65},
  ];
  for (const item of openingIntakes) {
    state = recordStockIntake(state, {
      materialId: item.id,
      fiscalYearBE: 2569,
      receivedDate: '2025-10-01',
      sourceType: 'OPENING_BALANCE',
      referenceDocNo: 'ปี 2568',
      unitPrice: item.price,
      initialQty: item.qty,
    }).state;
  }

  // =========================================================================
  // 2. ไตรมาส 1 ปีงบ 2569 (ต.ค. – ธ.ค. 2568)
  // =========================================================================
  state = recordStockIntake(state, {
    materialId: 'demo-mat-01-a4',
    fiscalYearBE: 2569,
    receivedDate: '2025-11-10',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านดินสอสี)',
    referenceDocNo: 'สว 05/2569',
    unitPrice: 125,
    initialQty: 30,
  }).state;
  state = recordStockIntake(state, {
    materialId: 'demo-mat-06-toner',
    fiscalYearBE: 2569,
    receivedDate: '2025-11-18',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (บริษัท ภูเก็ตไอทีซัพพลาย จำกัด)',
    referenceDocNo: 'สว 07/2569',
    unitPrice: 1850,
    initialQty: 4,
  }).state;
  state = recordStockIntake(state, {
    materialId: 'demo-mat-07-usb',
    fiscalYearBE: 2569,
    receivedDate: '2025-11-18',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (บริษัท ภูเก็ตไอทีซัพพลาย จำกัด)',
    referenceDocNo: 'สว 07/2569',
    unitPrice: 220,
    initialQty: 6,
  }).state;

  state = commitReq(state, {
    id: 'demo-req-69-01',
    runningNo: '01',
    fiscalYearBE: 2569,
    requestDate: '2025-11-25',
    committedDate: '2025-11-26',
    requesterName: 'นางสาวณกัญญา ดีเบา',
    requesterPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
    purpose: 'เพื่อใช้จัดทำเอกสารโครงการเบี้ยยังชีพผู้สูงอายุ ไตรมาส ๑',
    lines: [
      {materialId: 'demo-mat-02-postit', requestedQty: 5},
      {materialId: 'demo-mat-03-pen', requestedQty: 10},
      {materialId: 'demo-mat-04-folder', requestedQty: 4},
      {materialId: 'demo-mat-05-staples', requestedQty: 8},
    ],
  });
  state = commitReq(state, {
    id: 'demo-req-69-02',
    runningNo: '02',
    fiscalYearBE: 2569,
    requestDate: '2025-12-12',
    committedDate: '2025-12-12',
    requesterName: 'นายกิตตินันท์ พลรบ',
    requesterPosition: 'เจ้าพนักงานธุรการปฏิบัติงาน',
    purpose: 'เพื่อใช้ในงานธุรการและบริการประชาชน กองสวัสดิการสังคม',
    lines: [
      {materialId: 'demo-mat-06-toner', requestedQty: 1},
      {materialId: 'demo-mat-08-tissue', requestedQty: 6},
      {materialId: 'demo-mat-09-battery', requestedQty: 4},
    ],
  });

  // =========================================================================
  // 3. ไตรมาส 2 ปีงบ 2569 (ม.ค. – มี.ค. 2569)
  // =========================================================================
  // A4 เบิก 15 รีม -> ตัดข้าม 2 ล็อต (10@120 + 5@125)!
  state = commitReq(state, {
    id: 'demo-req-69-03',
    runningNo: '03',
    fiscalYearBE: 2569,
    requestDate: '2026-01-15',
    committedDate: '2026-01-16',
    requesterName: 'นางสาวศิริวรรณ ไทยมิตรชอบ',
    requesterPosition: 'นักพัฒนาชุมชนชำนาญการ',
    receiverName: 'นายชัยวัฒน์ สิทธิโชค',
    purpose: 'เพื่อพิมพ์แบบฟอร์มลงทะเบียนผู้พิการและรายงานประจำไตรมาส ๒',
    lines: [
      {materialId: 'demo-mat-01-a4', requestedQty: 15},
      {materialId: 'demo-mat-02-postit', requestedQty: 8},
      {materialId: 'demo-mat-03-pen', requestedQty: 8},
    ],
  });

  state = recordStockIntake(state, {
    materialId: 'demo-mat-04-folder',
    fiscalYearBE: 2569,
    receivedDate: '2026-02-10',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านดินสอสี)',
    referenceDocNo: 'สว 14/2569',
    unitPrice: 58,
    initialQty: 12,
  }).state;
  state = recordStockIntake(state, {
    materialId: 'demo-mat-05-staples',
    fiscalYearBE: 2569,
    receivedDate: '2026-02-10',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านดินสอสี)',
    referenceDocNo: 'สว 14/2569',
    unitPrice: 14,
    initialQty: 20,
  }).state;
  state = recordStockIntake(state, {
    materialId: 'demo-mat-08-tissue',
    fiscalYearBE: 2569,
    receivedDate: '2026-02-14',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ห้างหุ้นส่วนจำกัด ฉลองซัพพลาย)',
    referenceDocNo: 'สว 16/2569',
    unitPrice: 48,
    initialQty: 12,
  }).state;
  state = recordStockIntake(state, {
    materialId: 'demo-mat-10-box',
    fiscalYearBE: 2569,
    receivedDate: '2026-02-20',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านดินสอสี)',
    referenceDocNo: 'สว 18/2569',
    unitPrice: 590,
    initialQty: 4,
  }).state;

  state = commitReq(state, {
    id: 'demo-req-69-04',
    runningNo: '04',
    fiscalYearBE: 2569,
    requestDate: '2026-03-18',
    committedDate: '2026-03-19',
    requesterName: 'นางสาวณกัญญา ดีเบา',
    requesterPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
    purpose: 'เพื่อใช้ในโครงการอบรมอาสาสมัครพัฒนาสังคม',
    lines: [
      {materialId: 'demo-mat-05-staples', requestedQty: 10},
      {materialId: 'demo-mat-06-toner', requestedQty: 2},
      {materialId: 'demo-mat-07-usb', requestedQty: 2},
      {materialId: 'demo-mat-08-tissue', requestedQty: 6},
    ],
  });

  // =========================================================================
  // 4. ไตรมาส 3 ปีงบ 2569 (เม.ย. – มิ.ย. 2569)
  // =========================================================================
  state = recordStockIntake(state, {
    materialId: 'demo-mat-01-a4',
    fiscalYearBE: 2569,
    receivedDate: '2026-04-20',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านสยามสเตชั่นเนอรี)',
    referenceDocNo: 'สว 21/2569',
    unitPrice: 118,
    initialQty: 20,
  }).state;
  state = recordStockIntake(state, {
    materialId: 'demo-mat-03-pen',
    fiscalYearBE: 2569,
    receivedDate: '2026-05-18',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านสยามสเตชั่นเนอรี)',
    referenceDocNo: 'สว 24/2569',
    unitPrice: 15,
    initialQty: 36,
  }).state;
  state = recordStockIntake(state, {
    materialId: 'demo-mat-06-toner',
    fiscalYearBE: 2569,
    receivedDate: '2026-05-25',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (บริษัท ภูเก็ตไอทีซัพพลาย จำกัด)',
    referenceDocNo: 'สว 26/2569',
    unitPrice: 1920,
    initialQty: 3,
  }).state;
  state = recordStockIntake(state, {
    materialId: 'demo-mat-09-battery',
    fiscalYearBE: 2569,
    receivedDate: '2026-06-05',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านฉลองการไฟฟ้า)',
    referenceDocNo: 'สว 28/2569',
    unitPrice: 69,
    initialQty: 10,
  }).state;

  // Post-it ล็อต 65 บาท หมดพอดี (5+8+7=20 -> เหลือ 0), Folder ตัดข้ามล็อต (6@55 + 4@58), Battery ตัดข้ามล็อต (2@65 + 3@69)
  state = commitReq(state, {
    id: 'demo-req-69-05',
    runningNo: '05',
    fiscalYearBE: 2569,
    requestDate: '2026-06-15',
    committedDate: '2026-06-16',
    requesterName: 'นางสาวณกัญญา ดีเบา',
    requesterPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
    purpose: 'เพื่อจัดเก็บแฟ้มผู้มีสิทธิรับเงินอุดหนุนและปฏิบัติงานกลางปีงบประมาณ',
    lines: [
      {materialId: 'demo-mat-01-a4', requestedQty: 20},
      {materialId: 'demo-mat-02-postit', requestedQty: 7},
      {materialId: 'demo-mat-04-folder', requestedQty: 10},
      {materialId: 'demo-mat-08-tissue', requestedQty: 6},
      {materialId: 'demo-mat-09-battery', requestedQty: 5},
      {materialId: 'demo-mat-10-box', requestedQty: 2},
    ],
  });

  // =========================================================================
  // 5. ไตรมาส 4 ปีงบ 2569 (ก.ค. – ก.ย. 2569)
  // =========================================================================
  // Post-it รับล็อตใหม่ราคาลดลง 48 บาท + กล่องพลาสติกรับล็อตใหม่ 610 บาท
  state = recordStockIntake(state, {
    materialId: 'demo-mat-02-postit',
    fiscalYearBE: 2569,
    receivedDate: '2026-08-05',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านดินสอสี)',
    referenceDocNo: 'สว 34/2569',
    unitPrice: 48,
    initialQty: 15,
  }).state;
  state = recordStockIntake(state, {
    materialId: 'demo-mat-10-box',
    fiscalYearBE: 2569,
    receivedDate: '2026-08-18',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านดินสอสี)',
    referenceDocNo: 'สว 36/2569',
    unitPrice: 610,
    initialQty: 2,
  }).state;

  // ใบเบิกปิดไตรมาส 4: A4 ตัดข้ามล็อต (5@125 + 5@118), Toner ตัดข้ามล็อต (1@1,850 + 1@1,920), Tissue หมดพอดี 0 ม้วน
  state = commitReq(state, {
    id: 'demo-req-69-06',
    runningNo: '06',
    fiscalYearBE: 2569,
    requestDate: '2026-09-10',
    committedDate: '2026-09-11',
    requesterName: 'นายกิตตินันท์ พลรบ',
    requesterPosition: 'เจ้าพนักงานธุรการปฏิบัติงาน',
    purpose: 'เพื่อจัดทำรายงานผลการดำเนินงานและเตรียมตรวจนับพัสดุสิ้นปีงบประมาณ ๒๕๖๙',
    lines: [
      {materialId: 'demo-mat-01-a4', requestedQty: 10},
      {materialId: 'demo-mat-02-postit', requestedQty: 3},
      {materialId: 'demo-mat-05-staples', requestedQty: 10},
      {materialId: 'demo-mat-06-toner', requestedQty: 2},
      {materialId: 'demo-mat-07-usb', requestedQty: 2},
      {materialId: 'demo-mat-08-tissue', requestedQty: 6},
    ],
  });

  // Asset Loan #1 (FY 2569: ยืมและส่งคืนเรียบร้อยแล้ว)
  const loan69 = AssetLoanSchema.parse({
    id: 'demo-loan-69-01',
    loanRunningNo: '01',
    fiscalYearBE: 2569,
    assetId: 'demo-asset-01',
    borrowerName: 'นายชัยวัฒน์ สิทธิโชค',
    borrowerPosition: 'ผู้ช่วยนักพัฒนาชุมชน',
    borrowerDepartment: 'กองสวัสดิการสังคม',
    purpose: 'ใช้ลงพื้นที่สำรวจข้อมูลผู้สูงอายุ หมู่ที่ ๑–๑๐ ตำบลฉลอง',
    loanDate: '2026-05-11',
    dueReturnDate: '2026-05-15',
    conditionBefore: 'ปกติ ใช้งานได้ อุปกรณ์ครบพร้อมสายชาร์จ',
    status: 'PENDING_SIGNATURE',
  });
  state = {...state, assetLoans: [...state.assetLoans, loan69]};
  state = transitionAssetLoanStatus(state, loan69.id, 'ACTIVATE').state;
  state = transitionAssetLoanStatus(state, loan69.id, 'RETURN', {
    actualReturnDate: '2026-05-15',
    conditionAfter: 'ปกติ ใช้งานได้ครบถ้วน',
  }).state;

  // =========================================================================
  // 6. ปิดงบปี 2569 & ยกยอดคงเหลือทุกล็อต FIFO ไปต้นปีงบประมาณ 2570 (1 ต.ค. 2569)
  // =========================================================================
  const carryForward = carryForwardFiscalYear(state, 2569, 2570);
  state = carryForward.state;

  // =========================================================================
  // 7. ต้นปีงบประมาณ พ.ศ. 2570 (ต.ค. – พ.ย. 2569): รับเพิ่ม, เบิกจริง, และใบเบิกรอเซ็น 1 ใบ!
  // =========================================================================
  state = recordStockIntake(state, {
    materialId: 'demo-mat-01-a4',
    fiscalYearBE: 2570,
    receivedDate: '2026-10-15',
    sourceType: 'PROCUREMENT_PO',
    sourceLabel: 'รับจาก (ร้านดินสอสี)',
    referenceDocNo: 'สว 02/2570',
    unitPrice: 122,
    initialQty: 10,
  }).state;

  // ใบเบิกแรกของปีงบ 2570 (ตัดจากยอดยกมาปี 2569 ทันที)
  state = commitReq(state, {
    id: 'demo-req-70-01',
    runningNo: '01',
    fiscalYearBE: 2570,
    requestDate: '2026-10-22',
    committedDate: '2026-10-23',
    requesterName: 'นางสาวณกัญญา ดีเบา',
    requesterPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
    purpose: 'เพื่อใช้ในการปฏิบัติงานประจำเดือนตุลาคม ปีงบประมาณ ๒๕๗๐',
    lines: [
      {materialId: 'demo-mat-02-postit', requestedQty: 2},
      {materialId: 'demo-mat-03-pen', requestedQty: 10}, // ตัดข้าม 2 ล็อตยอดยกมา: 6@12 + 4@15!
    ],
  });

  // ใบเบิกที่ 2 ของปีงบ 2570 — ค้างอยู่ในคิว "รอเซ็นรับของจริง" (PENDING_SIGNATURE) พร้อมผู้รับแทน
  // เพื่อให้ผู้ใช้เห็นยอด "คงเหลือจริง / จองรอเซ็น / พร้อมเบิก" และทดลองกดพิมพ์ INV-01 หรือกดยืนยันตัดสต๊อกได้ทันที!
  const pendingDraft = createRequisitionDraft(state, {
    id: 'demo-req-70-02',
    requisitionRunningNo: '02',
    fiscalYearBE: 2570,
    requestDate: '2026-11-24',
    requesterName: 'นางสาวศิริวรรณ ไทยมิตรชอบ',
    requesterPosition: 'นักพัฒนาชุมชนชำนาญการ',
    receiverName: 'นายชัยวัฒน์ สิทธิโชค',
    purpose: 'เพื่อเตรียมจัดทำเอกสารโครงการส่งเสริมคุณภาพชีวิตผู้สูงอายุ ไตรมาส ๑ ปีงบ ๒๕๗๐',
    lines: [
      {materialId: 'demo-mat-01-a4', requestedQty: 18}, // จองข้าม 2 ล็อต (15@118 ยอดยกมา + 3@122 ล็อตใหม่)
      {materialId: 'demo-mat-04-folder', requestedQty: 2},
    ],
  });
  state = transitionRequisitionStatus(pendingDraft.state, 'demo-req-70-02', 'SUBMIT_FOR_SIGNATURE').state;

  // Asset Loan #2 (FY 2570: กำลังยืมอยู่ เพื่อให้เห็นรายการยืมจริง + พิมพ์ INV-03 / ทดลองรับคืนได้)
  const loan70 = AssetLoanSchema.parse({
    id: 'demo-loan-70-01',
    loanRunningNo: '01',
    fiscalYearBE: 2570,
    assetId: 'demo-asset-02',
    borrowerName: 'นางสาวณกัญญา ดีเบา',
    borrowerPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
    borrowerDepartment: 'กองสวัสดิการสังคม',
    purpose: 'บันทึกภาพโครงการมอบเบี้ยยังชีพและกิจกรรมโรงเรียนผู้สูงอายุ',
    loanDate: '2026-11-22',
    dueReturnDate: '2026-11-28',
    conditionBefore: 'ปกติ ใช้งานได้ พร้อมแบตเตอรี่และกระเป๋าใส่กล้อง',
    status: 'PENDING_SIGNATURE',
  });
  state = {...state, assetLoans: [...state.assetLoans, loan70]};
  state = transitionAssetLoanStatus(state, loan70.id, 'ACTIVATE').state;

  const fy2569Summary = buildFiscalYearSummary(state, 2569);
  const fy2569Quarters = ([1, 2, 3, 4] as const).map(q => buildQuarterlyCutOffReport(state, 2569, q));
  const fy2569Audit = buildAnnualAudit213Report(state, 2569, '2026-09-30');
  const fy2570Summary = buildFiscalYearSummary(state, 2570);

  return {
    state,
    carryForward,
    fy2569Summary,
    fy2569Quarters,
    fy2569Audit,
    fy2570Summary,
  };
}
