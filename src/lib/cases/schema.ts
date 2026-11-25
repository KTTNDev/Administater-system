import {z} from 'zod';
import {
  AgencyConfigSchema,
  ISODateSchema,
  PersonSchema,
  SignatoryChainSchema,
} from '../procurement/schema';

const optionalIsoDate = z
  .string()
  .trim()
  .refine(s => s === '' || ISODateSchema.safeParse(s).success, 'วันที่ ISO ไม่ถูกต้อง')
  .optional()
  .default('');

const nonEmptyText = z.string().trim().min(1);
const optionalRunningNo = z
  .string()
  .trim()
  .regex(/^[\d๐-๙/-]*$/, 'เลขทะเบียนหนังสือไม่ถูกต้อง')
  .optional()
  .default('');

export const CaseNumberTrackSchema = z.enum([
  'INTERNAL_MEMO',
  'MUNICIPAL_ORDER',
  'ANNOUNCEMENT',
  'EXTERNAL_LETTER',
  'PURCHASE_ORDER',
  'NONE',
]);

export const CaseDocTypeSchema = z.enum([
  'INTERNAL_MEMO',
  'EXTERNAL_LETTER',
  'MUNICIPAL_ORDER',
  'ANNOUNCEMENT',
  'CERTIFICATE_OR_INVITATION',
  'PROJECT_PROPOSAL_OR_ATTACHMENT',
  'PHOTO_SHEET',
]);

export const CaseVariablePresetKeySchema = z.enum([
  'projectName',
  'eventDate',
  'eventTime',
  'eventLocation',
  'budgetAmount',
  'targetGroup',
]);

export const CaseVariableSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z_][A-Za-z0-9_]*$/, 'ชื่อตัวแปรต้องเป็นภาษาอังกฤษ ตัวเลข หรือ _'),
  label: z.string().trim().min(1).max(160),
  value: z.string().max(4000).default(''),
  kind: z.enum(['text', 'date', 'money', 'number']).default('text'),
});

export const ExternalOverrideSchema = z.object({
  fileName: nonEmptyText.max(260),
  fileType: z.enum(['docx', 'pdf']),
  storedPath: nonEmptyText.max(1000),
  uploadedAt: nonEmptyText,
  note: z.string().max(500).optional(),
});

export const RoutingStripVisibilitySchema = z.enum([
  'FIRST_COPY_ONLY',
  'ALL_COPIES',
  'NONE',
]);

export const MemoApprovalChainSchema = z.enum([
  'NONE',
  '2_TIER',
  '3_TIER',
  '4_TIER_VERTICAL',
]);

export const CaseTableRowSchema = z.object({
  cells: z.array(z.string()).min(1),
});

export const CaseTableSpecSchema = z.object({
  caption: z.string().optional(),
  columns: z.array(z.string()).min(1),
  columnWidths: z.array(z.number().positive()).optional(),
  rows: z.array(CaseTableRowSchema).default([]),
  footerRows: z.array(CaseTableRowSchema).default([]),
  bordered: z.boolean().default(true),
});

// 1. INTERNAL_MEMO
export const InternalMemoPayloadSchema = z.object({
  docType: z.literal('INTERNAL_MEMO'),
  department: z.string().optional(),
  recipient: z.string().default(''),
  useStructuredSections: z.boolean().default(true),
  sections: z
    .object({
      background: z.string().default(''),
      facts: z.string().default(''),
      legalBasis: z.string().default(''),
      proposal: z.string().default(''),
    })
    .default({background: '', facts: '', legalBasis: '', proposal: ''}),
  bodyParagraphs: z.array(z.string()).default([]),
  tables: z.array(CaseTableSpecSchema).default([]),
  closing: z.string().default('จึงเรียนมาเพื่อโปรดพิจารณา'),
  approvalChain: MemoApprovalChainSchema.default('3_TIER'),
  proposer: PersonSchema.optional(),
});

// 2. EXTERNAL_LETTER
export const ExternalLetterPayloadSchema = z.object({
  docType: z.literal('EXTERNAL_LETTER'),
  recipient: z.string().default(''),
  references: z.array(z.string()).default([]),
  enclosures: z.array(z.string()).default([]),
  bodyParagraphs: z.array(z.string()).default([]),
  tables: z.array(CaseTableSpecSchema).default([]),
  closing: z.string().default('ขอแสดงความนับถือ'),
  signer: PersonSchema.optional(),
  footerDivision: z.string().optional(),
  footerPhone: z.string().optional(),
  footerFax: z.string().optional(),
});

