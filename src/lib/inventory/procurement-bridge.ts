const randomUUID = () => globalThis.crypto.randomUUID();
import {computeProcurementCase} from '../procurement/calculations';
import {toThaiDigits} from '../procurement/formatting';
import {formatDocumentNumbers} from '../procurement/numbering';
import {defaultAgency} from '../procurement/presets/default-agency';
import type {AgencyConfig, ComputedProcurementCase, ProcurementCaseInput} from '../procurement/types';
import {findCategoryByName, mergeSuggestedUnits, searchStandardCatalog} from './catalog/standard-units';
import {DuplicateProcurementImportError, recordStockIntake, round2} from './fifo-engine';
import {MaterialItemSchema} from './schema';
import type {CategoryCode, InventoryDomainState, MaterialItem, StockIntakeDraft, StockLot} from './types';

const normalizeMaterialKey = (value: string) =>
  value
    .normalize('NFKC')
    .replace(/[๐-๙]/g, ch => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)))
    .toLocaleLowerCase('th-TH')
    .replace(/\s+/g, ' ')
    .trim();

function ensureComputedCase(input: ComputedProcurementCase | ProcurementCaseInput): ComputedProcurementCase {
  if ('grandTotal' in input && 'lineTotals' in input) return input;
  return computeProcurementCase(input);
}

export interface ProcurementIntakeMappingResult {
  caseId: string;
  alreadyImported: boolean;
  poNumber: string;
  poNumberThai: string;
  inspectionDate: string;
  vendorShopName: string;
  fiscalYearBE: number;
  drafts: StockIntakeDraft[];
}

/**
 * Maps a completed Procurement case (Doc 10 PO + Doc 11.1 inspection) into pre-filled StockIntakeDraft[]
 * with auto-matching against existing MaterialItem master records and 18-category catalog suggestions.
 */
export function mapProcurementCaseToStockIntake(
  procurementCase: ComputedProcurementCase | ProcurementCaseInput,
  existingMaterials: readonly MaterialItem[],
  existingLots: readonly StockLot[] = [],
  agency: AgencyConfig = defaultAgency,
): ProcurementIntakeMappingResult {
  const c = ensureComputedCase(procurementCase);
  const alreadyImported = existingLots.some(lot => lot.sourceProcurementCaseId === c.id);
  const numbers = formatDocumentNumbers(c.docs, agency);
  const poNumber = numbers.doc10_purchaseOrder || numbers.doc11_1_inspectionReport || c.id;
  const poNumberThai = toThaiDigits(poNumber);
  const inspectionDate =
    c.docs.doc11_1_inspectionReport.date ??
    c.deliveryDate ??
    c.docs.doc10_purchaseOrder.date ??
    c.docs.doc1_approvePrinciple.date;

  const fiscalYearBE =
    c.docs.doc10_purchaseOrder.fiscalYearBE ??
    c.budgetLine.fiscalYearBE;

  const sourceLabel = `รับจาก (${c.vendor.shopName})`;
  const budgetCategory = findCategoryByName(c.budgetLine.categoryType) ?? findCategoryByName(c.budgetLine.categoryGroup);

  const drafts: StockIntakeDraft[] = c.items.map((item, itemIndex) => {
    const normName = normalizeMaterialKey(item.description);
    const normUnit = normalizeMaterialKey(item.unit);

    const matched =
      existingMaterials.find(
        m => normalizeMaterialKey(m.name) === normName && normalizeMaterialKey(m.unit) === normUnit,
      ) ??
      existingMaterials.find(
        m =>
          normalizeMaterialKey(m.name) === normName ||
          (normName.length >= 6 &&
            normalizeMaterialKey(m.unit) === normUnit &&
            (normalizeMaterialKey(m.name).includes(normName) || normName.includes(normalizeMaterialKey(m.name)))),
      ) ??
      null;

    const catalogHits = searchStandardCatalog(item.description, budgetCategory?.code);
    const fallbackHits = catalogHits.length ? catalogHits : searchStandardCatalog(item.description);
    const bestHit = fallbackHits[0];

    const suggestedCategoryCode: CategoryCode =
      matched?.categoryCode ??
      bestHit?.categoryCode ??
      budgetCategory?.code ??
      '01';
    const suggestedCategoryType =
      matched?.categoryType ??
      bestHit?.categoryName ??
      budgetCategory?.categoryName ??
      'วัสดุสำนักงาน';

    const suggestedUnits = mergeSuggestedUnits(
      bestHit?.suggestedUnits ?? [],
      item.unit,
    );

    return {
      sourceProcurementCaseId: c.id,
      itemIndex,
      matchedMaterialId: matched?.id ?? null,
      matchedMaterialName: matched?.name ?? null,
      isNewMaterial: !matched,
      suggestedName: matched?.name ?? item.description.trim(),
      suggestedCategoryCode,
      suggestedCategoryType,
      suggestedUnit: matched?.unit ?? item.unit.trim(),
      suggestedUnits,
      fiscalYearBE,
      receivedDate: inspectionDate,
      sourceType: 'PROCUREMENT_PO',
      sourceLabel,
      referenceDocNo: poNumber,
      referenceDocNoThai: poNumberThai,
      unitPrice: item.unitPrice,
      initialQty: item.quantity,
      lineTotal: c.lineTotals[itemIndex] ?? round2(item.quantity * item.unitPrice),
    };
  });

  return {
    caseId: c.id,
    alreadyImported,
    poNumber,
    poNumberThai,
    inspectionDate,
    vendorShopName: c.vendor.shopName,
    fiscalYearBE,
    drafts,
  };
}

