import {describe, expect, it} from 'vitest';
import JSZip from 'jszip';
import {defaultAgency} from '../../procurement/presets/default-agency';
import {sampleCase} from '../../procurement/workspace/samples';
import {
  createEmptyInventoryState,
  createRequisitionDraft,
  recordStockIntake,
  transitionRequisitionStatus,
} from '../../inventory/fifo-engine';
import {
  buildCaseRoadmap,
  buildRoadmapChecklistText,
  CaseConflictError,
  createMemoryCaseRepository,
  renderRoadmapChecklistDocx,
  resolveAllLinkedModules,
  resolveCaseText,
  validateCaseFolder,
  type CaseFolder,
} from '../index';

describe('Phase 7 cross-module linker (Procurement + Inventory FIFO) & repository', () => {
  it('links Phase 1 Procurement cases (Set 1 & Set 2) and a Phase 5 Inventory requisition into live roadmap rows', async () => {
    const procSet1 = sampleCase(1520);
    const procSet2 = sampleCase(22890);

    // Build a real Phase 5 Inventory state with 1 requisition
    let inv = createEmptyInventoryState();
    const materialId = 'mat-a4-001';
    inv = {
      ...inv,
      materials: [
        {
          id: materialId,
          ledgerSeqNo: 1,
          code: 'MAT-001',
          name: 'กระดาษถ่ายเอกสาร A4 80 แกรม',
          categoryCode: 'OFFICE',
          categoryType: 'วัสดุสำนักงาน',
          specification: '80 แกรม',
          unit: 'รีม',
          storageLocation: 'ห้องพัสดุ',
          maxStockQty: 100,
          minStockQty: 5,
        },
      ],
    };
    inv = recordStockIntake(inv, {
      materialId,
      receivedDate: '2026-10-05',
      initialQty: 20,
      unitPrice: 120,
      sourceType: 'OPENING_BALANCE',
      referenceDocNo: 'ยกยอดต้นปี',
      fiscalYearBE: 2570,
    }).state;
    const draftRes = createRequisitionDraft(inv, {
      fiscalYearBE: 2570,
      requisitionRunningNo: 'บว. 02/2570',
      requestDate: '2026-11-18',
      requesterName: 'นางสาวณกัญญา ดีเบา',
      requesterPosition: 'นักพัฒนาชุมชน',
      purpose: 'ใช้จัดทำเอกสารอบรมผู้สูงอายุ',
      lines: [{materialId, requestedQty: 5}],
    });
    inv = transitionRequisitionStatus(
      draftRes.state,
      draftRes.requisition.id,
      'SUBMIT_FOR_SIGNATURE',
    ).state;
    const requisition = draftRes.requisition;

    const folder: CaseFolder = {
      id: 'case-cross-1',
      name: 'โครงการจัดอบรมและจัดหาวัสดุ ประจำปี 2570',
      fiscalYearBE: 2570,
      category: 'โครงการพัฒนาสังคม',
      status: 'IN_PROGRESS',
      description: '',
      agency: structuredClone(defaultAgency),
      signatories: structuredClone(procSet1.caseInput.signatories),
      variables: [],
      stages: [
        {id: 'st-1', name: 'รอบที่ 1 จัดซื้อจัดจ้าง', order: 0},
        {id: 'st-2', name: 'รอบที่ 2 เบิกจ่ายวัสดุ', order: 1},
      ],
      items: [
        {
          id: 'link-proc-1',
          order: 0,
          stageId: 'st-1',
          kind: 'LINKED_MODULE_REF',
          title: 'จัดซื้อวัสดุสำนักงานชุดที่ 1',
          targetModule: 'PROCUREMENT',
          targetId: procSet1.caseInput.id,
          includePdfInBinder: true,
          copies: 1,
        },
        {
          id: 'link-proc-2',
          order: 1,
          stageId: 'st-1',
          kind: 'LINKED_MODULE_REF',
          title: 'จัดซื้อวัสดุสำนักงานชุดที่ 2 (e-GP)',
          targetModule: 'PROCUREMENT',
          targetId: procSet2.caseInput.id,
          includePdfInBinder: true,
          copies: 1,
        },
        {
          id: 'link-inv-1',
          order: 0,
          stageId: 'st-2',
          kind: 'LINKED_MODULE_REF',
          title: 'เบิกกระดาษ A4 ประกอบโครงการ',
          targetModule: 'INVENTORY_REQUISITION',
          targetId: requisition.id,
          includePdfInBinder: true,
          copies: 1,
        },
      ],
      createdAt: '2026-11-12T00:00:00Z',
      updatedAt: '2026-11-12T00:00:00Z',
    };

    const linkedBefore = resolveAllLinkedModules(folder, {
      procurementCases: [procSet1, procSet2],
      inventoryState: inv,
    });

    const rowsBefore = buildCaseRoadmap(folder, linkedBefore);
    expect(rowsBefore).toHaveLength(3);
    expect(rowsBefore[0].referenceNo).toBe('สว ๑๓/๒๕๗๐');
    expect(rowsBefore[0].totalAmount).toBe(1520);
    expect(rowsBefore[1].totalAmount).toBe(22890);
    expect(rowsBefore[2].referenceNo).toBe('บว. ๐๒/๒๕๗๐');
    expect(rowsBefore[2].statusBadge).toContain('PENDING_SIGNATURE');

    // Cross-reference citation pointing to the linked Procurement item works live
    const cited = resolveCaseText(folder, 'ตาม {{ref:link-proc-1:full}}', {linkedSummaries: linkedBefore});
    expect(cited.text).toContain('สว ๑๓/๒๕๗๐');

    // Validator alerts on PENDING_SIGNATURE inventory requisition
    const issuesBefore = validateCaseFolder(folder, {linkedSummaries: linkedBefore});
    expect(issuesBefore.some(i => i.code === 'LINKED_MODULE_INCOMPLETE' && i.itemIds.includes('link-inv-1'))).toBe(true);

    // Commit signature in Inventory & update PO number in Procurement -> roadmap updates live without copying!
    inv = transitionRequisitionStatus(inv, requisition.id, 'COMMIT_AFTER_SIGNATURE', {
      committedDate: '2026-11-19',
    }).state;
    procSet1.caseInput.docs.doc10_purchaseOrder.runningNo = '18';

    const linkedAfter = resolveAllLinkedModules(folder, {
      procurementCases: [procSet1, procSet2],
      inventoryState: inv,
    });
    const rowsAfter = buildCaseRoadmap(folder, linkedAfter);
    expect(rowsAfter[0].referenceNo).toBe('สว ๑๘/๒๕๗๐');
    expect(rowsAfter[2].statusBadge).toContain('COMMITTED');
    expect(rowsAfter[2].totalAmount).toBe(600);

    const checklistText = buildRoadmapChecklistText(folder, linkedAfter);
    expect(checklistText).toContain('สว ๑๘/๒๕๗๐');
    expect(checklistText).toContain('บว. ๐๒/๒๕๗๐');

    const checklistDocx = await renderRoadmapChecklistDocx(folder, linkedAfter);
    const zip = await JSZip.loadAsync(checklistDocx);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('ใบปะหน้าลายแทงเรียงแฟ้มงานสารบรรณ');
    expect(xml).toContain('w:tblHeader');
    expect(xml).not.toContain('txbxContent');
  });

  it('persists folders/blueprints with optimistic versioning and reserves shared 5-track numbers monotonically', () => {
    const repo = createMemoryCaseRepository();
    const loaded = repo.load();
    expect(loaded.version).toBe(0);

    const r1 = repo.reserveNextNumber('INTERNAL_MEMO', 2570, 'doc-1');
    const r2 = repo.reserveNextNumber('INTERNAL_MEMO', 2570, 'doc-2');
    const rOrder = repo.reserveNextNumber('MUNICIPAL_ORDER', 2570, 'ord-1');
    expect(r1.runningNo).toBe('1');
    expect(r2.runningNo).toBe('2');
    expect(rOrder.runningNo).toBe('1');

    // Stale version write is rejected with CaseConflictError
    expect(() => repo.save({...loaded, version: 0})).toThrow(CaseConflictError);
  });
});
