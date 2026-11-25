import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import {readAttachment} from '../attachments';
import {documentAssets} from '../assets';
import {listBudgets} from '../budget-db';
import {listRegister} from '../correspondence-db';
import {registerCsv} from '../correspondence-export';
import {db, getSetting, listDrafts, readDraft, setSetting} from '../db';
import type {SavedDraft} from '../document';
import {effectiveReceiverName} from '../inventory/fifo-engine';
import {resolveInventoryContext, sqliteInventoryRepository} from '../inventory/server-context';
import {
  buildInv01RequisitionForm,
  buildInv02StockCardForm,
  buildInv03AssetLoanForm,
  buildInv04CutOffSummaryForm,
  buildInv05AnnualAudit213Form,
} from '../inventory/templates/build-forms';
import {renderInventoryDocx} from '../inventory/templates/docx/render-inv-docx';
import {mergeInventoryPdfs, renderInventoryPdf} from '../inventory/templates/html/render-inv-pdf';
import {localFilesRoot} from '../local-dossiers';
import {listOffice} from '../office-db';
import {renderPdf} from '../pdf';
import {computeProcurementCase} from '../procurement/calculations';
import {listCoreDraftBindings} from '../procurement/core/bindings';
import {corePdfBinder} from '../procurement/core/output';
import {buildBinderManifest} from '../procurement/manifest';
import {ProcurementCaseInputSchema} from '../procurement/schema';
import {sqliteRepository as procurementRepo} from '../procurement/storage/sqlite';
import {cleanForExport, type StoredCase} from '../procurement/workspace/model';
import {projectFiles, readProject, readProjectFile} from '../project-db';
import {projectReportWord} from '../project-report';
import {renderWord} from '../word';
import {renderCorrespondenceWord} from './correspondence-word';
import {
  fiscalYearBEFromDate,
  fiscalYearFolder,
  readLastArchiveRun,
  recordLastArchiveRun,
  resolveIndexedFolder,
  safeArchivePart,
  validateHandoverRootPath,
  writeVersionedFile,
  type VersionedWriteResult,
} from './fs-utils';

export type ArchiveModuleKey =
  | 'documents'
  | 'procurement'
  | 'inventory'
  | 'projects'
  | 'budget'
  | 'correspondence'
  | 'laws';

export const ALL_ARCHIVE_MODULES: readonly ArchiveModuleKey[] = [
  'documents',
  'procurement',
  'inventory',
  'projects',
  'budget',
  'correspondence',
  'laws',
];

const DOC_TYPE_FOLDERS: Record<string, string> = {
  external: 'หนังสือภายนอก',
  internal: 'หนังสือภายใน',
  stamped: 'หนังสือประทับตรา',
  order: 'คำสั่ง',
  regulation: 'ระเบียบ',
  rule: 'ข้อบังคับ',
  announcement: 'ประกาศ',
  statement: 'แถลงการณ์',
  news: 'ข่าว',
  certificate: 'หนังสือรับรอง',
  minutes: 'รายงานการประชุม',
  memorandum: 'บันทึกข้อความ',
  other: 'หนังสืออื่น',
};

const PROJECT_STAGE_FOLDERS: Record<string, string> = {
  planning: '01_ที่มาและแผนงาน',
  approval: '02_เสนออนุมัติ',
  preparation: '03_เตรียมงาน',
  delivery: '04_ดำเนินงาน',
  finance: '05_การเงินและหลักฐาน',
  evaluation: '06_ประเมินและสรุปผล',
};

export interface ArchiveTally {
  created: number;
  updated: number;
  unchanged: number;
  archivedPrevious: number;
  errors: string[];
  files: VersionedWriteResult[];
}

function emptyTally(): ArchiveTally {
  return {created: 0, updated: 0, unchanged: 0, archivedPrevious: 0, errors: [], files: []};
}

function addWrite(tally: ArchiveTally, res: VersionedWriteResult): void {
  tally.files.push(res);
  if (res.status === 'created') tally.created += 1;
  else if (res.status === 'updated') tally.updated += 1;
  else tally.unchanged += 1;
  if (res.archivedPrevious) tally.archivedPrevious += 1;
}

function tableExists(name: string): boolean {
  return Boolean(db().prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));
}

export function defaultHandoverRoot(): string {
  return path.join(localFilesRoot(), 'แฟ้มงานพร้อมใช้');
}

export function getHandoverRoot(): string {
  if (process.env.NODE_ENV === 'test') {
    const custom = getSetting('storage:handoverRoot');
    return custom ? path.resolve(custom) : defaultHandoverRoot();
  }
  const custom = getSetting('storage:handoverRoot');
  return custom ? path.resolve(custom) : defaultHandoverRoot();
}

export function setHandoverRoot(candidatePath: string): string {
  const trimmed = candidatePath.trim();
  if (!trimmed) {
    setSetting('storage:handoverRoot', '');
    return defaultHandoverRoot();
  }
  const validated = validateHandoverRootPath(trimmed);
  fs.mkdirSync(validated, {recursive: true});
  // Verify writable immediately
  const probe = path.join(validated, `.sarabun-write-check-${Date.now()}.tmp`);
  fs.writeFileSync(probe, 'ok');
  fs.unlinkSync(probe);
  setSetting('storage:handoverRoot', validated);
  return validated;
}

function resolveDocFiscalYear(draft: SavedDraft): number | null {
  return fiscalYearBEFromDate(draft.date) ?? fiscalYearBEFromDate(draft.updatedAt);
}

