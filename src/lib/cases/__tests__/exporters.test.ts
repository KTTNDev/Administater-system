import {describe, expect, it} from 'vitest';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import {defaultAgency} from '../../procurement/presets/default-agency';
import type {SignatoryChain} from '../../procurement/types';
import type {CaseFolder} from '../types';
import {buildBlankCaseCoreDraft, mapCaseItemToCoreDraft, syncCaseCoreDraft} from '../core/mapper';
import {buildBlankLocalWordForm} from '../templates/blank-local-form';
import {buildLocalHandoffZip} from '../exporters/local-handoff-zip';
import {exportPortableCaseArchive, parsePortableCaseArchive} from '../exporters/portable-archive';
import {assembleCasePdfBinder} from '../exporters/case-pdf-binder';
import {renderWord} from '../../word';

const TEST_SIGNATORIES: SignatoryChain = {
  procurementOfficer: {
    id: 'officer',
    fullName: 'นายกิตตินันท์ พลรบ',
    position: 'เจ้าพนักงานธุรการปฏิบัติงาน',
  },
  divisionDirector: {
    id: 'director',
    fullName: 'นางกุลวดี ส่งแสง',
    position: 'ผู้อำนวยการกองสวัสดิการสังคม',
  },
  municipalClerk: {
    id: 'clerk',
    fullName: 'นายชัยณิวัฒน์ สายสุวรรณ์',
    position: 'รองปลัดเทศบาล',
    actingLine: 'รักษาราชการแทน',
    actingTarget: 'ปลัดเทศบาลตำบลฉลอง',
  },
  mayor: {
    id: 'mayor',
    fullName: 'นายธนพร องค์สันติภาพ',
    position: 'นายกเทศมนตรีตำบลฉลอง',
  },
};

