import {documentSchema, type Draft} from '../../document';
import {toThaiDigits, toThaiOfficialText} from '../../procurement/formatting';
import type {AgencyConfig, Person, SignatoryChain} from '../../procurement/types';
import {DOC_TYPE_THAI_NAMES, formatOfficialNumber, resolveCaseText} from '../resolver';
import type {
  CaseDocType,
  CaseFolder,
  CaseTableSpec,
  GeneratedDocItem,
  LinkedModuleSummary,
  MemoApprovalChain,
} from '../types';

export interface MapCaseCoreOptions {
  highlightBlanks?: boolean;
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>;
}

const SYNC_CASE_CONTENT_FIELDS = [
  'type',
  'subject',
  'headerSubtitle',
  'number',
  'date',
  'organization',
  'department',
  'address',
  'phone',
  'recipient',
  'salutation',
  'reference',
  'attachments',
  'body',
  'bodyMode',
  'contentBlocks',
  'background',
  'facts',
  'legalBasis',
  'consideration',
  'proposal',
  'closing',
  'signer',
  'position',
  'proposers',
  'opinions',
  'certificateRecipient',
  'otherShowSignatures',
  'appendixTitle',
] as const satisfies readonly (keyof Draft)[];

function formatPersonPosition(person: Person): string {
  const acting = person.actingLine?.trim();
  const line1 = acting
    ? acting.startsWith(person.position)
      ? acting
      : `${person.position} ${acting}`
    : person.position;
  return [line1, person.actingTarget].filter((v): v is string => Boolean(v && v.trim())).join('\n');
}

function escapeCell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function tableToMarkdown(
  folder: CaseFolder,
  spec: CaseTableSpec,
  options: MapCaseCoreOptions,
): string {
  const resolve = (raw: string) =>
    resolveCaseText(folder, raw, {
      highlightBlanks: options.highlightBlanks,
      linkedSummaries: options.linkedSummaries,
    }).text;

  const caption = spec.caption ? `## ${resolve(spec.caption)}` : '';
  const headers = `| ${spec.columns.map(c => escapeCell(resolve(c))).join(' | ')} |`;
  const sep = `| ${spec.columns.map(() => '---').join(' | ')} |`;
  const allRows = [...spec.rows, ...spec.footerRows].map(row => {
    const cells = Array.from({length: spec.columns.length}, (_, i) =>
      escapeCell(resolve(row.cells[i] ?? '')),
    );
    return `| ${cells.join(' | ')} |`;
  });
  return [caption, headers, sep, ...allRows].filter(Boolean).join('\n');
}

function buildOpinionsFromChain(
  chain: MemoApprovalChain,
  agency: AgencyConfig,
  signatories: SignatoryChain,
): Draft['opinions'] {
  if (chain === 'NONE') return [];
  if (chain === '2_TIER') {
    return [
      {
        title: `เรียน นายก${agency.municipalityName}`,
        comment: '- เพื่อโปรดพิจารณาอนุมัติ',
        name: signatories.municipalClerk.fullName,
        position: formatPersonPosition(signatories.municipalClerk),
        showDate: false,
        lines: 1,
      },
      {
        title: 'อนุมัติ',
        comment: '',
        name: signatories.mayor.fullName,
        position: formatPersonPosition(signatories.mayor),
        showDate: false,
        lines: 1,
      },
    ];
  }
  if (chain === '3_TIER') {
    return [
      {
        title: `เรียน ปลัด${agency.municipalityName}`,
        comment: '- เพื่อโปรดพิจารณา',
        name: signatories.divisionDirector.fullName,
        position: formatPersonPosition(signatories.divisionDirector),
        showDate: false,
        lines: 1,
      },
      {
        title: `เรียน นายก${agency.municipalityName}`,
        comment: '- เพื่อโปรดพิจารณาอนุมัติ',
        name: signatories.municipalClerk.fullName,
        position: formatPersonPosition(signatories.municipalClerk),
        showDate: false,
        lines: 1,
      },
      {
        title: 'อนุมัติ',
        comment: '',
        name: signatories.mayor.fullName,
        position: formatPersonPosition(signatories.mayor),
        showDate: false,
        lines: 1,
      },
    ];
  }
  // 4_TIER_VERTICAL
  return [
    {
      title: 'ความเห็นของหัวหน้าเจ้าหน้าที่',
      comment: '',
      name: signatories.divisionDirector.fullName,
      position: formatPersonPosition(signatories.divisionDirector),
      showDate: false,
      lines: 2,
    },
    {
      title: 'ความเห็นของปลัดเทศบาล',
      comment: '',
      name: signatories.municipalClerk.fullName,
      position: formatPersonPosition(signatories.municipalClerk),
      showDate: false,
      lines: 2,
    },
    {
      title: `ความคิดเห็นของนายก${agency.municipalityName}`,
      comment: '- ทราบ / อนุมัติ',
      name: signatories.mayor.fullName,
      position: formatPersonPosition(signatories.mayor),
      showDate: false,
      lines: 1,
    },
  ];
}