function procurementFolderRel(record: StoredCase): {fiscalYearBE: number | null; relative: string; caseTitle: string} {
  const input = record.caseInput;
  const fy =
    input.budgetLine.fiscalYearBE ||
    fiscalYearBEFromDate(input.docs.doc1_approvePrinciple.date) ||
    fiscalYearBEFromDate(record.updatedAt);
  const total = input.items.reduce((sum, it) => sum + (Number(it.quantity) || 0) * (Number(it.unitPrice) || 0), 0);
  const workMonth =
    record.tracker?.workMonth ||
    (input.docs.doc1_approvePrinciple.date ? input.docs.doc1_approvePrinciple.date.slice(0, 7) : '');
  const title = safeArchivePart(input.projectTitleShort || input.budgetLine.categoryType || 'งานจัดซื้อจัดจ้าง', 55);
  const amountTag = `${Math.round(total).toLocaleString('en-US')}บาท`;
  const folderName = [workMonth ? safeArchivePart(workMonth, 10) : '', amountTag, title].filter(Boolean).join('_');
  return {
    fiscalYearBE: fy,
    caseTitle: title,
    relative: path.join(fiscalYearFolder(fy), '02_จัดซื้อจัดจ้าง', safeArchivePart(folderName, 85)),
  };
}

function mirrorDocumentAssets(root: string, folder: string, draft: SavedDraft, tally: ArchiveTally): void {
  const conn = db();
  if (draft.attachmentFiles?.length && tableExists('document_attachments')) {
    for (const ref of draft.attachmentFiles) {
      const row = conn.prepare('SELECT id, name, file FROM document_attachments WHERE id=?').get(ref.id) as
        | {id: string; name: string; file: Uint8Array}
        | undefined;
      if (!row?.file) continue;
      const ext = path.extname(row.name) || '.pdf';
      const base = safeArchivePart(path.basename(row.name, ext), 60);
      addWrite(tally, writeVersionedFile(root, folder, path.join('ไฟล์แนบ', `${base}${ext}`), Buffer.from(row.file)));
    }
  }
  const imageRefs = [
    ...(draft.appendixImages ?? []),
    ...(draft.floatingItems ?? []).filter(x => x.kind === 'image').map(x => x.image),
  ];
  if (imageRefs.length && tableExists('document_appendix_images')) {
    const unique = [...new Map(imageRefs.map(x => [x.id, x])).values()];
    for (const ref of unique) {
      const row = conn.prepare('SELECT id, name, file FROM document_appendix_images WHERE id=?').get(ref.id) as
        | {id: string; name: string; file: Uint8Array}
        | undefined;
      if (!row?.file) continue;
      const ext = path.extname(row.name) || '.png';
      const base = safeArchivePart(path.basename(row.name, ext), 60);
      addWrite(tally, writeVersionedFile(root, folder, path.join('รูปภาพ', `${base}${ext}`), Buffer.from(row.file)));
    }
  }
  if (tableExists('signed_scans')) {
    const scans = conn.prepare('SELECT id, name, file FROM signed_scans WHERE document_id=?').all(draft.id) as Array<{
      id: string;
      name: string;
      file: Uint8Array;
    }>;
    for (const scan of scans) {
      const ext = path.extname(scan.name) || '.pdf';
      const base = safeArchivePart(path.basename(scan.name, ext), 60);
      addWrite(tally, writeVersionedFile(root, folder, path.join('ฉบับลงนาม', `${base}${ext}`), Buffer.from(scan.file)));
    }
  }
}

/**
 * Auto-save hook for `GET /api/documents/[id]/word` & `/pdf` AND batch archiver.
 * Automatically routes the document into:
 *  - `05_โอนงบประมาณ/` if linked to a budget transfer
 *  - `02_จัดซื้อจัดจ้าง/<case>/01_เอกสาร_Word/` if linked to a procurement case
 *  - `01_หนังสือราชการ/<ประเภท>/` otherwise
 */
export function archiveDocumentBytes(
  draft: SavedDraft,
  ext: 'docx' | 'pdf',
  bytes: Uint8Array,
  rootOverride?: string,
): {folder: string; filePath: string; tally: ArchiveTally} {
  const root = rootOverride ?? getHandoverRoot();
  const tally = emptyTally();
  const conn = db();

  // 1. Check if linked to Procurement case
  if (tableExists('procurement_core_drafts')) {
    const procLink = conn
      .prepare('SELECT case_id, doc_id FROM procurement_core_drafts WHERE draft_id=?')
      .get(draft.id) as {case_id: string; doc_id: string} | undefined;
    if (procLink) {
      const procCase = procurementRepo.getCase(procLink.case_id);
      if (procCase) {
        const meta = procurementFolderRel(procCase);
        const caseFolder = resolveIndexedFolder(root, `procurement:${procLink.case_id}`, meta.relative);
        const docPrefix = procLink.doc_id.replace('.', '-').padStart(2, '0');
        const sub = ext === 'docx' ? '01_เอกสาร_Word' : '02_เอกสารรายฉบับ_PDF';
        const fileName = `${docPrefix}_${safeArchivePart(draft.subject || `เอกสาร_${procLink.doc_id}`, 60)}.${ext}`;
        const written = writeVersionedFile(root, caseFolder, path.join(sub, fileName), bytes);
        addWrite(tally, written);
        return {folder: caseFolder, filePath: written.filePath, tally};
      }
    }
  }

  // 2. Check if linked to Budget Transfer
  const budgetRow = tableExists('budget_transfers')
    ? (conn.prepare('SELECT id, data FROM budget_transfers WHERE document_id=?').get(draft.id) as
        | {id: string; data: string}
        | undefined)
    : undefined;

  const fy = resolveDocFiscalYear(draft);
  const numPrefix = draft.number?.trim() ? `${safeArchivePart(draft.number, 24)}_` : '';
  const cleanSubject = safeArchivePart(draft.subject || 'เอกสารไม่มีชื่อเรื่อง', 58);

  let folder: string;
  if (budgetRow) {
    const budgetData = JSON.parse(budgetRow.data) as {year?: number; title?: string};
    const bFy = budgetData.year || fy;
    const bTitle = safeArchivePart(budgetData.title || draft.subject || 'ขอโอนงบประมาณ', 58);
    folder = resolveIndexedFolder(
      root,
      `budget:${budgetRow.id}`,
      path.join(fiscalYearFolder(bFy), '05_โอนงบประมาณ', `${numPrefix}${bTitle}`),
    );
  } else {
    const typeFolder = DOC_TYPE_FOLDERS[draft.type] ?? 'หนังสืออื่น';
    folder = resolveIndexedFolder(
      root,
      `document:${draft.id}`,
      path.join(fiscalYearFolder(fy), '01_หนังสือราชการ', typeFolder, `${numPrefix}${cleanSubject}`),
    );
  }

  const written = writeVersionedFile(root, folder, `${cleanSubject}.${ext}`, bytes);
  addWrite(tally, written);
  mirrorDocumentAssets(root, folder, draft, tally);
  return {folder, filePath: written.filePath, tally};
}

