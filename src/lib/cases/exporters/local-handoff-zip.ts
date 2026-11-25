import 'server-only';
import JSZip from 'jszip';
import {withWordRenderer} from '../../word';
import {resolveCaseItemCoreDraft} from '../core/bindings';
import {buildCaseRoadmap, buildRoadmapChecklistText, renderRoadmapChecklistDocx} from '../roadmap';
import {resolveCaseText} from '../resolver';
import {computeProcurementCase} from '../../procurement/calculations';
import {packageDocxZip} from '../../procurement/exporters/docx/zip-packager';
import {defaultAgency} from '../../procurement/presets/default-agency';
import type {AgencyConfig, ProcurementCaseInput} from '../../procurement/types';
import {buildInv01RequisitionForm, buildInv03AssetLoanForm} from '../../inventory/templates/build-forms';
import {renderInventoryDocx} from '../../inventory/templates/docx/render-inv-docx';
import type {InventoryDomainState} from '../../inventory/types';
import type {CaseFolder, LinkedModuleSummary} from '../types';
import {sanitizeCaseFileName} from './portable-archive';

export interface LocalHandoffZipOptions {
  highlightBlanks?: boolean;
  includeRoadmapFiles?: boolean;
  includeAttachmentsAndLinked?: boolean;
  preferBoundCore?: boolean;
  stageId?: string;
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>;
  procurementCases?: readonly ProcurementCaseInput[];
  procurementAgencies?: ReadonlyMap<string, AgencyConfig>;
  inventoryState?: InventoryDomainState;
  resolveStoredFile?: (ref: string | undefined) => {
    originalName: string;
    bytes: Buffer;
    fileType: 'PDF' | 'DOCX' | 'IMAGE';
  } | null;
}