function makeSampleFolder(): CaseFolder {
  const now = '2026-11-25T10:00:00.000Z';
  return {
    id: 'case-exp-1',
    name: 'โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ ประจำปี ๒๕๗๐',
    fiscalYearBE: 2570,
    category: 'โครงการฝึกอบรม',
    status: 'IN_PROGRESS',
    description: 'แฟ้มงานทดสอบส่งออก Phase 8',
    agency: defaultAgency,
    signatories: TEST_SIGNATORIES,
    variables: [
      {key: 'projectName', label: 'ชื่อโครงการ', value: 'โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ', kind: 'text'},
      {key: 'eventDate', label: 'วันจัดงาน', value: '', kind: 'date'}, // Blank on purpose to test yellow highlight!
    ],
    stages: [{id: 'stage-1', name: 'รอบที่ 1 ขออนุมัติโครงการ', order: 0}],
    items: [
      {
        id: 'doc-1',
        order: 0,
        stageId: 'stage-1',
        copies: 2,
        kind: 'GENERATED_DOC',
        docType: 'INTERNAL_MEMO',
        track: 'INTERNAL_MEMO',
        runningNo: '1515',
        date: '2026-10-15',
        title: 'ขออนุมัติจัด{{var.projectName}}',
        payload: {
          docType: 'INTERNAL_MEMO',
          recipient: 'นายกเทศมนตรีตำบลฉลอง',
          useStructuredSections: true,
          sections: {
            background: 'กำหนดจัดงานในวันที่ {{var.eventDate}}',
            facts: 'มีผู้เข้าร่วมจำนวน 50 คน',
            legalBasis: '',
            proposal: 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
          },
          bodyParagraphs: [],
          tables: [],
          closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
          approvalChain: '3_TIER',
        },
      },
      {
        id: 'doc-2',
        order: 1,
        stageId: 'stage-1',
        copies: 1,
        kind: 'GENERATED_DOC',
        docType: 'MUNICIPAL_ORDER',
        track: 'MUNICIPAL_ORDER',
        runningNo: '250',
        date: '2026-10-16',
        title: 'แต่งตั้งคณะกรรมการดำเนินงาน{{var.projectName}}',
        payload: {
          docType: 'MUNICIPAL_ORDER',
          preambleParagraphs: ['ตามบันทึกข้อความ {{ref:doc-1:full}} จึงแต่งตั้งคณะกรรมการ'],
          appointees: [{fullName: 'นายสมชาย ใจดี', position: 'นักพัฒนาชุมชน', role: 'ประธานกรรมการ'}],
          dutiesParagraphs: ['ดำเนินงานให้เรียบร้อย'],
          effectiveNote: 'ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป',
          routingStripMode: 'FIRST_COPY_ONLY',
        },
      },
      {
        id: 'slot-1',
        order: 2,
        stageId: 'stage-1',
        copies: 1,
        kind: 'EXTERNAL_FILE_SLOT',
        title: 'สำเนาแผนพัฒนาท้องถิ่น',
        externalDocNo: '',
        externalDate: '',
        exportBehavior: 'PRINT_DIVIDER_CHECKLIST',
        stampReminderNote: 'รับรองสำเนาถูกต้อง',
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

describe('Phase 8 Case Exporters (Core-First Engine)', () => {
  it('maps CaseFolder items to Core Drafts and preserves Core editor-owned overlays on sync', () => {
    const folder = makeSampleFolder();
    const doc1 = folder.items[0];
    if (doc1.kind !== 'GENERATED_DOC') throw new Error('Expected generated doc');

    const coreDraft = mapCaseItemToCoreDraft(folder, doc1, {highlightBlanks: false});
    expect(coreDraft.type).toBe('internal');
    expect(coreDraft.number).toContain('๑๕๑๕');
    expect(coreDraft.opinions.length).toBe(3);
    expect(coreDraft.caseFolderSource?.folderId).toBe(folder.id);
    expect(coreDraft.caseFolderSource?.itemId).toBe(doc1.id);

    // Simulate user adding a floating text box in Core editor, then syncing updated subject
    const editedInCore = {
      ...coreDraft,
      floatingItems: [
        {
          kind: 'text' as const,
          id: '11111111-1111-4111-8111-111111111111',
          page: 1,
          xMm: 40,
          yMm: 180,
          widthMm: 60,
          fontPt: 16,
          bold: false,
          text: 'หมายเหตุจาก Core',
        },
      ],
    };
    const updatedGen = mapCaseItemToCoreDraft(
      {...folder, variables: folder.variables.map(v => (v.key === 'projectName' ? {...v, value: 'โครงการอัปเดต'} : v))},
      doc1,
    );
    const synced = syncCaseCoreDraft(editedInCore, updatedGen);
    expect(synced.subject).toContain('โครงการอัปเดต');
    expect(synced.floatingItems).toHaveLength(1);
    expect(synced.floatingItems[0].kind === 'text' ? synced.floatingItems[0].text : '').toBe('หมายเหตุจาก Core');
  });

  it('builds Local Word Handoff Kit (.zip) via Core renderWord with roadmap .docx/.txt and yellow highlight blanks', async () => {
    const folder = makeSampleFolder();
    const res = await buildLocalHandoffZip(folder, {
      highlightBlanks: true,
      includeRoadmapFiles: true,
      includeAttachmentsAndLinked: true,
      preferBoundCore: false,
    });

    const zip = await JSZip.loadAsync(res.zipBytes);
    const names = Object.keys(zip.files);
    expect(names).toContain('00_ลายแทงและเช็กลิสต์แฟ้มงาน.docx');
    expect(names).toContain('00_ลายแทงและเช็กลิสต์แฟ้มงาน.txt');

    const doc1Entry = names.find(n => n.includes('01_') && n.endsWith('.docx'));
    expect(doc1Entry).toBeDefined();
    const doc1Buf = await zip.file(doc1Entry!)!.async('nodebuffer');
    const doc1Zip = await JSZip.loadAsync(doc1Buf);
    const doc1Xml = await doc1Zip.file('word/document.xml')!.async('string');

    expect(doc1Xml).toContain('<w:highlight w:val="yellow"/>');
    expect(doc1Xml).toContain('๑๕๑๕');

    const doc2Entry = names.find(n => n.includes('02_') && n.endsWith('.docx'));
    expect(doc2Entry).toBeDefined();
    const doc2Buf = await zip.file(doc2Entry!)!.async('nodebuffer');
    const doc2Zip = await JSZip.loadAsync(doc2Buf);
    const doc2Xml = await doc2Zip.file('word/document.xml')!.async('string');
    expect(doc2Xml).toContain('๑๕๑๕');
    expect(doc2Xml).not.toContain('<w:txbxContent>');
  }, 60000);

  it('generates Quick Blank Local Word Form via Core renderWord with external prefix and zero floating text boxes', async () => {
    const coreBlank = buildBlankCaseCoreDraft('EXTERNAL_LETTER', defaultAgency, TEST_SIGNATORIES, {
      highlightBlanks: true,
      title: 'ขอความอนุเคราะห์วิทยากร',
    });
    const buf = await renderWord(coreBlank, {highlightBlanks: true});
    const zip = await JSZip.loadAsync(buf);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('ภก ๕๒๘๐๖');
    expect(xml).toContain('ขอความอนุเคราะห์วิทยากร');
    expect(xml).toContain('<w:highlight w:val="yellow"/>');
    expect(xml).toContain('TH SarabunIT๙');

    // Legacy helper remains valid too
    const legacyBuf = await buildBlankLocalWordForm('EXTERNAL_LETTER', defaultAgency, TEST_SIGNATORIES, {
      highlightBlanks: true,
      title: 'ขอความอนุเคราะห์วิทยากร',
    });
    expect(legacyBuf.length).toBeGreaterThan(1000);
  }, 60000);

  it('round-trips Portable Archive (.sarabun-case.json) and rejects invalid payloads', () => {
    const folder = makeSampleFolder();
    const exported = exportPortableCaseArchive(folder);
    expect(exported.fileName).toMatch(/\.sarabun-case\.json$/);

    const imported = parsePortableCaseArchive(exported.json, {
      regenerateId: true,
      suffixImportedName: true,
    });
    expect(imported.folder.id).not.toBe(folder.id);
    expect(imported.folder.name).toContain('(นำเข้า)');
    expect(imported.folder.items).toHaveLength(3);

    expect(() => parsePortableCaseArchive('{"format":"wrong"}')).toThrow();
  });

  it('assembles Print-Ready Case PDF Binder via Core renderPdf with cover checklist, copy duplication, and divider sheet', async () => {
    const folder = makeSampleFolder();
    const result = await assembleCasePdfBinder(folder, {
      mode: 'FULL_BINDER',
      duplicateCopies: true,
      includeCoverChecklist: true,
      includeDividers: true,
      includeLinkedPdfs: false,
      preferBoundCore: false,
    });

    expect(result.pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    const pdf = await PDFDocument.load(result.pdfBytes);
    expect(pdf.getPageCount()).toBe(result.pageCount);
    // Cover (1) + Doc1 x2 copies (>=2) + Doc2 x1 (>=1) + Divider x1 (1) => >= 5 pages
    expect(result.pageCount).toBeGreaterThanOrEqual(5);
    expect(result.entries.some(e => e.source === 'COVER')).toBe(true);
    expect(result.entries.filter(e => e.itemId === 'doc-1')).toHaveLength(2);
    expect(result.entries.some(e => e.source === 'DIVIDER' && e.itemId === 'slot-1')).toBe(true);
  }, 60000);
});