/**
 * Mirrors procurement external attachments, inspection photos, checklist, and optional generated Word/PDF
 * straight into `ปีงบประมาณ XXXX/02_จัดซื้อจัดจ้าง/<เดือน>_<ยอดเงิน>_<ชื่องาน>/`.
 */
export function archiveProcurementAssets(
  record: StoredCase,
  extra: {
    wordFiles?: Array<{docId: string; filename: string; bytes: Uint8Array}>;
    binderPdf?: {filename: string; bytes: Uint8Array};
    singlePdf?: {docId: string; title: string; bytes: Uint8Array};
    checklistText?: string;
  } = {},
  rootOverride?: string,
): {folder: string; tally: ArchiveTally} {
  const root = rootOverride ?? getHandoverRoot();
  const tally = emptyTally();
  const meta = procurementFolderRel(record);
  const folder = resolveIndexedFolder(root, `procurement:${record.caseInput.id}`, meta.relative);

  // Word docs
  for (const wf of extra.wordFiles ?? []) {
    const safeFile = `${safeArchivePart(path.basename(wf.filename, '.docx'), 75)}.docx`;
    addWrite(tally, writeVersionedFile(root, folder, path.join('01_เอกสาร_Word', safeFile), wf.bytes));
  }

  // Merged printable binder PDF or single PDF
  if (extra.binderPdf) {
    addWrite(tally, writeVersionedFile(root, folder, extra.binderPdf.filename, extra.binderPdf.bytes));
  }
  if (extra.singlePdf) {
    const docPrefix = extra.singlePdf.docId.replace('.', '-');
    const name = `${docPrefix}_${safeArchivePart(extra.singlePdf.title, 60)}.pdf`;
    addWrite(tally, writeVersionedFile(root, folder, path.join('02_เอกสารรายฉบับ_PDF', name), extra.singlePdf.bytes));
  }

  // Checklist
  if (extra.checklistText) {
    addWrite(tally, writeVersionedFile(root, folder, 'รายการเรียงแฟ้ม.txt', Buffer.from('\uFEFF' + extra.checklistText, 'utf8')));
  }

  // External evidence files (quotations, e-LAAS, e-GP, other)
  const extFiles = record.externalFiles ?? [];
  extFiles.forEach((file, idx) => {
    try {
      const stored = readAttachment(file.id);
      const slotPrefix = file.slotId === 'OTHER' ? 'อื่นๆ' : file.slotId.replace('.', '-');
      const ext = path.extname(file.name) || '.pdf';
      const label = safeArchivePart(file.label || path.basename(file.name, ext), 55);
      const outName = `${slotPrefix}_${String(idx + 1).padStart(2, '0')}_${label}${ext}`;
      addWrite(tally, writeVersionedFile(root, folder, path.join('03_ไฟล์แนบภายนอก', outName), Buffer.from(stored.file)));
    } catch (e) {
      tally.errors.push(`ไฟล์แนบ ${file.name}: ${e instanceof Error ? e.message : 'อ่านไฟล์ไม่สำเร็จ'}`);
    }
  });

  // Inspection photos (supports data:image/... URIs and local file paths)
  const photoPaths = record.caseInput.attachments?.photoPaths ?? [];
  photoPaths.forEach((photoSrc: string, idx: number) => {
    const match = /^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i.exec(photoSrc || '');
    if (match) {
      const ext = match[1].toLowerCase() === 'png' ? '.png' : '.jpg';
      const raw = Buffer.from(match[2], 'base64');
      const outName = `ภาพตรวจรับ_${String(idx + 1).padStart(2, '0')}${ext}`;
      addWrite(tally, writeVersionedFile(root, folder, path.join('04_รูปภาพตรวจรับ', outName), raw));
      return;
    }
    if (photoSrc && fs.existsSync(photoSrc) && fs.statSync(photoSrc).isFile()) {
      const ext = path.extname(photoSrc) || '.jpg';
      const outName = `ภาพตรวจรับ_${String(idx + 1).padStart(2, '0')}${ext}`;
      addWrite(tally, writeVersionedFile(root, folder, path.join('04_รูปภาพตรวจรับ', outName), fs.readFileSync(photoSrc)));
    }
  });

  return {folder, tally};
}

