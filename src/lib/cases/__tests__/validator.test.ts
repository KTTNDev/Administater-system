import {describe, expect, it} from 'vitest';
import {defaultAgency} from '../../procurement/presets/default-agency';
import type {SignatoryChain} from '../../procurement/types';
import {validateCaseFolder, type CaseFolder, type LinkedModuleSummary} from '../index';

const signatories: SignatoryChain = {
  procurementOfficer: {id: 's1', fullName: 'นายกิตตินันท์ พลรบ', position: 'เจ้าพนักงานธุรการปฏิบัติงาน'},
  divisionDirector: {id: 's2', fullName: 'นางสาวผู้อำนวยการ', position: 'ผู้อำนวยการกองสวัสดิการสังคม'},
  municipalClerk: {id: 's3', fullName: 'นายปลัด', position: 'ปลัดเทศบาลตำบลฉลอง'},
  mayor: {id: 's4', fullName: 'นายกเทศมนตรี', position: 'นายกเทศมนตรีตำบลฉลอง'},
};

function baseFolder(): CaseFolder {
  return {
    id: 'f-val',
    name: 'แฟ้มทดสอบตรวจความถูกต้อง',
    fiscalYearBE: 2570,
    category: 'งานบริหารทั่วไป',
    status: 'IN_PROGRESS',
    description: '',
    agency: structuredClone(defaultAgency),
    signatories,
    variables: [],
    stages: [
      {id: 'st-1', name: 'รอบ 1', order: 0},
      {id: 'st-2', name: 'รอบ 2', order: 1},
    ],
    items: [
      {
        id: 'doc-a',
        order: 0,
        stageId: 'st-1',
        kind: 'GENERATED_DOC',
        docType: 'INTERNAL_MEMO',
        track: 'INTERNAL_MEMO',
        title: 'ขออนุมัติหลักการ',
        runningNo: '1510',
        date: '2026-11-18',
        copies: 1,
        payload: {
          docType: 'INTERNAL_MEMO',
          recipient: 'นายกเทศมนตรี',
          useStructuredSections: false,
          sections: {background: '', facts: '', legalBasis: '', proposal: ''},
          bodyParagraphs: ['เนื้อหาเอกสาร A'],
          tables: [],
          closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
          approvalChain: '2_TIER',
        },
      },
      {
        id: 'doc-b',
        order: 1,
        stageId: 'st-2',
        kind: 'GENERATED_DOC',
        docType: 'INTERNAL_MEMO',
        track: 'INTERNAL_MEMO',
        title: 'รายงานผลการดำเนินงาน',
        runningNo: '1512',
        date: '2026-11-19',
        copies: 1,
        payload: {
          docType: 'INTERNAL_MEMO',
          recipient: 'นายกเทศมนตรี',
          useStructuredSections: false,
          sections: {background: '', facts: '', legalBasis: '', proposal: ''},
          bodyParagraphs: ['อ้างถึง {{ref:doc-a:full}}'],
          tables: [],
          closing: 'จึงเรียนมาเพื่อโปรดทราบ',
          approvalChain: '2_TIER',
        },
      },
    ],
    createdAt: '2026-11-18T00:00:00Z',
    updatedAt: '2026-11-18T00:00:00Z',
  };
}

describe('Phase 7 CaseFolder roadmap validation rules', () => {
  it('passes cleanly when dates, references, working days, and 5-track numbers are valid', () => {
    const issues = validateCaseFolder(baseFolder());
    expect(issues).toEqual([]);
  });

  it('triggers REF_CHRONOLOGY_ERROR when Doc B cites Doc A but predates Doc A', () => {
    const folder = baseFolder();
    if (folder.items[1].kind === 'GENERATED_DOC') {
      folder.items[1].date = '2026-11-17'; // before doc-a (2026-11-18)
    }
    const issues = validateCaseFolder(folder);
    const err = issues.find(i => i.code === 'REF_CHRONOLOGY_ERROR');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('ERROR');
    expect(err?.itemIds).toEqual(['doc-a', 'doc-b']);
    expect(err?.suggestedFix).toBe('2026-11-18');
  });

  it('triggers SAME_TRACK_NUMBER_ORDER when a later doc on the same track has a duplicate or smaller number', () => {
    const folder = baseFolder();
    if (folder.items[1].kind === 'GENERATED_DOC') {
      folder.items[1].runningNo = '1510'; // duplicate of doc-a
    }
    const issues = validateCaseFolder(folder);
    const err = issues.find(i => i.code === 'SAME_TRACK_NUMBER_ORDER');
    expect(err).toBeDefined();
    expect(err?.severity).toBe('ERROR');
  });

  it('triggers DATE_ON_HOLIDAY with next working day suggestion for weekends and Thai public holidays', () => {
    const folder = baseFolder();
    if (folder.items[0].kind === 'GENERATED_DOC') {
      folder.items[0].date = '2026-11-21'; // Saturday
    }
    if (folder.items[1].kind === 'GENERATED_DOC') {
      folder.items[1].date = '2026-12-05'; // Father's Day / Saturday
    }
    const issues = validateCaseFolder(folder);
    const holidays = issues.filter(i => i.code === 'DATE_ON_HOLIDAY');
    expect(holidays).toHaveLength(2);
    expect(holidays[0].suggestedFix).toBe('2026-11-23');
  });

  it('warns on UNRESOLVED_REFERENCE and LINKED_MODULE_INCOMPLETE', () => {
    const folder = baseFolder();
    if (folder.items[1].kind === 'GENERATED_DOC' && folder.items[1].payload.docType === 'INTERNAL_MEMO') {
      folder.items[1].payload.bodyParagraphs.push('อ้างถึง {{ref:deleted-doc:full}}');
    }
    folder.items.push({
      id: 'link-inv',
      order: 2,
      stageId: 'st-2',
      kind: 'LINKED_MODULE_REF',
      title: 'ใบเบิกวัสดุประกอบโครงการ',
      targetModule: 'INVENTORY_REQUISITION',
      targetId: 'req-001',
      includePdfInBinder: true,
      copies: 1,
    });

    const summaries = new Map<string, LinkedModuleSummary>([
      [
        'link-inv',
        {
          itemId: 'link-inv',
          targetModule: 'INVENTORY_REQUISITION',
          targetId: 'req-001',
          found: true,
          title: 'ใบเบิกวัสดุ',
          referenceNo: 'บว. 01/2570',
          date: '2026-11-20',
          totalAmount: 1200,
          status: 'PENDING_SIGNATURE',
          isIncomplete: true,
          incompleteReasons: ['ใบเบิกวัสดุ บว. 01/2570 ยังรอลายมือชื่อ (PENDING_SIGNATURE)'],
          pdfAvailable: true,
        },
      ],
    ]);

    const issues = validateCaseFolder(folder, {linkedSummaries: summaries});
    expect(issues.some(i => i.code === 'UNRESOLVED_REFERENCE')).toBe(true);
    expect(issues.some(i => i.code === 'LINKED_MODULE_INCOMPLETE')).toBe(true);
  });
});
