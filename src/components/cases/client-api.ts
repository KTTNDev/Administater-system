'use client';
import type {SavedDraft} from '@/lib/document';
import {formatThaiDate, toThaiDigits, toThaiOfficialText} from '@/lib/procurement/formatting';
import type {AgencyConfig, SignatoryChain} from '@/lib/procurement/types';
import {DOC_TYPE_THAI_NAMES, formatOfficialNumber, resolveCaseText} from '@/lib/cases/resolver';
import type {
  CaseBlueprint,
  CaseDocType,
  CaseDomainState,
  CaseFolder,
  CaseItem,
  CaseValidationIssue,
  ExternalFileSlotItem,
  GeneratedDocItem,
  LinkedModuleRefItem,
  LinkedModuleSummary,
  LinkedModuleTarget,
  MemoApprovalChain,
  RoadmapRow,
} from '@/lib/cases/types';

export interface AvailableProcurementLink {
  id: string;
  title: string;
  poNumber: string;
  date: string;
  fiscalYearBE: number;
  grandTotal: number;
  vendorName: string;
  methodLabel: string;
}

export interface AvailableInventoryReqLink {
  id: string;
  runningNo: string;
  fiscalYearBE: number;
  requestDate: string;
  requesterName: string;
  purpose: string;
  status: string;
  totalValue: number;
}

export interface AvailableAssetLoanLink {
  id: string;
  runningNo: string;
  fiscalYearBE: number;
  loanDate: string;
  borrowerName: string;
  assetName: string;
  status: string;
}

export interface CaseDomainPayload {
  record: {
    data: CaseDomainState;
    version: number;
    updatedAt: string;
  };
  defaults: {
    agency: AgencyConfig;
    signatories: SignatoryChain;
  };
  linkedSummariesByFolder: Record<string, Record<string, LinkedModuleSummary>>;
  availableProcurement: AvailableProcurementLink[];
  availableRequisitions: AvailableInventoryReqLink[];
  availableAssetLoans: AvailableAssetLoanLink[];
  drive: {
    configured: boolean;
    connected: boolean;
    email: string;
  };
  createdId?: string;
  reservedRunningNo?: string;
}

export interface UploadedCaseFile {
  id: string;
  path: string;
  originalName: string;
  fileType: 'PDF' | 'DOCX' | 'IMAGE';
  mime: string;
  pages: number;
  bytesLength: number;
  uploadedAt: string;
}

export interface LinkedCaseCoreDraft {
  id: string;
  folder_id: string;
  item_id: string;
  draft_id: string;
  copies: number;
  source_version: number;
  synced_at: string;
  draft: SavedDraft | null;
  localFileWarning?: string | null;
}

export interface PreviewHtmlResponse {
  html: string;
  docType: CaseDocType;
  coreType?: string;
  title: string;
  validationIssues: CaseValidationIssue[];
  linkedSummaries: Record<string, LinkedModuleSummary>;
  boundCoreDraft?: {id: string; version: number; type: string} | null;
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as {
      error?: string;
      issues?: {messageTh?: string}[];
    };
    if (body.error) return body.error;
    if (Array.isArray(body.issues) && body.issues.length > 0) {
      return body.issues.map(i => i.messageTh).filter(Boolean).join('; ') || fallback;
    }
  } catch {
    // ignore JSON parse failure
  }
  return fallback;
}

export async function fetchCaseDomain(): Promise<CaseDomainPayload> {
  const res = await fetch('/api/cases/domain', {cache: 'no-store'});
  if (!res.ok) throw new Error(await parseError(res, 'โหลดข้อมูลแฟ้มงานสารบรรณไม่สำเร็จ'));
  return (await res.json()) as CaseDomainPayload;
}

export async function postCaseAction(body: Record<string, unknown>): Promise<CaseDomainPayload> {
  const res = await fetch('/api/cases/domain', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, 'บันทึกข้อมูลแฟ้มงานไม่สำเร็จ'));
  return (await res.json()) as CaseDomainPayload;
}

export async function uploadCaseExternalFile(file: File): Promise<UploadedCaseFile> {
  const form = new FormData();
  form.set('file', file);
  const res = await fetch('/api/cases/domain', {
    method: 'POST',
    body: form,
  });
  if (!res.ok) throw new Error(await parseError(res, 'อัปโหลดไฟล์แนบไม่สำเร็จ'));
  return (await res.json()) as UploadedCaseFile;
}