/** 1-click full archive of a single Procurement case (all linked Word .docx + external files + photos + optional PDF). */
export async function archiveProcurementCaseNow(
  caseId: string,
  options: {includePdf?: boolean; allowExportWithErrors?: boolean; rootOverride?: string} = {},
): Promise<{folder: string; tally: ArchiveTally}> {
  const record = procurementRepo.getCase(caseId);
  if (!record) throw new Error('ไม่พบงานจัดซื้อจัดจ้างที่เลือก');

  const links = listCoreDraftBindings(caseId);
  const wordFiles: Array<{docId: string; filename: string; bytes: Uint8Array}> = [];
  const checklistLines: string[] = [];

  let computedRows: ReturnType<typeof buildBinderManifest> = [];
  try {
    const parsed = ProcurementCaseInputSchema.parse(cleanForExport(record.caseInput));
    computedRows = buildBinderManifest(computeProcurementCase(parsed));
  } catch {
    // Even if case is still a draft, archive whichever linked Core drafts exist!
  }

  if (computedRows.length > 0) {
    for (const row of computedRows) {
      const link = links.find(l => l.doc_id === row.docId && l.draft);
      if (row.source === 'GENERATED' && link?.draft) {
        const bytes = await renderWord(link.draft);
        const prefix = row.docId.replace('.', '-');
        wordFiles.push({
          docId: row.docId,
          filename: `${prefix}_${safeArchivePart(link.draft.subject || row.title, 60)}.docx`,
          bytes,
        });
        checklistLines.push(`${row.docId} ${row.title} (Word พร้อมแก้ไข)`);
      } else {
        checklistLines.push(`${row.docId} ${row.title}`);
      }
    }
  } else {
    for (const link of links) {
      if (!link.draft) continue;
      const bytes = await renderWord(link.draft);
      const prefix = link.doc_id.replace('.', '-');
      wordFiles.push({
        docId: link.doc_id,
        filename: `${prefix}_${safeArchivePart(link.draft.subject || link.doc_id, 60)}.docx`,
        bytes,
      });
    }
  }

  let binderPdf: {filename: string; bytes: Uint8Array} | undefined;
  if (options.includePdf && links.some(l => l.draft)) {
    try {
      const pdf = await corePdfBinder(
        {caseId, allowExportWithErrors: options.allowExportWithErrors ?? true},
        {...record.pdfDefaults, profile: {mode: 'FULL_BINDER'}},
      );
      binderPdf = {filename: '02_รวมเล่มพร้อมพิมพ์.pdf', bytes: pdf.bytes};
    } catch {
      // Allow partial draft archival even when full PDF binder cannot be generated yet
    }
  }

  return archiveProcurementAssets(
    record,
    {
      wordFiles,
      binderPdf,
      checklistText: checklistLines.length ? checklistLines.join('\r\n') : undefined,
    },
    options.rootOverride,
  );
}

/** Auto-save hook & helper for Inventory FIFO exports (`INV-01`..`INV-05`). */
export function archiveInventoryFile(
  fiscalYearBE: number,
  subFolder:
    | '01_ใบเบิกวัสดุ_INV-01'
    | '02_บัญชีวัสดุ_INV-02'
    | '03_ทะเบียนครุภัณฑ์และใบยืม_INV-03'
    | '04_รายงานตัดพัสดุและตรวจนับประจำปี',
  filename: string,
  bytes: Uint8Array,
  rootOverride?: string,
): {folder: string; result: VersionedWriteResult} {
  const root = rootOverride ?? getHandoverRoot();
  const baseFolder = resolveIndexedFolder(
    root,
    `inventory:${fiscalYearBE}`,
    path.join(fiscalYearFolder(fiscalYearBE), '03_พัสดุและครุภัณฑ์'),
  );
  const ext = path.extname(filename);
  const base = safeArchivePart(path.basename(filename, ext), 70);
  const res = writeVersionedFile(root, baseFolder, path.join(subFolder, `${base}${ext}`), bytes);
  return {folder: path.join(baseFolder, subFolder), result: res};
}

