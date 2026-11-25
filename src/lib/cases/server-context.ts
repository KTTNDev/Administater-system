import 'server-only';
import {randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {PDFDocument, PDFName} from 'pdf-lib';
import sharp from 'sharp';
import {readAttachment} from '../attachments';
import {db} from '../db';
import {storageConfig} from '../storage';
import {sqliteInventoryRepository} from '../inventory/server-context';
import type {InventoryDomainState} from '../inventory/types';
import {defaultAgency} from '../procurement/presets/default-agency';
import {ProcurementCaseInputSchema} from '../procurement/schema';
import {sqliteRepository as procurementRepo} from '../procurement/storage/sqlite';
import type {AgencyConfig, ProcurementCaseInput, SignatoryChain} from '../procurement/types';
import {cleanForExport, type StoredCase} from '../procurement/workspace/model';
import {computeProcurementCase} from '../procurement/calculations';
import {formatDocumentNumbers} from '../procurement/numbering';
import {createSqliteCaseRepository} from './repository';
import {resolveAllLinkedModules, type CrossModuleSources} from './cross-module-linker';
import type {CaseFolder, LinkedModuleSummary} from './types';

type CaseSqliteGetter = Parameters<typeof createSqliteCaseRepository>[0];

export const sqliteCaseRepository = createSqliteCaseRepository(
  (() => db()) as unknown as CaseSqliteGetter,
);

const DEFAULT_SIGNATORIES: SignatoryChain = {
  procurementOfficer: {
    id: 'officer',
    fullName: 'นายกิตตินันท์ พลรบ',
    position: 'เจ้าพนักงานธุรการปฏิบัติงาน',
  },
  divisionDirector: {
    id: 'director',
    fullName: 'นางกุลวดี ส่งแสง',
    position: 'ผู้อำนวยการกองสวัสดิการสังคม',
  },
  municipalClerk: {
    id: 'clerk',
    fullName: 'นายชัยณิวัฒน์ สายสุวรรณ์',
    position: 'รองปลัดเทศบาล',
    actingLine: 'รักษาราชการแทน',
    actingTarget: 'ปลัดเทศบาลตำบลฉลอง',
  },
  mayor: {
    id: 'mayor',
    fullName: 'นายธนพร องค์สันติภาพ',
    position: 'นายกเทศมนตรีตำบลฉลอง',
  },
};

export function resolveCaseDefaults(): {agency: AgencyConfig; signatories: SignatoryChain} {
  try {
    const master = procurementRepo.getMasterData().data;
    const agency: AgencyConfig = master.agency ?? defaultAgency;
    const byId = new Map(master.people.map(p => [p.id, p]));
    const pick = (key: keyof SignatoryChain) => {
      const person = byId.get(master.signatories[key]);
      if (person && person.fullName.trim()) return person;
      return DEFAULT_SIGNATORIES[key];
    };
    return {
      agency,
      signatories: {
        procurementOfficer: pick('procurementOfficer'),
        divisionDirector: pick('divisionDirector'),
        municipalClerk: pick('municipalClerk'),
        mayor: pick('mayor'),
      },
    };
  } catch {
    return {agency: defaultAgency, signatories: DEFAULT_SIGNATORIES};
  }
}

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

export interface LoadedCrossModuleContext {
  sources: CrossModuleSources;
  procurementInputs: ProcurementCaseInput[];
  procurementAgencies: ReadonlyMap<string, AgencyConfig>;
  availableProcurement: AvailableProcurementLink[];
  availableRequisitions: AvailableInventoryReqLink[];
  availableAssetLoans: AvailableAssetLoanLink[];
}

export function loadCrossModuleContext(): LoadedCrossModuleContext {
  const storedProcurementCases: StoredCase[] = [];
  const procurementInputs: ProcurementCaseInput[] = [];
  const procurementAgencies = new Map<string, AgencyConfig>();
  const availableProcurement: AvailableProcurementLink[] = [];

  try {
    for (const record of procurementRepo.listCases()) {
      storedProcurementCases.push(record);
      const agency = record.agency ?? defaultAgency;
      procurementAgencies.set(record.caseInput.id, agency);
      const parsed = ProcurementCaseInputSchema.safeParse(cleanForExport(record.caseInput));
      if (!parsed.success) {
        const rawPo = record.caseInput.docs.doc10_purchaseOrder.runningNo;
        const fy =
          record.caseInput.docs.doc10_purchaseOrder.fiscalYearBE ??
          record.caseInput.budgetLine.fiscalYearBE;
        availableProcurement.push({
          id: record.caseInput.id,
          title:
            record.caseInput.projectTitleShort ||
            record.caseInput.budgetLine.categoryType ||
            'งานจัดซื้อจัดจ้าง',
          poNumber: rawPo ? `${agency.codes.poPrefix} ${rawPo}/${fy}` : '',
          date:
            record.caseInput.docs.doc10_purchaseOrder.date ||
            record.caseInput.docs.doc1_approvePrinciple.date ||
            '',
          fiscalYearBE: record.caseInput.budgetLine.fiscalYearBE,
          grandTotal: record.caseInput.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0),
          vendorName: record.caseInput.vendor.shopName || record.caseInput.vendor.contactPersonName || '',
          methodLabel: record.caseInput.workflowModeOverride === 'EGP_OVER_5000' ? 'e-GP' : '≤ 5,000 บาท',
        });
        continue;
      }
      const c = parsed.data;
      procurementInputs.push(c);
      let grandTotal = 0;
      let isEgp = c.workflowModeOverride === 'EGP_OVER_5000';
      let poNumber = c.docs.doc10_purchaseOrder.runningNo
        ? `${agency.codes.poPrefix} ${c.docs.doc10_purchaseOrder.runningNo}/${c.docs.doc10_purchaseOrder.fiscalYearBE ?? c.budgetLine.fiscalYearBE}`
        : '';
      try {
        const computed = computeProcurementCase(c);
        grandTotal = computed.grandTotal;
        isEgp = computed.workflowMode === 'EGP_OVER_5000';
        const formatted = formatDocumentNumbers(c.docs, agency);
        if (formatted.doc10_purchaseOrder) poNumber = formatted.doc10_purchaseOrder;
      } catch {
        grandTotal = c.items.reduce((s, item) => s + item.quantity * item.unitPrice, 0);
      }
      availableProcurement.push({
        id: c.id,
        title: c.projectTitleShort || c.budgetLine.categoryType || 'งานจัดซื้อจัดจ้าง',
        poNumber,
        date: c.docs.doc10_purchaseOrder.date || c.docs.doc1_approvePrinciple.date || '',
        fiscalYearBE: c.budgetLine.fiscalYearBE,
        grandTotal,
        vendorName: c.vendor.shopName || c.vendor.contactPersonName || '',
        methodLabel: isEgp ? 'e-GP' : '≤ 5,000 บาท',
      });
    }
  } catch {
    // Graceful degradation if procurement table has no records yet
  }

  let inventoryState: InventoryDomainState | undefined;
  const availableRequisitions: AvailableInventoryReqLink[] = [];
  const availableAssetLoans: AvailableAssetLoanLink[] = [];
  try {
    inventoryState = sqliteInventoryRepository.load().data;
    const assetById = new Map(inventoryState.assets.map(a => [a.id, a]));
    for (const req of inventoryState.requisitions) {
      const totalValue = req.lines.reduce(
        (sum, line) => sum + line.allocations.reduce((s, a) => s + a.lineAmount, 0),
        0,
      );
      availableRequisitions.push({
        id: req.id,
        runningNo: req.requisitionRunningNo,
        fiscalYearBE: req.fiscalYearBE,
        requestDate: req.requestDate,
        requesterName: req.requesterName,
        purpose: req.purpose || 'เบิกวัสดุสำนักงาน',
        status: req.status,
        totalValue,
      });
    }
    for (const loan of inventoryState.assetLoans) {
      const asset = assetById.get(loan.assetId);
      availableAssetLoans.push({
        id: loan.id,
        runningNo: loan.loanRunningNo,
        fiscalYearBE: loan.fiscalYearBE,
        loanDate: loan.loanDate,
        borrowerName: loan.borrowerName,
        assetName: asset ? `${asset.assetCode} ${asset.name}` : loan.purpose,
        status: loan.status,
      });
    }
  } catch {
    // Graceful degradation
  }

  return {
    sources: {procurementCases: storedProcurementCases, inventoryState},
    procurementInputs,
    procurementAgencies,
    availableProcurement,
    availableRequisitions,
    availableAssetLoans,
  };
}

