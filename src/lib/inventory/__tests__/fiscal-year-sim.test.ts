import {describe,expect,it} from 'vitest';
import {
  availableQty,
  carryForwardFiscalYear,
  createEmptyInventoryState,
  createRequisitionDraft,
  getMaterialStockTotals,
  InsufficientStockError,
  InvalidRequisitionTransitionError,
  recordStockIntake,
  round2,
  transitionRequisitionStatus,
} from '../fifo-engine';
import {buildFullFiscalYearDemoState} from '../demo-fy-simulation';
import {buildAnnualAudit213Report, buildFiscalYearSummary, buildQuarterlyCutOffReport, buildStockCard} from '../reports';
import {AssetItemSchema, AssetLoanSchema, MaterialItemSchema} from '../schema';
import type {InventoryDomainState} from '../types';

function issueAndCommit(
  state: InventoryDomainState,
  params: {
    runningNo: string;
    fiscalYearBE: number;
    date: string;
    requesterName: string;
    requesterPosition?: string;
    receiverName?: string;
    materialId: string;
    qty: number;
  },
) {
  const created = createRequisitionDraft(state, {
    requisitionRunningNo: params.runningNo,
    fiscalYearBE: params.fiscalYearBE,
    requestDate: params.date,
    requesterName: params.requesterName,
    requesterPosition: params.requesterPosition ?? 'เจ้าพนักงานธุรการปฏิบัติงาน',
    receiverName: params.receiverName,
    lines: [{materialId: params.materialId, requestedQty: params.qty}],
  });
  const submitted = transitionRequisitionStatus(created.state, created.requisition.id, 'SUBMIT_FOR_SIGNATURE');
  const committed = transitionRequisitionStatus(submitted.state, submitted.requisition.id, 'COMMIT_AFTER_SIGNATURE', {
    committedDate: params.date,
  });
  return committed;
}

