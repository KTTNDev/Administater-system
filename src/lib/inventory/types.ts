import type {z} from 'zod';
import type {
  AssetConditionSchema,
  AssetItemSchema,
  AssetLoanSchema,
  AssetLoanStatusSchema,
  CategoryCodeSchema,
  InventoryDomainStateSchema,
  MaterialItemSchema,
  RequisitionAllocationSchema,
  RequisitionLineSchema,
  RequisitionSchema,
  RequisitionStatusSchema,
  StockLedgerEntrySchema,
  StockLotSchema,
  StockLotSourceTypeSchema,
} from './schema';

export type CategoryCode = z.infer<typeof CategoryCodeSchema>;
export type MaterialItem = z.infer<typeof MaterialItemSchema>;
export type MaterialItemInput = z.input<typeof MaterialItemSchema>;
export type StockLotSourceType = z.infer<typeof StockLotSourceTypeSchema>;
export type StockLot = z.infer<typeof StockLotSchema>;
export type RequisitionStatus = z.infer<typeof RequisitionStatusSchema>;
export type RequisitionAllocation = z.infer<typeof RequisitionAllocationSchema>;
export type RequisitionLine = z.infer<typeof RequisitionLineSchema>;
export type Requisition = z.infer<typeof RequisitionSchema>;
export type StockLedgerEntry = z.infer<typeof StockLedgerEntrySchema>;
export type AssetCondition = z.infer<typeof AssetConditionSchema>;
export type AssetItem = z.infer<typeof AssetItemSchema>;
export type AssetItemInput = z.input<typeof AssetItemSchema>;
export type AssetLoanStatus = z.infer<typeof AssetLoanStatusSchema>;
export type AssetLoan = z.infer<typeof AssetLoanSchema>;
export type AssetLoanInput = z.input<typeof AssetLoanSchema>;
export type InventoryDomainState = z.infer<typeof InventoryDomainStateSchema>;

export type RequisitionTransitionAction =
  | 'SUBMIT_FOR_SIGNATURE'
  | 'COMMIT_AFTER_SIGNATURE'
  | 'CANCEL';

export type AssetLoanTransitionAction = 'ACTIVATE' | 'RETURN' | 'CANCEL';

export interface FifoPreviewResult {
  materialId: string;
  requestedQty: number;
  balanceBefore: number;
  balanceAfter: number;
  totalAmount: number;
  allocations: RequisitionAllocation[];
}

export interface StockIntakeInput {
  lotId?: string;
  materialId: string;
  fiscalYearBE: number;
  receivedDate: string;
  createdOrder?: number;
  sourceType: StockLotSourceType;
  sourceLabel?: string;
  referenceDocNo: string;
  sourceProcurementCaseId?: string;
  unitPrice: number;
  initialQty: number;
  accountingNote?: string;
}

export interface StockIntakeDraft {
  sourceProcurementCaseId: string;
  itemIndex: number;
  matchedMaterialId: string | null;
  matchedMaterialName: string | null;
  isNewMaterial: boolean;
  suggestedName: string;
  suggestedCategoryCode: CategoryCode;
  suggestedCategoryType: string;
  suggestedUnit: string;
  suggestedUnits: string[];
  fiscalYearBE: number;
  receivedDate: string;
  sourceType: 'PROCUREMENT_PO';
  sourceLabel: string;
  referenceDocNo: string;
  referenceDocNoThai: string;
  unitPrice: number;
  initialQty: number;
  lineTotal: number;
}

export interface StockCardSheet {
  sheetNo: number;
  totalSheets: number;
  rows: StockLedgerEntry[];
}

export interface StockCardReport {
  material: MaterialItem;
  fiscalYearBE: number;
  entries: StockLedgerEntry[];
  sheets: StockCardSheet[];
  openingQty: number;
  openingAmount: number;
  totalInQty: number;
  totalInAmount: number;
  totalOutQty: number;
  totalOutAmount: number;
  closingQty: number;
  closingAmount: number;
}

export interface MaterialFiscalSummary {
  materialId: string;
  ledgerSeqNo: number;
  name: string;
  categoryCode: CategoryCode;
  categoryType: string;
  unit: string;
  openingQty: number;
  openingAmount: number;
  totalInQty: number;
  totalInAmount: number;
  totalOutQty: number;
  totalOutAmount: number;
  closingQty: number;
  closingAmount: number;
  lotRemainingQty: number;
  lotRemainingAmount: number;
  reservedQty: number;
  availableQty: number;
  qtyBalanced: boolean;
  amountBalanced: boolean;
  isBelowMinStock: boolean;
}

export interface FiscalYearSummary {
  fiscalYearBE: number;
  periodLabel: string;
  periodStart?: string;
  periodEnd?: string;
  items: MaterialFiscalSummary[];
  totals: {
    openingQty: number;
    openingAmount: number;
    totalInQty: number;
    totalInAmount: number;
    totalOutQty: number;
    totalOutAmount: number;
    closingQty: number;
    closingAmount: number;
    lotRemainingQty: number;
    lotRemainingAmount: number;
  };
  lowStockMaterialIds: string[];
  allBalanced: boolean;
}

export interface Audit213Report {
  fiscalYearBE: number;
  auditDate: string;
  regulationRef: string;
  materialSummary: FiscalYearSummary;
  assets: {
    totalCount: number;
    totalAcquisitionCost: number;
    byCondition: Record<AssetCondition, number>;
    activeLoanCount: number;
    overdueLoanCount: number;
    items: AssetItem[];
    overdueLoans: AssetLoan[];
  };
}