export function resolveLinkedSummariesForFolder(
  folder: CaseFolder,
  sources?: CrossModuleSources,
): Map<string, LinkedModuleSummary> {
  const ctxSources = sources ?? loadCrossModuleContext().sources;
  return resolveAllLinkedModules(folder, ctxSources);
}

// ---------------------------------------------------------------------------
// Case External Files Storage (PDF, PNG, JPG, WebP, DOCX)
// ---------------------------------------------------------------------------

function ensureCaseExternalFileTable(): void {
  db().exec(
    `CREATE TABLE IF NOT EXISTS case_external_files (
      id TEXT PRIMARY KEY,
      original_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      file_type TEXT NOT NULL,
      pages INTEGER NOT NULL,
      bytes BLOB NOT NULL,
      pdf_bytes BLOB,
      created_at TEXT NOT NULL
    )`,
  );
}

const isPng = (b: Buffer) => b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
const isJpeg = (b: Buffer) => b.subarray(0, 3).equals(Buffer.from([255, 216, 255]));
const isWebp = (b: Buffer) =>
  b.length >= 12 &&
  b.subarray(0, 4).toString('ascii') === 'RIFF' &&
  b.subarray(8, 12).toString('ascii') === 'WEBP';
const isPdf = (b: Buffer) => b.subarray(0, 5).toString('ascii') === '%PDF-';
const isZipMagic = (b: Buffer) => b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04;