export async function fetchCasePreviewHtml(input: {
  folder: CaseFolder;
  itemId: string;
  highlightBlanks?: boolean;
  copyNumber?: number;
  preferBound?: boolean;
}): Promise<PreviewHtmlResponse> {
  const res = await fetch('/api/cases/preview-html', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res, 'สร้างตัวอย่างเอกสาร A4 ไม่สำเร็จ'));
  return (await res.json()) as PreviewHtmlResponse;
}

export async function fetchCaseCoreDrafts(folderId: string): Promise<LinkedCaseCoreDraft[]> {
  const res = await fetch(`/api/cases/core-drafts?folderId=${encodeURIComponent(folderId)}`, {
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(await parseError(res, 'โหลดรายการร่างในระบบหลัก (Core) ไม่สำเร็จ'));
  return (await res.json()) as LinkedCaseCoreDraft[];
}

export async function bindCaseCoreDraftsApi(
  folderId: string,
  mode: 'create' | 'sync',
  itemIds?: string[],
): Promise<LinkedCaseCoreDraft[]> {
  const res = await fetch('/api/cases/core-drafts', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({folderId, mode, itemIds}),
  });
  if (!res.ok) throw new Error(await parseError(res, 'เชื่อมร่างหนังสือในระบบหลัก (Core) ไม่สำเร็จ'));
  return (await res.json()) as LinkedCaseCoreDraft[];
}

function filenameFromDisposition(header: string | null, fallback: string): string {
  if (!header) return fallback;
  const utf8Match = header.match(/filename\*=UTF-8''([^;\n]+)/i);
  if (utf8Match) {
    try {
      return decodeURIComponent(utf8Match[1]);
    } catch {
      return fallback;
    }
  }
  const simpleMatch = header.match(/filename="([^"]+)"/i);
  return simpleMatch ? simpleMatch[1] : fallback;
}

export async function downloadCaseExport(
  url: string,
  body: Record<string, unknown>,
  fallbackName: string,
): Promise<{fileName: string}> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res, 'ส่งออกเอกสารไม่สำเร็จ'));
  const blob = await res.blob();
  const fileName = filenameFromDisposition(res.headers.get('content-disposition'), fallbackName);
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
  return {fileName};
}

export async function importPortableArchive(archive: string | Record<string, unknown>): Promise<{
  ok: boolean;
  importedFolderId: string;
  folderName: string;
}> {
  const res = await fetch('/api/cases/export/portable', {
    method: 'PUT',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({archive, regenerateId: true, suffixImportedName: true}),
  });
  if (!res.ok) throw new Error(await parseError(res, 'นำเข้าไฟล์สำรองแฟ้มงานไม่สำเร็จ'));
  return (await res.json()) as {ok: boolean; importedFolderId: string; folderName: string};
}

export async function backupCaseToDrive(folder: CaseFolder): Promise<{
  ok: boolean;
  configured: boolean;
  connected: boolean;
  url?: string;
  message?: string;
}> {
  const res = await fetch('/api/cases/backup-drive', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({folder}),
  });
  if (!res.ok) throw new Error(await parseError(res, 'สำรองข้อมูลไปยัง Google Drive ไม่สำเร็จ'));
  return (await res.json()) as {
    ok: boolean;
    configured: boolean;
    connected: boolean;
    url?: string;
    message?: string;
  };
}

// ---------------------------------------------------------------------------
// Pure client-side factories & roadmap builder (no `docx` dependency!)
// ---------------------------------------------------------------------------

export function currentFiscalYearBE(): number {
  const now = new Date();
  return now.getFullYear() + 543 + (now.getMonth() >= 9 ? 1 : 0);
}

export function todayIsoDate(): string {
  return new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Bangkok'});
}