function buildNumberForCore(
  folder: CaseFolder,
  item: GeneratedDocItem,
  highlightBlanks: boolean,
): string {
  if (item.docType === 'ANNOUNCEMENT') return '';
  const formatted = formatOfficialNumber(folder, item);
  if (formatted) return formatted;
  const a = folder.agency;
  if (item.docType === 'INTERNAL_MEMO') {
    return highlightBlanks
      ? `${toThaiOfficialText(a.codes.internalMemoPrefix)}/[เลขที่บันทึก]`
      : `${toThaiOfficialText(a.codes.internalMemoPrefix)}/`;
  }
  if (
    item.docType === 'EXTERNAL_LETTER' ||
    (item.docType === 'CERTIFICATE_OR_INVITATION' &&
      item.payload.docType === 'CERTIFICATE_OR_INVITATION' &&
      item.payload.variant === 'INVITATION')
  ) {
    return highlightBlanks
      ? `${toThaiOfficialText(a.codes.externalLetterPrefix)}/[เลขหนังสือภายนอก]`
      : `${toThaiOfficialText(a.codes.externalLetterPrefix)}/`;
  }
  return '';
}

/**
 * Core-First Mapper: Converts any of the 7 CaseFolder document types into a validated
 * Core `Draft` (`documentSchema`) so Preview (`documentHtml`), PDF (`renderPdf`), Word (`renderWord`),
 * and the interactive Core Editor (`DocumentForm`) all use the single Core form engine.
 */
