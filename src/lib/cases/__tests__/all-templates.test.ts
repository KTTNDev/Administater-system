import {describe, expect, it} from 'vitest';
import JSZip from 'jszip';
import sharp from 'sharp';
import {defaultAgency} from '../../procurement/presets/default-agency';
import type {SignatoryChain} from '../../procurement/types';
import {
  buildCaseDocumentIR,
  renderCaseDocumentHtml,
  type CaseDocType,
  type CaseFolder,
  type GeneratedDocItem,
} from '../index';
import {renderCaseDocumentDocx} from '../templates/render-case-docx';
import {buildBlankLocalWordForm} from '../templates/blank-local-form';

const signatories: SignatoryChain = {
  procurementOfficer: {id: 's1', fullName: 'นายกิตตินันท์ พลรบ', position: 'เจ้าพนักงานธุรการปฏิบัติงาน'},
  divisionDirector: {id: 's2', fullName: 'นางสาวผู้อำนวยการ กองสวัสดิการ', position: 'ผู้อำนวยการกองสวัสดิการสังคม'},
  municipalClerk: {id: 's3', fullName: 'นายปลัด เทศบาล', position: 'ปลัดเทศบาลตำบลฉลอง'},
  mayor: {id: 's4', fullName: 'นายกเทศมนตรี ตำบลฉลอง', position: 'นายกเทศมนตรีตำบลฉลอง'},
};

const ALL_7_DOC_TYPES: CaseDocType[] = [
  'INTERNAL_MEMO',
  'EXTERNAL_LETTER',
  'MUNICIPAL_ORDER',
  'ANNOUNCEMENT',
  'CERTIFICATE_OR_INVITATION',
  'PROJECT_PROPOSAL_OR_ATTACHMENT',
  'PHOTO_SHEET',
];

