import {availableQty, round2, roundQty} from './fifo-engine';
import type {
  AssetCondition,
  Audit213Report,
  FiscalYearSummary,
  InventoryDomainState,
  MaterialFiscalSummary,
  StockCardReport,
  StockCardSheet,
  StockLedgerEntry,
  StockLot,
} from './types';

function isOpeningEntry(entry: StockLedgerEntry, lotsById: ReadonlyMap<string, StockLot>): boolean {
  const lot = lotsById.get(entry.lotId);
  if (lot) return lot.sourceType === 'OPENING_BALANCE';
  return entry.partyDescription === 'ยอดยกมา';
}

export function getThaiFiscalQuarterRange(
  fiscalYearBE: number,
  quarter: 1 | 2 | 3 | 4,
): {periodLabel: string; periodStart: string; periodEnd: string} {
  const yearAD = fiscalYearBE - 543;
  switch (quarter) {
    case 1:
      return {
        periodLabel: `ไตรมาส 1 ปีงบประมาณ ${fiscalYearBE} (ต.ค.–ธ.ค. ${fiscalYearBE - 1})`,
        periodStart: `${yearAD - 1}-10-01`,
        periodEnd: `${yearAD - 1}-12-31`,
      };
    case 2:
      return {
        periodLabel: `ไตรมาส 2 ปีงบประมาณ ${fiscalYearBE} (ม.ค.–มี.ค. ${fiscalYearBE})`,
        periodStart: `${yearAD}-01-01`,
        periodEnd: `${yearAD}-03-31`,
      };
    case 3:
      return {
        periodLabel: `ไตรมาส 3 ปีงบประมาณ ${fiscalYearBE} (เม.ย.–มิ.ย. ${fiscalYearBE})`,
        periodStart: `${yearAD}-04-01`,
        periodEnd: `${yearAD}-06-30`,
      };
    case 4:
      return {
        periodLabel: `ไตรมาส 4 ปีงบประมาณ ${fiscalYearBE} (ก.ค.–ก.ย. ${fiscalYearBE})`,
        periodStart: `${yearAD}-07-01`,
        periodEnd: `${yearAD}-09-30`,
      };
  }
}

export function buildStockCard(
  state: InventoryDomainState,
  materialId: string,
  fiscalYearBE: number,
  rowsPerSheet = 20,
): StockCardReport {
  const material = state.materials.find(m => m.id === materialId);
  if (!material) throw new Error(`ไม่พบรายการวัสดุรหัส ${materialId}`);
  if (!Number.isInteger(rowsPerSheet) || rowsPerSheet < 1) {
    throw new RangeError('จำนวนแถวต่อแผ่นต้องเป็นจำนวนเต็มตั้งแต่ 1 ขึ้นไป');
  }

  const lotsById = new Map(state.lots.map(lot => [lot.id, lot]));
  const entries = state.ledger.filter(e => e.materialId === materialId && e.fiscalYearBE === fiscalYearBE);

  let openingQty = 0;
  let openingAmount = 0;
  let totalInQty = 0;
  let totalInAmount = 0;
  let totalOutQty = 0;
  let totalOutAmount = 0;

  for (const entry of entries) {
    if (entry.inQty > 0) {
      if (isOpeningEntry(entry, lotsById)) {
        openingQty = roundQty(openingQty + entry.inQty);
        openingAmount = round2(openingAmount + entry.inAmount);
      } else {
        totalInQty = roundQty(totalInQty + entry.inQty);
        totalInAmount = round2(totalInAmount + entry.inAmount);
      }
    }
    if (entry.outQty > 0) {
      totalOutQty = roundQty(totalOutQty + entry.outQty);
      totalOutAmount = round2(totalOutAmount + entry.outAmount);
    }
  }

  const lastEntry = entries.at(-1);
  const closingQty = lastEntry ? lastEntry.balanceQty : openingQty;
  const closingAmount = lastEntry ? lastEntry.balanceAmount : openingAmount;

  const totalSheets = Math.max(1, Math.ceil(entries.length / rowsPerSheet));
  const sheets: StockCardSheet[] = Array.from({length: totalSheets}, (_, index) => ({
    sheetNo: index + 1,
    totalSheets,
    rows: entries.slice(index * rowsPerSheet, (index + 1) * rowsPerSheet),
  }));

  return {
    material,
    fiscalYearBE,
    entries,
    sheets,
    openingQty,
    openingAmount,
    totalInQty,
    totalInAmount,
    totalOutQty,
    totalOutAmount,
    closingQty,
    closingAmount,
  };
}

