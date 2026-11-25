const randomUUID = () => globalThis.crypto.randomUUID();
import {
  AssetLoanSchema,
  InventoryDomainStateSchema,
  RequisitionSchema,
  StockLedgerEntrySchema,
  StockLotSchema,
} from './schema';
import type {
  AssetLoan,
  AssetLoanTransitionAction,
  FifoPreviewResult,
  InventoryDomainState,
  Requisition,
  RequisitionAllocation,
  RequisitionTransitionAction,
  StockIntakeInput,
  StockLedgerEntry,
  StockLot,
} from './types';

export function round2(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export function roundQty(value: number): number {
  const rounded = Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
  return Object.is(rounded, -0) ? 0 : rounded;
}

export class InsufficientStockError extends Error {
  readonly materialId: string;
  readonly requestedQty: number;
  readonly availableQty: number;
  readonly shortfallQty: number;

  constructor(materialId: string, requestedQty: number, availableQty: number) {
    const shortfall = roundQty(requestedQty - availableQty);
    super(`วัสดุคงเหลือพร้อมเบิกไม่เพียงพอ (ขอเบิก ${requestedQty} คงเหลือพร้อมเบิก ${availableQty} ขาดอีก ${shortfall})`);
    this.name = 'InsufficientStockError';
    this.materialId = materialId;
    this.requestedQty = requestedQty;
    this.availableQty = availableQty;
    this.shortfallQty = shortfall;
  }
}

export class InvalidRequisitionTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRequisitionTransitionError';
  }
}

export class DuplicateProcurementImportError extends Error {
  readonly caseId: string;
  constructor(caseId: string) {
    super(`งานจัดซื้อจัดจ้างรหัส ${caseId} ถูกรับเข้าคลังวัสดุไปแล้ว ไม่สามารถนำเข้าซ้ำได้`);
    this.name = 'DuplicateProcurementImportError';
    this.caseId = caseId;
  }
}

export function createEmptyInventoryState(): InventoryDomainState {
  return InventoryDomainStateSchema.parse({});
}

export function availableQty(lot: Pick<StockLot, 'remainingQty' | 'reservedQty'>): number {
  return roundQty(Math.max(0, lot.remainingQty - lot.reservedQty));
}

/** Deterministic FIFO ordering: receivedDate ASC, createdOrder ASC, id ASC. */
export function sortLotsFifo(lots: readonly StockLot[], materialId?: string): StockLot[] {
  const filtered = materialId ? lots.filter(lot => lot.materialId === materialId) : [...lots];
  return filtered.sort(
    (a, b) =>
      a.receivedDate.localeCompare(b.receivedDate) ||
      a.createdOrder - b.createdOrder ||
      a.id.localeCompare(b.id),
  );
}

export function getMaterialStockTotals(lots: readonly StockLot[], materialId: string) {
  let remainingQty = 0;
  let reservedQty = 0;
  let available = 0;
  let totalValue = 0;
  for (const lot of lots) {
    if (lot.materialId !== materialId) continue;
    remainingQty = roundQty(remainingQty + lot.remainingQty);
    reservedQty = roundQty(reservedQty + lot.reservedQty);
    available = roundQty(available + availableQty(lot));
    totalValue = round2(totalValue + round2(lot.remainingQty * lot.unitPrice));
  }
  return {remainingQty, reservedQty, availableQty: available, totalValue};
}

export function effectiveReceiverName(req: Pick<Requisition, 'requesterName' | 'receiverName'>): string {
  const custom = req.receiverName?.trim();
  return custom ? custom : req.requesterName;
}

