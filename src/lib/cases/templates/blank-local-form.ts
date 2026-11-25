import 'server-only';
import type {AgencyConfig, SignatoryChain} from '../../procurement/types';
import type {CaseDocType, CaseFolder, GeneratedDocItem, MemoApprovalChain} from '../types';
import {buildCaseDocumentIR} from './all-doc-builders';
import {renderCaseDocumentDocx} from './render-case-docx';

export interface BlankLocalFormOptions {
  highlightBlanks?: boolean;
  variant?: 'INVITATION' | 'CERTIFICATE';
  fiscalYearBE?: number;
  title?: string;
  approvalChain?: MemoApprovalChain;
}

function p(prompt: string, highlightBlanks: boolean): string {
  return highlightBlanks ? `[${prompt}]` : '....................................................';
}

function titleOrPrompt(customTitle: string | undefined, prompt: string, highlightBlanks: boolean): string {
  const trimmed = customTitle?.trim();
  return trimmed ? trimmed : p(prompt, highlightBlanks);
}

function buildBlankItem(
  docType: CaseDocType,
  agency: AgencyConfig,
  options: BlankLocalFormOptions,
): GeneratedDocItem {
  const hl = options.highlightBlanks ?? true;
  const base = {
    id: `blank-${docType.toLowerCase()}`,
    order: 0,
    stageId: 'stage-1',
    copies: 1,
    kind: 'GENERATED_DOC' as const,
    docType,
    runningNo: '',
    date: '',
  };

  switch (docType) {
    case 'INTERNAL_MEMO':
      return {
        ...base,
        track: 'INTERNAL_MEMO',
        title: titleOrPrompt(options.title, 'พิมพ์ชื่อเรื่องบันทึกข้อความที่นี่', hl),
        payload: {
          docType: 'INTERNAL_MEMO',
          recipient: `นายก${agency.municipalityName}`,
          useStructuredSections: true,
          sections: {
            background: p('พิมพ์เนื้อหาเรื่องเดิมที่นี่', hl),
            facts: p('พิมพ์เนื้อหาข้อเท็จจริงที่นี่', hl),
            legalBasis: p('พิมพ์ระเบียบและกฎหมายที่เกี่ยวข้องที่นี่', hl),
            proposal: p('พิมพ์ข้อพิจารณาและข้อเสนอที่นี่', hl),
          },
          bodyParagraphs: [],
          tables: [],
          closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
          approvalChain: options.approvalChain ?? '3_TIER',
        },
      };

    case 'EXTERNAL_LETTER':
      return {
        ...base,
        track: 'EXTERNAL_LETTER',
        title: titleOrPrompt(options.title, 'พิมพ์ชื่อเรื่องหนังสือภายนอกที่นี่', hl),
        payload: {
          docType: 'EXTERNAL_LETTER',
          recipient: p('พิมพ์ตำแหน่งผู้รับหนังสือ', hl),
          references: [],
          enclosures: [p('ระบุสิ่งที่ส่งมาด้วย (ถ้ามี)', hl)],
          bodyParagraphs: [
            p('พิมพ์เนื้อหาหนังสือภายนอกย่อหน้าที่ ๑ ที่นี่', hl),
            p('พิมพ์เนื้อหาหนังสือภายนอกย่อหน้าที่ ๒ ที่นี่', hl),
          ],
          tables: [],
          closing: 'ขอแสดงความนับถือ',
        },
      };

    case 'MUNICIPAL_ORDER':
      return {
        ...base,
        track: 'MUNICIPAL_ORDER',
        title: titleOrPrompt(options.title, 'พิมพ์ชื่อเรื่องคำสั่งเทศบาลที่นี่', hl),
        payload: {
          docType: 'MUNICIPAL_ORDER',
          preambleParagraphs: [p('พิมพ์เหตุผลและความจำเป็นในการออกคำสั่งที่นี่', hl)],
          appointees: [
            {
              fullName: p('ชื่อ-สกุล ผู้ได้รับแต่งตั้ง ลำดับที่ ๑', hl),
              position: p('ตำแหน่ง', hl),
              role: p('บทบาท/หน้าที่', hl),
            },
            {
              fullName: p('ชื่อ-สกุล ผู้ได้รับแต่งตั้ง ลำดับที่ ๒', hl),
              position: p('ตำแหน่ง', hl),
              role: p('บทบาท/หน้าที่', hl),
            },
          ],
          dutiesParagraphs: [p('พิมพ์อำนาจหน้าที่ของผู้ได้รับแต่งตั้งที่นี่', hl)],
          effectiveNote: 'ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป',
          routingStripMode: 'FIRST_COPY_ONLY',
        },
      };

    case 'ANNOUNCEMENT':
      return {
        ...base,
        track: 'ANNOUNCEMENT',
        title: titleOrPrompt(options.title, 'พิมพ์ชื่อเรื่องประกาศเทศบาลที่นี่', hl),
        payload: {
          docType: 'ANNOUNCEMENT',
          registryLogNo: '',
          bodyParagraphs: [
            p('พิมพ์เนื้อหาประกาศย่อหน้าที่ ๑ ที่นี่', hl),
            p('พิมพ์รายละเอียดหรือกำหนดการประกาศที่นี่', hl),
          ],
          tables: [],
          closingNote: 'จึงประกาศให้ทราบโดยทั่วกัน',
          routingStripMode: 'FIRST_COPY_ONLY',
        },
      };

    case 'CERTIFICATE_OR_INVITATION': {
      const variant = options.variant ?? 'INVITATION';
      return {
        ...base,
        track: variant === 'INVITATION' ? 'EXTERNAL_LETTER' : 'NONE',
        title: titleOrPrompt(
          options.title,
          variant === 'CERTIFICATE'
            ? 'พิมพ์เรื่องหนังสือรับรองที่นี่'
            : 'พิมพ์เรื่องหนังสือเชิญวิทยากร/เชิญประชุมที่นี่',
          hl,
        ),
        payload: {
          docType: 'CERTIFICATE_OR_INVITATION',
          variant,
          certificateNo: '',
          recipient: variant === 'INVITATION' ? p('พิมพ์ชื่อ/ตำแหน่งผู้รับเชิญ', hl) : '',
          references: [],
          enclosures: variant === 'INVITATION' ? [p('กำหนดการ/วาระการประชุม จำนวน ๑ ชุด', hl)] : [],
          eventDate: variant === 'INVITATION' ? p('ระบุวัน/วันที่จัดงาน', hl) : '',
          eventTime: variant === 'INVITATION' ? p('ระบุเวลา', hl) : '',
          eventLocation: variant === 'INVITATION' ? p('ระบุสถานที่จัดงาน', hl) : '',
          bodyParagraphs: [
            variant === 'CERTIFICATE'
              ? p('พิมพ์ข้อความรับรองบุคคล/หน่วยงาน/ข้อเท็จจริงที่นี่', hl)
              : p('พิมพ์ข้อความเชิญเข้าร่วมประชุมหรือเป็นวิทยากรที่นี่', hl),
          ],
          agendaTable:
            variant === 'INVITATION'
              ? {
                  caption: 'กำหนดการโดยสังเขป',
                  columns: ['เวลา', 'กิจกรรม / วาระ'],
                  columnWidths: [25, 75],
                  rows: [{cells: [p('๐๙.๐๐ - ๑๒.๐๐ น.', hl), p('พิมพ์รายละเอียดกิจกรรม', hl)]}],
                  footerRows: [],
                  bordered: true,
                }
              : undefined,
          closing: 'ขอแสดงความนับถือ',
        },
      };
    }

    case 'PROJECT_PROPOSAL_OR_ATTACHMENT':
      return {
        ...base,
        track: 'NONE',
        title: titleOrPrompt(options.title, 'พิมพ์ชื่อโครงการหรือเอกสารประกอบที่นี่', hl),
        payload: {
          docType: 'PROJECT_PROPOSAL_OR_ATTACHMENT',
          subtitle: `ประจำปีงบประมาณ พ.ศ. ${options.fiscalYearBE ?? new Date().getFullYear() + 543}`,
          projectName: titleOrPrompt(options.title, 'พิมพ์ชื่อโครงการเต็มที่นี่', hl),
          rationale: p('พิมพ์หลักการและเหตุผลของโครงการที่นี่', hl),
          objectives: [p('พิมพ์วัตถุประสงค์ข้อที่ ๑', hl), p('พิมพ์วัตถุประสงค์ข้อที่ ๒', hl)],
          targets: [p('พิมพ์กลุ่มเป้าหมายและจำนวนผู้เข้าร่วม', hl)],
          scheduleAndLocation: p('พิมพ์ระยะเวลาและสถานที่ดำเนินการ', hl),
          budgetSummary: p('พิมพ์แหล่งงบประมาณและยอดเงินรวม', hl),
          budgetTable: {
            columns: ['ลำดับ', 'รายการค่าใช้จ่าย', 'จำนวนเงิน (บาท)'],
            columnWidths: [12, 63, 25],
            rows: [{cells: ['๑', p('พิมพ์รายการค่าใช้จ่าย', hl), p('๐.๐๐', hl)]}],
            footerRows: [{cells: ['', 'รวมเป็นเงินทั้งสิ้น', p('๐.๐๐', hl)]}],
            bordered: true,
          },
          extraSections: [],
        },
      };

    case 'PHOTO_SHEET':
      return {
        ...base,
        track: 'NONE',
        title: titleOrPrompt(options.title, 'พิมพ์หัวเรื่องภาพถ่ายประกอบกิจกรรมที่นี่', hl),
        payload: {
          docType: 'PHOTO_SHEET',
          subtitle: p('พิมพ์วัน/สถานที่จัดกิจกรรม (ถ้ามี)', hl),
          layout: '2_PER_PAGE',
          photos: [],
          certificationText: 'ขอรับรองว่าเป็นเอกสารที่ถูกต้อง',
        },
      };
  }
}