// 3. MUNICIPAL_ORDER
export const MunicipalOrderAppointeeSchema = z.object({
  fullName: z.string().default(''),
  position: z.string().default(''),
  role: z.string().default(''),
});

export const MunicipalOrderPayloadSchema = z.object({
  docType: z.literal('MUNICIPAL_ORDER'),
  orderYearBE: z.number().int().min(2400).max(2742).optional(),
  preambleParagraphs: z.array(z.string()).default([]),
  appointees: z.array(MunicipalOrderAppointeeSchema).default([]),
  dutiesParagraphs: z.array(z.string()).default([]),
  effectiveNote: z.string().default('ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป'),
  signer: PersonSchema.optional(),
  routingStripMode: RoutingStripVisibilitySchema.default('FIRST_COPY_ONLY'),
});

// 4. ANNOUNCEMENT
export const AnnouncementPayloadSchema = z.object({
  docType: z.literal('ANNOUNCEMENT'),
  registryLogNo: optionalRunningNo,
  bodyParagraphs: z.array(z.string()).default([]),
  tables: z.array(CaseTableSpecSchema).default([]),
  closingNote: z.string().default('จึงประกาศให้ทราบโดยทั่วกัน'),
  signer: PersonSchema.optional(),
  routingStripMode: RoutingStripVisibilitySchema.default('FIRST_COPY_ONLY'),
});

// 5. CERTIFICATE_OR_INVITATION
export const CertificateOrInvitationPayloadSchema = z.object({
  docType: z.literal('CERTIFICATE_OR_INVITATION'),
  variant: z.enum(['INVITATION', 'CERTIFICATE']).default('INVITATION'),
  certificateNo: z.string().default(''),
  recipient: z.string().default(''),
  references: z.array(z.string()).default([]),
  enclosures: z.array(z.string()).default([]),
  eventDate: z.string().default('{{var.eventDate}}'),
  eventTime: z.string().default('{{var.eventTime}}'),
  eventLocation: z.string().default('{{var.eventLocation}}'),
  bodyParagraphs: z.array(z.string()).default([]),
  agendaTable: CaseTableSpecSchema.optional(),
  closing: z.string().default('ขอแสดงความนับถือ'),
  signer: PersonSchema.optional(),
});

// 6. PROJECT_PROPOSAL_OR_ATTACHMENT
export const ProjectProposalSectionSchema = z.object({
  heading: z.string().default(''),
  body: z.string().default(''),
});

export const ProjectProposalPayloadSchema = z.object({
  docType: z.literal('PROJECT_PROPOSAL_OR_ATTACHMENT'),
  subtitle: z.string().default(''),
  projectName: z.string().default('{{var.projectName}}'),
  rationale: z.string().default(''),
  objectives: z.array(z.string()).default([]),
  targets: z.array(z.string()).default([]),
  scheduleAndLocation: z.string().default(''),
  budgetSummary: z.string().default(''),
  budgetTable: CaseTableSpecSchema.optional(),
  extraSections: z.array(ProjectProposalSectionSchema).default([]),
  responsiblePerson: PersonSchema.optional(),
  reviewerPerson: PersonSchema.optional(),
  approverPerson: PersonSchema.optional(),
});

// 7. PHOTO_SHEET
export const CasePhotoEntrySchema = z.object({
  id: nonEmptyText,
  source: nonEmptyText,
  caption: z.string().default(''),
});

export const PhotoSheetPayloadSchema = z.object({
  docType: z.literal('PHOTO_SHEET'),
  subtitle: z.string().default(''),
  layout: z.enum(['1_PER_PAGE', '2_PER_PAGE', 'GRID_2X2']).default('2_PER_PAGE'),
  photos: z.array(CasePhotoEntrySchema).max(40).default([]),
  certificationText: z.string().default('ขอรับรองว่าเป็นเอกสารที่ถูกต้อง'),
  certifier: PersonSchema.optional(),
});

export const GeneratedDocPayloadSchema = z.discriminatedUnion('docType', [
  InternalMemoPayloadSchema,
  ExternalLetterPayloadSchema,
  MunicipalOrderPayloadSchema,
  AnnouncementPayloadSchema,
  CertificateOrInvitationPayloadSchema,
  ProjectProposalPayloadSchema,
  PhotoSheetPayloadSchema,
]);