/**
 * 1-click atomic import of all items from a completed Procurement case into inventory state.
 * Creates new MaterialItem records for unmatched items, adds StockLots + immutable StockLedgerEntries,
 * and rejects duplicate imports of the same procurement case.
 */
export function importProcurementCaseToInventory(
  state: InventoryDomainState,
  procurementCase: ComputedProcurementCase | ProcurementCaseInput,
  agency: AgencyConfig = defaultAgency,
): {
  state: InventoryDomainState;
  createdMaterials: MaterialItem[];
  createdLots: StockLot[];
  mapping: ProcurementIntakeMappingResult;
} {
  const mapping = mapProcurementCaseToStockIntake(procurementCase, state.materials, state.lots, agency);
  if (mapping.alreadyImported) {
    throw new DuplicateProcurementImportError(mapping.caseId);
  }

  let nextState = state;
  const createdMaterials: MaterialItem[] = [];
  const createdLots: StockLot[] = [];
  let nextSeqNo = state.materials.reduce((max, m) => Math.max(max, m.ledgerSeqNo), 0);

  for (const draft of mapping.drafts) {
    let materialId = draft.matchedMaterialId;
    if (!materialId) {
      // Check if an earlier line in this same PO just created a matching material.
      const justCreated = createdMaterials.find(
        m =>
          normalizeMaterialKey(m.name) === normalizeMaterialKey(draft.suggestedName) &&
          normalizeMaterialKey(m.unit) === normalizeMaterialKey(draft.suggestedUnit),
      );
      if (justCreated) {
        materialId = justCreated.id;
      } else {
        nextSeqNo += 1;
        const created = MaterialItemSchema.parse({
          id: randomUUID(),
          ledgerSeqNo: nextSeqNo,
          code: '',
          name: draft.suggestedName,
          categoryCode: draft.suggestedCategoryCode,
          categoryType: draft.suggestedCategoryType,
          specification: '',
          unit: draft.suggestedUnit,
          storageLocation: agency.divisionName,
          maxStockQty: null,
          minStockQty: 5,
        });
        createdMaterials.push(created);
        nextState = {...nextState, materials: [...nextState.materials, created]};
        materialId = created.id;
      }
    }

    const intakeResult = recordStockIntake(
      nextState,
      {
        materialId,
        fiscalYearBE: draft.fiscalYearBE,
        receivedDate: draft.receivedDate,
        sourceType: 'PROCUREMENT_PO',
        sourceLabel: draft.sourceLabel,
        referenceDocNo: draft.referenceDocNo,
        sourceProcurementCaseId: draft.sourceProcurementCaseId,
        unitPrice: draft.unitPrice,
        initialQty: draft.initialQty,
      },
      {allowDuplicateProcurementCase: true},
    );
    nextState = intakeResult.state;
    createdLots.push(intakeResult.lot);
  }

  return {state: nextState, createdMaterials, createdLots, mapping};
}
