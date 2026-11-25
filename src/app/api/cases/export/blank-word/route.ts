import {z} from 'zod';
import {renderWord} from '@/lib/word';
import {
  contentDisposition,
  exportFailure,
  guardExportRequest,
  PRIVATE_HEADERS,
  readExportJson,
} from '@/lib/procurement/exporters/api';
import {resolveCaseItemCoreDraft} from '@/lib/cases/core/bindings';
import {buildBlankCaseCoreDraft} from '@/lib/cases/core/mapper';
import {
  CaseDocTypeSchema,
  CaseFolderSchema,
  MemoApprovalChainSchema,
} from '@/lib/cases/schema';
import {DOC_TYPE_THAI_NAMES, resolveCaseText} from '@/lib/cases/resolver';
import {renderRoadmapChecklistDocx} from '@/lib/cases/roadmap';
import {sanitizeCaseFileName} from '@/lib/cases/exporters/portable-archive';
import {
  resolveCaseDefaults,
  resolveLinkedSummariesForFolder,
} from '@/lib/cases/server-context';

export const runtime = 'nodejs';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const BlankWordRequestSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('blank').default('blank'),
    docType: CaseDocTypeSchema,
    title: z.string().optional(),
    approvalChain: MemoApprovalChainSchema.optional(),
    variant: z.enum(['INVITATION', 'CERTIFICATE']).optional(),
    fiscalYearBE: z.number().int().min(2400).max(2742).optional(),
    highlightBlanks: z.boolean().default(true),
  }),
  z.object({
    mode: z.literal('single_doc'),
    folder: CaseFolderSchema,
    itemId: z.string().min(1),
    highlightBlanks: z.boolean().default(true),
    copyNumber: z.number().int().min(1).max(10).default(1),
  }),
  z.object({
    mode: z.literal('roadmap'),
    folder: CaseFolderSchema,
  }),
]);

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const raw = (await readExportJson(request)) as Record<string, unknown>;
    const normalized = raw && typeof raw === 'object' && !('mode' in raw) ? {...raw, mode: 'blank'} : raw;
    const input = BlankWordRequestSchema.parse(normalized);

    if (input.mode === 'roadmap') {
      const linkedSummaries = resolveLinkedSummariesForFolder(input.folder);
      const docxBuf = await renderRoadmapChecklistDocx(input.folder, linkedSummaries);
      const fileName = `00_ลายแทง_${sanitizeCaseFileName(input.folder.name, 'roadmap')}.docx`;
      return new Response(new Uint8Array(docxBuf), {
        status: 200,
        headers: {
          ...PRIVATE_HEADERS,
          'Content-Type': DOCX_MIME,
          'Content-Disposition': contentDisposition(fileName),
        },
      });
    }

    if (input.mode === 'single_doc') {
      const item = input.folder.items.find(i => i.id === input.itemId);
      if (!item || item.kind !== 'GENERATED_DOC') {
        return Response.json({error: 'ไม่พบเอกสารที่ต้องการส่งออกเป็น Word'}, {status: 404, headers: PRIVATE_HEADERS});
      }
      const linkedSummaries = resolveLinkedSummariesForFolder(input.folder);
      const {draft} = resolveCaseItemCoreDraft(input.folder, item, {
        linkedSummaries,
        highlightBlanks: input.highlightBlanks,
        preferBound: true,
      });
      const docxBuf = await renderWord(draft, {highlightBlanks: input.highlightBlanks});
      const resolvedTitle =
        draft.subject ||
        resolveCaseText(input.folder, item.title, {
          highlightBlanks: false,
          linkedSummaries,
        }).text;
      const fileName = `${sanitizeCaseFileName(resolvedTitle, item.docType)}.docx`;
      return new Response(new Uint8Array(docxBuf), {
        status: 200,
        headers: {
          ...PRIVATE_HEADERS,
          'Content-Type': DOCX_MIME,
          'Content-Disposition': contentDisposition(fileName),
        },
      });
    }

    const defaults = resolveCaseDefaults();
    const blankDraft = buildBlankCaseCoreDraft(
      input.docType,
      defaults.agency,
      defaults.signatories,
      {
        highlightBlanks: input.highlightBlanks,
        variant: input.variant,
        fiscalYearBE: input.fiscalYearBE,
        title: input.title,
        approvalChain: input.approvalChain,
      },
    );
    const docxBuf = await renderWord(blankDraft, {highlightBlanks: input.highlightBlanks});
    const label = input.title?.trim() || `ฟอร์มเปล่า_${DOC_TYPE_THAI_NAMES[input.docType]}`;
    const fileName = `${sanitizeCaseFileName(label, 'blank-form')}.docx`;

    return new Response(new Uint8Array(docxBuf), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': DOCX_MIME,
        'Content-Disposition': contentDisposition(fileName),
      },
    });
  } catch (e) {
    return exportFailure(e);
  }
}
