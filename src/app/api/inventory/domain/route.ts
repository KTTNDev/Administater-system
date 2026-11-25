import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {createProcurementExternalAttachment} from '@/lib/attachments';
import {exportFailure, guardExportRequest, limitedBody, PRIVATE_HEADERS, readExportJson} from '@/lib/procurement/exporters/api';
import {ProcurementCaseInputSchema} from '@/lib/procurement/schema';
import {sqliteRepository as procurementRepo} from '@/lib/procurement/storage/sqlite';
import {cleanForExport} from '@/lib/procurement/workspace/model';
import {
  carryForwardFiscalYear,
  createRequisitionDraft,
  DuplicateProcurementImportError,
  InsufficientStockError,
  InvalidRequisitionTransitionError,
  recordStockIntake,
  transitionAssetLoanStatus,
  transitionRequisitionStatus,
} from '@/lib/inventory/fifo-engine';
import {importProcurementCaseToInventory} from '@/lib/inventory/procurement-bridge';
import {InventoryConflictError} from '@/lib/inventory/repository';
import {
  AssetConditionSchema,
  AssetItemSchema,
  AssetLoanSchema,
  CategoryCodeSchema,
  ISODateSchema,
  MaterialItemSchema,
  StockLotSourceTypeSchema,
} from '@/lib/inventory/schema';
import {
  listProcurementIntakeOptions,
  resolveInventoryContext,
  sqliteInventoryRepository,
} from '@/lib/inventory/server-context';

export const runtime = 'nodejs';

function buildPayload() {
  const record = sqliteInventoryRepository.load();
  const context = resolveInventoryContext();
  const procurementCases = listProcurementIntakeOptions(record.data);
  return {record, context, procurementCases};
}

export async function GET() {
  try {
    await requireUser();
  } catch {
    return Response.json({error: 'กรุณาเข้าสู่ระบบใหม่'}, {status: 401, headers: PRIVATE_HEADERS});
  }
  try {
    return Response.json(buildPayload(), {headers: PRIVATE_HEADERS});
  } catch (e) {
    return Response.json(
      {error: e instanceof Error ? e.message : 'โหลดข้อมูลคลังพัสดุไม่สำเร็จ'},
      {status: 500, headers: PRIVATE_HEADERS},
    );
  }
}

const ActionSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('intake'),
    expectedVersion: z.number().int().nonnegative(),
    materialId: z.string().optional(),
    newMaterial: z.object({
      code: z.string().default(''),
      name: z.string().trim().min(1),
      categoryCode: CategoryCodeSchema,
      categoryType: z.string().trim().min(1),
      specification: z.string().default(''),
      unit: z.string().trim().min(1),
      storageLocation: z.string().default('กองสวัสดิการสังคม'),
      maxStockQty: z.number().nonnegative().nullable().default(null),
      minStockQty: z.number().nonnegative().default(5),
    }).optional(),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    receivedDate: ISODateSchema,
    sourceType: StockLotSourceTypeSchema,
    sourceLabel: z.string().optional(),
    referenceDocNo: z.string().default(''),
    unitPrice: z.number().finite().nonnegative(),
    initialQty: z.number().finite().positive(),
  }),
  z.object({
    action: z.literal('importProcurement'),
    expectedVersion: z.number().int().nonnegative(),
    caseId: z.string().min(1),
  }),
  z.object({
    action: z.literal('createRequisition'),
    expectedVersion: z.number().int().nonnegative(),
    requisitionRunningNo: z.string().trim().min(1).optional(),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    requestDate: ISODateSchema,
    requesterName: z.string().trim().min(1),
    requesterPosition: z.string().trim().min(1),
    receiverName: z.string().optional(),
    purpose: z.string().optional(),
    submitImmediately: z.boolean().default(true),
    lines: z.array(z.object({
      materialId: z.string().min(1),
      requestedQty: z.number().finite().positive(),
      remarkOverride: z.string().optional(),
    })).min(1),
  }),
  z.object({
    action: z.literal('transitionRequisition'),
    expectedVersion: z.number().int().nonnegative(),
    requisitionId: z.string().min(1),
    transition: z.enum(['SUBMIT_FOR_SIGNATURE', 'COMMIT_AFTER_SIGNATURE', 'CANCEL']),
    committedDate: ISODateSchema.optional(),
    signedScanAttachmentPath: z.string().optional(),
  }),
  z.object({
    action: z.literal('saveAsset'),
    expectedVersion: z.number().int().nonnegative(),
    asset: z.object({
      id: z.string().optional(),
      assetCode: z.string().trim().min(1),
      name: z.string().trim().min(1),
      brandModel: z.string().default(''),
      acquiredDate: ISODateSchema,
      acquisitionCost: z.number().finite().nonnegative(),
      assignedLocation: z.string().default('กองสวัสดิการสังคม'),
      custodianName: z.string().trim().min(1),
      condition: AssetConditionSchema,
      note: z.string().default(''),
    }),
  }),
  z.object({
    action: z.literal('deleteAsset'),
    expectedVersion: z.number().int().nonnegative(),
    assetId: z.string().min(1),
  }),
  z.object({
    action: z.literal('createAssetLoan'),
    expectedVersion: z.number().int().nonnegative(),
    loanRunningNo: z.string().trim().min(1).optional(),
    fiscalYearBE: z.number().int().min(2400).max(2742),
    assetId: z.string().min(1),
    borrowerName: z.string().trim().min(1),
    borrowerPosition: z.string().trim().min(1),
    borrowerDepartment: z.string().trim().min(1),
    purpose: z.string().trim().min(1),
    loanDate: ISODateSchema,
    dueReturnDate: ISODateSchema,
    conditionBefore: z.string().default('ปกติ ใช้งานได้'),
    activateImmediately: z.boolean().default(true),
  }),
  z.object({
    action: z.literal('transitionAssetLoan'),
    expectedVersion: z.number().int().nonnegative(),
    loanId: z.string().min(1),
    transition: z.enum(['ACTIVATE', 'RETURN', 'CANCEL']),
    actualReturnDate: ISODateSchema.optional(),
    conditionAfter: z.string().optional(),
  }),
  z.object({
    action: z.literal('carryForward'),
    expectedVersion: z.number().int().nonnegative(),
    fromFiscalYearBE: z.number().int().min(2400).max(2741),
    toFiscalYearBE: z.number().int().min(2401).max(2742).optional(),
  }),
]);

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);

    // Multipart upload path for optional signed requisition scan PDF/image
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const body = await limitedBody(request, 25 * 1024 * 1024);
      const form = await new Request(request.url, {
        method: 'POST',
        headers: {'Content-Type': contentType},
        body: new Uint8Array(body),
      }).formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return Response.json({error: 'กรุณาเลือกไฟล์ PDF หรือรูปภาพ'}, {status: 400, headers: PRIVATE_HEADERS});
      }
      const saved = await createProcurementExternalAttachment(file);
      return Response.json(
        {attachmentId: saved.id, path: `/api/attachments/${saved.id}`, name: saved.name, pages: saved.pages},
        {headers: PRIVATE_HEADERS},
      );
    }

    const cmd = ActionSchema.parse(await readExportJson(request));
    const current = sqliteInventoryRepository.load();
    if (current.version !== cmd.expectedVersion) {
      throw new InventoryConflictError();
    }

    let nextData = current.data;
    let createdId: string | undefined;

    switch (cmd.action) {
      case 'intake': {
        let materialId = cmd.materialId;
        if (!materialId) {
          if (!cmd.newMaterial) throw new Error('กรุณาเลือกวัสดุเดิมหรือระบุข้อมูลวัสดุใหม่');
          const nextSeq = nextData.materials.reduce((m, item) => Math.max(m, item.ledgerSeqNo), 0) + 1;
          const created = MaterialItemSchema.parse({
            id: randomUUID(),
            ledgerSeqNo: nextSeq,
            ...cmd.newMaterial,
          });
          nextData = {...nextData, materials: [...nextData.materials, created]};
          materialId = created.id;
        }
        const res = recordStockIntake(nextData, {
          materialId,
          fiscalYearBE: cmd.fiscalYearBE,
          receivedDate: cmd.receivedDate,
          sourceType: cmd.sourceType,
          sourceLabel: cmd.sourceLabel,
          referenceDocNo: cmd.referenceDocNo,
          unitPrice: cmd.unitPrice,
          initialQty: cmd.initialQty,
        });
        nextData = res.state;
        createdId = res.lot.id;
        break;
      }
      case 'importProcurement': {
        const storedCase = procurementRepo.getCase(cmd.caseId);
        if (!storedCase) throw new Error('ไม่พบงานจัดซื้อจัดจ้างที่เลือก');
        const input = ProcurementCaseInputSchema.parse(cleanForExport(storedCase.caseInput));
        const imported = importProcurementCaseToInventory(nextData, input, storedCase.agency);
        nextData = imported.state;
        createdId = imported.createdLots[0]?.id;
        break;
      }
      case 'createRequisition': {
        const sameYearCount = nextData.requisitions.filter(r => r.fiscalYearBE === cmd.fiscalYearBE).length;
        const runningNo = cmd.requisitionRunningNo || String(sameYearCount + 1).padStart(2, '0');
        const draftRes = createRequisitionDraft(nextData, {
          requisitionRunningNo: runningNo,
          fiscalYearBE: cmd.fiscalYearBE,
          requestDate: cmd.requestDate,
          requesterName: cmd.requesterName,
          requesterPosition: cmd.requesterPosition,
          receiverName: cmd.receiverName,
          purpose: cmd.purpose,
          lines: cmd.lines,
        });
        nextData = draftRes.state;
        createdId = draftRes.requisition.id;
        if (cmd.submitImmediately) {
          nextData = transitionRequisitionStatus(nextData, draftRes.requisition.id, 'SUBMIT_FOR_SIGNATURE').state;
        }
        break;
      }
      case 'transitionRequisition': {
        nextData = transitionRequisitionStatus(nextData, cmd.requisitionId, cmd.transition, {
          committedDate: cmd.committedDate,
          signedScanAttachmentPath: cmd.signedScanAttachmentPath,
        }).state;
        createdId = cmd.requisitionId;
        break;
      }
      case 'saveAsset': {
        const existingIdx = cmd.asset.id ? nextData.assets.findIndex(a => a.id === cmd.asset.id) : -1;
        const asset = AssetItemSchema.parse({...cmd.asset, id: cmd.asset.id || randomUUID()});
        if (nextData.assets.some(a => a.assetCode === asset.assetCode && a.id !== asset.id)) {
          throw new Error(`เลขครุภัณฑ์ ${asset.assetCode} มีอยู่ในทะเบียนแล้ว`);
        }
        nextData = {
          ...nextData,
          assets: existingIdx >= 0
            ? nextData.assets.map((a, idx) => (idx === existingIdx ? asset : a))
            : [...nextData.assets, asset],
        };
        createdId = asset.id;
        break;
      }
      case 'deleteAsset': {
        if (nextData.assetLoans.some(l => l.assetId === cmd.assetId && l.status === 'ACTIVE_LOAN')) {
          throw new Error('ไม่สามารถลบครุภัณฑ์ที่อยู่ระหว่างการยืมได้ กรุณารับคืนก่อน');
        }
        nextData = {...nextData, assets: nextData.assets.filter(a => a.id !== cmd.assetId)};
        break;
      }
      case 'createAssetLoan': {
        if (!nextData.assets.some(a => a.id === cmd.assetId)) {
          throw new Error('ไม่พบครุภัณฑ์ที่ต้องการยืม');
        }
        const sameYearCount = nextData.assetLoans.filter(l => l.fiscalYearBE === cmd.fiscalYearBE).length;
        const runningNo = cmd.loanRunningNo || String(sameYearCount + 1).padStart(2, '0');
        const loan = AssetLoanSchema.parse({
          id: randomUUID(),
          loanRunningNo: runningNo,
          fiscalYearBE: cmd.fiscalYearBE,
          assetId: cmd.assetId,
          borrowerName: cmd.borrowerName,
          borrowerPosition: cmd.borrowerPosition,
          borrowerDepartment: cmd.borrowerDepartment,
          purpose: cmd.purpose,
          loanDate: cmd.loanDate,
          dueReturnDate: cmd.dueReturnDate,
          conditionBefore: cmd.conditionBefore,
          status: 'PENDING_SIGNATURE',
        });
        nextData = {...nextData, assetLoans: [...nextData.assetLoans, loan]};
        createdId = loan.id;
        if (cmd.activateImmediately) {
          nextData = transitionAssetLoanStatus(nextData, loan.id, 'ACTIVATE').state;
        }
        break;
      }
      case 'transitionAssetLoan': {
        nextData = transitionAssetLoanStatus(nextData, cmd.loanId, cmd.transition, {
          actualReturnDate: cmd.actualReturnDate,
          conditionAfter: cmd.conditionAfter,
        }).state;
        createdId = cmd.loanId;
        break;
      }
      case 'carryForward': {
        const res = carryForwardFiscalYear(nextData, cmd.fromFiscalYearBE, cmd.toFiscalYearBE ?? cmd.fromFiscalYearBE + 1);
        nextData = res.state;
        break;
      }
    }

    sqliteInventoryRepository.save({...current, data: nextData});
    return Response.json({...buildPayload(), createdId}, {headers: PRIVATE_HEADERS});
  } catch (e) {
    if (e instanceof InventoryConflictError) {
      return Response.json({error: e.message}, {status: 409, headers: PRIVATE_HEADERS});
    }
    if (
      e instanceof InsufficientStockError ||
      e instanceof InvalidRequisitionTransitionError ||
      e instanceof DuplicateProcurementImportError
    ) {
      return Response.json({error: e.message}, {status: 400, headers: PRIVATE_HEADERS});
    }
    return exportFailure(e);
  }
}