export function buildFiscalYearSummary(
  state: InventoryDomainState,
  fiscalYearBE: number,
  options: {periodLabel?: string; periodStart?: string; periodEnd?: string} = {},
): FiscalYearSummary {
  const lotsById = new Map(state.lots.map(lot => [lot.id, lot]));
  const sortedMaterials = [...state.materials].sort((a, b) => a.ledgerSeqNo - b.ledgerSeqNo || a.id.localeCompare(b.id));
  const isPeriodCutOff = Boolean(options.periodStart || options.periodEnd);

  const items: MaterialFiscalSummary[] = sortedMaterials.map(material => {
    const yearEntries = state.ledger.filter(e => e.materialId === material.id && e.fiscalYearBE === fiscalYearBE);
    const materialLots = state.lots.filter(l => l.materialId === material.id && l.fiscalYearBE <= fiscalYearBE);

    let openingQty = 0;
    let openingAmount = 0;
    let totalInQty = 0;
    let totalInAmount = 0;
    let totalOutQty = 0;
    let totalOutAmount = 0;
    let closingQty = 0;
    let closingAmount = 0;

    if (isPeriodCutOff) {
      const start = options.periodStart ?? '0000-01-01';
      const end = options.periodEnd ?? '9999-12-31';
      const priorEntries = yearEntries.filter(e => e.entryDate < start);
      const periodEntries = yearEntries.filter(e => e.entryDate >= start && e.entryDate <= end);

      const priorLast = priorEntries.at(-1);
      openingQty = priorLast ? priorLast.balanceQty : 0;
      openingAmount = priorLast ? priorLast.balanceAmount : 0;

      for (const entry of periodEntries) {
        if (entry.inQty > 0) {
          if (priorEntries.length === 0 && isOpeningEntry(entry, lotsById)) {
            openingQty = roundQty(openingQty + entry.inQty);
            openingAmount = round2(openingAmount + entry.inAmount);
          } else {
            totalInQty = roundQty(totalInQty + entry.inQty);
            totalInAmount = round2(totalInAmount + entry.inAmount);
          }
        }
        if (entry.outQty > 0) {
          totalOutQty = roundQty(totalOutQty + entry.outQty);
          totalOutAmount = round2(totalOutAmount + entry.outAmount);
        }
      }

      const periodLast = periodEntries.at(-1) ?? priorLast;
      closingQty = periodLast ? periodLast.balanceQty : 0;
      closingAmount = periodLast ? periodLast.balanceAmount : 0;
    } else {
      for (const entry of yearEntries) {
        if (entry.inQty > 0) {
          if (isOpeningEntry(entry, lotsById)) {
            openingQty = roundQty(openingQty + entry.inQty);
            openingAmount = round2(openingAmount + entry.inAmount);
          } else {
            totalInQty = roundQty(totalInQty + entry.inQty);
            totalInAmount = round2(totalInAmount + entry.inAmount);
          }
        }
        if (entry.outQty > 0) {
          totalOutQty = roundQty(totalOutQty + entry.outQty);
          totalOutAmount = round2(totalOutAmount + entry.outAmount);
        }
      }
      const last = yearEntries.at(-1);
      closingQty = last ? last.balanceQty : openingQty;
      closingAmount = last ? last.balanceAmount : openingAmount;
    }

    const lotRemainingQty = roundQty(materialLots.reduce((sum, lot) => sum + lot.remainingQty, 0));
    const lotRemainingAmount = round2(
      materialLots.reduce((sum, lot) => sum + round2(lot.remainingQty * lot.unitPrice), 0),
    );
    const reservedQty = roundQty(materialLots.reduce((sum, lot) => sum + lot.reservedQty, 0));
    const availQty = roundQty(materialLots.reduce((sum, lot) => sum + availableQty(lot), 0));

    const expectedClosingQty = roundQty(openingQty + totalInQty - totalOutQty);
    const expectedClosingAmount = round2(openingAmount + totalInAmount - totalOutAmount);

    const carriedRefDoc = `ปี ${fiscalYearBE}`;
    const carriedForwardToNext = state.lots.some(
      l => l.fiscalYearBE === fiscalYearBE + 1 && l.sourceType === 'OPENING_BALANCE' && l.referenceDocNo === carriedRefDoc,
    );
    const carriedNextLots = carriedForwardToNext
      ? state.lots.filter(
          l =>
            l.materialId === material.id &&
            l.fiscalYearBE === fiscalYearBE + 1 &&
            l.sourceType === 'OPENING_BALANCE' &&
            l.referenceDocNo === carriedRefDoc,
        )
      : [];
    const checkClosingQty = carriedForwardToNext
      ? roundQty(carriedNextLots.reduce((sum, lot) => sum + lot.initialQty, 0))
      : lotRemainingQty;
    const checkClosingAmount = carriedForwardToNext
      ? round2(carriedNextLots.reduce((sum, lot) => sum + round2(lot.initialQty * lot.unitPrice), 0))
      : lotRemainingAmount;

    const qtyBalanced = isPeriodCutOff
      ? Math.abs(expectedClosingQty - closingQty) < 1e-6
      : Math.abs(expectedClosingQty - closingQty) < 1e-6 && Math.abs(closingQty - checkClosingQty) < 1e-6;
    const amountBalanced = isPeriodCutOff
      ? Math.abs(expectedClosingAmount - closingAmount) < 0.005
      : Math.abs(expectedClosingAmount - closingAmount) < 0.005 &&
        Math.abs(closingAmount - checkClosingAmount) < 0.005;

    return {
      materialId: material.id,
      ledgerSeqNo: material.ledgerSeqNo,
      name: material.name,
      categoryCode: material.categoryCode,
      categoryType: material.categoryType,
      unit: material.unit,
      openingQty,
      openingAmount,
      totalInQty,
      totalInAmount,
      totalOutQty,
      totalOutAmount,
      closingQty,
      closingAmount,
      lotRemainingQty,
      lotRemainingAmount,
      reservedQty,
      availableQty: availQty,
      qtyBalanced,
      amountBalanced,
      isBelowMinStock: closingQty <= material.minStockQty,
    };
  });

  const totals = {
    openingQty: roundQty(items.reduce((s, i) => s + i.openingQty, 0)),
    openingAmount: round2(items.reduce((s, i) => s + i.openingAmount, 0)),
    totalInQty: roundQty(items.reduce((s, i) => s + i.totalInQty, 0)),
    totalInAmount: round2(items.reduce((s, i) => s + i.totalInAmount, 0)),
    totalOutQty: roundQty(items.reduce((s, i) => s + i.totalOutQty, 0)),
    totalOutAmount: round2(items.reduce((s, i) => s + i.totalOutAmount, 0)),
    closingQty: roundQty(items.reduce((s, i) => s + i.closingQty, 0)),
    closingAmount: round2(items.reduce((s, i) => s + i.closingAmount, 0)),
    lotRemainingQty: roundQty(items.reduce((s, i) => s + i.lotRemainingQty, 0)),
    lotRemainingAmount: round2(items.reduce((s, i) => s + i.lotRemainingAmount, 0)),
  };

  return {
    fiscalYearBE,
    periodLabel: options.periodLabel ?? `ปีงบประมาณ ${fiscalYearBE}`,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
    items,
    totals,
    lowStockMaterialIds: items.filter(i => i.isBelowMinStock).map(i => i.materialId),
    allBalanced: items.every(i => i.qtyBalanced && i.amountBalanced),
  };
}

