import {z} from 'zod';
import {ISODateSchema} from '../procurement/schema';

export {ISODateSchema};

export const CategoryCodeSchema = z.string().regex(/^(0[1-9]|1[0-8])$/, 'รหัสหมวดวัสดุต้องเป็น 01 ถึง 18');

export const MaterialItemSchema = z.object({
  id: z.string().min(1),
  ledgerSeqNo: z.number().int().positive(),
  code: z.string().default(''),
  name: z.string().trim().min(1),
  categoryCode: CategoryCodeSchema,
  categoryType: z.string().trim().min(1),
  specification: z.string().default(''),
  unit: z.string().trim().min(1),
  storageLocation: z.string().default('กองสวัสดิการสังคม'),
  maxStockQty: z.number().nonnegative().nullable().default(null),
  minStockQty: z.number().nonnegative().default(5),
});

export const StockLotSourceTypeSchema = z.enum([
  'OPENING_BALANCE',
  'PROCUREMENT_PO',
  'TRANSFER_IN',
  'DONATION',
]);

export const StockLotSchema = z.object({
  id: z.string().min(1),
  materialId: z.string().min(1),
  fiscalYearBE: z.number().int().min(2400).max(2742),
  receivedDate: ISODateSchema,
  createdOrder: z.number().int().nonnegative(),
  sourceType: StockLotSourceTypeSchema,
  sourceLabel: z.string().trim().min(1),
  referenceDocNo: z.string().default(''),
  sourceProcurementCaseId: z.string().optional(),
  unitPrice: z.number().finite().nonnegative(),
  initialQty: z.number().finite().positive(),
  remainingQty: z.number().finite().nonnegative(),
  reservedQty: z.number().finite().nonnegative().default(0),
}).refine(lot => lot.remainingQty <= lot.initialQty + 1e-9, {
  message: 'จำนวนคงเหลือต้องไม่เกินจำนวนรับเข้าตั้งต้น',
  path: ['remainingQty'],
}).refine(lot => lot.reservedQty <= lot.remainingQty + 1e-9, {
  message: 'จำนวนที่จองไว้ต้องไม่เกินจำนวนคงเหลือในล็อต',
  path: ['reservedQty'],
});

export const RequisitionStatusSchema = z.enum([
  'DRAFT',
  'PENDING_SIGNATURE',
  'COMMITTED',
  'CANCELLED',
]);

export const RequisitionAllocationSchema = z.object({
  lotId: z.string().min(1),
  referenceDocNo: z.string(),
  unitPrice: z.number().finite().nonnegative(),
  allocatedQty: z.number().finite().positive(),
  lineAmount: z.number().finite().nonnegative(),
  balanceAfterThisSplit: z.number().finite().nonnegative(),
});

export const RequisitionLineSchema = z.object({
  id: z.string().min(1),
  materialId: z.string().min(1),
  requestedQty: z.number().finite().positive(),
  approvedQty: z.number().finite().nonnegative(),
  allocations: z.array(RequisitionAllocationSchema),
  remarkOverride: z.string().optional(),
});

export const RequisitionSchema = z.object({
  id: z.string().min(1),
  requisitionRunningNo: z.string().trim().min(1),
  fiscalYearBE: z.number().int().min(2400).max(2742),
  requestDate: ISODateSchema,
  requesterName: z.string().trim().min(1),
  requesterPosition: z.string().trim().min(1),
  receiverName: z.string().optional(),
  purpose: z.string().default('เพื่อใช้ในการปฏิบัติราชการ งานกองสวัสดิการสังคม เทศบาลตำบลฉลอง'),
  status: RequisitionStatusSchema,
  lines: z.array(RequisitionLineSchema).min(1),
  committedDate: ISODateSchema.optional(),
  signedScanAttachmentPath: z.string().optional(),
});

export const StockLedgerEntrySchema = z.object({
  id: z.string().min(1),
  materialId: z.string().min(1),
  fiscalYearBE: z.number().int().min(2400).max(2742),
  entryDate: ISODateSchema,
  partyDescription: z.string().trim().min(1),
  docNo: z.string(),
  lotId: z.string().min(1),
  unitPrice: z.number().finite().nonnegative(),
  inQty: z.number().finite().nonnegative().default(0),
  inAmount: z.number().finite().nonnegative().default(0),
  outQty: z.number().finite().nonnegative().default(0),
  outAmount: z.number().finite().nonnegative().default(0),
  balanceQty: z.number().finite().nonnegative(),
  balanceAmount: z.number().finite().nonnegative(),
  accountingNote: z.string().trim().min(1),
});

export const AssetConditionSchema = z.enum([
  'GOOD',
  'DAMAGED_REPAIRABLE',
  'UNSERVICEABLE_DISPOSE',
  'MISSING',
]);

export const AssetItemSchema = z.object({
  id: z.string().min(1),
  assetCode: z.string().trim().min(1),
  name: z.string().trim().min(1),
  brandModel: z.string().default(''),
  acquiredDate: ISODateSchema,
  acquisitionCost: z.number().finite().nonnegative(),
  assignedLocation: z.string().default('กองสวัสดิการสังคม'),
  custodianName: z.string().trim().min(1),
  condition: AssetConditionSchema,
  note: z.string().default(''),
});

export const AssetLoanStatusSchema = z.enum([
  'PENDING_SIGNATURE',
  'ACTIVE_LOAN',
  'RETURNED',
  'CANCELLED',
]);

export const AssetLoanSchema = z.object({
  id: z.string().min(1),
  loanRunningNo: z.string().trim().min(1),
  fiscalYearBE: z.number().int().min(2400).max(2742),
  assetId: z.string().min(1),
  borrowerName: z.string().trim().min(1),
  borrowerPosition: z.string().trim().min(1),
  borrowerDepartment: z.string().trim().min(1),
  purpose: z.string().trim().min(1),
  loanDate: ISODateSchema,
  dueReturnDate: ISODateSchema,
  actualReturnDate: ISODateSchema.optional(),
  conditionBefore: z.string().default('ปกติ ใช้งานได้'),
  conditionAfter: z.string().optional(),
  status: AssetLoanStatusSchema,
});

export const InventoryDomainStateSchema = z.object({
  materials: z.array(MaterialItemSchema).default([]),
  lots: z.array(StockLotSchema).default([]),
  requisitions: z.array(RequisitionSchema).default([]),
  ledger: z.array(StockLedgerEntrySchema).default([]),
  assets: z.array(AssetItemSchema).default([]),
  assetLoans: z.array(AssetLoanSchema).default([]),
});
