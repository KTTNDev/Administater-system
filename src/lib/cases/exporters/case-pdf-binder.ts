import 'server-only';
import {PDFDocument} from 'pdf-lib';
import {withPdfRenderer} from '../../pdf';
import {withProcurementPage} from '../../procurement/exporters/pdf/browser-pool';
import {normalizeThaiCMaps} from '../../procurement/exporters/pdf/thai-cmap';
import {assemblePdfBinder} from '../../procurement/exporters/pdf/binder';
import {computeProcurementCase} from '../../procurement/calculations';
import {toThaiDigits, toThaiOfficialText} from '../../procurement/formatting';
import {defaultAgency} from '../../procurement/presets/default-agency';
import type {AgencyConfig, ProcurementCaseInput} from '../../procurement/types';
import {loadInventoryPrintAssets} from '../../inventory/templates/html/render-inv-html';
import {renderInventoryPdf} from '../../inventory/templates/html/render-inv-pdf';
import {buildInv01RequisitionForm, buildInv03AssetLoanForm} from '../../inventory/templates/build-forms';
import type {InventoryDomainState} from '../../inventory/types';
import {resolveCaseItemCoreDraft} from '../core/bindings';
import {buildCaseRoadmap} from '../roadmap';
import type {CaseFolder, LinkedModuleSummary, RoadmapRow} from '../types';

export interface CasePdfBinderOptions {
  mode?: 'FULL_BINDER' | 'BY_STAGE';
  stageId?: string;
  duplicateCopies?: boolean;
  includeLinkedPdfs?: boolean;
  includeDividers?: boolean;
  includeCoverChecklist?: boolean;
  highlightBlanks?: boolean;
  density?: 'normal' | 'compact' | 'tight';
  preferBoundCore?: boolean;
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>;
  procurementCases?: readonly ProcurementCaseInput[];
  procurementAgencies?: ReadonlyMap<string, AgencyConfig>;
  inventoryState?: InventoryDomainState;
  resolveStoredFile?: (ref: string | undefined) => {
    originalName: string;
    bytes: Buffer;
    pdfBytes: Buffer | null;
    fileType: 'PDF' | 'DOCX' | 'IMAGE';
  } | null;
}

export interface CaseBinderEntry {
  itemId: string;
  label: string;
  source: 'COVER' | 'GENERATED' | 'OVERRIDE_PDF' | 'EXTERNAL_FILE' | 'LINKED_MODULE' | 'DIVIDER';
  copy: number;
  startPage: number;
  pageCount: number;
}

export interface CasePdfBinderResult {
  pdfBytes: Buffer;
  pageCount: number;
  entries: CaseBinderEntry[];
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function buildFontFaceCss(assets: {regularFontUri: string; boldFontUri: string}): string {
  return `
@font-face {
  font-family: 'TH Sarabun IT๙';
  src: url('${assets.regularFontUri}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'TH Sarabun IT๙';
  src: url('${assets.boldFontUri}') format('truetype');
  font-weight: 700;
  font-style: normal;
}`;
}

async function renderHtmlToPdfBytes(html: string): Promise<{pdfBytes: Buffer; pageCount: number}> {
  return withProcurementPage(async page => {
    await page.setContent(html, {waitUntil: 'load'});
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {})));
    });
    const raw = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
    });
    const doc = await PDFDocument.load(raw);
    normalizeThaiCMaps(doc);
    return {pdfBytes: Buffer.from(await doc.save()), pageCount: doc.getPageCount()};
  });
}

