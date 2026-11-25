import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {readDraft} from '@/lib/db';
import {
  ALL_ARCHIVE_MODULES,
  archiveAllWorkspaces,
  archiveDocumentBytes,
  archiveInventoryFiscalYearNow,
  archiveProcurementCaseNow,
  getHandoverRoot,
  getHandoverStatus,
  setHandoverRoot,
  type ArchiveModuleKey,
} from '@/lib/handover-archive/archive-service';
import {resolveSafeChild} from '@/lib/handover-archive/fs-utils';
import {renderPdf} from '@/lib/pdf';
import {exportFailure, guardExportRequest, PRIVATE_HEADERS, readExportJson} from '@/lib/procurement/exporters/api';
import {renderWord} from '@/lib/word';

export const runtime = 'nodejs';

const ModuleEnum = z.enum(ALL_ARCHIVE_MODULES as unknown as [ArchiveModuleKey, ...ArchiveModuleKey[]]);

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('setRoot'),
    rootPath: z.string().max(400),
  }),
  z.object({
    action: z.literal('openFolder'),
    relativePath: z.string().max(300).optional(),
  }),
  z.object({
    action: z.literal('archiveProcurementCase'),
    caseId: z.string().min(1),
    includePdf: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('archiveInventoryYear'),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    includePdf: z.boolean().default(false),
    landscapeStockCard: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('archiveDocument'),
    documentId: z.string().uuid(),
    includePdf: z.boolean().default(false),
  }),
  z.object({
    action: z.literal('archiveAll'),
    fiscalYearBE: z.number().int().min(2400).max(2742).nullable().optional(),
    modules: z.array(ModuleEnum).optional(),
    includePdf: z.boolean().default(false),
  }),
]);

export async function GET() {
  try {
    await requireUser();
  } catch {
    return Response.json({error: 'กรุณาเข้าสู่ระบบใหม่'}, {status: 401, headers: PRIVATE_HEADERS});
  }
  try {
    return Response.json(getHandoverStatus(), {headers: PRIVATE_HEADERS});
  } catch (error) {
    return Response.json(
      {error: error instanceof Error ? error.message : 'โหลดสถานะโฟลเดอร์จัดเก็บไม่สำเร็จ'},
      {status: 500, headers: PRIVATE_HEADERS},
    );
  }
}

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const cmd = ActionSchema.parse(await readExportJson(request));

    switch (cmd.action) {
      case 'setRoot': {
        const root = setHandoverRoot(cmd.rootPath);
        return Response.json({ok: true, root, status: getHandoverStatus()}, {headers: PRIVATE_HEADERS});
      }

      case 'openFolder': {
        const host = (request.headers.get('host') || '').split(':')[0].toLowerCase();
        if (!['127.0.0.1', 'localhost', '[::1]'].includes(host)) {
          return Response.json(
            {error: 'การเปิดโฟลเดอร์อัตโนมัติรองรับเฉพาะการใช้งานบนเครื่องนี้เท่านั้น'},
            {status: 403, headers: PRIVATE_HEADERS},
          );
        }
        const root = getHandoverRoot();
        fs.mkdirSync(root, {recursive: true});
        const target = cmd.relativePath ? resolveSafeChild(root, cmd.relativePath) : root;
        fs.mkdirSync(target, {recursive: true});
        if (process.platform === 'win32') {
          const child = spawn('explorer.exe', [target], {detached: true, stdio: 'ignore', windowsHide: false});
          child.unref();
        }
        return Response.json({ok: true, folder: target}, {headers: PRIVATE_HEADERS});
      }

      case 'archiveProcurementCase': {
        const res = await archiveProcurementCaseNow(cmd.caseId, {
          includePdf: cmd.includePdf,
          allowExportWithErrors: true,
        });
        return Response.json(
          {
            ok: true,
            folder: res.folder,
            created: res.tally.created,
            updated: res.tally.updated,
            unchanged: res.tally.unchanged,
            archivedPrevious: res.tally.archivedPrevious,
            errors: res.tally.errors,
          },
          {headers: PRIVATE_HEADERS},
        );
      }

      case 'archiveInventoryYear': {
        const res = await archiveInventoryFiscalYearNow(cmd.fiscalYearBE, {
          includePdf: cmd.includePdf,
          landscapeStockCard: cmd.landscapeStockCard,
        });
        return Response.json(
          {
            ok: true,
            folder: res.folder,
            created: res.tally.created,
            updated: res.tally.updated,
            unchanged: res.tally.unchanged,
            archivedPrevious: res.tally.archivedPrevious,
            errors: res.tally.errors,
          },
          {headers: PRIVATE_HEADERS},
        );
      }

      case 'archiveDocument': {
        const draft = readDraft(cmd.documentId);
        const wordRes = archiveDocumentBytes(draft, 'docx', await renderWord(draft));
        let pdfUpdated = 0;
        if (cmd.includePdf) {
          const pdfRes = archiveDocumentBytes(draft, 'pdf', await renderPdf(draft));
          pdfUpdated = pdfRes.tally.created + pdfRes.tally.updated;
        }
        return Response.json(
          {
            ok: true,
            folder: wordRes.folder,
            created: wordRes.tally.created,
            updated: wordRes.tally.updated + pdfUpdated,
            unchanged: wordRes.tally.unchanged,
            archivedPrevious: wordRes.tally.archivedPrevious,
          },
          {headers: PRIVATE_HEADERS},
        );
      }

      case 'archiveAll': {
        const report = await archiveAllWorkspaces({
          fiscalYearBE: cmd.fiscalYearBE ?? null,
          modules: cmd.modules,
          includePdf: cmd.includePdf,
        });
        return Response.json({ok: true, report, status: getHandoverStatus()}, {headers: PRIVATE_HEADERS});
      }
    }
  } catch (error) {
    return exportFailure(error);
  }
}
