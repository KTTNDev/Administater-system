import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {driveStatus} from '@/lib/drive';
import {
  exportFailure,
  guardExportRequest,
  limitedBody,
  PRIVATE_HEADERS,
  readExportJson,
} from '@/lib/procurement/exporters/api';
import {
  cloneCaseFolderSafely,
  instantiateCaseFolderFromBlueprint,
  saveAsBlueprint,
} from '@/lib/cases/blueprint';
import {CaseConflictError} from '@/lib/cases/repository';
import {CaseFolderSchema} from '@/lib/cases/schema';
import {
  loadCrossModuleContext,
  resolveCaseDefaults,
  resolveLinkedSummariesForFolder,
  saveCaseExternalFile,
  sqliteCaseRepository,
} from '@/lib/cases/server-context';
import type {LinkedModuleSummary} from '@/lib/cases/types';

export const runtime = 'nodejs';

function buildDomainPayload() {
  const record = sqliteCaseRepository.load();
  const defaults = resolveCaseDefaults();
  const cross = loadCrossModuleContext();
  const linkedSummariesByFolder: Record<string, Record<string, LinkedModuleSummary>> = {};

  for (const folder of record.data.folders) {
    const map = resolveLinkedSummariesForFolder(folder, cross.sources);
    linkedSummariesByFolder[folder.id] = Object.fromEntries(map.entries());
  }

  return {
    record,
    defaults,
    linkedSummariesByFolder,
    availableProcurement: cross.availableProcurement,
    availableRequisitions: cross.availableRequisitions,
    availableAssetLoans: cross.availableAssetLoans,
    drive: driveStatus(),
  };
}

export async function GET() {
  try {
    await requireUser();
  } catch {
    return Response.json({error: 'กรุณาเข้าสู่ระบบใหม่'}, {status: 401, headers: PRIVATE_HEADERS});
  }
  try {
    return Response.json(buildDomainPayload(), {headers: PRIVATE_HEADERS});
  } catch (e) {
    return Response.json(
      {error: e instanceof Error ? e.message : 'โหลดข้อมูลแฟ้มงานสารบรรณไม่สำเร็จ'},
      {status: 500, headers: PRIVATE_HEADERS},
    );
  }
}

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('upsertFolder'),
    expectedVersion: z.number().int().nonnegative().optional(),
    folder: CaseFolderSchema,
  }),
  z.object({
    action: z.literal('deleteFolder'),
    expectedVersion: z.number().int().nonnegative().optional(),
    folderId: z.string().min(1),
  }),
  z.object({
    action: z.literal('saveBlueprint'),
    expectedVersion: z.number().int().nonnegative().optional(),
    folderId: z.string().min(1),
    name: z.string().optional(),
    description: z.string().optional(),
    clearVariableValues: z.boolean().default(true),
  }),
  z.object({
    action: z.literal('deleteBlueprint'),
    expectedVersion: z.number().int().nonnegative().optional(),
    blueprintId: z.string().min(1),
  }),
  z.object({
    action: z.literal('instantiateBlueprint'),
    expectedVersion: z.number().int().nonnegative().optional(),
    blueprintId: z.string().min(1),
    name: z.string().trim().min(1),
    fiscalYearBE: z.number().int().min(2400).max(2742),
  }),
  z.object({
    action: z.literal('safeClone'),
    expectedVersion: z.number().int().nonnegative().optional(),
    folderId: z.string().min(1),
    name: z.string().optional(),
    fiscalYearBE: z.number().int().min(2400).max(2742).optional(),
  }),
  z.object({
    action: z.literal('reserveNumber'),
    track: z.enum([
      'INTERNAL_MEMO',
      'EXTERNAL_LETTER',
      'MUNICIPAL_ORDER',
      'ANNOUNCEMENT',
      'PURCHASE_ORDER',
    ]),
    yearBE: z.number().int().min(2400).max(2742),
    sourceId: z.string().optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);

    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const body = await limitedBody(request, 26 * 1024 * 1024);
      const form = await new Request(request.url, {
        method: 'POST',
        headers: {'Content-Type': contentType},
        body: new Uint8Array(body),
      }).formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return Response.json(
          {error: 'กรุณาเลือกไฟล์ PDF, Word (.docx) หรือรูปภาพ'},
          {status: 400, headers: PRIVATE_HEADERS},
        );
      }
      const saved = await saveCaseExternalFile(file);
      return Response.json(saved, {headers: PRIVATE_HEADERS});
    }

    const cmd = ActionSchema.parse(await readExportJson(request));

    if ('expectedVersion' in cmd && cmd.expectedVersion !== undefined) {
      const current = sqliteCaseRepository.load();
      if (current.version !== cmd.expectedVersion) {
        throw new CaseConflictError();
      }
    }

    let createdId: string | undefined;
    let reservedRunningNo: string | undefined;

    switch (cmd.action) {
      case 'upsertFolder': {
        const nextFolder = {...cmd.folder, updatedAt: new Date().toISOString()};
        sqliteCaseRepository.upsertFolder(nextFolder);
        createdId = nextFolder.id;
        break;
      }
      case 'deleteFolder': {
        sqliteCaseRepository.deleteFolder(cmd.folderId);
        break;
      }
      case 'saveBlueprint': {
        const current = sqliteCaseRepository.load();
        const folder = current.data.folders.find(f => f.id === cmd.folderId);
        if (!folder) throw new Error('ไม่พบแฟ้มงานต้นฉบับสำหรับบันทึกเป็นแม่แบบ');
        const bp = saveAsBlueprint(folder, {
          name: cmd.name,
          description: cmd.description,
          clearVariableValues: cmd.clearVariableValues,
        });
        sqliteCaseRepository.upsertBlueprint(bp);
        createdId = bp.id;
        break;
      }
      case 'deleteBlueprint': {
        sqliteCaseRepository.deleteBlueprint(cmd.blueprintId);
        break;
      }
      case 'instantiateBlueprint': {
        const current = sqliteCaseRepository.load();
        const bp = current.data.blueprints.find(b => b.id === cmd.blueprintId);
        if (!bp) throw new Error('ไม่พบแม่แบบแฟ้มงานที่เลือก');
        const defaults = resolveCaseDefaults();
        const created = instantiateCaseFolderFromBlueprint(
          bp,
          defaults.agency,
          defaults.signatories,
          {name: cmd.name, fiscalYearBE: cmd.fiscalYearBE},
        );
        sqliteCaseRepository.upsertFolder(created);
        createdId = created.id;
        break;
      }
      case 'safeClone': {
        const current = sqliteCaseRepository.load();
        const source = current.data.folders.find(f => f.id === cmd.folderId);
        if (!source) throw new Error('ไม่พบแฟ้มงานต้นฉบับสำหรับคัดลอก');
        const cloned = cloneCaseFolderSafely(source, {
          name: cmd.name,
          fiscalYearBE: cmd.fiscalYearBE,
        });
        sqliteCaseRepository.upsertFolder(cloned);
        createdId = cloned.id;
        break;
      }
      case 'reserveNumber': {
        const res = sqliteCaseRepository.reserveNextNumber(cmd.track, cmd.yearBE, cmd.sourceId);
        reservedRunningNo = res.runningNo;
        break;
      }
    }

    return Response.json(
      {...buildDomainPayload(), createdId, reservedRunningNo},
      {headers: PRIVATE_HEADERS},
    );
  } catch (e) {
    if (e instanceof CaseConflictError) {
      return Response.json({error: e.message}, {status: 409, headers: PRIVATE_HEADERS});
    }
    return exportFailure(e);
  }
}
