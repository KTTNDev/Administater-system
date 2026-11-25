import type {z} from 'zod';
import type {
  AnnouncementPayloadSchema,
  CaseBlueprintSchema,
  CaseDocTypeSchema,
  CaseDomainStateSchema,
  CaseFolderSchema,
  CaseFolderStatusSchema,
  CaseItemSchema,
  CaseNumberTrackSchema,
  CaseStageSchema,
  CaseTableSpecSchema,
  CaseVariableSchema,
  CertificateOrInvitationPayloadSchema,
  ExternalFileSlotItemSchema,
  ExternalLetterPayloadSchema,
  ExternalOverrideSchema,
  GeneratedDocItemSchema,
  GeneratedDocPayloadSchema,
  InternalMemoPayloadSchema,
  LinkedModuleRefItemSchema,
  LinkedModuleTargetSchema,
  MemoApprovalChainSchema,
  MunicipalOrderPayloadSchema,
  PhotoSheetPayloadSchema,
  ProjectProposalPayloadSchema,
  RoutingStripVisibilitySchema,
  SharedRegistryEntrySchema,
} from './schema';

export type CaseNumberTrack = z.infer<typeof CaseNumberTrackSchema>;
export type CaseDocType = z.infer<typeof CaseDocTypeSchema>;
export type CaseVariable = z.infer<typeof CaseVariableSchema>;
export type ExternalOverride = z.infer<typeof ExternalOverrideSchema>;
export type RoutingStripVisibility = z.infer<typeof RoutingStripVisibilitySchema>;
export type MemoApprovalChain = z.infer<typeof MemoApprovalChainSchema>;
export type CaseTableSpec = z.infer<typeof CaseTableSpecSchema>;

export type InternalMemoPayload = z.infer<typeof InternalMemoPayloadSchema>;
export type ExternalLetterPayload = z.infer<typeof ExternalLetterPayloadSchema>;
export type MunicipalOrderPayload = z.infer<typeof MunicipalOrderPayloadSchema>;
export type AnnouncementPayload = z.infer<typeof AnnouncementPayloadSchema>;
export type CertificateOrInvitationPayload = z.infer<typeof CertificateOrInvitationPayloadSchema>;
export type ProjectProposalPayload = z.infer<typeof ProjectProposalPayloadSchema>;
export type PhotoSheetPayload = z.infer<typeof PhotoSheetPayloadSchema>;
export type GeneratedDocPayload = z.infer<typeof GeneratedDocPayloadSchema>;

export type GeneratedDocItem = z.infer<typeof GeneratedDocItemSchema>;
export type ExternalFileSlotItem = z.infer<typeof ExternalFileSlotItemSchema>;
export type LinkedModuleTarget = z.infer<typeof LinkedModuleTargetSchema>;
export type LinkedModuleRefItem = z.infer<typeof LinkedModuleRefItemSchema>;
export type CaseItem = z.infer<typeof CaseItemSchema>;

export type CaseStage = z.infer<typeof CaseStageSchema>;
export type CaseFolderStatus = z.infer<typeof CaseFolderStatusSchema>;
export type CaseFolder = z.infer<typeof CaseFolderSchema>;
export type CaseBlueprint = z.infer<typeof CaseBlueprintSchema>;
export type SharedRegistryEntry = z.infer<typeof SharedRegistryEntrySchema>;
export type CaseDomainState = z.infer<typeof CaseDomainStateSchema>;

export interface CrossRefToken {
  raw: string;
  itemId: string;
  mode: 'full' | 'short';
}

export interface TextRunSegment {
  text: string;
  highlightBlank: boolean;
  tokenKind?: 'var' | 'ref' | 'blank';
  tokenKey?: string;
}

export interface ResolveOptions {
  highlightBlanks?: boolean;
  /** Live summaries of linked modules so @ref can cite linked Procurement / Inventory items too. */
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>;
}

export interface ResolvedTextResult {
  text: string;
  segments: TextRunSegment[];
  unresolvedVars: string[];
  unresolvedRefs: string[];
}

export interface LinkedModuleSummary {
  itemId: string;
  targetModule: LinkedModuleTarget;
  targetId: string;
  found: boolean;
  title: string;
  referenceNo: string;
  date: string;
  totalAmount?: number;
  status: string;
  isIncomplete: boolean;
  incompleteReasons: string[];
  pdfAvailable: boolean;
}

export type CaseValidationSeverity = 'ERROR' | 'WARNING' | 'INFO';

export interface CaseValidationIssue {
  code:
    | 'REF_CHRONOLOGY_ERROR'
    | 'SAME_TRACK_NUMBER_ORDER'
    | 'DATE_ON_HOLIDAY'
    | 'UNRESOLVED_REFERENCE'
    | 'LINKED_MODULE_INCOMPLETE';
  severity: CaseValidationSeverity;
  itemIds: string[];
  messageTh: string;
  suggestedFix?: string;
}

export interface RoadmapRow {
  sequence: number;
  stageId: string;
  stageName: string;
  itemId: string;
  kind: CaseItem['kind'];
  docTypeLabel: string;
  title: string;
  referenceNo: string;
  dateIso: string;
  dateThai: string;
  copies: number;
  statusBadge: string;
  isExternalOverride: boolean;
  overrideNote?: string;
  stampReminderNote?: string;
  totalAmount?: number;
}
