/**
 * Shared Document IR for Phase 6 official Thai municipal inventory forms (INV-01..INV-05).
 * Both HTML/Playwright PDF and editable native Word (.docx) render from this single model.
 * Every visible number is pre-formatted in Thai digits (๐-๙) so PDF and DOCX stay identical.
 */

export type InventoryFormCode = 'INV-01' | 'INV-02' | 'INV-03' | 'INV-04' | 'INV-05';

export interface InvSignaturePerson {
  roleLabel: string;
  fullName: string;
  positionLines: string[];
  prefix?: string;
}

export interface InvTableCell {
  text: string;
  align?: 'left' | 'center' | 'right';
  bold?: boolean;
  colSpan?: number;
  rowSpan?: number;
}

export interface InvTableRow {
  cells: InvTableCell[];
  isSubtotal?: boolean;
  isGrandTotal?: boolean;
  isFiller?: boolean;
}

export interface InvTableModel {
  columnWidthsPct: number[];
  headerRows: InvTableCell[][];
  bodyRows: InvTableRow[];
  fontPt?: number;
  compact?: boolean;
}

export interface Inv01RequisitionForm {
  formCode: 'INV-01';
  title: string;
  requisitionNoDisplay: string;
  agencyOfficeTitle: string;
  agencyLocationLine: string;
  requestDateDisplay: string;
  requesterLine: string;
  purposeCertification: string;
  table: InvTableModel;
  signatures: {
    requester: InvSignaturePerson;
    approver: InvSignaturePerson;
    issuer: InvSignaturePerson;
    receiver: InvSignaturePerson;
  };
}

export interface Inv02StockCardPage {
  pageNoDisplay: string;
  ledgerSeqNoDisplay: string;
  sheetNoDisplay: string;
  municipalityName: string;
  headerFields: {
    name: string;
    specification: string;
    storageLocation: string;
    categoryType: string;
    code: string;
    unit: string;
    maxStock: string;
    minStock: string;
  };
  table: InvTableModel;
}

export interface Inv02StockCardForm {
  formCode: 'INV-02';
  title: string;
  landscape?: boolean;
  cards: Inv02StockCardPage[];
}

export interface Inv03AssetLoanForm {
  formCode: 'INV-03';
  title: string;
  loanNoDisplay: string;
  divisionHeader: string;
  loanDateDisplay: string;
  borrowerInfoLines: string[];
  table: InvTableModel;
  loanSignatures: [InvSignaturePerson, InvSignaturePerson, InvSignaturePerson];
  returnSection: {
    actualReturnDateDisplay: string;
    conditionAfterDisplay: string;
    returner: InvSignaturePerson;
    inspector: InvSignaturePerson;
  };
}

export interface Inv04CutOffSummaryForm {
  formCode: 'INV-04';
  title: string;
  headingLine1: string;
  headingLine2: string;
  table: InvTableModel;
  signatures: [InvSignaturePerson, InvSignaturePerson];
}

export interface Inv05AnnualAudit213Form {
  formCode: 'INV-05';
  title: string;
  memoHeader: {
    governmentUnit: string;
    docNo: string;
    dateDisplay: string;
    subject: string;
    recipient: string;
  };
  paragraphs: string[];
  materialOverviewTable: InvTableModel;
  assetConditionTable: InvTableModel;
  assetDetailTable: InvTableModel;
  signatures: {
    committee: InvSignaturePerson;
    clerk: InvSignaturePerson;
    mayor: InvSignaturePerson;
  };
}

export type InventoryFormIR =
  | Inv01RequisitionForm
  | Inv02StockCardForm
  | Inv03AssetLoanForm
  | Inv04CutOffSummaryForm
  | Inv05AnnualAudit213Form;