const CaseItemBaseSchema = z.object({
  id: nonEmptyText,
  order: z.number().int().nonnegative(),
  stageId: nonEmptyText,
  title: z.string().trim().min(1).max(240),
  copies: z.number().int().min(1).max(20).default(1),
  note: z.string().max(1000).optional(),
});

export const GeneratedDocItemSchema = CaseItemBaseSchema.extend({
  kind: z.literal('GENERATED_DOC'),
  docType: CaseDocTypeSchema,
  track: CaseNumberTrackSchema.default('INTERNAL_MEMO'),
  runningNo: optionalRunningNo,
  date: optionalIsoDate,
  payload: GeneratedDocPayloadSchema,
  externalOverride: ExternalOverrideSchema.optional(),
});

export const ExternalFileSlotItemSchema = CaseItemBaseSchema.extend({
  kind: z.literal('EXTERNAL_FILE_SLOT'),
  externalDocNo: z.string().trim().max(120).default(''),
  externalDate: optionalIsoDate,
  stampReminderNote: z.string().max(400).default(''),
  exportBehavior: z
    .enum(['EMBED_UPLOADED_FILE', 'PRINT_DIVIDER_CHECKLIST'])
    .default('PRINT_DIVIDER_CHECKLIST'),
  uploadedFilePath: z.string().max(1000).optional(),
  uploadedFileName: z.string().max(260).optional(),
  uploadedFileType: z.enum(['pdf', 'image']).optional(),
});

export const LinkedModuleTargetSchema = z.enum([
  'PROCUREMENT',
  'INVENTORY_REQUISITION',
  'INVENTORY_ASSET_LOAN',
]);

export const LinkedModuleRefItemSchema = CaseItemBaseSchema.extend({
  kind: z.literal('LINKED_MODULE_REF'),
  targetModule: LinkedModuleTargetSchema,
  targetId: nonEmptyText,
  includePdfInBinder: z.boolean().default(true),
});

export const CaseItemSchema = z.discriminatedUnion('kind', [
  GeneratedDocItemSchema,
  ExternalFileSlotItemSchema,
  LinkedModuleRefItemSchema,
]);

export const CaseStageSchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText.max(160),
  order: z.number().int().nonnegative(),
});

export const CaseFolderStatusSchema = z.enum([
  'DRAFT',
  'IN_PROGRESS',
  'COMPLETED',
  'ARCHIVED',
]);

export const CaseFolderSchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText.max(240),
  fiscalYearBE: z.number().int().min(2400).max(2742),
  category: z.string().trim().max(120).default('งานบริหารทั่วไป'),
  status: CaseFolderStatusSchema.default('DRAFT'),
  description: z.string().max(2000).default(''),
  agency: AgencyConfigSchema,
  signatories: SignatoryChainSchema,
  variables: z.array(CaseVariableSchema).default([]),
  stages: z.array(CaseStageSchema).min(1),
  items: z.array(CaseItemSchema).default([]),
  blueprintSourceId: z.string().optional(),
  createdAt: nonEmptyText,
  updatedAt: nonEmptyText,
});

export const CaseBlueprintSchema = z.object({
  id: nonEmptyText,
  name: nonEmptyText.max(240),
  category: z.string().trim().max(120).default('งานบริหารทั่วไป'),
  description: z.string().max(2000).default(''),
  variables: z.array(CaseVariableSchema).default([]),
  stages: z.array(CaseStageSchema).min(1),
  items: z.array(CaseItemSchema).default([]),
  createdAt: nonEmptyText,
  updatedAt: nonEmptyText,
});

export const SharedRegistryEntrySchema = z.object({
  track: z.enum([
    'INTERNAL_MEMO',
    'MUNICIPAL_ORDER',
    'ANNOUNCEMENT',
    'EXTERNAL_LETTER',
    'PURCHASE_ORDER',
  ]),
  yearBE: z.number().int().min(2400).max(2742),
  runningNo: z.string().regex(/^\d+$/),
  sourceModule: z.enum(['PROCUREMENT', 'CASE_FOLDER', 'INVENTORY']).default('CASE_FOLDER'),
  sourceId: z.string().optional(),
});

export const CaseDomainStateSchema = z.object({
  folders: z.array(CaseFolderSchema).default([]),
  blueprints: z.array(CaseBlueprintSchema).default([]),
  sharedRegistry: z.array(SharedRegistryEntrySchema).default([]),
});
