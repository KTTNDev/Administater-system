import {z} from 'zod';
import {appendixSources} from '@/lib/appendix';
import {documentAssets} from '@/lib/assets';
import {documentHtml} from '@/lib/render-document';
import {
  exportFailure,
  guardExportRequest,
  PRIVATE_HEADERS,
  readExportJson,
} from '@/lib/procurement/exporters/api';
import {resolveCaseItemCoreDraft} from '@/lib/cases/core/bindings';
import {CaseFolderSchema} from '@/lib/cases/schema';
import {resolveLinkedSummariesForFolder} from '@/lib/cases/server-context';
import {validateCaseFolder} from '@/lib/cases/validator';

export const runtime = 'nodejs';

const PreviewRequestSchema = z.object({
  folder: CaseFolderSchema,
  itemId: z.string().min(1),
  highlightBlanks: z.boolean().default(true),
  copyNumber: z.number().int().min(1).max(10).default(1),
  preferBound: z.boolean().default(true),
});

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const input = PreviewRequestSchema.parse(await readExportJson(request));
    const item = input.folder.items.find(i => i.id === input.itemId);
    if (!item || item.kind !== 'GENERATED_DOC') {
      return Response.json(
        {error: 'ไม่พบเอกสารที่สร้างในระบบตามรหัสที่ระบุ'},
        {status: 404, headers: PRIVATE_HEADERS},
      );
    }

    const linkedSummaries = resolveLinkedSummariesForFolder(input.folder);
    const {draft, boundDraft} = resolveCaseItemCoreDraft(input.folder, item, {
      linkedSummaries,
      highlightBlanks: input.highlightBlanks,
      preferBound: input.preferBound,
    });

    const html = documentHtml(draft, documentAssets(), appendixSources(draft));
    const validationIssues = validateCaseFolder(input.folder, {linkedSummaries});

    return Response.json(
      {
        html,
        docType: item.docType,
        coreType: draft.type,
        title: draft.subject,
        validationIssues,
        linkedSummaries: Object.fromEntries(linkedSummaries.entries()),
        boundCoreDraft: boundDraft
          ? {id: boundDraft.id, version: boundDraft.version, type: boundDraft.type}
          : null,
      },
      {headers: PRIVATE_HEADERS},
    );
  } catch (e) {
    return exportFailure(e);
  }
}