/**
 * Quick Blank Local Word Generator:
 * Generates a ready-to-edit standalone `.docx` Buffer for any of the 7 official Thai government
 * document types pre-populated with Garuda (1.5cm or 3.0cm), A4 margins, TH Sarabun IT๙ (16pt),
 * latest agencyConfig header/phone/address, and latest signatories chain.
 * Zero `<w:txbxContent>` floating text boxes.
 */
export async function buildBlankLocalWordForm(
  docType: CaseDocType,
  agencyConfig: AgencyConfig,
  signatories: SignatoryChain,
  options: BlankLocalFormOptions = {},
): Promise<Buffer> {
  const highlightBlanks = options.highlightBlanks ?? true;
  const now = new Date().toISOString();
  const fy = options.fiscalYearBE ?? new Date().getFullYear() + 543 + (new Date().getMonth() >= 9 ? 1 : 0);
  const blankItem = buildBlankItem(docType, agencyConfig, {...options, highlightBlanks, fiscalYearBE: fy});

  const syntheticFolder: CaseFolder = {
    id: 'quick-blank-form',
    name: blankItem.title,
    fiscalYearBE: fy,
    category: 'แบบฟอร์มเปล่า',
    status: 'DRAFT',
    description: '',
    agency: agencyConfig,
    signatories,
    variables: [],
    stages: [{id: 'stage-1', name: 'แบบฟอร์มเปล่า', order: 0}],
    items: [blankItem],
    createdAt: now,
    updatedAt: now,
  };

  const ir = buildCaseDocumentIR(syntheticFolder, blankItem, {highlightBlanks});
  return renderCaseDocumentDocx(ir);
}
