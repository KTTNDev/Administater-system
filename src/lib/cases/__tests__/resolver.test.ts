import {describe, expect, it} from 'vitest';
import {defaultAgency} from '../../procurement/presets/default-agency';
import type {SignatoryChain} from '../../procurement/types';
import {
  buildCaseDocumentIR,
  cloneCaseFolderSafely,
  instantiateCaseFolderFromBlueprint,
  resolveCaseText,
  saveAsBlueprint,
  type CaseFolder,
  type GeneratedDocItem,
} from '../index';

const signatories: SignatoryChain = {
  procurementOfficer: {id: 's1', fullName: 'นายกิตตินันท์ พลรบ', position: 'เจ้าพนักงานธุรการปฏิบัติงาน'},
  divisionDirector: {id: 's2', fullName: 'นางสาวผู้อำนวยการ กองสวัสดิการ', position: 'ผู้อำนวยการกองสวัสดิการสังคม'},
  municipalClerk: {id: 's3', fullName: 'นายปลัด เทศบาล', position: 'ปลัดเทศบาลตำบลฉลอง'},
  mayor: {id: 's4', fullName: 'นายกเทศมนตรี ตำบลฉลอง', position: 'นายกเทศมนตรีตำบลฉลอง'},
};

function makeSampleFolder(): CaseFolder {
  const doc1: GeneratedDocItem = {
    id: 'doc-01',
    order: 0,
    stageId: 'st-1',
    kind: 'GENERATED_DOC',
    docType: 'INTERNAL_MEMO',
    track: 'INTERNAL_MEMO',
    title: 'ขออนุมัติ{{var.projectName}}',
    runningNo: '1510',
    date: '2026-12-03',
    copies: 1,
    payload: {
      docType: 'INTERNAL_MEMO',
      recipient: 'นายกเทศมนตรีตำบลฉลอง',
      useStructuredSections: true,
      sections: {
        background: 'ด้วยกองสวัสดิการสังคมจะจัด{{var.projectName}} ในวันที่ {{var.eventDate}} ณ {{var.eventLocation}} วงเงิน {{var.budgetAmount}} บาท',
        facts: 'มีกลุ่มเป้าหมายคือ {{var.targetGroup}}',
        legalBasis: '',
        proposal: 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
      },
      bodyParagraphs: [],
      tables: [],
      closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
      approvalChain: '3_TIER',
    },
  };

  const doc2: GeneratedDocItem = {
    id: 'doc-02',
    order: 1,
    stageId: 'st-2',
    kind: 'GENERATED_DOC',
    docType: 'EXTERNAL_LETTER',
    track: 'EXTERNAL_LETTER',
    title: 'ขอเชิญเข้าร่วม{{var.projectName}}',
    runningNo: '4601',
    date: '2026-12-04',
    copies: 1,
    payload: {
      docType: 'EXTERNAL_LETTER',
      recipient: 'ประธานชมรมผู้สูงอายุตำบลฉลอง',
      references: ['{{ref:doc-01:full}}'],
      enclosures: ['กำหนดการจัดงาน จำนวน ๑ ชุด'],
      bodyParagraphs: [
        'อ้างถึง {{ref:doc-01:short}} เทศบาลตำบลฉลองกำหนดจัด{{var.projectName}} ในวันที่ {{var.eventDate}} ณ {{var.eventLocation}}',
      ],
      tables: [],
      closing: 'ขอแสดงความนับถือ',
    },
  };

  return {
    id: 'folder-elderly-2570',
    name: 'โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ 2570',
    fiscalYearBE: 2570,
    category: 'โครงการพัฒนาสังคม',
    status: 'IN_PROGRESS',
    description: '',
    agency: structuredClone(defaultAgency),
    signatories,
    variables: [
      {key: 'projectName', label: 'ชื่อโครงการ', value: 'โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ', kind: 'text'},
      {key: 'eventDate', label: 'วันที่จัดงาน', value: '2026-12-15', kind: 'date'},
      {key: 'eventLocation', label: 'สถานที่จัดงาน', value: 'ห้องประชุมเทศบาลตำบลฉลอง', kind: 'text'},
      {key: 'budgetAmount', label: 'งบประมาณ', value: '45000', kind: 'money'},
      {key: 'targetGroup', label: 'กลุ่มเป้าหมาย', value: 'ผู้สูงอายุในเขตตำบลฉลอง จำนวน 80 คน', kind: 'text'},
    ],
    stages: [
      {id: 'st-1', name: 'รอบที่ 1 ขออนุมัติหลักการ', order: 0},
      {id: 'st-2', name: 'รอบที่ 2 ดำเนินการ', order: 1},
    ],
    items: [doc1, doc2],
    createdAt: '2026-12-01T00:00:00Z',
    updatedAt: '2026-12-01T00:00:00Z',
  };
}