function renderCoverChecklistHtml(
  folder: CaseFolder,
  rows: RoadmapRow[],
  assets: {regularFontUri: string; boldFontUri: string},
): string {
  const stageGrouped = rows
    .map(
      r => `<tr>
        <td style="text-align:center">${esc(toThaiDigits(String(r.sequence)))}</td>
        <td>${esc(toThaiOfficialText(r.stageName))}</td>
        <td><strong>${esc(toThaiOfficialText(r.title))}</strong><br><small>${esc(r.docTypeLabel)}${r.overrideNote ? ` · ${esc(r.overrideNote)}` : ''}</small></td>
        <td>${esc(r.referenceNo)}</td>
        <td>${esc(r.dateThai)}</td>
        <td style="text-align:center">${esc(toThaiDigits(String(r.copies)))} ชุด</td>
        <td>${esc(r.statusBadge)}</td>
      </tr>`,
    )
    .join('');

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<style>
${buildFontFaceCss(assets)}
@page { size: A4; margin: 2cm 2cm 2cm 2.5cm; }
body { font-family: 'TH Sarabun IT๙', 'TH Sarabun New', serif; font-size: 16pt; line-height: 1.2; color: #000; margin: 0; }
h1 { font-size: 20pt; margin: 0 0 4pt; text-align: center; }
.sub { text-align: center; margin: 0 0 12pt; }
table { width: 100%; border-collapse: collapse; font-size: 14pt; }
th, td { border: 1px solid #000; padding: 4pt 5pt; vertical-align: top; }
th { background: #f2f2f2; text-align: center; }
small { color: #333; }
</style>
</head>
<body>
  <h1>ใบปะหน้าลายแทงประจำแฟ้มงานสารบรรณ</h1>
  <p class="sub">${esc(toThaiOfficialText(folder.name))} · ปีงบประมาณ พ.ศ. ${esc(toThaiDigits(String(folder.fiscalYearBE)))}</p>
  <p style="margin:0 0 8pt">หน่วยงาน: ${esc(folder.agency.divisionName)} ${esc(folder.agency.municipalityName)} · เอกสารทั้งหมด ${esc(toThaiDigits(String(rows.length)))} รายการ</p>
  <table>
    <thead>
      <tr>
        <th style="width:7%">ลำดับ</th>
        <th style="width:16%">รอบเสนอเซ็น</th>
        <th style="width:33%">ชื่อเอกสาร / ประเภท</th>
        <th style="width:14%">เลขที่</th>
        <th style="width:12%">วันที่</th>
        <th style="width:8%">ชุด</th>
        <th style="width:10%">สถานะ</th>
      </tr>
    </thead>
    <tbody>${stageGrouped}</tbody>
  </table>
</body>
</html>`;
}

function renderDividerCardHtml(
  folder: CaseFolder,
  row: RoadmapRow,
  note: string,
  assets: {regularFontUri: string; boldFontUri: string},
): string {
  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<style>
${buildFontFaceCss(assets)}
@page { size: A4; margin: 2.5cm 2cm 2cm 3cm; }
body { font-family: 'TH Sarabun IT๙', 'TH Sarabun New', serif; font-size: 16pt; color: #000; margin: 0; }
.box { border: 1.5pt dashed #444; padding: 24pt; margin-top: 40pt; text-align: center; }
h2 { font-size: 22pt; margin: 0 0 10pt; }
p { margin: 4pt 0; }
.badge { display: inline-block; border: 1pt solid #000; padding: 2pt 10pt; margin-bottom: 10pt; font-weight: 700; }
</style>
</head>
<body>
  <div class="box">
    <div class="badge">แผ่นคั่นเอกสาร · ลำดับที่ ${esc(toThaiDigits(String(row.sequence)))}</div>
    <h2>${esc(toThaiOfficialText(row.title))}</h2>
    <p>แฟ้มงาน: ${esc(toThaiOfficialText(folder.name))}</p>
    <p>รอบเสนอเซ็น: ${esc(toThaiOfficialText(row.stageName))} · ประเภท: ${esc(row.docTypeLabel)}</p>
    <p>เลขที่อ้างอิง: ${esc(row.referenceNo)} · วันที่: ${esc(row.dateThai)} · จำนวน ${esc(toThaiDigits(String(row.copies)))} ชุด</p>
    <p style="margin-top:14pt;font-weight:700">${esc(note)}</p>
  </div>
</body>
</html>`;
}

async function appendPdfBytes(
  binder: PDFDocument,
  pdfBytes: Buffer,
  entries: CaseBinderEntry[],
  meta: Omit<CaseBinderEntry, 'startPage' | 'pageCount'>,
): Promise<void> {
  const part = await PDFDocument.load(pdfBytes);
  const startPage = binder.getPageCount() + 1;
  const copied = await binder.copyPages(part, part.getPageIndices());
  for (const page of copied) binder.addPage(page);
  entries.push({...meta, startPage, pageCount: copied.length});
}

export async function assembleCasePdfBinder(
  folder: CaseFolder,
  options: CasePdfBinderOptions = {},
): Promise<CasePdfBinderResult> {
  const mode = options.mode ?? 'FULL_BINDER';
  const duplicateCopies = options.duplicateCopies ?? true;
  const includeLinkedPdfs = options.includeLinkedPdfs ?? true;
  const includeDividers = options.includeDividers ?? true;
  const includeCoverChecklist = options.includeCoverChecklist ?? true;
  const highlightBlanks = options.highlightBlanks ?? false;
  const preferBoundCore = options.preferBoundCore ?? true;
  const linkedSummaries = options.linkedSummaries;

  const filteredFolder: CaseFolder =
    mode === 'BY_STAGE' && options.stageId
      ? {
          ...folder,
          stages: folder.stages.filter(s => s.id === options.stageId),
          items: folder.items.filter(i => i.stageId === options.stageId),
        }
      : folder;

  const rows = buildCaseRoadmap(filteredFolder, linkedSummaries);
  const assets = loadInventoryPrintAssets();
  const binder = await PDFDocument.create();
  const entries: CaseBinderEntry[] = [];

  if (includeCoverChecklist) {
    const coverHtml = renderCoverChecklistHtml(filteredFolder, rows, assets);
    const rendered = await renderHtmlToPdfBytes(coverHtml);
    await appendPdfBytes(binder, rendered.pdfBytes, entries, {
      itemId: 'COVER',
      label: 'ใบปะหน้าลายแทงประจำแฟ้มงาน',
      source: 'COVER',
      copy: 1,
    });
  }

  const itemById = new Map(filteredFolder.items.map(i => [i.id, i]));
  const procById = new Map((options.procurementCases ?? []).map(p => [p.id, p]));

  await withPdfRenderer(async renderCorePdf => {
    for (const row of rows) {
      const item = itemById.get(row.itemId);
      if (!item) continue;
      const totalCopies = duplicateCopies ? Math.max(1, item.copies) : 1;

      if (item.kind === 'GENERATED_DOC') {
        if (item.externalOverride) {
          const stored = options.resolveStoredFile?.(item.externalOverride.storedPath);
          if (stored?.pdfBytes) {
            for (let copy = 1; copy <= totalCopies; copy++) {
              await appendPdfBytes(binder, stored.pdfBytes, entries, {
                itemId: item.id,
                label: `${row.title} (ฉบับแก้ไขภายนอก)`,
                source: 'OVERRIDE_PDF',
                copy,
              });
            }
            continue;
          }
          if (includeDividers) {
            const dividerHtml = renderDividerCardHtml(
              folder,
              row,
              `กรุณาแทรกเอกสารฉบับแก้ไขภายนอก (${item.externalOverride.fileName}) ในช่องนี้`,
              assets,
            );
            const rendered = await renderHtmlToPdfBytes(dividerHtml);
            await appendPdfBytes(binder, rendered.pdfBytes, entries, {
              itemId: item.id,
              label: `${row.title} (แผ่นคั่นฉบับแก้ไขภายนอก)`,
              source: 'DIVIDER',
              copy: 1,
            });
          }
          continue;
        }

        const {draft} = resolveCaseItemCoreDraft(folder, item, {
          linkedSummaries,
          highlightBlanks,
          preferBound: preferBoundCore,
        });
        const pdfBuf = await renderCorePdf(draft);
        for (let copy = 1; copy <= totalCopies; copy++) {
          await appendPdfBytes(binder, pdfBuf, entries, {
            itemId: item.id,
            label: draft.subject || row.title,
            source: 'GENERATED',
            copy,
          });
        }
        continue;
      }

      if (item.kind === 'EXTERNAL_FILE_SLOT') {
        const stored = options.resolveStoredFile?.(item.uploadedFilePath);
        if (item.exportBehavior === 'EMBED_UPLOADED_FILE' && stored?.pdfBytes) {
          for (let copy = 1; copy <= totalCopies; copy++) {
            await appendPdfBytes(binder, stored.pdfBytes, entries, {
              itemId: item.id,
              label: row.title,
              source: 'EXTERNAL_FILE',
              copy,
            });
          }
        } else if (includeDividers) {
          const note = item.uploadedFilePath
            ? `แนบไฟล์ "${item.uploadedFileName || 'เอกสารแนบ'}" แล้ว — กำหนดให้พิมพ์แผ่นคั่นเพื่อแทรกต้นฉบับ`
            : 'ยังไม่ได้อัปโหลดไฟล์ — กรุณาแทรกเอกสารต้นฉบับในตำแหน่งนี้';
          const dividerHtml = renderDividerCardHtml(folder, row, note, assets);
          const rendered = await renderHtmlToPdfBytes(dividerHtml);
          await appendPdfBytes(binder, rendered.pdfBytes, entries, {
            itemId: item.id,
            label: `${row.title} (แผ่นคั่น)`,
            source: 'DIVIDER',
            copy: 1,
          });
        }
        continue;
      }

      if (item.kind === 'LINKED_MODULE_REF') {
        let embedded = false;
        if (includeLinkedPdfs && item.includePdfInBinder) {
          if (item.targetModule === 'PROCUREMENT') {
            const proc = procById.get(item.targetId);
            if (proc) {
              try {
                const computed = computeProcurementCase(proc);
                const agency =
                  options.procurementAgencies?.get(proc.id) ?? folder.agency ?? defaultAgency;
                const procBinder = await assemblePdfBinder(computed, agency, {
                  profile: {mode: 'FULL_BINDER'},
                  duplicateCopies: false,
                  includeDividers: false,
                  includeCoverChecklist: false,
                  routingStripMode: 'FIRST_COPY_ONLY',
                });
                await appendPdfBytes(binder, procBinder.pdfBytes, entries, {
                  itemId: item.id,
                  label: `${row.title} (ชุดจัดซื้อจัดจ้าง)`,
                  source: 'LINKED_MODULE',
                  copy: 1,
                });
                embedded = true;
              } catch {
                embedded = false;
              }
            }
          } else if (item.targetModule === 'INVENTORY_REQUISITION' && options.inventoryState) {
            const req = options.inventoryState.requisitions.find(r => r.id === item.targetId);
            if (req) {
              try {
                const form = buildInv01RequisitionForm(options.inventoryState, req, {
                  agency: folder.agency,
                  signatories: folder.signatories,
                });
                const invPdf = await renderInventoryPdf(form);
                await appendPdfBytes(binder, invPdf.pdfBytes, entries, {
                  itemId: item.id,
                  label: `${row.title} (ใบเบิกพัสดุ)`,
                  source: 'LINKED_MODULE',
                  copy: 1,
                });
                embedded = true;
              } catch {
                embedded = false;
              }
            }
          } else if (item.targetModule === 'INVENTORY_ASSET_LOAN' && options.inventoryState) {
            const loan = options.inventoryState.assetLoans.find(l => l.id === item.targetId);
            if (loan) {
              try {
                const form = buildInv03AssetLoanForm(options.inventoryState, loan, {
                  agency: folder.agency,
                  signatories: folder.signatories,
                });
                const invPdf = await renderInventoryPdf(form);
                await appendPdfBytes(binder, invPdf.pdfBytes, entries, {
                  itemId: item.id,
                  label: `${row.title} (ใบยืมครุภัณฑ์)`,
                  source: 'LINKED_MODULE',
                  copy: 1,
                });
                embedded = true;
              } catch {
                embedded = false;
              }
            }
          }
        }

        if (!embedded && includeDividers) {
          const dividerHtml = renderDividerCardHtml(
            folder,
            row,
            `เอกสารเชื่อมโยงจากระบบ (${row.docTypeLabel}) — แทรกเอกสารชุดจริงในตำแหน่งนี้`,
            assets,
          );
          const rendered = await renderHtmlToPdfBytes(dividerHtml);
          await appendPdfBytes(binder, rendered.pdfBytes, entries, {
            itemId: item.id,
            label: `${row.title} (แผ่นคั่นระบบเชื่อมโยง)`,
            source: 'DIVIDER',
            copy: 1,
          });
        }
      }
    }
  });

  if (binder.getPageCount() === 0) {
    throw new Error('ไม่มีเอกสารสำหรับรวมเล่ม PDF ในรอบหรือแฟ้มที่เลือก');
  }

  return {
    pdfBytes: Buffer.from(await binder.save()),
    pageCount: binder.getPageCount(),
    entries,
  };
}