export function mapCaseItemToCoreDraft(
  folder: CaseFolder,
  item: GeneratedDocItem,
  options: MapCaseCoreOptions = {},
): Draft {
  const hl = options.highlightBlanks === true;
  const resolve = (raw: string) =>
    resolveCaseText(folder, raw, {
      highlightBlanks: hl,
      linkedSummaries: options.linkedSummaries,
    }).text;

  const a = folder.agency;
  const s = folder.signatories;
  const subject = resolve(item.title).trim() || DOC_TYPE_THAI_NAMES[item.docType];
  const number = buildNumberForCore(folder, item, hl);
  const date = /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : '';
  const caseFolderSource = {
    folderId: folder.id,
    itemId: item.id,
    folderName: folder.name,
    docLabel: DOC_TYPE_THAI_NAMES[item.docType],
  };

  switch (item.payload.docType) {
    case 'INTERNAL_MEMO': {
      const p = item.payload;
      const proposer =
        p.proposer ?? (p.approvalChain === '2_TIER' ? s.divisionDirector : s.procurementOfficer);
      const dept = p.department?.trim()
        ? p.department.trim()
        : `${a.sectionName} ${a.divisionName} ${a.municipalityName}`;
      const recipient = resolve(p.recipient.trim() || `นายก${a.municipalityName}`);
      const hasTables = p.tables.length > 0;
      const bg = resolve(p.sections.background);
      const facts = resolve(p.sections.facts);
      const legal = resolve(p.sections.legalBasis);
      const prop = resolve(p.sections.proposal);
      const extraBody = p.bodyParagraphs.map(resolve).filter(Boolean);
      const tableBlocks = p.tables.map(t => tableToMarkdown(folder, t, options));

      const useStructured = p.useStructuredSections && !hasTables && extraBody.length === 0;
      const freeParts = [
        ...(p.useStructuredSections
          ? [
              bg ? `## เรื่องเดิม\n${bg}` : '',
              facts ? `## ข้อเท็จจริง\n${facts}` : '',
              legal ? `## ข้อระเบียบและกฎหมาย\n${legal}` : '',
              prop ? `## ข้อพิจารณาและข้อเสนอ\n${prop}` : '',
            ]
          : []),
        ...extraBody,
        ...tableBlocks,
      ].filter(Boolean);

      return documentSchema.parse({
        type: 'internal',
        subject,
        number,
        date,
        organization: a.municipalityName,
        department: dept,
        phone: a.phoneDisplay,
        salutation: 'เรียน',
        recipient,
        bodyMode: useStructured ? 'structured' : 'free',
        background: useStructured ? bg : '',
        facts: useStructured ? facts : '',
        legalBasis: useStructured ? legal : '',
        proposal: useStructured ? prop : '',
        body: useStructured ? '' : freeParts.join('\n'),
        closing: resolve(p.closing || 'จึงเรียนมาเพื่อโปรดพิจารณา'),
        signer: proposer.fullName,
        position: formatPersonPosition(proposer),
        opinions: buildOpinionsFromChain(p.approvalChain, a, s),
        numeralStyle: 'thai',
        caseFolderSource,
      });
    }

    case 'EXTERNAL_LETTER': {
      const p = item.payload;
      const signer = p.signer ?? s.mayor;
      const bodyParts = [
        ...p.bodyParagraphs.map(resolve).filter(Boolean),
        ...p.tables.map(t => tableToMarkdown(folder, t, options)),
      ];
      return documentSchema.parse({
        type: 'external',
        subject,
        number,
        date,
        organization: a.officeTitle,
        department: [a.divisionName, p.footerDivision || a.subDepartmentFooter]
          .filter(Boolean)
          .join('\n'),
        address: a.externalAddressLine,
        phone: [
          p.footerPhone || a.phoneShort,
          p.footerFax || a.fax ? `โทรสาร ${p.footerFax || a.fax}` : '',
        ]
          .filter(Boolean)
          .join('\n'),
        salutation: 'เรียน',
        recipient: resolve(p.recipient || (hl ? '[ระบุผู้รับหนังสือ]' : '')),
        reference: p.references.map(resolve).filter(Boolean).join('\n'),
        attachments: p.enclosures.map(resolve).filter(Boolean).join('\n'),
        bodyMode: 'free',
        body: bodyParts.join('\n'),
        closing: resolve(p.closing || 'ขอแสดงความนับถือ'),
        signer: signer.fullName,
        position: formatPersonPosition(signer),
        numeralStyle: 'thai',
        caseFolderSource,
      });
    }

    case 'MUNICIPAL_ORDER': {
      const p = item.payload;
      const signer = p.signer ?? s.mayor;
      const appointeeLines = p.appointees.map((ap, idx) =>
        resolve(
          `${toThaiDigits(idx + 1)}. ${ap.fullName}${ap.position ? ` ตำแหน่ง ${ap.position}` : ''}${ap.role ? ` เป็น${ap.role}` : ''}`,
        ),
      );
      const bodyParts = [
        ...p.preambleParagraphs.map(resolve).filter(Boolean),
        ...appointeeLines.filter(Boolean),
        ...p.dutiesParagraphs.map(resolve).filter(Boolean),
        resolve(p.effectiveNote || 'ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป'),
      ].filter(Boolean);

      return documentSchema.parse({
        type: 'order',
        subject,
        number,
        date,
        organization: a.municipalityName,
        department: a.divisionName,
        phone: a.phoneShort,
        bodyMode: 'free',
        body: bodyParts.join('\n'),
        closing: '',
        signer: signer.fullName,
        position: formatPersonPosition(signer),
        numeralStyle: 'thai',
        caseFolderSource,
      });
    }

    case 'ANNOUNCEMENT': {
      const p = item.payload;
      const signer = p.signer ?? s.mayor;
      const bodyParts = [
        ...p.bodyParagraphs.map(resolve).filter(Boolean),
        ...p.tables.map(t => tableToMarkdown(folder, t, options)),
        resolve(p.closingNote || 'จึงประกาศให้ทราบโดยทั่วกัน'),
      ].filter(Boolean);

      return documentSchema.parse({
        type: 'announcement',
        subject,
        number: '', // Announcements never print running number on paper
        date,
        organization: a.municipalityName,
        department: a.divisionName,
        phone: a.phoneShort,
        bodyMode: 'free',
        body: bodyParts.join('\n'),
        closing: '',
        signer: signer.fullName,
        position: formatPersonPosition(signer),
        numeralStyle: 'thai',
        caseFolderSource,
      });
    }

    case 'CERTIFICATE_OR_INVITATION': {
      const p = item.payload;
      const signer = p.signer ?? s.mayor;
      if (p.variant === 'CERTIFICATE') {
        return documentSchema.parse({
          type: 'certificate',
          subject,
          number: p.certificateNo ? resolve(p.certificateNo) : '',
          date,
          organization: a.municipalityName,
          department: a.divisionName,
          certificateRecipient: resolve(p.recipient),
          bodyMode: 'free',
          body: p.bodyParagraphs.map(resolve).filter(Boolean).join('\n'),
          closing: '',
          signer: signer.fullName,
          position: formatPersonPosition(signer),
          numeralStyle: 'thai',
          caseFolderSource,
        });
      }

      const eventLines = [
        p.eventDate ? `วัน/วันที่: ${resolve(p.eventDate)}` : '',
        p.eventTime ? `เวลา: ${resolve(p.eventTime)}` : '',
        p.eventLocation ? `สถานที่: ${resolve(p.eventLocation)}` : '',
      ].filter(Boolean);
      const bodyParts = [
        ...p.bodyParagraphs.map(resolve).filter(Boolean),
        ...(eventLines.length ? [eventLines.join(' ')] : []),
        ...(p.agendaTable ? [tableToMarkdown(folder, p.agendaTable, options)] : []),
      ];

      return documentSchema.parse({
        type: 'external',
        subject,
        number,
        date,
        organization: a.officeTitle,
        department: [a.divisionName, a.subDepartmentFooter].filter(Boolean).join('\n'),
        address: a.externalAddressLine,
        phone: [a.phoneShort, a.fax ? `โทรสาร ${a.fax}` : ''].filter(Boolean).join('\n'),
        salutation: 'เรียน',
        recipient: resolve(p.recipient || (hl ? '[ระบุผู้รับเชิญ]' : '')),
        reference: p.references.map(resolve).filter(Boolean).join('\n'),
        attachments: p.enclosures.map(resolve).filter(Boolean).join('\n'),
        bodyMode: 'free',
        body: bodyParts.join('\n'),
        closing: resolve(p.closing || 'ขอแสดงความนับถือ'),
        signer: signer.fullName,
        position: formatPersonPosition(signer),
        numeralStyle: 'thai',
        caseFolderSource,
      });
    }

    case 'PROJECT_PROPOSAL_OR_ATTACHMENT': {
      const p = item.payload;
      const proposer = p.responsiblePerson ?? s.procurementOfficer;
      const reviewer = p.reviewerPerson ?? s.divisionDirector;
      const approver = p.approverPerson ?? s.mayor;
      const sections: string[] = [];
      if (p.projectName.trim()) sections.push(`## ชื่อโครงการ\n${resolve(p.projectName)}`);
      if (p.rationale.trim()) sections.push(`## หลักการและเหตุผล\n${resolve(p.rationale)}`);
      if (p.objectives.length) {
        sections.push(
          `## วัตถุประสงค์\n${p.objectives.map((o, i) => `${toThaiDigits(i + 1)}. ${resolve(o)}`).join('\n')}`,
        );
      }
      if (p.targets.length) {
        sections.push(
          `## กลุ่มเป้าหมาย\n${p.targets.map((t, i) => `${toThaiDigits(i + 1)}. ${resolve(t)}`).join('\n')}`,
        );
      }
      if (p.scheduleAndLocation.trim()) {
        sections.push(`## ระยะเวลาและสถานที่ดำเนินการ\n${resolve(p.scheduleAndLocation)}`);
      }
      if (p.budgetSummary.trim()) {
        sections.push(`## งบประมาณ\n${resolve(p.budgetSummary)}`);
      }
      if (p.budgetTable) {
        sections.push(tableToMarkdown(folder, p.budgetTable, options));
      }
      for (const extra of p.extraSections) {
        if (extra.heading.trim() || extra.body.trim()) {
          sections.push(`## ${resolve(extra.heading)}\n${resolve(extra.body)}`);
        }
      }

      return documentSchema.parse({
        type: 'other',
        subject,
        headerSubtitle: resolve(p.subtitle),
        number: '',
        date,
        organization: a.municipalityName,
        department: a.divisionName,
        bodyMode: 'free',
        body: sections.join('\n'),
        closing: '',
        otherShowSignatures: true,
        signer: proposer.fullName,
        position: `ผู้เสนอโครงการ\n${formatPersonPosition(proposer)}`,
        opinions: [
          {
            title: 'ผู้เห็นชอบโครงการ',
            comment: '',
            name: reviewer.fullName,
            position: formatPersonPosition(reviewer),
            showDate: false,
            lines: 1,
          },
          {
            title: 'ผู้อนุมัติโครงการ',
            comment: '',
            name: approver.fullName,
            position: formatPersonPosition(approver),
            showDate: false,
            lines: 1,
          },
        ],
        numeralStyle: 'thai',
        caseFolderSource,
      });
    }

    case 'PHOTO_SHEET': {
      const p = item.payload;
      const certifier = p.certifier ?? s.procurementOfficer;
      return documentSchema.parse({
        type: 'other',
        subject,
        headerSubtitle: resolve(p.subtitle),
        number: '',
        date,
        organization: a.municipalityName,
        department: a.divisionName,
        bodyMode: 'free',
        body: resolve(p.certificationText || 'ขอรับรองว่าเป็นเอกสารที่ถูกต้อง'),
        closing: '',
        otherShowSignatures: true,
        signer: certifier.fullName,
        position: formatPersonPosition(certifier),
        appendixTitle: [subject, resolve(p.subtitle)].filter(Boolean).join('\n'),
        numeralStyle: 'thai',
        caseFolderSource,
      });
    }
  }
}