export function previewFifoAllocation(
  lots: readonly StockLot[],
  materialId: string,
  requestedQty: number,
): FifoPreviewResult {
  if (!Number.isFinite(requestedQty) || requestedQty <= 0) {
    throw new RangeError('จำนวนขอเบิกต้องมากกว่า 0');
  }
  const sorted = sortLotsFifo(lots, materialId);
  const totalAvailable = roundQty(sorted.reduce((sum, lot) => sum + availableQty(lot), 0));
  if (requestedQty > totalAvailable + 1e-9) {
    throw new InsufficientStockError(materialId, requestedQty, totalAvailable);
  }

  let remainingNeeded = roundQty(requestedQty);
  let runningBalance = totalAvailable;
  const allocations: RequisitionAllocation[] = [];
  let totalAmount = 0;

  for (const lot of sorted) {
    if (remainingNeeded <= 1e-9) break;
    const avail = availableQty(lot);
    if (avail <= 1e-9) continue;

    const take = roundQty(Math.min(avail, remainingNeeded));
    const lineAmount = round2(take * lot.unitPrice);
    runningBalance = roundQty(Math.max(0, runningBalance - take));
    remainingNeeded = roundQty(Math.max(0, remainingNeeded - take));
    totalAmount = round2(totalAmount + lineAmount);

    allocations.push({
      lotId: lot.id,
      referenceDocNo: lot.referenceDocNo,
      unitPrice: lot.unitPrice,
      allocatedQty: take,
      lineAmount,
      balanceAfterThisSplit: runningBalance,
    });
  }

  return {
    materialId,
    requestedQty,
    balanceBefore: totalAvailable,
    balanceAfter: runningBalance,
    totalAmount,
    allocations,
  };
}

export function recordStockIntake(
  state: InventoryDomainState,
  intake: StockIntakeInput,
  options: {allowDuplicateProcurementCase?: boolean} = {},
): {state: InventoryDomainState; lot: StockLot; ledgerEntry: StockLedgerEntry} {
  const material = state.materials.find(m => m.id === intake.materialId);
  if (!material) throw new Error(`ไม่พบรายการวัสดุรหัส ${intake.materialId}`);

  if (
    intake.sourceProcurementCaseId &&
    !options.allowDuplicateProcurementCase &&
    state.lots.some(
      l => l.sourceProcurementCaseId === intake.sourceProcurementCaseId && l.materialId === intake.materialId,
    )
  ) {
    throw new DuplicateProcurementImportError(intake.sourceProcurementCaseId);
  }

  const maxOrder = state.lots.reduce((max, l) => Math.max(max, l.createdOrder), 0);
  const partyDescription =
    intake.sourceType === 'OPENING_BALANCE'
      ? 'ยอดยกมา'
      : intake.sourceLabel?.trim() || 'รับเข้าพัสดุ';

  const lot = StockLotSchema.parse({
    id: intake.lotId ?? `LOT-${String(intake.fiscalYearBE).slice(-2)}-${randomUUID().slice(0, 8)}`,
    materialId: intake.materialId,
    fiscalYearBE: intake.fiscalYearBE,
    receivedDate: intake.receivedDate,
    createdOrder: intake.createdOrder ?? maxOrder + 1,
    sourceType: intake.sourceType,
    sourceLabel: partyDescription,
    referenceDocNo: intake.referenceDocNo,
    sourceProcurementCaseId: intake.sourceProcurementCaseId,
    unitPrice: intake.unitPrice,
    initialQty: intake.initialQty,
    remainingQty: intake.initialQty,
    reservedQty: 0,
  });

  const nextLots = [...state.lots, lot];
  const totals = getMaterialStockTotals(nextLots, intake.materialId);
  const inAmount = round2(lot.initialQty * lot.unitPrice);

  const ledgerEntry = StockLedgerEntrySchema.parse({
    id: randomUUID(),
    materialId: lot.materialId,
    fiscalYearBE: lot.fiscalYearBE,
    entryDate: lot.receivedDate,
    partyDescription,
    docNo: lot.referenceDocNo,
    lotId: lot.id,
    unitPrice: lot.unitPrice,
    inQty: lot.initialQty,
    inAmount,
    outQty: 0,
    outAmount: 0,
    balanceQty: totals.remainingQty,
    balanceAmount: totals.totalValue,
    accountingNote: intake.accountingNote?.trim() || 'บันทึกบัญชีเดบิท',
  });

  return {
    state: {...state, lots: nextLots, ledger: [...state.ledger, ledgerEntry]},
    lot,
    ledgerEntry,
  };
}

export interface CreateRequisitionDraftInput {
  id?: string;
  requisitionRunningNo: string;
  fiscalYearBE: number;
  requestDate: string;
  requesterName: string;
  requesterPosition: string;
  receiverName?: string;
  purpose?: string;
  lines: ReadonlyArray<{
    id?: string;
    materialId: string;
    requestedQty: number;
    remarkOverride?: string;
  }>;
}

