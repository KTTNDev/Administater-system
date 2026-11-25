import JSZip from 'jszip';
import {z} from 'zod';
import {archiveInventoryFile} from '@/lib/handover-archive/archive-service';
import {safeArchivePart} from '@/lib/handover-archive/fs-utils';
import {effectiveReceiverName} from '@/lib/inventory/fifo-engine';
import {contentDisposition, exportFailure, guardExportRequest, PRIVATE_HEADERS, readExportJson} from '@/lib/procurement/exporters/api';
import {ISODateSchema} from '@/lib/inventory/schema';
import {resolveInventoryContext, sqliteInventoryRepository} from '@/lib/inventory/server-context';
import {
  buildInv01RequisitionForm,
  buildInv02StockCardForm,
  buildInv03AssetLoanForm,
  buildInv04CutOffSummaryForm,
  buildInv05AnnualAudit213Form,
} from '@/lib/inventory/templates/build-forms';
import {packageInventoryDocxZip, renderInventoryDocx} from '@/lib/inventory/templates/docx/render-inv-docx';

export const runtime = 'nodejs';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const safeFilePart = (value: string) =>
  value.replace(/[\\/:*?"<>|\x00-\x1f]/g, '-').replace(/[. ]+$/g, '').slice(0, 60) || 'material';

const DocxExportSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('INV-01'), requisitionId: z.string().min(1)}),
  z.object({
    kind: z.literal('INV-02'),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    materialId: z.string().optional(),
    landscape: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal('INV-02_ZIP'),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    landscape: z.boolean().optional(),
  }),
  z.object({kind: z.literal('INV-03'), loanId: z.string().min(1)}),
  z.object({
    kind: z.literal('INV-04'),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    asOfDate: ISODateSchema,
    periodLabel: z.string().optional(),
    periodStart: ISODateSchema.optional(),
    periodEnd: ISODateSchema.optional(),
  }),
  z.object({
    kind: z.literal('INV-05'),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    auditDate: ISODateSchema.optional(),
    docNo: z.string().optional(),
    committeeName: z.string().optional(),
    committeePosition: z.string().optional(),
  }),
  z.object({
    kind: z.literal('ANNUAL_AUDIT_ZIP'),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    auditDate: ISODateSchema.optional(),
    asOfDate: ISODateSchema.optional(),
    landscape: z.boolean().optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const req = DocxExportSchema.parse(await readExportJson(request));
    const state = sqliteInventoryRepository.load().data;
    const ctx = resolveInventoryContext();

    let bytes: Buffer;
    let mime = DOCX_MIME;
    let filename = 'inventory-form.docx';

    switch (req.kind) {
      case 'INV-01': {
        const item = state.requisitions.find(r => r.id === req.requisitionId);
        if (!item) throw new Error('ไม่พบใบเบิกวัสดุที่เลือก');
        bytes = await renderInventoryDocx(buildInv01RequisitionForm(state, item, ctx));
        filename = `ใบเบิกวัสดุ-${item.requisitionRunningNo}-${item.fiscalYearBE}.docx`;
        break;
      }
      case 'INV-02': {
        bytes = await renderInventoryDocx(
          buildInv02StockCardForm(state, req.fiscalYearBE, {materialId: req.materialId, landscape: req.landscape}, ctx),
        );
        filename = req.materialId ? `บัญชีวัสดุ-${req.fiscalYearBE}.docx` : `บัญชีวัสดุทั้งกอง-${req.fiscalYearBE}.docx`;
        break;
      }
      case 'INV-02_ZIP': {
        const sorted = [...state.materials].sort((a, b) => a.ledgerSeqNo - b.ledgerSeqNo);
        if (!sorted.length) throw new Error('ยังไม่มีรายการวัสดุสำหรับส่งออก');
        bytes = await packageInventoryDocxZip(
          sorted.map(m => ({
            filename: `${String(m.ledgerSeqNo).padStart(3, '0')}-${safeFilePart(m.name)}.docx`,
            form: buildInv02StockCardForm(state, req.fiscalYearBE, {materialId: m.id, landscape: req.landscape}, ctx),
          })),
        );
        mime = 'application/zip';
        filename = `บัญชีวัสดุทั้งกอง-${req.fiscalYearBE}.zip`;
        break;
      }
      case 'INV-03': {
        const loan = state.assetLoans.find(l => l.id === req.loanId);
        if (!loan) throw new Error('ไม่พบใบยืมครุภัณฑ์ที่เลือก');
        bytes = await renderInventoryDocx(buildInv03AssetLoanForm(state, loan, ctx));
        filename = `ใบยืมครุภัณฑ์-${loan.loanRunningNo}-${loan.fiscalYearBE}.docx`;
        break;
      }
      case 'INV-04': {
        bytes = await renderInventoryDocx(
          buildInv04CutOffSummaryForm(
            state,
            req.fiscalYearBE,
            {
              asOfDate: req.asOfDate,
              periodLabel: req.periodLabel,
              periodStart: req.periodStart,
              periodEnd: req.periodEnd,
            },
            ctx,
          ),
        );
        filename = `รายงานสรุปตัดพัสดุ-${req.fiscalYearBE}.docx`;
        break;
      }
      case 'INV-05': {
        bytes = await renderInventoryDocx(
          buildInv05AnnualAudit213Form(
            state,
            req.fiscalYearBE,
            {
              auditDate: req.auditDate,
              docNo: req.docNo,
              committeeName: req.committeeName,
              committeePosition: req.committeePosition,
            },
            ctx,
          ),
        );
        filename = `รายงานตรวจสอบพัสดุข้อ213-${req.fiscalYearBE}.docx`;
        break;
      }
      case 'ANNUAL_AUDIT_ZIP': {
        const defaultSep30 = `${req.fiscalYearBE - 543}-09-30`;
        const auditDate = req.auditDate ?? defaultSep30;
        const asOfDate = req.asOfDate ?? auditDate;
        const sorted = [...state.materials].sort((a, b) => a.ledgerSeqNo - b.ledgerSeqNo);
        bytes = await packageInventoryDocxZip([
          {
            filename: `01-INV-05-รายงานตรวจสอบพัสดุข้อ213-${req.fiscalYearBE}.docx`,
            form: buildInv05AnnualAudit213Form(state, req.fiscalYearBE, {auditDate}, ctx),
          },
          {
            filename: `02-INV-04-รายงานสรุปตัดพัสดุ-${req.fiscalYearBE}.docx`,
            form: buildInv04CutOffSummaryForm(state, req.fiscalYearBE, {asOfDate}, ctx),
          },
          ...sorted.map(m => ({
            filename: `stock-cards/${String(m.ledgerSeqNo).padStart(3, '0')}-${safeFilePart(m.name)}.docx`,
            form: buildInv02StockCardForm(state, req.fiscalYearBE, {materialId: m.id, landscape: req.landscape}, ctx),
          })),
        ]);
        mime = 'application/zip';
        filename = `ชุดรายงานตรวจนับพัสดุประจำปี-${req.fiscalYearBE}.zip`;
        break;
      }
    }

    try {
      if (req.kind === 'INV-01') {
        const item = state.requisitions.find(r => r.id === req.requisitionId);
        if (item) {
          archiveInventoryFile(
            item.fiscalYearBE,
            '01_ใบเบิกวัสดุ_INV-01',
            `ใบเบิกวัสดุ_${safeArchivePart(item.requisitionRunningNo, 12)}-${item.fiscalYearBE}_${safeArchivePart(effectiveReceiverName(item), 32)}.docx`,
            bytes,
          );
        }
      } else if (req.kind === 'INV-02') {
        const mat = req.materialId ? state.materials.find(m => m.id === req.materialId) : undefined;
        archiveInventoryFile(
          req.fiscalYearBE,
          '02_บัญชีวัสดุ_INV-02',
          mat ? `${String(mat.ledgerSeqNo).padStart(3, '0')}_${safeArchivePart(mat.name, 55)}.docx` : `บัญชีวัสดุทั้งกอง_${req.fiscalYearBE}.docx`,
          bytes,
        );
      } else if (req.kind === 'INV-03') {
        const loan = state.assetLoans.find(l => l.id === req.loanId);
        if (loan) {
          archiveInventoryFile(
            loan.fiscalYearBE,
            '03_ทะเบียนครุภัณฑ์และใบยืม_INV-03',
            `ใบยืมครุภัณฑ์_ยค${safeArchivePart(loan.loanRunningNo, 12)}-${loan.fiscalYearBE}_${safeArchivePart(loan.borrowerName, 32)}.docx`,
            bytes,
          );
        }
      } else if (req.kind === 'INV-04' || req.kind === 'INV-05') {
        archiveInventoryFile(req.fiscalYearBE, '04_รายงานตัดพัสดุและตรวจนับประจำปี', filename.replace(/-/g, '_'), bytes);
      } else if (req.kind === 'INV-02_ZIP' || req.kind === 'ANNUAL_AUDIT_ZIP') {
        const unpacked = await JSZip.loadAsync(bytes);
        for (const [entryName, entry] of Object.entries(unpacked.files)) {
          if (entry.dir || !entryName.endsWith('.docx')) continue;
          const fileBuf = await entry.async('nodebuffer');
          const cleanName = entryName.split('/').pop() || entryName;
          const isCard = req.kind === 'INV-02_ZIP' || entryName.startsWith('stock-cards/');
          archiveInventoryFile(
            req.fiscalYearBE,
            isCard ? '02_บัญชีวัสดุ_INV-02' : '04_รายงานตัดพัสดุและตรวจนับประจำปี',
            cleanName,
            fileBuf,
          );
        }
      }
    } catch {
      // Non-blocking handover mirror
    }

    return new Response(new Uint8Array(bytes), {
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': mime,
        'Content-Disposition': contentDisposition(filename),
      },
    });
  } catch (error) {
    return exportFailure(error);
  }
}