export interface SavedCaseExternalFile {
  id: string;
  path: string;
  originalName: string;
  fileType: 'PDF' | 'DOCX' | 'IMAGE';
  mime: string;
  pages: number;
  bytesLength: number;
  uploadedAt: string;
}

export async function saveCaseExternalFile(file: File): Promise<SavedCaseExternalFile> {
  if (!file.size || file.size > 25 * 1024 * 1024) {
    throw new Error('รองรับไฟล์ PDF, DOCX, PNG, JPG และ WebP ขนาดไม่เกิน 25 MB ต่อไฟล์');
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  const originalName = (file.name || 'document').replace(/[\\/\x00-\x1f]/g, '_').slice(0, 220);
  const lower = originalName.toLowerCase();

  let fileType: 'PDF' | 'DOCX' | 'IMAGE';
  let mime: string;
  let pdfBytes: Buffer | null = null;
  let pages = 1;

  if (isPdf(bytes)) {
    fileType = 'PDF';
    mime = 'application/pdf';
    let source: PDFDocument;
    try {
      source = await PDFDocument.load(bytes);
    } catch {
      try {
        source = await PDFDocument.load(bytes, {ignoreEncryption: true});
      } catch {
        throw new Error('ไม่สามารถเปิดไฟล์ PDF นี้ได้ (อาจเสียหายหรือติดรหัสผ่าน)');
      }
    }
    pages = source.getPageCount();
    if (pages < 1 || pages > 200) throw new Error('ไฟล์ PDF ต้องมี 1–200 หน้า');
    const clean = await PDFDocument.create();
    const copied = await clean.copyPages(source, source.getPageIndices());
    for (const page of copied) {
      page.node.delete(PDFName.of('Annots'));
      page.node.delete(PDFName.of('AA'));
      clean.addPage(page);
    }
    pdfBytes = Buffer.from(await clean.save());
  } else if (isPng(bytes) || isJpeg(bytes) || isWebp(bytes)) {
    fileType = 'IMAGE';
    mime = isPng(bytes) ? 'image/png' : isWebp(bytes) ? 'image/webp' : 'image/jpeg';
    const base = sharp(bytes, {limitInputPixels: 64_000_000})
      .rotate()
      .resize({width: 2400, height: 2400, fit: 'inside', withoutEnlargement:true})
      .flatten({background: '#ffffff'});
    const usePng = isPng(bytes) && bytes.length <= 3 * 1024 * 1024;
    const normalized = usePng
      ? await base.png({compressionLevel: 7}).toBuffer()
      : await base.jpeg({quality: 88, mozjpeg: true}).toBuffer();
    const out = await PDFDocument.create();
    const img = usePng ? await out.embedPng(normalized) : await out.embedJpg(normalized);
    const page = out.addPage([595.28, 841.89]);
    const size = img.scale(Math.min(555.28 / img.width, 801.89 / img.height));
    page.drawImage(img, {x: (595.28 - size.width) / 2, y: (841.89 - size.height) / 2, ...size});
    pdfBytes = Buffer.from(await out.save());
    pages = 1;
  } else if (
    isZipMagic(bytes) &&
    (lower.endsWith('.docx') ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  ) {
    fileType = 'DOCX';
    mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    pages = 1;
  } else {
    throw new Error('รองรับเฉพาะไฟล์ PDF, Word (.docx), PNG, JPG และ WebP เท่านั้น');
  }

  const id = randomUUID();
  const uploadedAt = new Date().toISOString();
  ensureCaseExternalFileTable();
  db()
    .prepare(
      'INSERT INTO case_external_files(id,original_name,mime,file_type,pages,bytes,pdf_bytes,created_at) VALUES(?,?,?,?,?,?,?,?)',
    )
    .run(id, originalName, mime, fileType, pages, bytes, pdfBytes, uploadedAt);

  try {
    const dir = path.join(storageConfig().localFolder, 'แฟ้มงานสารบรรณ', 'ไฟล์แนบ');
    fs.mkdirSync(dir, {recursive: true});
    const ext = fileType === 'DOCX' ? '.docx' : fileType === 'PDF' ? '.pdf' : path.extname(originalName) || '.jpg';
    fs.writeFileSync(path.join(dir, `${id}${ext}`), bytes);
  } catch {
    // Non-fatal if local mirror folder is unavailable
  }

  return {
    id,
    path: `/api/cases/files/${id}`,
    originalName,
    fileType,
    mime,
    pages,
    bytesLength: bytes.length,
    uploadedAt,
  };
}

export interface StoredCaseFileData {
  id: string;
  originalName: string;
  mime: string;
  fileType: 'PDF' | 'DOCX' | 'IMAGE';
  pages: number;
  bytes: Buffer;
  pdfBytes: Buffer | null;
}

export function readCaseExternalFileById(id: string): StoredCaseFileData | null {
  if (!id || !/^[a-zA-Z0-9-]+$/.test(id)) return null;
  ensureCaseExternalFileTable();
  const row = db()
    .prepare('SELECT id, original_name, mime, file_type, pages, bytes, pdf_bytes FROM case_external_files WHERE id = ?')
    .get(id) as
    | {
        id: string;
        original_name: string;
        mime: string;
        file_type: 'PDF' | 'DOCX' | 'IMAGE';
        pages: number;
        bytes: Uint8Array;
        pdf_bytes: Uint8Array | null;
      }
    | undefined;
  if (!row) return null;
  return {
    id: row.id,
    originalName: row.original_name,
    mime: row.mime,
    fileType: row.file_type,
    pages: Number(row.pages),
    bytes: Buffer.from(row.bytes),
    pdfBytes: row.pdf_bytes ? Buffer.from(row.pdf_bytes) : null,
  };
}

/**
 * Resolves a stored file reference used in CaseItem (`uploadedFilePath` or `externalOverride.filePath`)
 * without allowing arbitrary filesystem path traversal.
 */
export function resolveCaseStoredFile(ref: string | undefined): StoredCaseFileData | null {
  if (!ref) return null;

  const caseFileMatch = ref.match(/^\/api\/cases\/files\/([a-zA-Z0-9-]+)$/);
  if (caseFileMatch) {
    return readCaseExternalFileById(caseFileMatch[1]);
  }

  const attachMatch = ref.match(/^\/api\/attachments\/([a-zA-Z0-9-]+)$/);
  if (attachMatch) {
    try {
      const att = readAttachment(attachMatch[1]);
      return {
        id: att.id,
        originalName: att.originalName || att.name,
        mime: 'application/pdf',
        fileType: 'PDF',
        pages: att.pages,
        bytes: att.original ?? att.file,
        pdfBytes: att.file,
      };
    } catch {
      return null;
    }
  }

  const dataUriMatch = ref.match(/^data:([^;]+);base64,(.+)$/);
  if (dataUriMatch) {
    const mime = dataUriMatch[1];
    const bytes = Buffer.from(dataUriMatch[2], 'base64');
    const fileType: 'PDF' | 'DOCX' | 'IMAGE' =
      mime === 'application/pdf'
        ? 'PDF'
        : mime.includes('wordprocessingml')
          ? 'DOCX'
          : 'IMAGE';
    return {
      id: 'inline-data',
      originalName: fileType === 'PDF' ? 'attachment.pdf' : fileType === 'DOCX' ? 'override.docx' : 'image.png',
      mime,
      fileType,
      pages: 1,
      bytes,
      pdfBytes: fileType === 'PDF' ? bytes : null,
    };
  }

  return null;
}