describe('FY 2569 Full Fiscal Year FIFO Simulations & Reconciliation', () => {
  it('Scenario A: Multi-Lot Price Split (กระดาษถ่ายเอกสาร A4 80 แกรม, FY 2569)', () => {
    const a4 = MaterialItemSchema.parse({
      id: 'mat-a4-80g',
      ledgerSeqNo: 1,
      code: '01-001',
      name: 'กระดาษถ่ายเอกสาร A4 80 แกรม',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      specification: 'ขนาด A4 80 แกรม (500 แผ่น/รีม)',
      unit: 'รีม',
      storageLocation: 'กองสวัสดิการสังคม',
      maxStockQty: 60,
      minStockQty: 10,
    });

    let state: InventoryDomainState = {...createEmptyInventoryState(), materials: [a4]};

    // 1. Opening 10 @ 115.00
    state = recordStockIntake(state, {
      lotId: 'LOT-A4-OPEN',
      materialId: a4.id,
      fiscalYearBE: 2569,
      receivedDate: '2025-10-01',
      createdOrder: 1,
      sourceType: 'OPENING_BALANCE',
      referenceDocNo: 'ปี 2568',
      unitPrice: 115,
      initialQty: 10,
    }).state;

    // 2. Issue 8 (from 10 @ 115 -> 2 remaining)
    const r1 = issueAndCommit(state, {
      runningNo: '01',
      fiscalYearBE: 2569,
      date: '2025-10-15',
      requesterName: 'นางสาวณกัญญา ดีเบา',
      materialId: a4.id,
      qty: 8,
    });
    state = r1.state;
    expect(r1.ledgerEntries).toHaveLength(1);
    expect(r1.ledgerEntries[0]).toMatchObject({outQty: 8, outAmount: 920, balanceQty: 2, balanceAmount: 230});

    // 3. Intake 30 @ 120.00
    state = recordStockIntake(state, {
      lotId: 'LOT-A4-IN1',
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

    // 4. Issue 12 -> auto-splits 2 @ 115 (230) + 10 @ 120 (1,200) = 1,430.00
    const r2 = issueAndCommit(state, {
      runningNo: '02',
      fiscalYearBE: 2569,
      date: '2026-01-12',
      requesterName: 'นายชัยวัฒน์ สิทธิโชค',
      materialId: a4.id,
      qty: 12,
    });
    state = r2.state;
    expect(r2.requisition.lines[0].allocations).toEqual([
      {
        lotId: 'LOT-A4-OPEN',
        referenceDocNo: 'ปี 2568',
        unitPrice: 115,
        allocatedQty: 2,
        lineAmount: 230,
        balanceAfterThisSplit: 30,
      },
      {
        lotId: 'LOT-A4-IN1',
        referenceDocNo: 'สว 05/2569',
        unitPrice: 120,
        allocatedQty: 10,
        lineAmount: 1200,
        balanceAfterThisSplit: 20,
      },
    ]);
    expect(round2(r2.ledgerEntries.reduce((s, e) => s + e.outAmount, 0))).toBe(1430);
    expect(r2.ledgerEntries[1]).toMatchObject({balanceQty: 20, balanceAmount: 2400});

    // 5. Intake 25 @ 118.00
    state = recordStockIntake(state, {
      lotId: 'LOT-A4-IN2',
      materialId: a4.id,
      fiscalYearBE: 2569,
      receivedDate: '2026-04-08',
      createdOrder: 3,
      sourceType: 'PROCUREMENT_PO',
      sourceLabel: 'รับจาก (ร้านดินสอสี)',
      referenceDocNo: 'สว 19/2569',
      unitPrice: 118,
      initialQty: 25,
    }).state;

    // 6. Issue 22 -> auto-splits 20 @ 120 (2,400) + 2 @ 118 (236) = 2,636.00
    const r3 = issueAndCommit(state, {
      runningNo: '03',
      fiscalYearBE: 2569,
      date: '2026-06-15',
      requesterName: 'นางสาวณกัญญา ดีเบา',
      materialId: a4.id,
      qty: 22,
    });
    state = r3.state;
    expect(r3.requisition.lines[0].allocations).toEqual([
      {
        lotId: 'LOT-A4-IN1',
        referenceDocNo: 'สว 05/2569',
        unitPrice: 120,
        allocatedQty: 20,
        lineAmount: 2400,
        balanceAfterThisSplit: 25,
      },
      {
        lotId: 'LOT-A4-IN2',
        referenceDocNo: 'สว 19/2569',
        unitPrice: 118,
        allocatedQty: 2,
        lineAmount: 236,
        balanceAfterThisSplit: 23,
      },
    ]);
    expect(round2(r3.ledgerEntries.reduce((s, e) => s + e.outAmount, 0))).toBe(2636);
    expect(r3.ledgerEntries[1]).toMatchObject({balanceQty: 23, balanceAmount: 2714});

    // 7. Issue 15 -> 15 @ 118 = 1,770.00 -> Closing 8 @ 118.00 = 944.00 THB
    const r4 = issueAndCommit(state, {
      runningNo: '04',
      fiscalYearBE: 2569,
      date: '2026-09-10',
      requesterName: 'นายกิตตินันท์ พลรบ',
      materialId: a4.id,
      qty: 15,
    });
    state = r4.state;
    expect(r4.ledgerEntries[0]).toMatchObject({outQty: 15, outAmount: 1770, balanceQty: 8, balanceAmount: 944});

    // Assert exact FY 2569 accounting invariants
    const summary = buildFiscalYearSummary(state, 2569);
    expect(summary.allBalanced).toBe(true);
    const row = summary.items[0];
    expect(row.openingQty).toBe(10);
    expect(row.openingAmount).toBe(1150);
    expect(row.totalInQty).toBe(55);
    expect(row.totalInAmount).toBe(6550);
    expect(row.totalOutQty).toBe(57);
    expect(row.totalOutAmount).toBe(6756);
    expect(row.closingQty).toBe(8);
    expect(row.closingAmount).toBe(944);
    expect(row.lotRemainingQty).toBe(8);
    expect(row.lotRemainingAmount).toBe(944);
    expect(row.openingQty + row.totalInQty - row.totalOutQty).toBe(row.closingQty);
    expect(round2(row.openingAmount + row.totalInAmount - row.totalOutAmount)).toBe(row.lotRemainingAmount);
    expect(row.isBelowMinStock).toBe(true); // 8 <= minStockQty(10)

    // Quarterly cut-off check (Q1 Oct-Dec 2025: Open 10, In 30, Out 8 -> Close 32)
    const q1 = buildQuarterlyCutOffReport(state, 2569, 1);
    expect(q1.allBalanced).toBe(true);
    expect(q1.items[0]).toMatchObject({openingQty: 10, totalInQty: 30, totalOutQty: 8, closingQty: 32, closingAmount: 3830});

    // Stock card sheet pagination check
    const card = buildStockCard(state, a4.id, 2569, 4);
    expect(card.entries).toHaveLength(9); // 3 intakes + 6 issue splits
    expect(card.sheets).toHaveLength(3);
    expect(card.closingQty).toBe(8);
    expect(card.closingAmount).toBe(944);
  });

  it('Scenario B: Real Chalong Post-it Case (ลำดับที่ 28, 65->48 THB full depletion & restock, FY 2569)', () => {
    const postIt = MaterialItemSchema.parse({
      id: 'mat-postit-28',
      ledgerSeqNo: 28,
      code: '',
      name: 'กระดาษโพสอิท คั่นหน้า กองสวัสดิการสังคม',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      specification: 'เนื้อเทป ขนาด 0.5 x 1.7 นิ้ว',
      unit: 'แผง',
      storageLocation: 'กองสวัสดิการสังคม',
      maxStockQty: 50,
      minStockQty: 5,
    });

    let state: InventoryDomainState = {...createEmptyInventoryState(), materials: [postIt]};

    // Opening 30 แผง @ 65.00 (บันทึกบัญชีเดบิท)
    const opening = recordStockIntake(state, {
      lotId: 'LOT-POSTIT-68',
      materialId: postIt.id,
      fiscalYearBE: 2569,
      receivedDate: '2025-10-01',
      createdOrder: 1,
      sourceType: 'OPENING_BALANCE',
      referenceDocNo: 'ปี 2568',
      unitPrice: 65,
      initialQty: 30,
    });
    state = opening.state;
    expect(opening.ledgerEntry).toMatchObject({
      partyDescription: 'ยอดยกมา',
      accountingNote: 'บันทึกบัญชีเดบิท',
      balanceQty: 30,
      balanceAmount: 1950,
    });

    // Sequential issues: 2, 2, 3, 3, 3, 3, 5, 5, 4 (total 30)
    const issueQtys = [2, 2, 3, 3, 3, 3, 5, 5, 4];
    const expectedBalances = [28, 26, 23, 20, 17, 14, 9, 4, 0];
    const issueDates = [
      '2025-10-20', '2025-11-18', '2025-12-16',
      '2026-01-22', '2026-02-19', '2026-03-25',
      '2026-05-14', '2026-06-24', '2026-07-20',
    ];

    issueQtys.forEach((qty, idx) => {
      const res = issueAndCommit(state, {
        runningNo: String(idx + 1).padStart(2, '0'),
        fiscalYearBE: 2569,
        date: issueDates[idx],
        requesterName: 'นางสาวณกัญญา ดีเบา',
        materialId: postIt.id,
        qty,
      });
      state = res.state;
      expect(res.ledgerEntries).toHaveLength(1);
      expect(res.ledgerEntries[0].accountingNote).toBe('ค่าวัสดุใช้ไป');
      expect(res.ledgerEntries[0].balanceQty).toBe(expectedBalances[idx]);
      expect(res.ledgerEntries[0].balanceAmount).toBe(round2(expectedBalances[idx] * 65));
    });

    // Verify full depletion to 0 before new price lot arrives
    expect(state.lots[0].remainingQty).toBe(0);

    // New intake 12 แผง @ 48.00 (บันทึกบัญชีเดบิท)
    const restock = recordStockIntake(state, {
      lotId: 'LOT-POSTIT-69',
      materialId: postIt.id,
      fiscalYearBE: 2569,
      receivedDate: '2026-08-15',
      createdOrder: 2,
      sourceType: 'PROCUREMENT_PO',
      sourceLabel: 'รับจาก (ร้านดินสอสี)',
      referenceDocNo: '107/5339',
      unitPrice: 48,
      initialQty: 12,
    });
    state = restock.state;
    expect(restock.ledgerEntry).toMatchObject({
      partyDescription: 'รับจาก (ร้านดินสอสี)',
      accountingNote: 'บันทึกบัญชีเดบิท',
      inQty: 12,
      inAmount: 576,
      balanceQty: 12,
      balanceAmount: 576,
    });

    // Assert exact FY 2569 closing & ข้อ 213 audit report
    const summary = buildFiscalYearSummary(state, 2569);
    expect(summary.allBalanced).toBe(true);
    expect(summary.items[0]).toMatchObject({
      ledgerSeqNo: 28,
      openingQty: 30,
      openingAmount: 1950,
      totalInQty: 12,
      totalInAmount: 576,
      totalOutQty: 30,
      totalOutAmount: 1950,
      closingQty: 12,
      closingAmount: 576,
      lotRemainingQty: 12,
      lotRemainingAmount: 576,
      qtyBalanced: true,
      amountBalanced: true,
    });

    // Attach 1 asset + 1 overdue loan to verify Annual Audit ข้อ 213 report
    state = {
      ...state,
      assets: [
        AssetItemSchema.parse({
          id: 'asset-213',
          assetCode: '7440-001-0005/68',
          name: 'เครื่องพิมพ์เลเซอร์',
          acquiredDate: '2025-03-10',
          acquisitionCost: 12500,
          custodianName: 'นายกิตตินันท์ พลรบ',
          condition: 'GOOD',
        }),
      ],
      assetLoans: [
        AssetLoanSchema.parse({
          id: 'loan-213',
          loanRunningNo: '01',
          fiscalYearBE: 2569,
          assetId: 'asset-213',
          borrowerName: 'นายชัยวัฒน์ สิทธิโชค',
          borrowerPosition: 'ผู้ช่วยนักพัฒนาชุมชน',
          borrowerDepartment: 'กองสวัสดิการสังคม',
          purpose: 'งานโครงการ',
          loanDate: '2026-09-01',
          dueReturnDate: '2026-09-15',
          status: 'ACTIVE_LOAN',
        }),
      ],
    };
    const audit = buildAnnualAudit213Report(state, 2569, '2026-09-30');
    expect(audit.materialSummary.allBalanced).toBe(true);
    expect(audit.assets.totalCount).toBe(1);
    expect(audit.assets.byCondition.GOOD).toBe(1);
    expect(audit.assets.overdueLoanCount).toBe(1);
  });

  it('Scenario C: Reservation Guard & Cancel Rollback', () => {
    const pen = MaterialItemSchema.parse({
      id: 'mat-pen',
      ledgerSeqNo: 5,
      name: 'ปากกาลูกลื่น น้ำเงิน',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      unit: 'แท่ง',
    });

    let state: InventoryDomainState = {...createEmptyInventoryState(), materials: [pen]};
    state = recordStockIntake(state, {
      lotId: 'LOT-PEN-1',
      materialId: pen.id,
      fiscalYearBE: 2569,
      receivedDate: '2025-10-01',
      createdOrder: 1,
      sourceType: 'OPENING_BALANCE',
      referenceDocNo: 'ปี 2568',
      unitPrice: 10,
      initialQty: 10,
    }).state;

    // Requisition #1 reserves 8 of 10
    const req1Draft = createRequisitionDraft(state, {
      id: 'req-c1',
      requisitionRunningNo: '01',
      fiscalYearBE: 2569,
      requestDate: '2025-10-10',
      requesterName: 'ผู้เบิกคนที่ 1',
      requesterPosition: 'นักพัฒนาชุมชน',
      lines: [{materialId: pen.id, requestedQty: 8}],
    });
    state = transitionRequisitionStatus(req1Draft.state, 'req-c1', 'SUBMIT_FOR_SIGNATURE').state;
    expect(availableQty(state.lots[0])).toBe(2);

    // Requisition #2 requesting 3 throws InsufficientStockError (only 2 available)
    let caught: unknown;
    try {
      createRequisitionDraft(state, {
        id: 'req-c2',
        requisitionRunningNo: '02',
        fiscalYearBE: 2569,
        requestDate: '2025-10-11',
        requesterName: 'ผู้เบิกคนที่ 2',
        requesterPosition: 'เจ้าพนักงานธุรการ',
        lines: [{materialId: pen.id, requestedQty: 3}],
      });
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(InsufficientStockError);
    expect((caught as InsufficientStockError).availableQty).toBe(2);
    expect((caught as InsufficientStockError).shortfallQty).toBe(1);

    // Cancel Requisition #1 -> releases 8 reserved back to available = 10
    state = transitionRequisitionStatus(state, 'req-c1', 'CANCEL').state;
    expect(availableQty(state.lots[0])).toBe(10);
    expect(state.lots[0].remainingQty).toBe(10);

    // Requisition #2 requesting 3 now succeeds cleanly!
    const req2Draft = createRequisitionDraft(state, {
      id: 'req-c2',
      requisitionRunningNo: '02',
      fiscalYearBE: 2569,
      requestDate: '2025-10-11',
      requesterName: 'ผู้เบิกคนที่ 2',
      requesterPosition: 'เจ้าพนักงานธุรการ',
      lines: [{materialId: pen.id, requestedQty: 3}],
    });
    state = transitionRequisitionStatus(req2Draft.state, 'req-c2', 'SUBMIT_FOR_SIGNATURE').state;
    state = transitionRequisitionStatus(state, 'req-c2', 'COMMIT_AFTER_SIGNATURE').state;

    expect(state.lots[0].remainingQty).toBe(7);
    expect(state.lots[0].reservedQty).toBe(0);
    expect(buildFiscalYearSummary(state, 2569).allBalanced).toBe(true);
  });

  it('Scenario D: Year-End Carry-Forward FY 2569 -> FY 2570 preserves multi-lot FIFO layers without double counting', () => {
    const folder = MaterialItemSchema.parse({
      id: 'mat-folder-cf',
      ledgerSeqNo: 1,
      code: '01-001',
      name: 'แฟ้มสันกว้าง A4',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      unit: 'แฟ้ม',
      storageLocation: 'กองสวัสดิการสังคม',
      minStockQty: 5,
    });
    let state: InventoryDomainState = {...createEmptyInventoryState(), materials: [folder]};

    // FY 2569: Lot 1 (10 @ 65) + Lot 2 (12 @ 48) -> Issue 6 (drains 6 of Lot 1 -> 4 @ 65 + 12 @ 48 = 16 units, 836 THB)
    state = recordStockIntake(state, {
      lotId: 'LOT-CF-1',
      materialId: folder.id,
      fiscalYearBE: 2569,
      receivedDate: '2025-10-01',
      createdOrder: 1,
      sourceType: 'OPENING_BALANCE',
      referenceDocNo: 'ปี 2568',
      unitPrice: 65,
      initialQty: 10,
    }).state;
    state = recordStockIntake(state, {
      lotId: 'LOT-CF-2',
      materialId: folder.id,
      fiscalYearBE: 2569,
      receivedDate: '2026-06-15',
      createdOrder: 2,
      sourceType: 'PROCUREMENT_PO',
      sourceLabel: 'รับจาก (ร้านดินสอสี)',
      referenceDocNo: 'สว 10/2569',
      unitPrice: 48,
      initialQty: 12,
    }).state;
    state = issueAndCommit(state, {
      runningNo: '01',
      fiscalYearBE: 2569,
      date: '2026-07-10',
      requesterName: 'นางสาวณกัญญา ดีเบา',
      materialId: folder.id,
      qty: 6,
    }).state;

    // Pending requisition blocks carry-forward until committed or cancelled
    let pendingState = createRequisitionDraft(state, {
      id: 'req-block',
      requisitionRunningNo: '02',
      fiscalYearBE: 2569,
      requestDate: '2026-09-20',
      requesterName: 'ผู้เบิกค้างเซ็น',
      requesterPosition: 'เจ้าพนักงานธุรการ',
      lines: [{materialId: folder.id, requestedQty: 1}],
    }).state;
    pendingState = transitionRequisitionStatus(pendingState, 'req-block', 'SUBMIT_FOR_SIGNATURE').state;
    expect(() => carryForwardFiscalYear(pendingState, 2569, 2570)).toThrow(InvalidRequisitionTransitionError);

    // Execute Carry-Forward FY 2569 -> FY 2570
    const cf = carryForwardFiscalYear(state, 2569, 2570);
    state = cf.state;
    expect(cf.openingDate).toBe('2026-10-01');
    expect(cf.carriedMaterialCount).toBe(1);
    expect(cf.carriedLotCount).toBe(2); // Both price layers (4@65 and 12@48) preserved!
    expect(cf.totalCarriedQty).toBe(16);
    expect(cf.totalCarriedAmount).toBe(836);

    // Live stock totals must NOT double-count!
    expect(getMaterialStockTotals(state.lots, folder.id)).toEqual({
      remainingQty: 16,
      reservedQty: 0,
      availableQty: 16,
      totalValue: 836,
    });

    // Duplicate carry-forward must throw
    expect(() => carryForwardFiscalYear(state, 2569, 2570)).toThrow(InvalidRequisitionTransitionError);

    // BOTH historical FY 2569 and new FY 2570 must reconcile 100% GREEN!
    const fy69 = buildFiscalYearSummary(state, 2569);
    const fy70 = buildFiscalYearSummary(state, 2570);
    expect(fy69.allBalanced).toBe(true);
    expect(fy69.totals.closingQty).toBe(16);
    expect(fy69.totals.closingAmount).toBe(836);
    expect(fy70.allBalanced).toBe(true);
    expect(fy70.totals.openingQty).toBe(16);
    expect(fy70.totals.openingAmount).toBe(836);
    expect(fy70.totals.closingQty).toBe(16);
    expect(fy70.totals.closingAmount).toBe(836);

    // First FY 2570 requisition (6 units) must drain carried-forward 4@65 first, then 2@48!
    const fy70Issue = issueAndCommit(state, {
      runningNo: '01',
      fiscalYearBE: 2570,
      date: '2026-10-20',
      requesterName: 'นางสาวณกัญญา ดีเบา',
      materialId: folder.id,
      qty: 6,
    });
    state = fy70Issue.state;
    expect(fy70Issue.ledgerEntries).toHaveLength(2);
    expect(fy70Issue.ledgerEntries[0]).toMatchObject({outQty: 4, unitPrice: 65, outAmount: 260, balanceQty: 12});
    expect(fy70Issue.ledgerEntries[1]).toMatchObject({outQty: 2, unitPrice: 48, outAmount: 96, balanceQty: 10, balanceAmount: 480});
    expect(buildFiscalYearSummary(state, 2569).allBalanced).toBe(true);
    expect(buildFiscalYearSummary(state, 2570).allBalanced).toBe(true);
  });

  it('Scenario E: Full 10-material FY 2569 -> Carry-Forward -> FY 2570 demo bundle reconciles 100% across all quarters and years', () => {
    const demo = buildFullFiscalYearDemoState();
    expect(demo.state.materials).toHaveLength(10);
    expect(demo.state.assets).toHaveLength(4);
    expect(demo.fy2569Summary.allBalanced).toBe(true);
    expect(demo.fy2569Quarters.every(q => q.allBalanced)).toBe(true);
    expect(demo.fy2570Summary.allBalanced).toBe(true);
    expect(demo.carryForward.openingDate).toBe('2026-10-01');
    expect(demo.carryForward.carriedMaterialCount).toBe(9); // #8 Tissue depleted to 0 at year end
    expect(demo.carryForward.totalCarriedQty).toBe(demo.fy2569Summary.totals.closingQty);
    expect(demo.carryForward.totalCarriedAmount).toBe(demo.fy2569Summary.totals.closingAmount);
    expect(demo.fy2570Summary.totals.openingQty).toBe(demo.fy2569Summary.totals.closingQty);
    expect(demo.fy2570Summary.totals.openingAmount).toBe(demo.fy2569Summary.totals.closingAmount);
    expect(demo.state.requisitions.filter(r => r.status === 'PENDING_SIGNATURE')).toHaveLength(1);
    expect(demo.state.assetLoans.filter(l => l.status === 'ACTIVE_LOAN')).toHaveLength(1);
  });
});