export function buildQuarterlyCutOffReport(
  state: InventoryDomainState,
  fiscalYearBE: number,
  quarter: 1 | 2 | 3 | 4,
): FiscalYearSummary {
  const range = getThaiFiscalQuarterRange(fiscalYearBE, quarter);
  return buildFiscalYearSummary(state, fiscalYearBE, range);
}

/**
 * Annual physical inspection & reconciliation report per
 * ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 213.
 */
export function buildAnnualAudit213Report(
  state: InventoryDomainState,
  fiscalYearBE: number,
  auditDate: string,
): Audit213Report {
  const materialSummary = buildFiscalYearSummary(state, fiscalYearBE);
  const byCondition: Record<AssetCondition, number> = {
    GOOD: 0,
    DAMAGED_REPAIRABLE: 0,
    UNSERVICEABLE_DISPOSE: 0,
    MISSING: 0,
  };
  let totalAcquisitionCost = 0;
  for (const asset of state.assets) {
    byCondition[asset.condition] += 1;
    totalAcquisitionCost = round2(totalAcquisitionCost + asset.acquisitionCost);
  }
  const activeLoans = state.assetLoans.filter(l => l.status === 'ACTIVE_LOAN');
  const overdueLoans = activeLoans.filter(l => l.dueReturnDate < auditDate);

  return {
    fiscalYearBE,
    auditDate,
    regulationRef: 'ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. 2560 ข้อ 213',
    materialSummary,
    assets: {
      totalCount: state.assets.length,
      totalAcquisitionCost,
      byCondition,
      activeLoanCount: activeLoans.length,
      overdueLoanCount: overdueLoans.length,
      items: [...state.assets].sort((a, b) => a.assetCode.localeCompare(b.assetCode)),
      overdueLoans,
    },
  };
}