describe('Phase 7 all 7 official document types + Quick Blank Local Word forms (HTML & DOCX)', () => {
  it('builds and renders all 7 official document types in HTML and native DOCX without floating text boxes', async () => {
    const sampleJpg = await sharp({
      create: {width: 400, height: 300, channels: 3, background: {r: 220, g: 235, b: 225}},
    })
      .jpeg({quality: 85})
      .toBuffer();
    const photoDataUri = `data:image/jpeg;base64,${sampleJpg.toString('base64')}`;

    const items: GeneratedDocItem[] = [
      {
        id: 'd1',
        order: 0,
        stageId: 'st-1',
        kind: 'GENERATED_DOC',
        docType: 'INTERNAL_MEMO',
        track: 'INTERNAL_MEMO',
        title: 'ขออนุมัติ{{var.projectName}}',
        runningNo: '1501',
        date: '2026-12-01',
        copies: 1,
        payload: {
          docType: 'INTERNAL_MEMO',
          recipient: 'นายกเทศมนตรีตำบลฉลอง',
          useStructuredSections: true,
          sections: {
            background: 'ตามแผนดำเนินงานประจำปี {{var.projectName}}',
            facts: 'กำหนดจัดงานวันที่ {{var.eventDate}} ณ {{var.eventLocation}}',
            legalBasis: 'ระเบียบกระทรวงมหาดไทยว่าด้วยค่าใช้จ่ายในการจัดงาน',
            proposal: 'เห็นควรอนุมัติโครงการ',
          },
          bodyParagraphs: [],
          tables: [],
          closing: 'จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ',
          approvalChain: '3_TIER',
        },
      },
      {
        id: 'd2',
        order: 1,
        stageId: 'st-1',
        kind: 'GENERATED_DOC',
        docType: 'EXTERNAL_LETTER',
        track: 'EXTERNAL_LETTER',
        title: 'ขอความอนุเคราะห์ประชาสัมพันธ์{{var.projectName}}',
        runningNo: '4501',
        date: '2026-12-02',
        copies: 1,
        payload: {
          docType: 'EXTERNAL_LETTER',
          recipient: 'กำนันตำบลฉลอง',
          references: ['{{ref:d1:full}}'],
          enclosures: ['กำหนดการ จำนวน ๑ ฉบับ'],
          bodyParagraphs: ['เทศบาลตำบลฉลองกำหนดจัด{{var.projectName}} ในวันที่ {{var.eventDate}}'],
          tables: [],
          closing: 'ขอแสดงความนับถือ',
        },
      },
      {
        id: 'd3',
        order: 2,
        stageId: 'st-1',
        kind: 'GENERATED_DOC',
        docType: 'MUNICIPAL_ORDER',
        track: 'MUNICIPAL_ORDER',
        title: 'แต่งตั้งคณะทำงานดำเนิน{{var.projectName}}',
        runningNo: '2310',
        date: '2026-12-02',
        copies: 3,
        payload: {
          docType: 'MUNICIPAL_ORDER',
          orderYearBE: 2569,
          preambleParagraphs: ['เพื่อให้การดำเนิน{{var.projectName}} เป็นไปด้วยความเรียบร้อย'],
          appointees: [
            {fullName: 'นายชัยวัฒน์ สิทธิโชค', position: 'นักพัฒนาชุมชนชำนาญการ', role: 'ประธานคณะทำงาน'},
            {fullName: 'นางสาวณกัญญา ดีเบา', position: 'นักพัฒนาชุมชนปฏิบัติการ', role: 'คณะทำงานและเลขานุการ'},
          ],
          dutiesParagraphs: ['ให้คณะทำงานมีหน้าที่จัดเตรียมสถานที่และประสานงานวิทยากร'],
          effectiveNote: 'ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป',
          routingStripMode: 'FIRST_COPY_ONLY',
        },
      },
      {
        id: 'd4',
        order: 3,
        stageId: 'st-1',
        kind: 'GENERATED_DOC',
        docType: 'ANNOUNCEMENT',
        track: 'ANNOUNCEMENT',
        title: 'รายชื่อผู้มีสิทธิเข้าร่วม{{var.projectName}}',
        runningNo: '',
        date: '2026-12-03',
        copies: 3,
        payload: {
          docType: 'ANNOUNCEMENT',
          registryLogNo: '998877',
          bodyParagraphs: ['เทศบาลตำบลฉลองขอประกาศรายชื่อผู้เข้าร่วม{{var.projectName}}'],
          tables: [],
          closingNote: 'จึงประกาศให้ทราบโดยทั่วกัน',
          routingStripMode: 'FIRST_COPY_ONLY',
        },
      },
      {
        id: 'd5',
        order: 4,
        stageId: 'st-1',
        kind: 'GENERATED_DOC',
        docType: 'CERTIFICATE_OR_INVITATION',
        track: 'EXTERNAL_LETTER',
        title: 'ขอเชิญเป็นวิทยากร{{var.projectName}}',
        runningNo: '4502',
        date: '2026-12-03',
        copies: 1,
        payload: {
          docType: 'CERTIFICATE_OR_INVITATION',
          variant: 'INVITATION',
          certificateNo: '',
          recipient: 'ผู้อำนวยการโรงพยาบาลส่งเสริมสุขภาพตำบลฉลอง',
          references: [],
          enclosures: ['กำหนดการฝึกอบรม จำนวน ๑ ชุด'],
          eventDate: '{{var.eventDate}}',
          eventTime: '๐๙.๐๐ - ๑๒.๐๐ น.',
          eventLocation: '{{var.eventLocation}}',
          bodyParagraphs: ['ขอเรียนเชิญท่านเป็นวิทยากรบรรยายความรู้ใน{{var.projectName}}'],
          agendaTable: {
            caption: 'กำหนดการบรรยาย',
            columns: ['เวลา', 'หัวข้อบรรยาย'],
            columnWidths: [28, 72],
            rows: [{cells: ['๐๙.๐๐ - ๑๒.๐๐ น.', 'การดูแลสุขภาพผู้สูงอายุ']}],
            footerRows: [],
            bordered: true,
          },
          closing: 'ขอแสดงความนับถือ',
        },
      },
      {
        id: 'd6',
        order: 5,
        stageId: 'st-1',
        kind: 'GENERATED_DOC',
        docType: 'PROJECT_PROPOSAL_OR_ATTACHMENT',
        track: 'NONE',
        title: 'ร่าง{{var.projectName}}',
        runningNo: '',
        date: '2026-12-01',
        copies: 1,
        payload: {
          docType: 'PROJECT_PROPOSAL_OR_ATTACHMENT',
          subtitle: 'ประจำปีงบประมาณ พ.ศ. ๒๕๗๐',
          projectName: '{{var.projectName}}',
          rationale: 'เพื่อส่งเสริมสุขภาวะที่ดีของผู้สูงอายุในพื้นที่',
          objectives: ['ให้ผู้สูงอายุได้รับความรู้ด้านการดูแลสุขภาพ', 'สร้างเครือข่ายผู้สูงอายุเข้มแข็ง'],
          targets: ['ผู้สูงอายุในเขตตำบลฉลอง จำนวน ๘๐ คน'],
          scheduleAndLocation: 'วันที่ {{var.eventDate}} ณ {{var.eventLocation}}',
          budgetSummary: 'งบประมาณทั้งสิ้น {{var.budgetAmount}} บาท',
          budgetTable: {
            columns: ['ลำดับ', 'รายการค่าใช้จ่าย', 'จำนวนเงิน (บาท)'],
            columnWidths: [12, 63, 25],
            rows: [
              {cells: ['๑', 'ค่าอาหารว่างและเครื่องดื่ม', '๑๒,๐๐๐.๐๐']},
              {cells: ['๒', 'ค่าวิทยากร', '๓,๖๐๐.๐๐']},
            ],
            footerRows: [{cells: ['', 'รวมเป็นเงินทั้งสิ้น', '๑๕,๖๐๐.๐๐']}],
            bordered: true,
          },
          extraSections: [],
        },
      },
      {
        id: 'd7',
        order: 6,
        stageId: 'st-1',
        kind: 'GENERATED_DOC',
        docType: 'PHOTO_SHEET',
        track: 'NONE',
        title: 'ภาพถ่ายประกอบกิจกรรม{{var.projectName}}',
        runningNo: '',
        date: '2026-12-15',
        copies: 1,
        payload: {
          docType: 'PHOTO_SHEET',
          subtitle: 'วันที่ {{var.eventDate}} ณ {{var.eventLocation}}',
          layout: '2_PER_PAGE',
          photos: [{id: 'p1', source: photoDataUri, caption: 'บรรยากาศการอบรมผู้สูงอายุ'}],
          certificationText: 'ขอรับรองว่าเป็นเอกสารที่ถูกต้อง',
        },
      },
    ];

    const folder: CaseFolder = {
      id: 'f-all-7',
      name: 'โครงการอบรมผู้สูงอายุครบ 7 แบบ',
      fiscalYearBE: 2570,
      category: 'โครงการ',
      status: 'IN_PROGRESS',
      description: '',
      agency: structuredClone(defaultAgency),
      signatories,
      variables: [
        {key: 'projectName', label: 'ชื่อโครงการ', value: 'โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ', kind: 'text'},
        {key: 'eventDate', label: 'วันที่จัดงาน', value: '2026-12-15', kind: 'date'},
        {key: 'eventLocation', label: 'สถานที่', value: 'ห้องประชุมเทศบาลตำบลฉลอง', kind: 'text'},
        {key: 'budgetAmount', label: 'งบประมาณ', value: '15600', kind: 'money'},
      ],
      stages: [{id: 'st-1', name: 'รอบเสนอแฟ้ม', order: 0}],
      items,
      createdAt: '2026-12-01T00:00:00Z',
      updatedAt: '2026-12-01T00:00:00Z',
    };

    for (const item of items) {
      const ir = buildCaseDocumentIR(folder, item);
      const html = renderCaseDocumentHtml(ir);
      expect(html).toContain('โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ');
      if (item.docType === 'ANNOUNCEMENT') {
        // Track 3 registry log number must NOT be printed on the document
        expect(html).not.toContain('998877');
        expect(html).not.toContain('๙๙๘๘๗๗');
      }

      const docxBytes = await renderCaseDocumentDocx(ir);
      const zip = await JSZip.loadAsync(docxBytes);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).not.toContain('txbxContent');
      expect(await zip.file('word/styles.xml')!.async('string')).toContain('TH SarabunIT๙');
      expect(await zip.file('word/fontTable.xml')!.async('string')).toContain('TH Sarabun IT๙');
      if (item.docType === 'PROJECT_PROPOSAL_OR_ATTACHMENT') {
        expect(xml).toContain('w:tblHeader');
      }
      if (item.docType === 'PHOTO_SHEET') {
        expect(Object.keys(zip.files).some(f => f.startsWith('word/media/'))).toBe(true);
      }
    }
  }, 120000);

  it('generates Quick Blank Local Word forms for all 7 doc types with zero floating text boxes and yellow highlights', async () => {
    for (const docType of ALL_7_DOC_TYPES) {
      const highlightedBuf = await buildBlankLocalWordForm(docType, defaultAgency, signatories, {
        highlightBlanks: true,
        fiscalYearBE: 2570,
      });
      const zip = await JSZip.loadAsync(highlightedBuf);
      const xml = await zip.file('word/document.xml')!.async('string');
      expect(xml).not.toContain('txbxContent');
      expect(xml).toContain('w:highlight w:val="yellow"');
    }

    // Also test CERTIFICATE variant and highlightBlanks: false (clean dotted lines)
    const certBuf = await buildBlankLocalWordForm('CERTIFICATE_OR_INVITATION', defaultAgency, signatories, {
      variant: 'CERTIFICATE',
      highlightBlanks: false,
    });
    const certZip = await JSZip.loadAsync(certBuf);
    const certXml = await certZip.file('word/document.xml')!.async('string');
    expect(certXml).toContain('หนังสือรับรอง');
    expect(certXml).not.toContain('txbxContent');
    expect(certXml).not.toContain('w:highlight w:val="yellow"');
  }, 120000);
});