describe('Phase 7 CaseFolder resolver, variables, live @ref & blueprints', () => {
  it('propagates a Case Variable change (eventDate) to both INTERNAL_MEMO and EXTERNAL_LETTER in Thai numerals', () => {
    const folder = makeSampleFolder();
    const memoBefore = buildCaseDocumentIR(folder, folder.items[0] as GeneratedDocItem);
    const letterBefore = buildCaseDocumentIR(folder, folder.items[1] as GeneratedDocItem);

    expect(memoBefore.blocks[0].kind === 'paragraph' && memoBefore.blocks[0].text).toContain('๑๕ ธันวาคม ๒๕๖๙');
    expect(memoBefore.blocks[0].kind === 'paragraph' && memoBefore.blocks[0].text).toContain('๔๕,๐๐๐.๐๐');
    expect(letterBefore.blocks[0].kind === 'paragraph' && letterBefore.blocks[0].text).toContain('๑๕ ธันวาคม ๒๕๖๙');

    // Update eventDate at the folder header -> propagates instantly to both documents
    folder.variables.find(v => v.key === 'eventDate')!.value = '2026-12-22';

    const memoAfter = buildCaseDocumentIR(folder, folder.items[0] as GeneratedDocItem);
    const letterAfter = buildCaseDocumentIR(folder, folder.items[1] as GeneratedDocItem);
    expect(memoAfter.blocks[0].kind === 'paragraph' && memoAfter.blocks[0].text).toContain('๒๒ ธันวาคม ๒๕๖๙');
    expect(letterAfter.blocks[0].kind === 'paragraph' && letterAfter.blocks[0].text).toContain('๒๒ ธันวาคม ๒๕๖๙');
  });

  it('updates Doc 2 live {{ref:doc-01:full}} citation automatically in Thai numerals when Doc 1 running number or date changes', () => {
    const folder = makeSampleFolder();
    const first = resolveCaseText(folder, '{{ref:doc-01:full}}');
    expect(first.text).toBe(
      'บันทึกข้อความ กองสวัสดิการสังคม ที่ ภก ๕๒๙๐๖/๑๕๑๐ ลงวันที่ ๓ ธันวาคม ๒๕๖๙ เรื่อง ขออนุมัติโครงการอบรมพัฒนาศักยภาพผู้สูงอายุ',
    );
    expect(first.unresolvedRefs).toEqual([]);

    // Mutate Doc 1 runningNo & date -> Doc 2 citation updates automatically
    const doc1 = folder.items[0] as GeneratedDocItem;
    doc1.runningNo = '1588';
    doc1.date = '2026-12-08';

    const second = resolveCaseText(folder, '{{ref:doc-01:full}}');
    expect(second.text).toBe(
      'บันทึกข้อความ กองสวัสดิการสังคม ที่ ภก ๕๒๙๐๖/๑๕๘๘ ลงวันที่ ๘ ธันวาคม ๒๕๖๙ เรื่อง ขออนุมัติโครงการอบรมพัฒนาศักยภาพผู้สูงอายุ',
    );
    expect(second.text).not.toMatch(/[0-9]/);
  });

  it('renders dotted blanks in normal mode and yellow highlight segments in highlightBlanks mode', () => {
    const folder = makeSampleFolder();
    (folder.items[0] as GeneratedDocItem).runningNo = '';
    folder.variables.find(v => v.key === 'eventLocation')!.value = '';

    const normal = resolveCaseText(folder, 'อ้างถึง {{ref:doc-01:short}} ณ {{var.eventLocation}}', {
      highlightBlanks: false,
    });
    expect(normal.text).toContain('...........');
    expect(normal.segments.every(s => !s.highlightBlank)).toBe(true);
    expect(normal.unresolvedRefs).toEqual(['doc-01']);
    expect(normal.unresolvedVars).toEqual(['eventLocation']);

    const highlighted = resolveCaseText(folder, 'อ้างถึง {{ref:doc-01:short}} ณ {{var.eventLocation}}', {
      highlightBlanks: true,
    });
    const blanks = highlighted.segments.filter(s => s.highlightBlank);
    expect(blanks.length).toBe(2);
    expect(blanks[0].text).toBe('[รอเลขที่หนังสือ]');
    expect(blanks[1].text).toBe('[กรอก:สถานที่จัดงาน]');
  });

  it('supports saveAsBlueprint(), cloneCaseFolderSafely(), and instantiateCaseFolderFromBlueprint() while wiping numbers/dates/overrides', () => {
    const folder = makeSampleFolder();
    (folder.items[0] as GeneratedDocItem).externalOverride = {
      fileName: 'edited-by-colleague.docx',
      fileType: 'docx',
      storedPath: '/tmp/edited.docx',
      uploadedAt: '2026-12-03T10:00:00Z',
      note: 'พี่ติ๋วแก้หน้า 2 แล้ว',
    };

    const cloned = cloneCaseFolderSafely(folder, {fiscalYearBE: 2571});
    expect(cloned.id).not.toBe(folder.id);
    expect(cloned.fiscalYearBE).toBe(2571);
    const clonedDoc1 = cloned.items[0] as GeneratedDocItem;
    expect(clonedDoc1.runningNo).toBe('');
    expect(clonedDoc1.date).toBe('');
    expect(clonedDoc1.externalOverride).toBeUndefined();
    // Cross-reference IDs remain intact!
    expect((cloned.items[1] as GeneratedDocItem).payload.docType).toBe('EXTERNAL_LETTER');

    const bp = saveAsBlueprint(folder);
    expect(bp.variables.every(v => v.value === '')).toBe(true);
    const fresh = instantiateCaseFolderFromBlueprint(bp, defaultAgency, signatories, {fiscalYearBE: 2571});
    expect(fresh.blueprintSourceId).toBe(bp.id);
    expect(fresh.items).toHaveLength(2);
    expect((fresh.items[0] as GeneratedDocItem).runningNo).toBe('');
  });
});