/**
 * Explicitly syncs content fields from CaseFolder into an existing bound Core draft
 * while preserving user-owned floating overlays (signatures, text boxes), appendix images,
 * and PDF attachments made in the Core editor.
 */
export function syncCaseCoreDraft<T extends Draft>(current: T, generated: Draft): T {
  const result = structuredClone(current);
  let changed = false;
  for (const key of SYNC_CASE_CONTENT_FIELDS) {
    if (JSON.stringify(current[key]) !== JSON.stringify(generated[key])) {
      changed = true;
    }
    Object.assign(result, {[key]: structuredClone(generated[key])});
  }
  result.caseFolderSource = generated.caseFolderSource;
  if (changed) result.status = 'draft';
  documentSchema.parse(result);
  return result;
}

/**
 * Builds a blank Core Draft for Quick Blank Local Word generation so blank forms
 * share 100% of Core's layout, dotted guides, margins, and signatures.
 */
export function buildBlankCaseCoreDraft(
  docType: CaseDocType,
  agency: AgencyConfig,
  signatories: SignatoryChain,
  options: {
    highlightBlanks?: boolean;
    variant?: 'INVITATION' | 'CERTIFICATE';
    fiscalYearBE?: number;
    title?: string;
    approvalChain?: MemoApprovalChain;
  } = {},
): Draft {
  const hl = options.highlightBlanks ?? true;
  const p = (prompt: string) => (hl ? `[${prompt}]` : '....................................................');
  const titleOr = (prompt: string) => (options.title?.trim() ? options.title.trim() : p(prompt));
  const fy = options.fiscalYearBE ?? new Date().getFullYear() + 543 + (new Date().getMonth() >= 9 ? 1 : 0);
  const now = new Date().toISOString();

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

  let blankItem: GeneratedDocItem;
  switch (docType) {
    case 'INTERNAL_MEMO':
      blankItem = {
        ...base,
        track: 'INTERNAL_MEMO',
        title: titleOr('พิมพ์ชื่อเรื่องบันทึกข้อความที่นี่'),
        payload: {
          docType: 'INTERNAL_MEMO',
          recipient: `นายก${agency.municipalityName}`,
          useStructuredSections: true,
          sections: {
            background: p('พิมพ์เนื้อหาเรื่องเดิมที่นี่'),
            facts: p('พิมพ์เนื้อหาข้อเท็จจริงที่นี่'),
            legalBasis: p('พิมพ์ระเบียบและกฎหมายที่เกี่ยวข้องที่นี่'),
            proposal: p('พิมพ์ข้อพิจารณาและข้อเสนอที่นี่'),
          },
          bodyParagraphs: [],
          tables: [],
          closing: 'จึงเรียนมาเพื่อโปรดพิจารณา',
          approvalChain: options.approvalChain ?? '3_TIER',
        },
      };
      break;
    case 'EXTERNAL_LETTER':
      blankItem = {
        ...base,
        track: 'EXTERNAL_LETTER',
        title: titleOr('พิมพ์ชื่อเรื่องหนังสือภายนอกที่นี่'),
        payload: {
          docType: 'EXTERNAL_LETTER',
          recipient: p('พิมพ์ตำแหน่งผู้รับหนังสือ'),
          references: [],
          enclosures: [p('ระบุสิ่งที่ส่งมาด้วย (ถ้ามี)')],
          bodyParagraphs: [
            p('พิมพ์เนื้อหาหนังสือภายนอกย่อหน้าที่ ๑ ที่นี่'),
            p('พิมพ์เนื้อหาหนังสือภายนอกย่อหน้าที่ ๒ ที่นี่'),
          ],
          tables: [],
          closing: 'ขอแสดงความนับถือ',
        },
      };
      break;
    case 'MUNICIPAL_ORDER':
      blankItem = {
        ...base,
        track: 'MUNICIPAL_ORDER',
        title: titleOr('พิมพ์ชื่อเรื่องคำสั่งเทศบาลที่นี่'),
        payload: {
          docType: 'MUNICIPAL_ORDER',
          preambleParagraphs: [p('พิมพ์เหตุผลและความจำเป็นในการออกคำสั่งที่นี่')],
          appointees: [
            {fullName: p('ชื่อ-สกุล ผู้ได้รับแต่งตั้ง ลำดับที่ ๑'), position: p('ตำแหน่ง'), role: p('บทบาท/หน้าที่')},
            {fullName: p('ชื่อ-สกุล ผู้ได้รับแต่งตั้ง ลำดับที่ ๒'), position: p('ตำแหน่ง'), role: p('บทบาท/หน้าที่')},
          ],
          dutiesParagraphs: [p('พิมพ์อำนาจหน้าที่ของผู้ได้รับแต่งตั้งที่นี่')],
          effectiveNote: 'ทั้งนี้ ตั้งแต่บัดนี้เป็นต้นไป',
          routingStripMode: 'FIRST_COPY_ONLY',
        },
      };
      break;
    case 'ANNOUNCEMENT':
      blankItem = {
        ...base,
        track: 'ANNOUNCEMENT',
        title: titleOr('พิมพ์ชื่อเรื่องประกาศเทศบาลที่นี่'),
        payload: {
          docType: 'ANNOUNCEMENT',
          registryLogNo: '',
          bodyParagraphs: [p('พิมพ์เนื้อหาประกาศย่อหน้าที่ ๑ ที่นี่'), p('พิมพ์รายละเอียดหรือกำหนดการประกาศที่นี่')],
          tables: [],
          closingNote: 'จึงประกาศให้ทราบโดยทั่วกัน',
          routingStripMode: 'FIRST_COPY_ONLY',
        },
      };
      break;
    case 'CERTIFICATE_OR_INVITATION': {
      const variant = options.variant ?? 'INVITATION';
      blankItem = {
        ...base,
        track: variant === 'INVITATION' ? 'EXTERNAL_LETTER' : 'NONE',
        title: titleOr(
          variant === 'CERTIFICATE'
            ? 'พิมพ์เรื่องหนังสือรับรองที่นี่'
            : 'พิมพ์เรื่องหนังสือเชิญวิทยากร/เชิญประชุมที่นี่',
        ),
        payload: {
          docType: 'CERTIFICATE_OR_INVITATION',
          variant,
          certificateNo: '',
          recipient: variant === 'INVITATION' ? p('พิมพ์ชื่อ/ตำแหน่งผู้รับเชิญ') : '',
          references: [],
          enclosures: variant === 'INVITATION' ? [p('กำหนดการ/วาระการประชุม จำนวน ๑ ชุด')] : [],
          eventDate: variant === 'INVITATION' ? p('ระบุวัน/วันที่จัดงาน') : '',
          eventTime: variant === 'INVITATION' ? p('ระบุเวลา') : '',
          eventLocation: variant === 'INVITATION' ? p('ระบุสถานที่จัดงาน') : '',
          bodyParagraphs: [
            variant === 'CERTIFICATE'
              ? p('พิมพ์ข้อความรับรองบุคคล/หน่วยงาน/ข้อเท็จจริงที่นี่')
              : p('พิมพ์ข้อความเชิญเข้าร่วมประชุมหรือเป็นวิทยากรที่นี่'),
          ],
          agendaTable:
            variant === 'INVITATION'
              ? {
                  caption: 'กำหนดการโดยสังเขป',
                  columns: ['เวลา', 'กิจกรรม / วาระ'],
                  columnWidths: [25, 75],
                  rows: [{cells: [p('๐๙.๐๐ - ๑๒.๐๐ น.'), p('พิมพ์รายละเอียดกิจกรรม')]}],
                  footerRows: [],
                  bordered: true,
                }
              : undefined,
          closing: 'ขอแสดงความนับถือ',
        },
      };
      break;
    }
    case 'PROJECT_PROPOSAL_OR_ATTACHMENT':
      blankItem = {
        ...base,
        track: 'NONE',
        title: titleOr('พิมพ์ชื่อโครงการหรือเอกสารประกอบที่นี่'),
        payload: {
          docType: 'PROJECT_PROPOSAL_OR_ATTACHMENT',
          subtitle: `ประจำปีงบประมาณ พ.ศ. ${fy}`,
          projectName: titleOr('พิมพ์ชื่อโครงการเต็มที่นี่'),
          rationale: p('พิมพ์หลักการและเหตุผลของโครงการที่นี่'),
          objectives: [p('พิมพ์วัตถุประสงค์ข้อที่ ๑'), p('พิมพ์วัตถุประสงค์ข้อที่ ๒')],
          targets: [p('พิมพ์กลุ่มเป้าหมายและจำนวนผู้เข้าร่วม')],
          scheduleAndLocation: p('พิมพ์ระยะเวลาและสถานที่ดำเนินการ'),
          budgetSummary: p('พิมพ์แหล่งงบประมาณและยอดเงินรวม'),
          budgetTable: {
            columns: ['ลำดับ', 'รายการค่าใช้จ่าย', 'จำนวนเงิน (บาท)'],
            columnWidths: [12, 63, 25],
            rows: [{cells: ['๑', p('พิมพ์รายการค่าใช้จ่าย'), p('๐.๐๐')]}],
            footerRows: [{cells: ['', 'รวมเป็นเงินทั้งสิ้น', p('๐.๐๐')]}],
            bordered: true,
          },
          extraSections: [],
        },
      };
      break;
    case 'PHOTO_SHEET':
      blankItem = {
        ...base,
        track: 'NONE',
        title: titleOr('พิมพ์หัวเรื่องภาพถ่ายประกอบกิจกรรมที่นี่'),
        payload: {
          docType: 'PHOTO_SHEET',
          subtitle: p('พิมพ์วัน/สถานที่จัดกิจกรรม (ถ้ามี)'),
          layout: '2_PER_PAGE',
          photos: [],
          certificationText: 'ขอรับรองว่าเป็นเอกสารที่ถูกต้อง',
        },
      };
      break;
  }

  const syntheticFolder: CaseFolder = {
    id: 'quick-blank-form',
    name: blankItem.title,
    fiscalYearBE: fy,
    category: 'แบบฟอร์มเปล่า',
    status: 'DRAFT',
    description: '',
    agency,
    signatories,
    variables: [],
    stages: [{id: 'stage-1', name: 'แบบฟอร์มเปล่า', order: 0}],
    items: [blankItem],
    createdAt: now,
    updatedAt: now,
  };

  return mapCaseItemToCoreDraft(syntheticFolder, blankItem, {highlightBlanks: hl});
}