export interface LocalHandoffZipResult {
  zipBytes: Buffer;
  fileName: string;
  fileList: string[];
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export async function buildLocalHandoffZip(
  folder: CaseFolder,
  options: LocalHandoffZipOptions = {},
): Promise<LocalHandoffZipResult> {
  const highlightBlanks = options.highlightBlanks ?? true;
  const includeRoadmapFiles = options.includeRoadmapFiles ?? true;
  const includeAttachmentsAndLinked = options.includeAttachmentsAndLinked ?? true;
  const preferBoundCore = options.preferBoundCore ?? true;
  const linkedSummaries = options.linkedSummaries;

  const zip = new JSZip();
  const fileList: string[] = [];

  const filteredFolder: CaseFolder = options.stageId
    ? {
        ...folder,
        stages: folder.stages.filter(s => s.id === options.stageId),
        items: folder.items.filter(i => i.stageId === options.stageId),
      }
    : folder;

  const roadmapRows = buildCaseRoadmap(filteredFolder, linkedSummaries);

  if (includeRoadmapFiles) {
    const roadmapDocx = await renderRoadmapChecklistDocx(filteredFolder, linkedSummaries);
    const roadmapTxt = buildRoadmapChecklistText(filteredFolder, linkedSummaries);
    zip.file('00_ลายแทงและเช็กลิสต์แฟ้มงาน.docx', roadmapDocx);
    zip.file('00_ลายแทงและเช็กลิสต์แฟ้มงาน.txt', Buffer.from(roadmapTxt, 'utf8'));
    fileList.push('00_ลายแทงและเช็กลิสต์แฟ้มงาน.docx', '00_ลายแทงและเช็กลิสต์แฟ้มงาน.txt');
  }

  const stageOrderIndex = new Map<string, number>();
  [...filteredFolder.stages]
    .sort((a, b) => a.order - b.order)
    .forEach((stage, idx) => stageOrderIndex.set(stage.id, idx + 1));

  const itemById = new Map(filteredFolder.items.map(i => [i.id, i]));
  const procById = new Map((options.procurementCases ?? []).map(p => [p.id, p]));

  await withWordRenderer(async renderCoreWord => {
    for (const row of roadmapRows) {
      const item = itemById.get(row.itemId);
      if (!item) continue;

      const stageIdx = stageOrderIndex.get(row.stageId) ?? 1;
      const stageFolder = `${pad2(stageIdx)}_${sanitizeCaseFileName(row.stageName, `stage-${stageIdx}`).slice(0, 48)}`;
      const seqPrefix = pad2(row.sequence);

      if (item.kind === 'GENERATED_DOC') {
        const {draft} = resolveCaseItemCoreDraft(folder, item, {
          linkedSummaries,
          highlightBlanks,
          preferBound: preferBoundCore,
        });
        const resolvedTitle =
          draft.subject ||
          resolveCaseText(folder, item.title, {
            highlightBlanks: false,
            linkedSummaries,
          }).text;
        const baseName = `${seqPrefix}_${sanitizeCaseFileName(resolvedTitle, item.docType).slice(0, 64)}`;
        const docxBuffer = await renderCoreWord(draft, {highlightBlanks});
        const entryPath = `${stageFolder}/${baseName}.docx`;
        zip.file(entryPath, docxBuffer);
        fileList.push(entryPath);

        if (includeAttachmentsAndLinked && item.externalOverride) {
          const stored = options.resolveStoredFile?.(item.externalOverride.storedPath);
          if (stored) {
            const overrideName = `${seqPrefix}_${sanitizeCaseFileName(
              item.externalOverride.fileName || stored.originalName,
              'override',
            )}`;
            const overridePath = `90_ฉบับแก้ไขภายนอก/${overrideName}`;
            zip.file(overridePath, stored.bytes);
            fileList.push(overridePath);
          }
        }
        continue;
      }

      if (item.kind === 'EXTERNAL_FILE_SLOT') {
        if (includeAttachmentsAndLinked && item.uploadedFilePath) {
          const stored = options.resolveStoredFile?.(item.uploadedFilePath);
          if (stored) {
            const fileName = `${seqPrefix}_${sanitizeCaseFileName(
              item.uploadedFileName || stored.originalName,
              'attachment',
            )}`;
            const attachPath = `91_ไฟล์แนบภายนอก/${fileName}`;
            zip.file(attachPath, stored.bytes);
            fileList.push(attachPath);
          }
        }
        continue;
      }

      if (item.kind === 'LINKED_MODULE_REF' && includeAttachmentsAndLinked) {
        if (item.targetModule === 'PROCUREMENT') {
          const proc = procById.get(item.targetId);
          if (proc) {
            try {
              const computed = computeProcurementCase(proc);
              const agency =
                options.procurementAgencies?.get(proc.id) ?? folder.agency ?? defaultAgency;
              const procZip = await packageDocxZip(computed, agency);
              const linkedPath = `92_เอกสารจากระบบที่ผูกไว้/${seqPrefix}_จัดซื้อจัดจ้าง_${sanitizeCaseFileName(
                proc.projectTitleShort || proc.id,
                'procurement',
              ).slice(0, 50)}.zip`;
              zip.file(linkedPath, procZip);
              fileList.push(linkedPath);
            } catch {
              // Skip incomplete procurement package gracefully
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
              const buf = await renderInventoryDocx(form);
              const linkedPath = `92_เอกสารจากระบบที่ผูกไว้/${seqPrefix}_ใบเบิกพัสดุ_${sanitizeCaseFileName(
                req.requisitionRunningNo || req.id,
                'req',
              )}.docx`;
              zip.file(linkedPath, buf);
              fileList.push(linkedPath);
            } catch {
              // Skip gracefully
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
              const buf = await renderInventoryDocx(form);
              const linkedPath = `92_เอกสารจากระบบที่ผูกไว้/${seqPrefix}_ใบยืมครุภัณฑ์_${sanitizeCaseFileName(
                loan.loanRunningNo || loan.id,
                'loan',
              )}.docx`;
              zip.file(linkedPath, buf);
              fileList.push(linkedPath);
            } catch {
              // Skip gracefully
            }
          }
        }
      }
    }
  });

  const zipBytes = await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});
  const fileName = `${sanitizeCaseFileName(folder.name, 'case-handoff')}_ชุดส่งต่อWord.zip`;
  return {zipBytes, fileName, fileList};
}
