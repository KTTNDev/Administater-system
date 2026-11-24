/** Renderer-neutral, resolved text. Identifiers, copy counts and layout metrics remain machine data. */
export type GeneratedDocId = '1' | '2' | '3' | '4.1' | '6.1' | '6.2' | '7' | '8' | '9' | '10' | '11.1' | '11.2' | '11.3' | '12' | '13';
export type DocumentFamily = 'MEMO' | 'ORDER' | 'ANNOUNCEMENT' | 'EXTERNAL_LETTER' | 'PURCHASE_ORDER' | 'TOR' | 'INSPECTION_SHEET' | 'PHOTO_SHEET';
export type Density = 'normal' | 'compact' | 'tight';
export interface ParagraphBlock {
  kind: 'paragraph'; text: string; heading?: string; indent: boolean;
  /** Phase 3 measurement must retain at least this many trailing body lines with signatures. */
  keepTrailingLines?: 2;
}
export interface TableCell { text: string; colspan?: number; align?: 'left' | 'right' | 'center'; bold?: boolean }
export interface TableBlock {
  kind: 'table'; caption?: string; columns: string[]; columnWidths?: number[]; rows: TableCell[][];
  footerRows: TableCell[][]; bordered: boolean; repeatHeader: true;
  continuationCaption: string; continued?: boolean;
}
export interface SignatureBlock {
  kind: 'signature'; name: string; lines: string[]; label: string;
  date?: string; showSignatureLine: boolean;
}
export interface ApprovalBox { heading: string; comments: string[]; signature: SignatureBlock }
export interface SignatureCluster {
  kind: 'signature-cluster'; closing: string[]; signatures: SignatureBlock[];
  approvals: ApprovalBox[]; approvalLayout: 'grid' | 'vertical'; keepWithPrevious: true;
}
export interface PhotoGridBlock {
  kind: 'photo-grid'; photos: {source: string; alt: string}[];
  columns: 1 | 2; maxHeightCm: number;
}
export interface MetadataBlock { kind: 'metadata'; columns: string[][] }
export interface CheckboxesBlock { kind: 'checkboxes'; groups: {label: string; choices: {text: string; checked: boolean}[]}[] }
export type DocumentBlock = ParagraphBlock | TableBlock | SignatureCluster | PhotoGridBlock | MetadataBlock | CheckboxesBlock;
export interface DocumentPage {
  purpose: 'body' | 'attachment' | 'photos'; heading?: string[]; blocks: DocumentBlock[];
}
export interface RenderedDocumentSpec {
  docId: GeneratedDocId; family: DocumentFamily; title: string; copies: number;
  header: {lines: string[]; department?: string; number?: string; date?: string; subject?: string; recipient?: string; addressLines?: string[]};
  pages: DocumentPage[]; footerLines: string[];
  continuationNote: string;
  routingStrip: {visibility: 'FIRST_COPY' | 'ALL_COPIES'; lines: string[]} | null;
  layout: {density: Density; singlePagePreferred: boolean; keepTrailingBodyLines: 2};
}
export type ProcurementDocumentModel = RenderedDocumentSpec;
export interface TemplateOptions {
  poTableMode?: 'SUMMARY' | 'ITEMIZED';
  showRoutingStrip?: boolean;
  routingStripCopies?: 'FIRST_COPY' | 'ALL_COPIES';
  density?: Density;
}