/** 1-click full archive of ALL Inventory FIFO forms for a fiscal year (`INV-01`..`INV-05` Word + optional PDF + signed scans). */
export async function archiveInventoryFiscalYearNow(
  fiscalYearBE: number,
  options: {includePdf?: boolean; landscapeStockCard?: boolean; rootOverride?: string} = {},
): Promise<{folder: string; tally: ArchiveTally}> {
  const root = options.rootOverride ?? getHandoverRoot();
  const tally = emptyTally();
  const state = sqliteInventoryRepository.load().data;
  const ctx = resolveInventoryContext();
  const baseFolder = resolveIndexedFolder(
    root,
    `inventory:${fiscalYearBE}`,
    path.join(fiscalYearFolder(fiscalYearBE), '03_พัสดุและครุภัณฑ์'),
  );

  // 1. INV-01 Requisitions in this fiscal year
  const reqs = state.requisitions.filter(r => r.fiscalYearBE === fiscalYearBE && r.status !== 'CANCELLED');
  for (const req of reqs) {
    const form = buildInv01RequisitionForm(state, req, ctx);
    const nameBase = `ใบเบิกวัสดุ_${safeArchivePart(req.requisitionRunningNo, 12)}-${fiscalYearBE}_${safeArchivePart(effectiveReceiverName(req), 32)}`;
    addWrite(
      tally,
      writeVersionedFile(root, baseFolder, path.join('01_ใบเบิกวัสดุ_INV-01', `${nameBase}.docx`), await renderInventoryDocx(form)),
    );
    if (options.includePdf) {
      const pdf = await renderInventoryPdf(form);
      addWrite(
        tally,
        writeVersionedFile(root, baseFolder, path.join('01_ใบเบิกวัสดุ_INV-01', `${nameBase}.pdf`), pdf.pdfBytes),
      );
    }
    if (req.signedScanAttachmentPath?.startsWith('/api/attachments/')) {
      const attId = req.signedScanAttachmentPath.slice('/api/attachments/'.length);
      try {
        const stored = readAttachment(attId);
        const ext = path.extname(stored.name) || '.pdf';
        addWrite(
          tally,
          writeVersionedFile(
            root,
            baseFolder,
            path.join('01_ใบเบิกวัสดุ_INV-01', 'ฉบับลงนาม', `${nameBase}_ลงนามแล้ว${ext}`),
            Buffer.from(stored.file),
          ),
        );
      } catch {
        // ignore missing scan
      }
    }
  }

  // 2. INV-02 Stock Cards (individual .docx per material sorted by ledgerSeqNo + full binder)
  const sortedMaterials = [...state.materials].sort((a, b) => a.ledgerSeqNo - b.ledgerSeqNo);
  for (const mat of sortedMaterials) {
    const hasEntries = state.ledger.some(e => e.materialId === mat.id && e.fiscalYearBE === fiscalYearBE);
    const hasLots = state.lots.some(l => l.materialId === mat.id && l.fiscalYearBE <= fiscalYearBE);
    if (!hasEntries && !hasLots) continue;
    const form = buildInv02StockCardForm(state, fiscalYearBE, {materialId: mat.id, landscape: options.landscapeStockCard}, ctx);
    const nameBase = `${String(mat.ledgerSeqNo).padStart(3, '0')}_${safeArchivePart(mat.name, 55)}`;
    addWrite(
      tally,
      writeVersionedFile(root, baseFolder, path.join('02_บัญชีวัสดุ_INV-02', `${nameBase}.docx`), await renderInventoryDocx(form)),
    );
  }
  if (sortedMaterials.length > 0 && options.includePdf) {
    const fullCard = buildInv02StockCardForm(state, fiscalYearBE, {landscape: options.landscapeStockCard}, ctx);
    const pdf = await renderInventoryPdf(fullCard);
    addWrite(
      tally,
      writeVersionedFile(root, baseFolder, path.join('02_บัญชีวัสดุ_INV-02', `บัญชีวัสดุทั้งกอง_${fiscalYearBE}.pdf`), pdf.pdfBytes),
    );
  }

  // 3. INV-03 Asset Loans in this fiscal year
  const loans = state.assetLoans.filter(l => l.fiscalYearBE === fiscalYearBE && l.status !== 'CANCELLED');
  for (const loan of loans) {
    const form = buildInv03AssetLoanForm(state, loan, ctx);
    const nameBase = `ใบยืมครุภัณฑ์_ยค${safeArchivePart(loan.loanRunningNo, 12)}-${fiscalYearBE}_${safeArchivePart(loan.borrowerName, 32)}`;
    addWrite(
      tally,
      writeVersionedFile(
        root,
        baseFolder,
        path.join('03_ทะเบียนครุภัณฑ์และใบยืม_INV-03', `${nameBase}.docx`),
        await renderInventoryDocx(form),
      ),
    );
    if (options.includePdf) {
      const pdf = await renderInventoryPdf(form);
      addWrite(
        tally,
        writeVersionedFile(root, baseFolder, path.join('03_ทะเบียนครุภัณฑ์และใบยืม_INV-03', `${nameBase}.pdf`), pdf.pdfBytes),
      );
    }
  }

  // 4. INV-04 Cut-off Summary + INV-05 Annual Audit 213
  const sep30 = `${fiscalYearBE - 543}-09-30`;
  const inv04 = buildInv04CutOffSummaryForm(state, fiscalYearBE, {asOfDate: sep30}, ctx);
  const inv05 = buildInv05AnnualAudit213Form(state, fiscalYearBE, {auditDate: sep30}, ctx);
  addWrite(
    tally,
    writeVersionedFile(
      root,
      baseFolder,
      path.join('04_รายงานตัดพัสดุและตรวจนับประจำปี', `รายงานสรุปตัดพัสดุ_${fiscalYearBE}.docx`),
      await renderInventoryDocx(inv04),
    ),
  );
  addWrite(
    tally,
    writeVersionedFile(
      root,
      baseFolder,
      path.join('04_รายงานตัดพัสดุและตรวจนับประจำปี', `รายงานตรวจสอบพัสดุข้อ213_${fiscalYearBE}.docx`),
      await renderInventoryDocx(inv05),
    ),
  );
  if (options.includePdf) {
    const inv04Pdf = await renderInventoryPdf(inv04);
    const inv05Pdf = await renderInventoryPdf(inv05);
    addWrite(
      tally,
      writeVersionedFile(
        root,
        baseFolder,
        path.join('04_รายงานตัดพัสดุและตรวจนับประจำปี', `รายงานสรุปตัดพัสดุ_${fiscalYearBE}.pdf`),
        inv04Pdf.pdfBytes,
      ),
    );
    addWrite(
      tally,
      writeVersionedFile(
        root,
        baseFolder,
        path.join('04_รายงานตัดพัสดุและตรวจนับประจำปี', `รายงานตรวจสอบพัสดุข้อ213_${fiscalYearBE}.pdf`),
        inv05Pdf.pdfBytes,
      ),
    );
    const binderForms = [
      inv05,
      inv04,
      ...(sortedMaterials.length ? [buildInv02StockCardForm(state, fiscalYearBE, {landscape: options.landscapeStockCard}, ctx)] : []),
    ];
    const merged = await mergeInventoryPdfs(binderForms);
    addWrite(
      tally,
      writeVersionedFile(
        root,
        baseFolder,
        path.join('04_รายงานตัดพัสดุและตรวจนับประจำปี', `ชุดรายงานตรวจนับพัสดุประจำปี_${fiscalYearBE}.pdf`),
        merged.pdfBytes,
      ),
    );
  }

  return {folder: baseFolder, tally};
}

