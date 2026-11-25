import {z} from 'zod';
import {
  contentDisposition,
  exportFailure,
  guardExportRequest,
  PRIVATE_HEADERS,
  readExportJson,
} from '@/lib/procurement/exporters/api';
import {CaseFolderSchema} from '@/lib/cases/schema';
import {buildLocalHandoffZip} from '@/lib/cases/exporters/local-handoff-zip';
import {
  loadCrossModuleContext,
  resolveCaseStoredFile,
  resolveLinkedSummariesForFolder,
} from '@/lib/cases/server-context';

export const runtime = 'nodejs';

const LocalHandoffRequestSchema = z.object({
  folder: CaseFolderSchema,
  highlightBlanks: z.boolean().default(true),
  includeRoadmapFiles: z.boolean().default(true),
  includeAttachmentsAndLinked: z.boolean().default(true),
  stageId: z.string().optional(),
});

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const input = LocalHandoffRequestSchema.parse(await readExportJson(request));
    const cross = loadCrossModuleContext();
    const linkedSummaries = resolveLinkedSummariesForFolder(input.folder, cross.sources);

    const result = await buildLocalHandoffZip(input.folder, {
      highlightBlanks: input.highlightBlanks,
      includeRoadmapFiles: input.includeRoadmapFiles,
      includeAttachmentsAndLinked: input.includeAttachmentsAndLinked,
      stageId: input.stageId,
      linkedSummaries,
      procurementCases: cross.procurementInputs,
      procurementAgencies: cross.procurementAgencies,
      inventoryState: cross.sources.inventoryState ?? undefined,
      resolveStoredFile: resolveCaseStoredFile,
    });

    return new Response(new Uint8Array(result.zipBytes), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'application/zip',
        'Content-Disposition': contentDisposition(result.fileName),
      },
    });
  } catch (e) {
    return exportFailure(e);
  }
}
