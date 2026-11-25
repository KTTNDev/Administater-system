import {computeProcurementCase} from '../procurement/calculations';
import {formatDocumentNumbers} from '../procurement/numbering';
import {validateProcurementCase} from '../procurement/validator';
import {cleanForExport, type StoredCase} from '../procurement/workspace/model';
import {ProcurementCaseInputSchema} from '../procurement/schema';
import type {InventoryDomainState} from '../inventory/types';
import type {CaseFolder, LinkedModuleRefItem, LinkedModuleSummary} from './types';

export interface CrossModuleSources {
  procurementCases?: ReadonlyArray<StoredCase>;
  inventoryState?: InventoryDomainState | null;
}

/**
 * Read-only bridge pulling live title, reference number, date, amount, and status
 * directly from Phase 1–4 Procurement cases and Phase 5–6 Inventory requisitions / asset loans
 * without duplicating data.
 */
export function resolveLinkedModuleItem(
  item: LinkedModuleRefItem,
  sources: CrossModuleSources,
): LinkedModuleSummary {
  if (item.targetModule === 'PROCUREMENT') {
    const record = sources.procurementCases?.find(c => c.caseInput.id === item.targetId);
    if (!record) {
      return {
        itemId: item.id,
        targetModule: item.targetModule,
        targetId: item.targetId,
        found: false,
        title: item.title,
        referenceNo: '',
        date: '',
        status: 'NOT_FOUND',
        isIncomplete: true,
        incompleteReasons: [`ไม่พบงานจัดซื้อจัดจ้างรหัส ${item.targetId}`],
        pdfAvailable: false,
      };
    }

    const cleaned = cleanForExport(record.caseInput);
    const parsed = ProcurementCaseInputSchema.safeParse(cleaned);
    if (!parsed.success) {
      return {
        itemId: item.id,
        targetModule: item.targetModule,
        targetId: item.targetId,
        found: true,
        title: record.caseInput.projectTitleShort || record.caseInput.budgetLine.categoryType || item.title,
        referenceNo: record.caseInput.docs.doc10_purchaseOrder.runningNo
          ? `${record.agency.codes.poPrefix} ${record.caseInput.docs.doc10_purchaseOrder.runningNo}/${record.caseInput.docs.doc10_purchaseOrder.fiscalYearBE ?? record.caseInput.budgetLine.fiscalYearBE}`
          : '',
        date:
          record.caseInput.docs.doc10_purchaseOrder.date ||
          record.caseInput.docs.doc1_approvePrinciple.date ||
          '',
        status: record.tracker?.status || 'DRAFTED',
        isIncomplete: true,
        incompleteReasons: ['ข้อมูลงานจัดซื้อจัดจ้างยังไม่ครบตามเกณฑ์ส่งออก'],
        pdfAvailable: false,
      };
    }

    const computed = computeProcurementCase(parsed.data);
    const numbers = formatDocumentNumbers(computed.docs, record.agency);
    const blockingErrors = validateProcurementCase(computed).filter(i => i.severity === 'ERROR');
    const trackerStatus = record.tracker?.status ?? 'DRAFTED';
    const incompleteReasons: string[] = [];
    if (blockingErrors.length > 0) {
      incompleteReasons.push(
        ...blockingErrors.map(err => `จัดซื้อจัดจ้าง: ${err.messageTh}`),
      );
    }
    if (trackerStatus === 'RESERVING_NUMBERS') {
      incompleteReasons.push('งานจัดซื้อจัดจ้างยังอยู่ในสถานะจองเลขสมุดคุม / รอข้อมูล');
    }

    return {
      itemId: item.id,
      targetModule: item.targetModule,
      targetId: item.targetId,
      found: true,
      title: `${computed.terms.action}${computed.projectTitle}`,
      referenceNo: numbers.doc10_purchaseOrder || numbers.doc1_approvePrinciple || '',
      date: computed.docs.doc10_purchaseOrder.date || computed.docs.doc1_approvePrinciple.date || '',
      totalAmount: computed.grandTotal,
      status: trackerStatus,
      isIncomplete: incompleteReasons.length > 0,
      incompleteReasons,
      pdfAvailable: blockingErrors.length === 0,
    };
  }

  if (item.targetModule === 'INVENTORY_REQUISITION') {
    const req = sources.inventoryState?.requisitions.find(r => r.id === item.targetId);
    if (!req) {
      return {
        itemId: item.id,
        targetModule: item.targetModule,
        targetId: item.targetId,
        found: false,
        title: item.title,
        referenceNo: '',
        date: '',
        status: 'NOT_FOUND',
        isIncomplete: true,
        incompleteReasons: [`ไม่พบใบเบิกวัสดุรหัส ${item.targetId}`],
        pdfAvailable: false,
      };
    }

    const incompleteReasons: string[] = [];
    if (req.status === 'PENDING_SIGNATURE') {
      incompleteReasons.push(`ใบเบิกวัสดุ ${req.requisitionRunningNo} ยังรอลายมือชื่อและยืนยันตัดสต็อก (PENDING_SIGNATURE)`);
    } else if (req.status === 'DRAFT') {
      incompleteReasons.push(`ใบเบิกวัสดุ ${req.requisitionRunningNo} ยังเป็นฉบับร่าง (DRAFT)`);
    } else if (req.status === 'CANCELLED') {
      incompleteReasons.push(`ใบเบิกวัสดุ ${req.requisitionRunningNo} ถูกยกเลิกแล้ว (CANCELLED)`);
    }

    const totalCost = req.lines.reduce(
      (sum, line) => sum + line.allocations.reduce((s, a) => s + a.lineAmount, 0),
      0,
    );

    return {
      itemId: item.id,
      targetModule: item.targetModule,
      targetId: item.targetId,
      found: true,
      title: `ใบเบิกวัสดุ (${req.requesterName}${req.purpose ? ` — ${req.purpose}` : ''})`,
      referenceNo: req.requisitionRunningNo,
      date: req.requestDate,
      totalAmount: Math.round(totalCost * 100) / 100,
      status: req.status,
      isIncomplete: incompleteReasons.length > 0,
      incompleteReasons,
      pdfAvailable: req.status === 'COMMITTED' || req.status === 'PENDING_SIGNATURE',
    };
  }

  // INVENTORY_ASSET_LOAN
  const loan = sources.inventoryState?.assetLoans.find(l => l.id === item.targetId);
  if (!loan) {
    return {
      itemId: item.id,
      targetModule: item.targetModule,
      targetId: item.targetId,
      found: false,
      title: item.title,
      referenceNo: '',
      date: '',
      status: 'NOT_FOUND',
      isIncomplete: true,
      incompleteReasons: [`ไม่พบใบยืมครุภัณฑ์รหัส ${item.targetId}`],
      pdfAvailable: false,
    };
  }

  const asset = sources.inventoryState?.assets.find(a => a.id === loan.assetId);
  const incompleteReasons: string[] = [];
  if (loan.status === 'PENDING_SIGNATURE') {
    incompleteReasons.push(`ใบยืมครุภัณฑ์ ${loan.loanRunningNo} ยังรอลายมือชื่อ (PENDING_SIGNATURE)`);
  } else if (loan.status === 'CANCELLED') {
    incompleteReasons.push(`ใบยืมครุภัณฑ์ ${loan.loanRunningNo} ถูกยกเลิกแล้ว (CANCELLED)`);
  }

  return {
    itemId: item.id,
    targetModule: item.targetModule,
    targetId: item.targetId,
    found: true,
    title: `ใบยืมครุภัณฑ์ (${asset?.name ?? loan.assetId} — ${loan.borrowerName})`,
    referenceNo: loan.loanRunningNo,
    date: loan.loanDate,
    totalAmount: asset?.acquisitionCost,
    status: loan.status,
    isIncomplete: incompleteReasons.length > 0,
    incompleteReasons,
    pdfAvailable: true,
  };
}

export function resolveAllLinkedModules(
  folder: CaseFolder,
  sources: CrossModuleSources,
): Map<string, LinkedModuleSummary> {
  const map = new Map<string, LinkedModuleSummary>();
  for (const item of folder.items) {
    if (item.kind !== 'LINKED_MODULE_REF') continue;
    map.set(item.id, resolveLinkedModuleItem(item, sources));
  }
  return map;
}