/** Auto-save hook & batch helper for Projects (`04_โครงการและงานประจำปี`). */
export function archiveProjectBytes(
  projectId: string,
  ext: 'docx' | 'pdf',
  bytes: Uint8Array,
  rootOverride?: string,
): {folder: string; tally: ArchiveTally} {
  const root = rootOverride ?? getHandoverRoot();
  const tally = emptyTally();
  const project = readProject(projectId);
  const fy = Number(project.fiscalYear) || null;
  const title = safeArchivePart(project.title, 60);
  const folder = resolveIndexedFolder(
    root,
    `project:${projectId}`,
    path.join(fiscalYearFolder(fy), '04_โครงการและงานประจำปี', title),
  );

  addWrite(tally, writeVersionedFile(root, folder, `รูปเล่มโครงการ_${title}.${ext}`, bytes));

  // Mirror stage evidence cleanly
  for (const meta of projectFiles(projectId)) {
    try {
      const full = readProjectFile(meta.id);
      const stageFolder = PROJECT_STAGE_FOLDERS[meta.stage] ?? safeArchivePart(meta.stage, 30);
      const fExt = path.extname(full.name) || (full.mime === 'image/png' ? '.png' : '.pdf');
      const fBase = safeArchivePart(path.basename(full.name, fExt), 55);
      addWrite(
        tally,
        writeVersionedFile(root, folder, path.join('หลักฐานประกอบ', stageFolder, `${fBase}${fExt}`), full.file),
      );
    } catch {
      // skip missing blob
    }
  }
  return {folder, tally};
}

/** Auto-save hook for Correspondence Register exports (`06_ทะเบียนรับส่งหนังสือ`). */
export function archiveCorrespondenceBytes(
  fiscalYearBE: number | null,
  filename: string,
  bytes: Uint8Array,
  rootOverride?: string,
): {folder: string; result: VersionedWriteResult} {
  const root = rootOverride ?? getHandoverRoot();
  const folder = resolveIndexedFolder(
    root,
    `correspondence:${fiscalYearBE ?? 'all'}`,
    path.join(fiscalYearFolder(fiscalYearBE), '06_ทะเบียนรับส่งหนังสือ'),
  );
  const ext = path.extname(filename);
  const base = safeArchivePart(path.basename(filename, ext), 70);
  const result = writeVersionedFile(root, folder, `${base}${ext}`, bytes);
  return {folder, result};
}

/** Mirrors Law Library PDFs into `คลังกฎหมายและระเบียบกลาง/`. */
export function archiveLegalLibraryNow(rootOverride?: string): {folder: string; tally: ArchiveTally} {
  const root = rootOverride ?? getHandoverRoot();
  const tally = emptyTally();
  const baseFolder = resolveIndexedFolder(root, 'laws:root', 'คลังกฎหมายและระเบียบกลาง');
  if (!tableExists('legal_library')) return {folder: baseFolder, tally};

  const rows = db().prepare('SELECT id, data, file, file_name FROM legal_library').all() as Array<{
    id: string;
    data: string;
    file: Uint8Array | null;
    file_name: string | null;
  }>;
  for (const row of rows) {
    if (!row.file) continue;
    const data = JSON.parse(row.data) as {category?: string; year?: string; title?: string};
    const cat = safeArchivePart(data.category || 'ทั่วไป', 36);
    const yr = safeArchivePart(data.year || 'ไม่ระบุปี', 16);
    const ext = path.extname(row.file_name || '') || '.pdf';
    const title = safeArchivePart(data.title || path.basename(row.file_name || 'ระเบียบ', ext), 65);
    addWrite(tally, writeVersionedFile(root, baseFolder, path.join(cat, yr, `${title}${ext}`), Buffer.from(row.file)));
  }
  return {folder: baseFolder, tally};
}

export interface ModuleArchiveReport {
  module: ArchiveModuleKey;
  label: string;
  itemsProcessed: number;
  created: number;
  updated: number;
  unchanged: number;
  archivedPrevious: number;
  errors: string[];
}

export interface FullArchiveReport {
  root: string;
  fiscalYearBE: number | null;
  includePdf: boolean;
  at: string;
  totals: {created: number; updated: number; unchanged: number; archivedPrevious: number; errors: number};
  modules: ModuleArchiveReport[];
}

/**
 * 1-Click Full System / Fiscal-Year Handover Archive Pack!
 * Exports editable Word (.docx) + attachments/evidence (+ optional PDF) across all chosen modules
 * into `<HandoverRoot>/ปีงบประมาณ XXXX/<01..06>/` cleanly with automatic `ประวัติรุ่นเก่า/`.
 */
