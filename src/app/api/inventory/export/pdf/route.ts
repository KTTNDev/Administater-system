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
import {mergeInventoryPdfs, renderInventoryPdf} from '@/lib/inventory/templates/html/render-inv-pdf';

export const runtime = 'nodejs';

const PdfExportSchema = z.discriminatedUnion('kind', [
  z.object({kind: z.literal('INV-01'), requisitionId: z.string().min(1)}),
  z.object({
    kind: z.literal('INV-02'),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    materialId: z.string().optional(),
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
    kind: z.literal('ANNUAL_AUDIT_BINDER'),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    auditDate: ISODateSchema.optional(),
    asOfDate: ISODateSchema.optional(),
    landscape: z.boolean().optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const req = PdfExportSchema.parse(await readExportJson(request));
    const state = sqliteInventoryRepository.load().data;
    const ctx = resolveInventoryContext();

    let result: {pdfBytes: Buffer; pageCount: number};
    let filename = 'inventory-form.pdf';

    switch (req.kind) {
      case 'INV-01': {
        const item = state.requisitions.find(r => r.id === req.requisitionId);
        if (!item) throw new Error('ไม่พบใบเบิกวัสดุที่เลือก');
        result = await renderInventoryPdf(buildInv01RequisitionForm(state, item, ctx));
        filename = `ใบเบิกวัสดุ-${item.requisitionRunningNo}-${item.fiscalYearBE}.pdf`;
        break;
      }
      case 'INV-02': {
        const form = buildInv02StockCardForm(state, req.fiscalYearBE, {
          materialId: req.materialId,
          landscape: req.landscape,
        }, ctx);
        result = await renderInventoryPdf(form);
        filename = req.materialId
          ? `บัญชีวัสดุ-${req.fiscalYearBE}.pdf`
          : `บัญชีวัสดุทั้งกอง-${req.fiscalYearBE}.pdf`;
        break;
      }
      case 'INV-03': {
        const loan = state.assetLoans.find(l => l.id === req.loanId);
        if (!loan) throw new Error('ไม่พบใบยืมครุภัณฑ์ที่เลือก');
        result = await renderInventoryPdf(buildInv03AssetLoanForm(state, loan, ctx));
        filename = `ใบยืมครุภัณฑ์-${loan.loanRunningNo}-${loan.fiscalYearBE}.pdf`;
        break;
      }
      case 'INV-04': {
        result = await renderInventoryPdf(
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
        filename = `รายงานสรุปตัดพัสดุ-${req.fiscalYearBE}.pdf`;
        break;
      }
      case 'INV-05': {
        result = await renderInventoryPdf(
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
        filename = `รายงานตรวจสอบพัสดุข้อ213-${req.fiscalYearBE}.pdf`;
        break;
      }
      case 'ANNUAL_AUDIT_BINDER': {
        const defaultSep30 = `${req.fiscalYearBE - 543}-09-30`;
        const auditDate = req.auditDate ?? defaultSep30;
        const asOfDate = req.asOfDate ?? auditDate;
        const forms = [
          buildInv05AnnualAudit213Form(state, req.fiscalYearBE, {auditDate}, ctx),
          buildInv04CutOffSummaryForm(state, req.fiscalYearBE, {asOfDate}, ctx),
          ...(state.materials.length
            ? [buildInv02StockCardForm(state, req.fiscalYearBE, {landscape: req.landscape}, ctx)]
            : []),
        ];
        result = await mergeInventoryPdfs(forms);
        filename = `ชุดรายงานตรวจนับพัสดุประจำปี-${req.fiscalYearBE}.pdf`;
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
            `ใบเบิกวัสดุ_${safeArchivePart(item.requisitionRunningNo, 12)}-${item.fiscalYearBE}_${safeArchivePart(effectiveReceiverName(item), 32)}.pdf`,
            result.pdfBytes,
          );
        }
      } else if (req.kind === 'INV-02') {
        const mat = req.materialId ? state.materials.find(m => m.id === req.materialId) : undefined;
        archiveInventoryFile(
          req.fiscalYearBE,
          '02_บัญชีวัสดุ_INV-02',
          mat ? `${String(mat.ledgerSeqNo).padStart(3, '0')}_${safeArchivePart(mat.name, 55)}.pdf` : `บัญชีวัสดุทั้งกอง_${req.fiscalYearBE}.pdf`,
          result.pdfBytes,
        );
      } else if (req.kind === 'INV-03') {
        const loan = state.assetLoans.find(l => l.id === req.loanId);
        if (loan) {
          archiveInventoryFile(
            loan.fiscalYearBE,
            '03_ทะเบียนครุภัณฑ์และใบยืม_INV-03',
            `ใบยืมครุภัณฑ์_ยค${safeArchivePart(loan.loanRunningNo, 12)}-${loan.fiscalYearBE}_${safeArchivePart(loan.borrowerName, 32)}.pdf`,
            result.pdfBytes,
          );
        }
      } else {
        archiveInventoryFile(req.fiscalYearBE, '04_รายงานตัดพัสดุและตรวจนับประจำปี', filename.replace(/-/g, '_'), result.pdfBytes);
      }
    } catch {
      // Non-blocking handover mirror
    }

    return new Response(new Uint8Array(result.pdfBytes), {
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(filename),
        'X-Page-Count': String(result.pageCount),
      },
    });
  } catch (error) {
    return exportFailure(error);
  }
}