export function createRequisitionDraft(
  state: InventoryDomainState,
  input: CreateRequisitionDraftInput,
): {state: InventoryDomainState; requisition: Requisition} {
  const workingLots = structuredClone(state.lots);
  const lines = input.lines.map(line => {
    const preview = previewFifoAllocation(workingLots, line.materialId, line.requestedQty);
    // Simulate temporary reservation on working copy so multiple lines for the same material preview accurately.
    for (const alloc of preview.allocations) {
      const lot = workingLots.find(l => l.id === alloc.lotId)!;
      lot.reservedQty = roundQty(lot.reservedQty + alloc.allocatedQty);
    }
    return {
      id: line.id ?? randomUUID(),
      materialId: line.materialId,
      requestedQty: line.requestedQty,
      approvedQty: line.requestedQty,
      allocations: preview.allocations,
      remarkOverride: line.remarkOverride,
    };
  });

  const requisition = RequisitionSchema.parse({
    id: input.id ?? randomUUID(),
    requisitionRunningNo: input.requisitionRunningNo,
    fiscalYearBE: input.fiscalYearBE,
    requestDate: input.requestDate,
    requesterName: input.requesterName,
    requesterPosition: input.requesterPosition,
    receiverName: input.receiverName?.trim() || undefined,
    purpose: input.purpose,
    status: 'DRAFT',
    lines,
  });

  return {
    state: {...state, requisitions: [...state.requisitions, requisition]},
    requisition,
  };
}

export function assertRequisitionMutable(requisition: Pick<Requisition, 'status'>): void {
  if (requisition.status === 'COMMITTED') {
    throw new InvalidRequisitionTransitionError('ใบเบิกที่ลงบัญชีแล้วไม่สามารถแก้ไขหรือลบได้ เพื่อความถูกต้องทางบัญชี');
  }
  if (requisition.status === 'PENDING_SIGNATURE') {
    throw new InvalidRequisitionTransitionError('ใบเบิกที่อยู่ระหว่างรอลงนามไม่สามารถแก้ไขโดยตรง กรุณายกเลิกเพื่อคืนยอดจองก่อน');
  }
}

export function updateRequisitionDraft(
  state: InventoryDomainState,
  requisitionId: string,
  patch: Partial<Pick<Requisition, 'requestDate' | 'requesterName' | 'requesterPosition' | 'receiverName' | 'purpose' | 'requisitionRunningNo'>>,
): {state: InventoryDomainState; requisition: Requisition} {
  const existing = state.requisitions.find(r => r.id === requisitionId);
  if (!existing) throw new Error(`ไม่พบใบเบิกวัสดุรหัส ${requisitionId}`);
  assertRequisitionMutable(existing);
  const updated = RequisitionSchema.parse({...existing, ...patch});
  return {
    state: {...state, requisitions: state.requisitions.map(r => (r.id === requisitionId ? updated : r))},
    requisition: updated,
  };
}

export function deleteRequisition(state: InventoryDomainState, requisitionId: string): InventoryDomainState {
  const existing = state.requisitions.find(r => r.id === requisitionId);
  if (!existing) throw new Error(`ไม่พบใบเบิกวัสดุรหัส ${requisitionId}`);
  assertRequisitionMutable(existing);
  return {...state, requisitions: state.requisitions.filter(r => r.id !== requisitionId)};
}