export async function archiveAllWorkspaces(options: {
  fiscalYearBE?: number | null;
  modules?: readonly ArchiveModuleKey[];
  includePdf?: boolean;
  rootOverride?: string;
} = {}): Promise<FullArchiveReport> {
  const root = options.rootOverride ?? getHandoverRoot();
  fs.mkdirSync(root, {recursive: true});
  const selected = new Set<ArchiveModuleKey>(options.modules?.length ? options.modules : ALL_ARCHIVE_MODULES);
  const fyFilter = options.fiscalYearBE ?? null;
  const includePdf = Boolean(options.includePdf);
  const reports: ModuleArchiveReport[] = [];

  const mergeReport = (module: ArchiveModuleKey, label: string, itemsProcessed: number, tally: ArchiveTally) => {
    reports.push({
      module,
      label,
      itemsProcessed,
      created: tally.created,
      updated: tally.updated,
      unchanged: tally.unchanged,
      archivedPrevious: tally.archivedPrevious,
      errors: tally.errors,
    });
  };

  // Pre-index procurement-linked & budget-linked draft IDs so documents module doesn't duplicate them
  const procDraftIds = new Set<string>(
    tableExists('procurement_core_drafts')
      ? (db().prepare('SELECT draft_id FROM procurement_core_drafts').all() as Array<{draft_id: string}>).map(r => r.draft_id)
      : [],
  );
  const budgetDraftIds = new Set<string>(
    tableExists('budget_transfers')
      ? (db().prepare('SELECT document_id FROM budget_transfers WHERE document_id IS NOT NULL').all() as Array<{document_id: string}>).map(
          r => r.document_id,
        )
      : [],
  );

  // 1. หนังสือราชการ (Official Documents)
  if (selected.has('documents')) {
    const tally = emptyTally();
    let count = 0;
    for (const summary of listDrafts()) {
      if (procDraftIds.has(summary.id) || budgetDraftIds.has(summary.id)) continue;
      const fy = resolveDocFiscalYear(summary);
      if (fyFilter && fy !== fyFilter) continue;
      count += 1;
      try {
        const draft = readDraft(summary.id);
        const wordBytes = await renderWord(draft);
        const resW = archiveDocumentBytes(draft, 'docx', wordBytes, root);
        for (const f of resW.tally.files) addWrite(tally, f);
        if (includePdf) {
          const pdfBytes = await renderPdf(draft);
          const resP = archiveDocumentBytes(draft, 'pdf', pdfBytes, root);
          for (const f of resP.tally.files) addWrite(tally, f);
        }
      } catch (e) {
        tally.errors.push(`หนังสือ "${summary.subject}": ${e instanceof Error ? e.message : 'ส่งออกไม่สำเร็จ'}`);
      }
    }
    mergeReport('documents', '01 หนังสือราชการ', count, tally);
  }

  // 2. จัดซื้อจัดจ้าง (Procurement Cases)
  if (selected.has('procurement')) {
    const tally = emptyTally();
    let count = 0;
    for (const procCase of procurementRepo.listCases()) {
      const meta = procurementFolderRel(procCase);
      if (fyFilter && meta.fiscalYearBE !== fyFilter) continue;
      count += 1;
      try {
        const res = await archiveProcurementCaseNow(procCase.caseInput.id, {
          includePdf,
          allowExportWithErrors: true,
          rootOverride: root,
        });
        for (const f of res.tally.files) addWrite(tally, f);
        tally.errors.push(...res.tally.errors);
      } catch (e) {
        tally.errors.push(`จัดซื้อจัดจ้าง "${meta.caseTitle}": ${e instanceof Error ? e.message : 'จัดเก็บไม่สำเร็จ'}`);
      }
    }
    mergeReport('procurement', '02 จัดซื้อจัดจ้าง', count, tally);
  }

  // 3. พัสดุและครุภัณฑ์ (Inventory FIFO)
  if (selected.has('inventory')) {
    const tally = emptyTally();
    const invState = sqliteInventoryRepository.load().data;
    const invYears = new Set<number>();
    for (const l of invState.lots) invYears.add(l.fiscalYearBE);
    for (const e of invState.ledger) invYears.add(e.fiscalYearBE);
    for (const r of invState.requisitions) invYears.add(r.fiscalYearBE);
    for (const ln of invState.assetLoans) invYears.add(ln.fiscalYearBE);
    const targetYears = fyFilter
      ? invYears.has(fyFilter) || invState.materials.length > 0
        ? [fyFilter]
        : []
      : [...invYears].sort((a, b) => a - b);

    let count = 0;
    for (const fy of targetYears) {
      count += 1;
      try {
        const res = await archiveInventoryFiscalYearNow(fy, {includePdf, rootOverride: root});
        for (const f of res.tally.files) addWrite(tally, f);
        tally.errors.push(...res.tally.errors);
      } catch (e) {
        tally.errors.push(`พัสดุปีงบ ${fy}: ${e instanceof Error ? e.message : 'จัดเก็บไม่สำเร็จ'}`);
      }
    }
    mergeReport('inventory', '03 พัสดุและครุภัณฑ์ (FIFO)', count, tally);
  }

  // 4. โครงการและงานประจำปี (Annual Projects)
  if (selected.has('projects')) {
    const tally = emptyTally();
    const allOffice = listOffice();
    const projects = allOffice.filter(i => i.kind === 'project');
    const assets = documentAssets();
    const orgName = JSON.parse(getSetting('organization') || '{}').name || '';
    let count = 0;
    for (const proj of projects) {
      if (fyFilter && Number(proj.fiscalYear) !== fyFilter) continue;
      count += 1;
      try {
        const files = projectFiles(proj.id).map(f => (f.includeInReport ? readProjectFile(f.id) : {...f, file: Buffer.alloc(0)}));
        const wordBytes = await projectReportWord({
          project: proj,
          items: allOffice,
          files,
          organization: orgName,
          font: assets.regular,
          bold: assets.bold,
        });
        const res = archiveProjectBytes(proj.id, 'docx', wordBytes, root);
        for (const f of res.tally.files) addWrite(tally, f);
        tally.errors.push(...res.tally.errors);
      } catch (e) {
        tally.errors.push(`โครงการ "${proj.title}": ${e instanceof Error ? e.message : 'จัดเก็บไม่สำเร็จ'}`);
      }
    }
    mergeReport('projects', '04 โครงการและงานประจำปี', count, tally);
  }

  // 5. โอนงบประมาณ (Budget Transfers)
  if (selected.has('budget')) {
    const tally = emptyTally();
    let count = 0;
    for (const b of listBudgets()) {
      if (fyFilter && Number(b.data.year) !== fyFilter) continue;
      if (!b.documentId) continue;
      count += 1;
      try {
        const draft = readDraft(b.documentId);
        const wordBytes = await renderWord(draft);
        const resW = archiveDocumentBytes(draft, 'docx', wordBytes, root);
        for (const f of resW.tally.files) addWrite(tally, f);
        if (includePdf) {
          const pdfBytes = await renderPdf(draft);
          const resP = archiveDocumentBytes(draft, 'pdf', pdfBytes, root);
          for (const f of resP.tally.files) addWrite(tally, f);
        }
      } catch (e) {
        tally.errors.push(`โอนงบ "${b.data.title}": ${e instanceof Error ? e.message : 'จัดเก็บไม่สำเร็จ'}`);
      }
    }
    mergeReport('budget', '05 โอนงบประมาณ', count, tally);
  }

  // 6. ทะเบียนรับ–ส่งหนังสือ (Correspondence Register)
  if (selected.has('correspondence')) {
    const tally = emptyTally();
    const allEntries = listRegister();
    const byFy = new Map<number, typeof allEntries>();
    for (const entry of allEntries) {
      const fy = fiscalYearBEFromDate(entry.registeredDate) ?? entry.year + 543;
      if (fyFilter && fy !== fyFilter) continue;
      const list = byFy.get(fy) ?? [];
      list.push(entry);
      byFy.set(fy, list);
    }
    let count = 0;
    for (const [fy, entries] of byFy.entries()) {
      count += entries.length;
      try {
        const desc = `ปีงบประมาณ พ.ศ. ${fy} · ${entries.length} รายการ`;
        const bookDocx = await renderCorrespondenceWord(entries, {mode: 'book', description: desc});
        const statsDocx = await renderCorrespondenceWord(entries, {mode: 'stats', description: desc});
        const csvBytes = Buffer.from(registerCsv(entries), 'utf8');
        addWrite(tally, archiveCorrespondenceBytes(fy, `ทะเบียนรับส่งหนังสือ_${fy}.docx`, bookDocx, root).result);
        addWrite(tally, archiveCorrespondenceBytes(fy, `สถิติทะเบียนรับส่งหนังสือ_${fy}.docx`, statsDocx, root).result);
        addWrite(tally, archiveCorrespondenceBytes(fy, `ทะเบียนรับส่งหนังสือ_${fy}.csv`, csvBytes, root).result);
      } catch (e) {
        tally.errors.push(`ทะเบียนรับส่งปี ${fy}: ${e instanceof Error ? e.message : 'จัดเก็บไม่สำเร็จ'}`);
      }
    }
    mergeReport('correspondence', '06 ทะเบียนรับ–ส่งหนังสือ', count, tally);
  }

  // 7. คลังกฎหมายและระเบียบกลาง
  if (selected.has('laws')) {
    const res = archiveLegalLibraryNow(root);
    mergeReport('laws', 'คลังกฎหมายและระเบียบกลาง', res.tally.files.length, res.tally);
  }

  const totals = reports.reduce(
    (acc, r) => ({
      created: acc.created + r.created,
      updated: acc.updated + r.updated,
      unchanged: acc.unchanged + r.unchanged,
      archivedPrevious: acc.archivedPrevious + r.archivedPrevious,
      errors: acc.errors + r.errors.length,
    }),
    {created: 0, updated: 0, unchanged: 0, archivedPrevious: 0, errors: 0},
  );
  const at = new Date().toISOString();
  recordLastArchiveRun(root, {at, fiscalYearBE: fyFilter, ...totals});

  return {root, fiscalYearBE: fyFilter, includePdf, at, totals, modules: reports};
}

