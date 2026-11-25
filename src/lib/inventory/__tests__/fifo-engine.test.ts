import {describe,expect,it} from 'vitest';
import {DatabaseSync} from 'node:sqlite';
import {
  availableQty,
  createEmptyInventoryState,
  createRequisitionDraft,
  deleteRequisition,
  effectiveReceiverName,
  InsufficientStockError,
  InvalidRequisitionTransitionError,
  previewFifoAllocation,
  recordStockIntake,
  transitionAssetLoanStatus,
  transitionRequisitionStatus,
  updateRequisitionDraft,
} from '../fifo-engine';
import {
  createMemoryInventoryRepository,
  createSqliteInventoryRepository,
  InventoryConflictError,
  type SqliteLike,
} from '../repository';
import {AssetItemSchema, AssetLoanSchema, MaterialItemSchema} from '../schema';

function baseState() {
  const mat = MaterialItemSchema.parse({
    id: 'mat-a4',
    ledgerSeqNo: 1,
    code: '01-001',
    name: 'กระดาษถ่ายเอกสาร A4 80 แกรม',
    categoryCode: '01',
    categoryType: 'วัสดุสำนักงาน',
    specification: 'A4 80 แกรม 500 แผ่น',
    unit: 'รีม',
    storageLocation: 'กองสวัสดิการสังคม',
    minStockQty: 5,
  });
  return {...createEmptyInventoryState(), materials: [mat]};
}

