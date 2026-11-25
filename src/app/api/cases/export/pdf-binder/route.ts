import {z} from 'zod';
import {
  contentDisposition,
  exportFailure,
  guardExportRequest,
  PRIVATE_HEADERS,
  readExportJson,
} from '@/lib/procurement/exporters/api';
import {CaseFolderSchema} from '@/lib/cases/schema';
import {assembleCasePdfBinder} from '@/lib/cases/exporters/case-pdf-binder';
import {sanitizeCaseFileName} from '@/lib/cases/exporters/portable-archive';
import {
  loadCrossModuleContext,
  resolveCaseStoredFile,
  resolveLinkedSummariesForFolder,
} from '@/lib/cases/server-context';

export const runtime = 'nodejs';

const BinderRequestSchema = z.object({
  folder: CaseFolderSchema,
  mode: z.enum(['FULL_BINDER', 'BY_STAGE']).default('FULL_BINDER'),
  stageId: z.string().optional(),
  duplicateCopies: z.boolean().default(true),
  includeLinkedPdfs: z.boolean().default(true),
  includeDividers: z.boolean().default(true),
  includeCoverChecklist: z.boolean().default(true),
  highlightBlanks: z.boolean().default(false),
  density: z.enum(['normal', 'compact', 'tight']).default('normal'),
});

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const input = BinderRequestSchema.parse(await readExportJson(request));
    const cross = loadCrossModuleContext();
    const linkedSummaries = resolveLinkedSummariesForFolder(input.folder, cross.sources);

    const result = await assembleCasePdfBinder(input.folder, {
      mode: input.mode,
      stageId: input.stageId,
      duplicateCopies: input.duplicateCopies,
      includeLinkedPdfs: input.includeLinkedPdfs,
      includeDividers: input.includeDividers,
      includeCoverChecklist: input.includeCoverChecklist,
      highlightBlanks: input.highlightBlanks,
      density: input.density,
      linkedSummaries,
      procurementCases: cross.procurementInputs,
      procurementAgencies: cross.procurementAgencies,
      inventoryState: cross.sources.inventoryState ?? undefined,
      resolveStoredFile: resolveCaseStoredFile,
    });

    const stageSuffix =
      input.mode === 'BY_STAGE' && input.stageId
        ? `_${sanitizeCaseFileName(
            input.folder.stages.find(s => s.id === input.stageId)?.name ?? 'stage',
            'stage',
          )}`
        : '';
    const filename = `${sanitizeCaseFileName(input.folder.name, 'case-binder')}${stageSuffix}_แฟ้มพร้อมพิมพ์.pdf`;

    return new Response(new Uint8Array(result.pdfBytes), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'application/pdf',
        'Content-Disposition': contentDisposition(filename),
        'X-Sarabun-Page-Count': String(result.pageCount),
      },
    });
  } catch (e) {
    return exportFailure(e);
  }
}