/** Fast status snapshot for the Settings UI without rendering any files. */
export function getHandoverStatus() {
  const root = getHandoverRoot();
  const defRoot = defaultHandoverRoot();
  const years = new Set<number>();

  const docs = listDrafts();
  for (const d of docs) {
    const fy = resolveDocFiscalYear(d);
    if (fy) years.add(fy);
  }
  const cases = procurementRepo.listCases();
  for (const c of cases) {
    const fy = procurementFolderRel(c).fiscalYearBE;
    if (fy) years.add(fy);
  }
  const invState = sqliteInventoryRepository.load().data;
  for (const l of invState.lots) years.add(l.fiscalYearBE);
  for (const e of invState.ledger) years.add(e.fiscalYearBE);
  for (const r of invState.requisitions) years.add(r.fiscalYearBE);
  const projects = listOffice().filter(i => i.kind === 'project');
  for (const p of projects) if (p.fiscalYear) years.add(Number(p.fiscalYear));
  const budgets = listBudgets();
  for (const b of budgets) if (b.data.year) years.add(Number(b.data.year));
  const register = listRegister();
  for (const r of register) {
    const fy = fiscalYearBEFromDate(r.registeredDate);
    if (fy) years.add(fy);
  }

  return {
    root,
    defaultRoot: defRoot,
    isCustom: path.resolve(root) !== path.resolve(defRoot),
    exists: fs.existsSync(root),
    fiscalYears: [...years].sort((a, b) => b - a),
    lastRun: readLastArchiveRun(root),
    counts: {
      documents: docs.length,
      procurement: cases.length,
      inventoryMaterials: invState.materials.length,
      inventoryRequisitions: invState.requisitions.length,
      projects: projects.length,
      budgets: budgets.length,
      correspondence: register.length,
    },
  };
}