describe('FIFO two-phase requisition engine & audit immutability', () => {
  it('splits multi-lot issues in strict FIFO order and tracks balanceAfterThisSplit', () => {
    let state = baseState();
    state = recordStockIntake(state, {
      lotId: 'LOT-B',
      materialId: 'mat-a4',
      fiscalYearBE: 2569,
      receivedDate: '2025-10-01',
      createdOrder: 2,
      sourceType: 'PROCUREMENT_PO',
      sourceLabel: 'รับจาก (ร้านดินสอสี)',
      referenceDocNo: 'สว 02/2569',
      unitPrice: 120,
      initialQty: 5,
    }).state;
    // Earlier createdOrder on the same receivedDate must be consumed first.
    state = recordStockIntake(state, {
      lotId: 'LOT-A',
      materialId: 'mat-a4',
      fiscalYearBE: 2569,
      receivedDate: '2025-10-01',
      createdOrder: 1,
      sourceType: 'OPENING_BALANCE',
      referenceDocNo: 'ปี 2568',
      unitPrice: 115,
      initialQty: 4,
    }).state;

    const preview = previewFifoAllocation(state.lots, 'mat-a4', 7);
    expect(preview.balanceBefore).toBe(9);
    expect(preview.balanceAfter).toBe(2);
    expect(preview.totalAmount).toBe(820); // 4*115 + 3*120 = 460 + 360
    expect(preview.allocations).toEqual([
      {
        lotId: 'LOT-A',
        referenceDocNo: 'ปี 2568',
        unitPrice: 115,
        allocatedQty: 4,
        lineAmount: 460,
        balanceAfterThisSplit: 5,
      },
      {
        lotId: 'LOT-B',
        referenceDocNo: 'สว 02/2569',
        unitPrice: 120,
        allocatedQty: 3,
        lineAmount: 360,
        balanceAfterThisSplit: 2,
      },
    ]);
  });

  it('supports separate proxy receiver, reservation blocking, cancel rollback, and committed immutability', () => {
    let state = baseState();
    state = recordStockIntake(state, {
      lotId: 'LOT-1',
      materialId: 'mat-a4',
      fiscalYearBE: 2569,
      receivedDate: '2025-10-01',
      createdOrder: 1,
      sourceType: 'OPENING_BALANCE',
      referenceDocNo: 'ปี 2568',
      unitPrice: 100,
      initialQty: 10,
    }).state;

    const draft1 = createRequisitionDraft(state, {
      id: 'req-1',
      requisitionRunningNo: '01',
      fiscalYearBE: 2569,
      requestDate: '2025-10-10',
      requesterName: 'นางสาวณกัญญา ดีเบา',
      requesterPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
      receiverName: 'นายชัยวัฒน์ สิทธิโชค',
      lines: [{materialId: 'mat-a4', requestedQty: 6}],
    });
    state = draft1.state;
    expect(effectiveReceiverName(draft1.requisition)).toBe('นายชัยวัฒน์ สิทธิโชค');

    // Submit -> locks reservedQty without changing remainingQty
    const pending1 = transitionRequisitionStatus(state, 'req-1', 'SUBMIT_FOR_SIGNATURE');
    state = pending1.state;
    expect(state.lots[0].remainingQty).toBe(10);
    expect(state.lots[0].reservedQty).toBe(6);
    expect(availableQty(state.lots[0])).toBe(4);
    expect(state.ledger).toHaveLength(1); // Only opening balance so far

    // Second requester asking for 5 must fail (only 4 available)
    expect(() =>
      createRequisitionDraft(state, {
        requisitionRunningNo: '02',
        fiscalYearBE: 2569,
        requestDate: '2025-10-11',
        requesterName: 'นายกิตตินันท์ พลรบ',
        requesterPosition: 'เจ้าพนักงานธุรการปฏิบัติงาน',
        lines: [{materialId: 'mat-a4', requestedQty: 5}],
      }),
    ).toThrow(InsufficientStockError);

    // Direct edit while pending signature is forbidden
    expect(() => updateRequisitionDraft(state, 'req-1', {requesterName: 'เปลี่ยนชื่อ'})).toThrow(
      InvalidRequisitionTransitionError,
    );

    // Cancel releases reservation safely
    state = transitionRequisitionStatus(state, 'req-1', 'CANCEL').state;
    expect(state.lots[0].remainingQty).toBe(10);
    expect(state.lots[0].reservedQty).toBe(0);

    // Now create, submit, and commit req-2 (default receiver = requester)
    const draft2 = createRequisitionDraft(state, {
      id: 'req-2',
      requisitionRunningNo: '02',
      fiscalYearBE: 2569,
      requestDate: '2025-10-12',
      requesterName: 'นางสาวณกัญญา ดีเบา',
      requesterPosition: 'นักพัฒนาชุมชนปฏิบัติการ',
      lines: [{materialId: 'mat-a4', requestedQty: 5}],
    });
    state = draft2.state;
    expect(effectiveReceiverName(draft2.requisition)).toBe('นางสาวณกัญญา ดีเบา');

    state = transitionRequisitionStatus(state, 'req-2', 'SUBMIT_FOR_SIGNATURE').state;
    const committed = transitionRequisitionStatus(state, 'req-2', 'COMMIT_AFTER_SIGNATURE', {
      committedDate: '2025-10-14',
      signedScanAttachmentPath: '/scans/req-02-2569.pdf',
    });
    state = committed.state;
    expect(state.lots[0].remainingQty).toBe(5);
    expect(state.lots[0].reservedQty).toBe(0);
    expect(committed.ledgerEntries).toHaveLength(1);
    expect(committed.ledgerEntries[0]).toMatchObject({
      partyDescription: 'จ่ายให้ นางสาวณกัญญา ดีเบา',
      docNo: '02/2569',
      outQty: 5,
      outAmount: 500,
      balanceQty: 5,
      balanceAmount: 500,
      accountingNote: 'ค่าวัสดุใช้ไป',
    });

    // Audit immutability: COMMITTED requisitions cannot be modified, cancelled, or deleted
    expect(() => transitionRequisitionStatus(state, 'req-2', 'CANCEL')).toThrow(InvalidRequisitionTransitionError);
    expect(() => updateRequisitionDraft(state, 'req-2', {purpose: 'แก้ไขย้อนหลัง'})).toThrow(
      InvalidRequisitionTransitionError,
    );
    expect(() => deleteRequisition(state, 'req-2')).toThrow(InvalidRequisitionTransitionError);
  });

  it('enforces asset loan lifecycle and repository optimistic locking (memory + SQLite)', () => {
    let state = baseState();
    state = {
      ...state,
      assets: [
        AssetItemSchema.parse({
          id: 'asset-1',
          assetCode: '7440-001-0005/68',
          name: 'เครื่องคอมพิวเตอร์โน้ตบุ๊ก',
          acquiredDate: '2025-05-01',
          acquisitionCost: 24500,
          custodianName: 'นายกิตตินันท์ พลรบ',
          condition: 'GOOD',
        }),
      ],
      assetLoans: [
        AssetLoanSchema.parse({
          id: 'loan-1',
          loanRunningNo: '01',
          fiscalYearBE: 2569,
          assetId: 'asset-1',
          borrowerName: 'นายชัยวัฒน์ สิทธิโชค',
          borrowerPosition: 'ผู้ช่วยนักพัฒนาชุมชน',
          borrowerDepartment: 'กองสวัสดิการสังคม',
          purpose: 'ลงพื้นที่สำรวจข้อมูลผู้สูงอายุ',
          loanDate: '2026-01-10',
          dueReturnDate: '2026-01-15',
          status: 'PENDING_SIGNATURE',
        }),
      ],
    };

    state = transitionAssetLoanStatus(state, 'loan-1', 'ACTIVATE').state;
    expect(state.assetLoans[0].status).toBe('ACTIVE_LOAN');
    state = transitionAssetLoanStatus(state, 'loan-1', 'RETURN', {
      actualReturnDate: '2026-01-14',
      conditionAfter: 'ปกติ ครบถ้วน',
    }).state;
    expect(state.assetLoans[0].status).toBe('RETURNED');

    // Memory repository optimistic lock
    const mem = createMemoryInventoryRepository();
    const s0 = mem.load();
    const s1 = mem.save({...s0, data: state});
    expect(s1.version).toBe(1);
    expect(() => mem.save({...s0, data: state})).toThrow(InventoryConflictError);

    // SQLite repository adapter
    const rawDb = new DatabaseSync(':memory:');
    const wrapper: SqliteLike = {
      exec: sql => rawDb.exec(sql),
      prepare: sql => rawDb.prepare(sql) as unknown as ReturnType<SqliteLike['prepare']>,
      transaction: op => () => {
        rawDb.exec('BEGIN IMMEDIATE');
        try {
          const out = op();
          rawDb.exec('COMMIT');
          return out;
        } catch (err) {
          rawDb.exec('ROLLBACK');
          throw err;
        }
      },
    };
    const sqliteRepo = createSqliteInventoryRepository(() => wrapper);
    const loaded0 = sqliteRepo.load();
    expect(loaded0.version).toBe(0);
    const saved1 = sqliteRepo.save({...loaded0, data: state});
    expect(saved1.version).toBe(1);
    expect(sqliteRepo.load().data.assets).toHaveLength(1);
    expect(() => sqliteRepo.save({...loaded0, data: state})).toThrow(InventoryConflictError);
    rawDb.close();
  });
});