export function transitionRequisitionStatus(
  state: InventoryDomainState,
  requisitionId: string,
  action: RequisitionTransitionAction,
  options: {committedDate?: string; signedScanAttachmentPath?: string} = {},
): {state: InventoryDomainState; requisition: Requisition; ledgerEntries: StockLedgerEntry[]} {
  const index = state.requisitions.findIndex(r => r.id === requisitionId);
  if (index < 0) throw new Error(`ไม่พบใบเบิกวัสดุรหัส ${requisitionId}`);

  const current = state.requisitions[index];
  const workingLots = structuredClone(state.lots);
  const newLedgerEntries: StockLedgerEntry[] = [];
  let updated: Requisition;

  if (action === 'SUBMIT_FOR_SIGNATURE') {
    if (current.status !== 'DRAFT') {
      throw new InvalidRequisitionTransitionError(
        `ไม่สามารถส่งลงนามได้ เนื่องจากสถานะปัจจุบันคือ ${current.status} (ต้องเป็น DRAFT)`,
      );
    }

    const frozenLines = current.lines.map(line => {
      const qtyToIssue = line.approvedQty > 0 ? line.approvedQty : line.requestedQty;
      const preview = previewFifoAllocation(workingLots, line.materialId, qtyToIssue);
      for (const alloc of preview.allocations) {
        const lot = workingLots.find(l => l.id === alloc.lotId);
        if (!lot) throw new Error(`ไม่พบล็อตพัสดุ ${alloc.lotId}`);
        lot.reservedQty = roundQty(lot.reservedQty + alloc.allocatedQty);
      }
      return {
        ...line,
        approvedQty: qtyToIssue,
        allocations: preview.allocations,
      };
    });

    updated = RequisitionSchema.parse({
      ...current,
      status: 'PENDING_SIGNATURE',
      lines: frozenLines,
    });
  } else if (action === 'COMMIT_AFTER_SIGNATURE') {
    if (current.status !== 'PENDING_SIGNATURE') {
      throw new InvalidRequisitionTransitionError(
        `ไม่สามารถตัดจ่ายลงบัญชีได้ เนื่องจากสถานะปัจจุบันคือ ${current.status} (ต้องเป็น PENDING_SIGNATURE)`,
      );
    }

    const entryDate = options.committedDate ?? current.requestDate;
    const docNo = `${current.requisitionRunningNo}/${current.fiscalYearBE}`;
    const partyDescription = `จ่ายให้ ${current.requesterName}`;

    for (const line of current.lines) {
      for (const alloc of line.allocations) {
        const lot = workingLots.find(l => l.id === alloc.lotId);
        if (!lot) throw new Error(`ไม่พบล็อตพัสดุ ${alloc.lotId}`);
        if (lot.reservedQty + 1e-9 < alloc.allocatedQty || lot.remainingQty + 1e-9 < alloc.allocatedQty) {
          throw new InvalidRequisitionTransitionError(
            `ยอดจองหรือยอดคงเหลือในล็อต ${lot.id} ไม่ตรงกับใบเบิก กรุณาตรวจสอบทะเบียนล็อต`,
          );
        }
        lot.reservedQty = roundQty(Math.max(0, lot.reservedQty - alloc.allocatedQty));
        lot.remainingQty = roundQty(Math.max(0, lot.remainingQty - alloc.allocatedQty));

        const totals = getMaterialStockTotals(workingLots, line.materialId);
        newLedgerEntries.push(
          StockLedgerEntrySchema.parse({
            id: randomUUID(),
            materialId: line.materialId,
            fiscalYearBE: current.fiscalYearBE,
            entryDate,
            partyDescription,
            docNo,
            lotId: lot.id,
            unitPrice: alloc.unitPrice,
            inQty: 0,
            inAmount: 0,
            outQty: alloc.allocatedQty,
            outAmount: alloc.lineAmount,
            balanceQty: totals.remainingQty,
            balanceAmount: totals.totalValue,
            accountingNote: 'ค่าวัสดุใช้ไป',
          }),
        );
      }
    }

    updated = RequisitionSchema.parse({
      ...current,
      status: 'COMMITTED',
      committedDate: entryDate,
      signedScanAttachmentPath: options.signedScanAttachmentPath ?? current.signedScanAttachmentPath,
    });
  } else {
    // CANCEL
    if (current.status === 'COMMITTED') {
      throw new InvalidRequisitionTransitionError('ไม่สามารถยกเลิกใบเบิกที่ตัดจ่ายลงบัญชีวัสดุแล้วได้');
    }
    if (current.status === 'CANCELLED') {
      return {state, requisition: current, ledgerEntries: []};
    }
    if (current.status === 'PENDING_SIGNATURE') {
      for (const line of current.lines) {
        for (const alloc of line.allocations) {
          const lot = workingLots.find(l => l.id === alloc.lotId);
          if (!lot) continue;
          lot.reservedQty = roundQty(Math.max(0, lot.reservedQty - alloc.allocatedQty));
        }
      }
    }
    updated = RequisitionSchema.parse({
      ...current,
      status: 'CANCELLED',
    });
  }

  const nextRequisitions = state.requisitions.map((r, i) => (i === index ? updated : r));
  return {
    state: {
      ...state,
      lots: workingLots,
      requisitions: nextRequisitions,
      ledger: [...state.ledger, ...newLedgerEntries],
    },
    requisition: updated,
    ledgerEntries: newLedgerEntries,
  };
}