export function createBlankCaseFolder(input: {
  name: string;
  fiscalYearBE: number;
  category: string;
  description?: string;
  agency: AgencyConfig;
  signatories: SignatoryChain;
}): CaseFolder {
  const now = new Date().toISOString();
  const stage1Id = `stage-${crypto.randomUUID().slice(0, 8)}`;
  const stage2Id = `stage-${crypto.randomUUID().slice(0, 8)}`;
  return {
    id: crypto.randomUUID(),
    name: input.name.trim(),
    fiscalYearBE: input.fiscalYearBE,
    category: input.category.trim() || 'โครงการทั่วไป',
    status: 'DRAFT',
    description: input.description?.trim() ?? '',
    agency: structuredClone(input.agency),
    signatories: structuredClone(input.signatories),
    variables: [
      {key: 'projectName', label: 'ชื่อโครงการ', value: input.name.trim(), kind: 'text'},
      {key: 'eventDate', label: 'วันจัดงาน', value: '', kind: 'date'},
      {key: 'eventLocation', label: 'สถานที่', value: '', kind: 'text'},
      {key: 'budgetAmount', label: 'งบประมาณ (บาท)', value: '', kind: 'money'},
    ],
    stages: [
      {id: stage1Id, name: 'รอบที่ 1 ขออนุมัติโครงการและคำสั่ง', order: 0},
      {id: stage2Id, name: 'รอบที่ 2 ดำเนินงาน จัดซื้อ และเบิกจ่าย', order: 1},
    ],
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function createDefaultGeneratedDocItem(
  docType: CaseDocType,
  stageId: string,
  order: number,
  agency: AgencyConfig,
  options?: {title?: string; approvalChain?: MemoApprovalChain},
): GeneratedDocItem {
  const id = `doc-${crypto.randomUUID().slice(0, 8)}`;
  const base = {
    id,
    order,
    stageId,
    copies: 1,
    kind: 'GENERATED_DOC' as const,
    docType,
    runningNo: '',
    date: todayIsoDate(),
  };

  switch (docType) {
    case 'INTERNAL_MEMO':
      return {
        ...base,
        track: 'INTERNAL_MEMO',
        title: options?.title || 'ขออนุมัติดำเนินการ{{var.projectName}}',
        payload: {
          docType: 'INTERNAL_MEMO',
          recipient: `นายก${agency.municipalityName}`,
          useStructuredSections: true,
          sections: {
            background: 'ด้วย{{var.projectName}} มีกำหนดดำเนินการในวันที่ {{var.eventDate}} ณ {{var.eventLocation}}',
            facts: '',
            legalBasis: '',
            proposal: 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
          },
          bodyParagraphs: [],
          tables: [],
          closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
          approvalChain: options?.approvalChain ?? '3_TIER',
        },
      };
    case 'EXTERNAL_LETTER':
      return {
        ...base,
        track: 'EXTERNAL_LETTER',
        title: options?.title || 'ขอความอนุเคราะห์ดำเนินการตาม{{var.projectName}}',
        payload: {
          docType: 'EXTERNAL_LETTER',
          recipient: '',
          references: [],
          enclosures: [],
          bodyParagraphs: [
            'ด้วยเทศบาลตำบลฉลองกำหนดจัด{{var.projectName}} ในวันที่ {{var.eventDate}} ณ {{var.eventLocation}}',
          ],
          tables: [],
          closing: 'ขอแสดงความนับถือ',
        },
      };
    case 'MUNICIPAL_ORDER':
      return {
        ...base,
        track: 'MUNICIPAL_ORDER',
        title: options?.title || 'แต่งตั้งคณะกรรมการดำเนินงาน{{var.projectName}}',
        payload: {
          docType: 'MUNICIPAL_ORDER',
          preambleParagraphs: ['เพื่อให้การดำเนินงาน{{var.projectName}} เป็นไปด้วยความเรียบร้อยและมีประสิทธิภาพ'],
          appointees: [{fullName: '', position: '', role: 'ประธานกรรมการ'}],
          dutiesParagraphs: ['มีหน้าที่ควบคุม กำกับ ดูแลการดำเนินงานให้เป็นไปตามวัตถุประสงค์ของโครงการ'],
          effectiveNote: 'ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป',
          routingStripMode: 'FIRST_COPY_ONLY',
        },
      };
    case 'ANNOUNCEMENT':
      return {
        ...base,
        track: 'ANNOUNCEMENT',
        title: options?.title || 'ประกาศ{{var.projectName}}',
        payload: {
          docType: 'ANNOUNCEMENT',
          registryLogNo: '',
          bodyParagraphs: ['ด้วยเทศบาลตำบลฉลองได้กำหนดจัด{{var.projectName}} ในวันที่ {{var.eventDate}}'],
          tables: [],
          closingNote: 'จึงประกาศให้ทราบโดยทั่วกัน',
          routingStripMode: 'FIRST_COPY_ONLY',
        },
      };
    case 'CERTIFICATE_OR_INVITATION':
      return {
        ...base,
        track: 'EXTERNAL_LETTER',
        title: options?.title || 'ขอเชิญเป็นวิทยากร/เข้าร่วม{{var.projectName}}',
        payload: {
          docType: 'CERTIFICATE_OR_INVITATION',
          variant: 'INVITATION',
          certificateNo: '',
          recipient: '',
          references: [],
          enclosures: ['กำหนดการ จำนวน ๑ ชุด'],
          eventDate: '{{var.eventDate}}',
          eventTime: '๐๙.๐๐ - ๑๖.๐๐ น.',
          eventLocation: '{{var.eventLocation}}',
          bodyParagraphs: ['ด้วยเทศบาลตำบลฉลองกำหนดจัด{{var.projectName}} จึงขอเรียนเชิญท่านเข้าร่วมตามวัน เวลา และสถานที่ดังกล่าว'],
          closing: 'ขอแสดงความนับถือ',
        },
      };
    case 'PROJECT_PROPOSAL_OR_ATTACHMENT':
      return {
        ...base,
        track: 'NONE',
        title: options?.title || 'ร่างโครงการ {{var.projectName}}',
        payload: {
          docType: 'PROJECT_PROPOSAL_OR_ATTACHMENT',
          subtitle: `ประจำปีงบประมาณ พ.ศ. ${currentFiscalYearBE()}`,
          projectName: '{{var.projectName}}',
          rationale: '',
          objectives: ['เพื่อพัฒนาศักยภาพกลุ่มเป้าหมายตามแผนพัฒนาท้องถิ่น'],
          targets: ['กลุ่มเป้าหมายในเขตเทศบาลตำบลฉลอง'],
          scheduleAndLocation: 'วันที่ {{var.eventDate}} ณ {{var.eventLocation}}',
          budgetSummary: 'งบประมาณทั้งสิ้น {{var.budgetAmount}} บาท',
          extraSections: [],
        },
      };
    case 'PHOTO_SHEET':
      return {
        ...base,
        track: 'NONE',
        title: options?.title || 'ภาพถ่ายกิจกรรม {{var.projectName}}',
        payload: {
          docType: 'PHOTO_SHEET',
          subtitle: 'วันที่ {{var.eventDate}} ณ {{var.eventLocation}}',
          layout: '2_PER_PAGE',
          photos: [],
          certificationText: 'ขอรับรองว่าเป็นเอกสารที่ถูกต้อง',
        },
      };
  }
}

export function createExternalSlotItem(
  stageId: string,
  order: number,
  title = 'เอกสารแนบ / แผ่นคั่น',
): ExternalFileSlotItem {
  return {
    id: `slot-${crypto.randomUUID().slice(0, 8)}`,
    order,
    stageId,
    copies: 1,
    kind: 'EXTERNAL_FILE_SLOT',
    title,
    externalDocNo: '',
    externalDate: '',
    exportBehavior: 'PRINT_DIVIDER_CHECKLIST',
    stampReminderNote: 'รับรองสำเนาถูกต้อง',
  };
}

export function createLinkedModuleItem(input: {
  stageId: string;
  order: number;
  targetModule: LinkedModuleTarget;
  targetId: string;
  title: string;
  includePdfInBinder?: boolean;
}): LinkedModuleRefItem {
  return {
    id: `link-${crypto.randomUUID().slice(0, 8)}`,
    order: input.order,
    stageId: input.stageId,
    copies: 1,
    kind: 'LINKED_MODULE_REF',
    targetModule: input.targetModule,
    targetId: input.targetId,
    title: input.title,
    includePdfInBinder: input.includePdfInBinder ?? true,
  };
}

export function buildClientRoadmap(
  folder: CaseFolder,
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>,
): RoadmapRow[] {
  const stageMap = new Map(folder.stages.map(s => [s.id, s]));
  const ordered = [...folder.items].sort((a, b) => {
    const sa = stageMap.get(a.stageId)?.order ?? 9999;
    const sb = stageMap.get(b.stageId)?.order ?? 9999;
    if (sa !== sb) return sa - sb;
    return a.order - b.order;
  });

  return ordered.map((item: CaseItem, index: number): RoadmapRow => {
    const stageName = stageMap.get(item.stageId)?.name ?? 'เอกสารทั่วไป';

    if (item.kind === 'GENERATED_DOC') {
      const resolvedTitle = resolveCaseText(folder, item.title, {
        highlightBlanks: false,
        linkedSummaries,
      }).text;
      const refNo =
        item.docType === 'ANNOUNCEMENT' && item.payload.docType === 'ANNOUNCEMENT'
          ? item.payload.registryLogNo
            ? `ทะเบียนประกาศ ${toThaiDigits(item.payload.registryLogNo)}`
            : 'ไม่พิมพ์เลข'
          : formatOfficialNumber(folder, item) || 'รอจองเลข';
      const dateIso = item.date || '';
      const dateThai = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? formatThaiDate(dateIso) : 'รอลงวันที่';
      const isOverride = Boolean(item.externalOverride);
      return {
        sequence: index + 1,
        stageId: item.stageId,
        stageName,
        itemId: item.id,
        kind: item.kind,
        docTypeLabel: DOC_TYPE_THAI_NAMES[item.docType],
        title: resolvedTitle,
        referenceNo: refNo,
        dateIso,
        dateThai,
        copies: item.copies,
        statusBadge: isOverride ? 'ใช้ฉบับแก้ไขภายนอก' : 'ระบบสร้าง',
        isExternalOverride: isOverride,
        overrideNote: item.externalOverride?.note,
      };
    }

    if (item.kind === 'EXTERNAL_FILE_SLOT') {
      const dateIso = item.externalDate || '';
      const dateThai = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? formatThaiDate(dateIso) : 'ยังไม่ระบุวันที่';
      const hasFile = Boolean(item.uploadedFilePath);
      return {
        sequence: index + 1,
        stageId: item.stageId,
        stageName,
        itemId: item.id,
        kind: item.kind,
        docTypeLabel: 'เอกสารภายนอก',
        title: toThaiOfficialText(item.title),
        referenceNo: item.externalDocNo ? toThaiOfficialText(item.externalDocNo) : '-',
        dateIso,
        dateThai,
        copies: item.copies,
        statusBadge: hasFile
          ? item.exportBehavior === 'EMBED_UPLOADED_FILE'
            ? 'แนบไฟล์แล้ว (รวมเล่ม)'
            : 'แนบไฟล์แล้ว (พิมพ์แผ่นคั่น)'
          : 'แทรกเอกสารต้นฉบับ',
        isExternalOverride: false,
        stampReminderNote: item.stampReminderNote,
      };
    }

    const summary = linkedSummaries?.get(item.id);
    const modLabel =
      item.targetModule === 'PROCUREMENT'
        ? 'ผูกจัดซื้อจัดจ้าง'
        : item.targetModule === 'INVENTORY_REQUISITION'
          ? 'ผูกใบเบิกพัสดุ'
          : 'ผูกใบยืมครุภัณฑ์';
    const dateIso = summary?.date || '';
    const dateThai = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? formatThaiDate(dateIso) : 'ยังไม่ระบุวันที่';

    return {
      sequence: index + 1,
      stageId: item.stageId,
      stageName,
      itemId: item.id,
      kind: item.kind,
      docTypeLabel: modLabel,
      title: summary?.title || item.title,
      referenceNo: summary?.referenceNo ? toThaiOfficialText(summary.referenceNo) : 'ยังไม่ผูก',
      dateIso,
      dateThai,
      copies: item.copies,
      statusBadge: summary?.found
        ? summary.isIncomplete
          ? 'ข้อมูลยังไม่ครบ'
          : 'เชื่อมโยงสด'
        : 'ยังไม่ผูกข้อมูล',
      isExternalOverride: false,
      totalAmount: summary?.totalAmount,
    };
  });
}

export type {CaseBlueprint};