export function transitionAssetLoanStatus(
  state: InventoryDomainState,
  loanId: string,
  action: AssetLoanTransitionAction,
  options: {actualReturnDate?: string; conditionAfter?: string} = {},
): {state: InventoryDomainState; loan: AssetLoan} {
  const index = state.assetLoans.findIndex(l => l.id === loanId);
  if (index < 0) throw new Error(`ไม่พบใบยืมครุภัณฑ์รหัส ${loanId}`);
  const current = state.assetLoans[index];
  let updated: AssetLoan;

  if (action === 'ACTIVATE') {
    if (current.status !== 'PENDING_SIGNATURE') {
      throw new InvalidRequisitionTransitionError('เปิดใช้งานการยืมได้เฉพาะใบยืมที่รอลงนามเท่านั้น');
    }
    const conflict = state.assetLoans.find(l => l.id !== loanId && l.assetId === current.assetId && l.status === 'ACTIVE_LOAN');
    if (conflict) {
      throw new InvalidRequisitionTransitionError(`ครุภัณฑ์นี้ถูกยืมอยู่ตามใบยืม ${conflict.loanRunningNo}/${conflict.fiscalYearBE}`);
    }
    updated = AssetLoanSchema.parse({...current, status: 'ACTIVE_LOAN'});
  } else if (action === 'RETURN') {
    if (current.status !== 'ACTIVE_LOAN') {
      throw new InvalidRequisitionTransitionError('รับคืนได้เฉพาะครุภัณฑ์ที่อยู่ระหว่างยืมเท่านั้น');
    }
    updated = AssetLoanSchema.parse({
      ...current,
      status: 'RETURNED',
      actualReturnDate: options.actualReturnDate ?? current.dueReturnDate,
      conditionAfter: options.conditionAfter ?? 'ปกติ ใช้งานได้',
    });
  } else {
    if (current.status !== 'PENDING_SIGNATURE') {
      throw new InvalidRequisitionTransitionError('ยกเลิกได้เฉพาะใบยืมที่ยังไม่ส่งมอบเท่านั้น');
    }
    updated = AssetLoanSchema.parse({...current, status: 'CANCELLED'});
  }

  return {
    state: {...state, assetLoans: state.assetLoans.map((l, i) => (i === index ? updated : l))},
    loan: updated,
  };
}

export interface CarryForwardResult {
  state: InventoryDomainState;
  fromFiscalYearBE: number;
  toFiscalYearBE: number;
  openingDate: string;
  carriedMaterialCount: number;
  carriedLotCount: number;
  totalCarriedQty: number;
  totalCarriedAmount: number;
}

/**
 * Closes `fromFiscalYearBE` and carries forward every active remaining FIFO cost layer
 * as `OPENING_BALANCE` (`ยอดยกมา`) on October 1 of `toFiscalYearBE` without double-counting stock.
 */
export function carryForwardFiscalYear(
  state: InventoryDomainState,
  fromFiscalYearBE: number,
  toFiscalYearBE = fromFiscalYearBE + 1,
): CarryForwardResult {
  if (!Number.isInteger(fromFiscalYearBE) || !Number.isInteger(toFiscalYearBE) || toFiscalYearBE <= fromFiscalYearBE) {
    throw new RangeError('ปีงบประมาณปลายทางต้องมากกว่าปีงบประมาณต้นทาง');
  }

  const pendingReqs = state.requisitions.filter(
    r => r.fiscalYearBE <= fromFiscalYearBE && r.status === 'PENDING_SIGNATURE',
  );
  if (pendingReqs.length > 0) {
    throw new InvalidRequisitionTransitionError(
      `ยังมีใบเบิกปีงบประมาณ ${fromFiscalYearBE} รอเซ็นรับของจริงอยู่ ${pendingReqs.length} ใบ กรุณายืนยันตัดสต๊อกหรือยกเลิกก่อนปิดงบและยกยอด`,
    );
  }

  const refDoc = `ปี ${fromFiscalYearBE}`;
  const alreadyCarried = state.lots.some(
    l => l.fiscalYearBE === toFiscalYearBE && l.sourceType === 'OPENING_BALANCE' && l.referenceDocNo === refDoc,
  );
  if (alreadyCarried) {
    throw new InvalidRequisitionTransitionError(
      `ได้ดำเนินการปิดงบและยกยอดจากปีงบประมาณ ${fromFiscalYearBE} ไปปีงบประมาณ ${toFiscalYearBE} เรียบร้อยแล้ว`,
    );
  }

  const openingDate = `${toFiscalYearBE - 544}-10-01`;
  const workingLots = structuredClone(state.lots);
  const newLots: StockLot[] = [];
  const newLedger: StockLedgerEntry[] = [];
  let maxOrder = workingLots.reduce((m, l) => Math.max(m, l.createdOrder), 0);
  let carriedMaterialCount = 0;
  let totalCarriedQty = 0;
  let totalCarriedAmount = 0;

  const sortedMaterials = [...state.materials].sort(
    (a, b) => a.ledgerSeqNo - b.ledgerSeqNo || a.id.localeCompare(b.id),
  );

  for (const material of sortedMaterials) {
    const activeOldLots = sortLotsFifo(
      workingLots.filter(
        l => l.materialId === material.id && l.fiscalYearBE <= fromFiscalYearBE && l.remainingQty > 1e-9,
      ),
    );
    if (activeOldLots.length === 0) continue;

    carriedMaterialCount += 1;
    let runningQty = 0;
    let runningAmount = 0;

    for (const oldLot of activeOldLots) {
      const targetRef = workingLots.find(l => l.id === oldLot.id)!;
      const carryQty = roundQty(targetRef.remainingQty);
      const carryAmount = round2(carryQty * targetRef.unitPrice);

      // Transfer remaining physical stock out of closed year into new fiscal year's opening layer
      targetRef.remainingQty = 0;

      maxOrder += 1;
      const openingLot = StockLotSchema.parse({
        id: `LOT-${String(toFiscalYearBE).slice(-2)}-CF-${randomUUID().slice(0, 8)}`,
        materialId: material.id,
        fiscalYearBE: toFiscalYearBE,
        receivedDate: openingDate,
        createdOrder: maxOrder,
        sourceType: 'OPENING_BALANCE',
        sourceLabel: 'ยอดยกมา',
        referenceDocNo: refDoc,
        unitPrice: targetRef.unitPrice,
        initialQty: carryQty,
        remainingQty: carryQty,
        reservedQty: 0,
      });
      newLots.push(openingLot);

      runningQty = roundQty(runningQty + carryQty);
      runningAmount = round2(runningAmount + carryAmount);
      totalCarriedQty = roundQty(totalCarriedQty + carryQty);
      totalCarriedAmount = round2(totalCarriedAmount + carryAmount);

      newLedger.push(
        StockLedgerEntrySchema.parse({
          id: randomUUID(),
          materialId: material.id,
          fiscalYearBE: toFiscalYearBE,
          entryDate: openingDate,
          partyDescription: 'ยอดยกมา',
          docNo: refDoc,
          lotId: openingLot.id,
          unitPrice: openingLot.unitPrice,
          inQty: carryQty,
          inAmount: carryAmount,
          outQty: 0,
          outAmount: 0,
          balanceQty: runningQty,
          balanceAmount: runningAmount,
          accountingNote: 'บันทึกบัญชีเดบิท',
        }),
      );
    }
  }

  return {
    state: {
      ...state,
      lots: [...workingLots, ...newLots],
      ledger: [...state.ledger, ...newLedger],
    },
    fromFiscalYearBE,
    toFiscalYearBE,
    openingDate,
    carriedMaterialCount,
    carriedLotCount: newLots.length,
    totalCarriedQty,
    totalCarriedAmount,
  };
}
