import {
  formatThaiDate,
  formatThaiSignatureDate,
  toThaiDigits,
  toThaiOfficialText,
} from '../../procurement/formatting';
import type {
  ApprovalBox,
  Density,
  DocumentFamily,
  SignatureBlock,
} from '../../procurement/templates/ir';
import {SARABUN_RULES} from '../../procurement/templates/sarabun-rules';
import type {Person} from '../../procurement/types';
import {
  formatOfficialNumber,
  resolveCaseText,
  splitHighlightPrompts,
} from '../resolver';
import type {
  CaseDocType,
  CaseFolder,
  CaseTableSpec,
  GeneratedDocItem,
  LinkedModuleSummary,
  RoutingStripVisibility,
  TextRunSegment,
} from '../types';

export interface CaseParagraphBlock {
  kind: 'paragraph';
  heading?: string;
  segments: TextRunSegment[];
  text: string;
  indent: boolean;
  align?: 'left' | 'center' | 'right' | 'justify';
  bold?: boolean;
  sizePt?: number;
  keepNext?: boolean;
}

export interface CaseTableBlock {
  kind: 'table';
  caption?: string;
  columns: string[];
  columnWidths?: number[];
  rows: Array<Array<{segments: TextRunSegment[]; text: string; align?: 'left' | 'center' | 'right'; bold?: boolean}>>;
  footerRows: Array<Array<{segments: TextRunSegment[]; text: string; align?: 'left' | 'center' | 'right'; bold?: boolean}>>;
  bordered: boolean;
  repeatHeader: true;
  continuationCaption: string;
}

export interface CaseSignatureClusterBlock {
  kind: 'signature-cluster';
  closing: string[];
  signatures: SignatureBlock[];
  approvals: ApprovalBox[];
  approvalLayout: 'grid' | 'vertical';
}

export interface CasePhotoGridBlock {
  kind: 'photo-grid';
  columns: 1 | 2;
  maxHeightCm: number;
  photos: Array<{id: string; source: string; caption: string}>;
}

export type CaseDocumentBlock =
  | CaseParagraphBlock
  | CaseTableBlock
  | CaseSignatureClusterBlock
  | CasePhotoGridBlock;

export interface CaseDocumentIR {
  itemId: string;
  docType: CaseDocType;
  family: DocumentFamily;
  garudaCm: 0 | 1.5 | 3;
  title: string;
  copies: number;
  highlightBlanks: boolean;
  header: {
    lines: string[];
    department?: string;
    number?: TextRunSegment[];
    date?: TextRunSegment[];
    subject?: TextRunSegment[];
    recipient?: TextRunSegment[];
    references?: TextRunSegment[][];
    enclosures?: TextRunSegment[][];
    addressLines?: string[];
    centeredDivider?: boolean;
    certificateNo?: TextRunSegment[];
  };
  blocks: CaseDocumentBlock[];
  footerLines: string[];
  continuationNote: string;
  routingStrip: {visibility: 'FIRST_COPY' | 'ALL_COPIES'; lines: string[]} | null;
  layout: {
    density: Density;
    marginsCm: {top: number; bottom: number; left: number; right: number};
  };
}

export interface BuildCaseDocOptions {
  highlightBlanks?: boolean;
  density?: Density;
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>;
}

function makeSignatory(person: Person, label = '', dateIso?: string): SignatureBlock {
  const acting = person.actingLine?.trim();
  const role = acting
    ? acting.startsWith(person.position)
      ? acting
      : `${person.position} ${acting}`
    : person.position;
  return {
    kind: 'signature',
    name: toThaiOfficialText(person.fullName),
    lines: [role, person.actingTarget].filter((v): v is string => Boolean(v && v.trim())).map(v => toThaiOfficialText(v)),
    label: toThaiOfficialText(label),
    ...(dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? {date: formatThaiSignatureDate(dateIso)} : {}),
    showSignatureLine: true,
  };
}

function resolveSegments(
  folder: CaseFolder,
  raw: string,
  options: BuildCaseDocOptions,
): {text: string; segments: TextRunSegment[]} {
  const resolved = resolveCaseText(folder, raw, {
    highlightBlanks: options.highlightBlanks,
    linkedSummaries: options.linkedSummaries,
  });
  if (!options.highlightBlanks) {
    return {text: resolved.text, segments: resolved.segments};
  }
  const expanded: TextRunSegment[] = [];
  for (const seg of resolved.segments) {
    if (seg.highlightBlank) {
      expanded.push(seg);
    } else {
      expanded.push(...splitHighlightPrompts(seg.text, true));
    }
  }
  return {text: expanded.map(s => s.text).join(''), segments: expanded};
}

function makeParagraph(
  folder: CaseFolder,
  raw: string,
  options: BuildCaseDocOptions,
  extra: Partial<Omit<CaseParagraphBlock, 'kind' | 'segments' | 'text'>> = {},
): CaseParagraphBlock {
  const {text, segments} = resolveSegments(folder, raw, options);
  return {
    kind: 'paragraph',
    text,
    segments,
    indent: extra.indent ?? true,
    ...(extra.heading ? {heading: toThaiOfficialText(extra.heading)} : {}),
    ...(extra.align ? {align: extra.align} : {}),
    ...(extra.bold ? {bold: extra.bold} : {}),
    ...(extra.sizePt ? {sizePt: extra.sizePt} : {}),
    ...(extra.keepNext ? {keepNext: extra.keepNext} : {}),
  };
}

function makeTable(
  folder: CaseFolder,
  spec: CaseTableSpec,
  options: BuildCaseDocOptions,
): CaseTableBlock {
  const mapRows = (rows: CaseTableSpec['rows'], bold = false) =>
    rows.map(row =>
      row.cells.map(cellRaw => {
        const {text, segments} = resolveSegments(folder, cellRaw, options);
        return {text, segments, bold};
      }),
    );
  return {
    kind: 'table',
    caption: spec.caption ? resolveSegments(folder, spec.caption, options).text : undefined,
    columns: spec.columns.map(c => resolveSegments(folder, c, options).text),
    columnWidths: spec.columnWidths,
    rows: mapRows(spec.rows),
    footerRows: mapRows(spec.footerRows, true),
    bordered: spec.bordered,
    repeatHeader: true,
    continuationCaption: 'ตารางรายการ (ต่อ)',
  };
}

function makeRoutingStrip(
  folder: CaseFolder,
  mode: RoutingStripVisibility,
): CaseDocumentIR['routingStrip'] {
  if (mode === 'NONE') return null;
  return {
    visibility: mode === 'ALL_COPIES' ? 'ALL_COPIES' : 'FIRST_COPY',
    lines: [
      'รองนายกเทศมนตรี',
      'ปลัดเทศบาล',
      'รองปลัดเทศบาล',
      `ผอ.${folder.agency.divisionName}`,
      'หัวหน้าฝ่าย',
      'หัวหน้างาน',
      'จนท./ร่าง/พิมพ์/ทาน',
    ].map(v => toThaiOfficialText(`........ ${v}`)),
  };
}

function makeBlankOrValueSegments(
  value: string,
  blankPrompt: string,
  highlightBlanks: boolean,
  prefix?: string,
): TextRunSegment[] {
  if (value.trim()) {
    return splitHighlightPrompts(toThaiOfficialText(value.trim()), highlightBlanks);
  }
  const normalizedPrefix = prefix ? `${toThaiOfficialText(prefix)}/` : '';
  const placeholder: TextRunSegment = {
    text: highlightBlanks ? `[${toThaiOfficialText(blankPrompt)}]` : '................',
    highlightBlank: highlightBlanks,
    tokenKind: 'blank',
  };
  return normalizedPrefix
    ? [{text: normalizedPrefix, highlightBlank: false}, placeholder]
    : [placeholder];
}

function formatDateSegments(iso: string | undefined, highlightBlanks: boolean): TextRunSegment[] {
  if (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    return [{text: formatThaiDate(iso), highlightBlank: false}];
  }
  return [
    {
      text: highlightBlanks ? '[ลงวันที่]' : '................',
      highlightBlank: highlightBlanks,
      tokenKind: 'blank',
    },
  ];
}

/**
 * Converts any of the 7 official Thai government document types inside a CaseFolder
 * into a renderer-neutral CaseDocumentIR (reusing Phase 2 Sarabun margin/density rules).
 */
export function buildCaseDocumentIR(
  folder: CaseFolder,
  item: GeneratedDocItem,
  options: BuildCaseDocOptions = {},
): CaseDocumentIR {
  const highlightBlanks = options.highlightBlanks === true;
  const density: Density = options.density ?? 'normal';
  const a = folder.agency;
  const s = folder.signatories;
  const subjectResolved = resolveSegments(folder, item.title, options);
  const officialNo = formatOfficialNumber(folder, item);
  const dateSegs = formatDateSegments(item.date, highlightBlanks);
  const datePlain = item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? formatThaiDate(item.date) : '................';

  switch (item.payload.docType) {
    case 'INTERNAL_MEMO': {
      const p = item.payload;
      const blocks: CaseDocumentBlock[] = [];
      if (p.useStructuredSections) {
        const secDefs: Array<[string, string]> = [
          ['เรื่องเดิม', p.sections.background],
          ['ข้อเท็จจริง', p.sections.facts],
          ['ข้อระเบียบและกฎหมาย', p.sections.legalBasis],
          ['ข้อพิจารณาและข้อเสนอ', p.sections.proposal],
        ];
        for (const [heading, text] of secDefs) {
          if (text.trim()) {
            blocks.push(makeParagraph(folder, text, options, {heading, indent: true}));
          }
        }
      }
      for (const body of p.bodyParagraphs) {
        if (body.trim()) blocks.push(makeParagraph(folder, body, options, {indent: true}));
      }
      for (const tbl of p.tables) {
        blocks.push(makeTable(folder, tbl, options));
      }

      const proposer = p.proposer ?? (p.approvalChain === '2_TIER' ? s.divisionDirector : s.procurementOfficer);
      const approvals: ApprovalBox[] = [];
      let approvalLayout: 'grid' | 'vertical' = 'grid';

      if (p.approvalChain === '2_TIER') {
        approvals.push(
          {heading: toThaiOfficialText(`เรียน นายก${a.municipalityName}`), comments: ['- เพื่อโปรดพิจารณาอนุมัติ'], signature: makeSignatory(s.municipalClerk)},
          {heading: 'อนุมัติ', comments: [], signature: makeSignatory(s.mayor)},
        );
      } else if (p.approvalChain === '3_TIER') {
        approvals.push(
          {heading: toThaiOfficialText(`เรียน ปลัด${a.municipalityName}`), comments: ['- เพื่อโปรดพิจารณา'], signature: makeSignatory(s.divisionDirector)},
          {heading: toThaiOfficialText(`เรียน นายก${a.municipalityName}`), comments: ['- เพื่อโปรดพิจารณาอนุมัติ'], signature: makeSignatory(s.municipalClerk)},
          {heading: 'อนุมัติ', comments: [], signature: makeSignatory(s.mayor)},
        );
      } else if (p.approvalChain === '4_TIER_VERTICAL') {
        approvalLayout = 'vertical';
        approvals.push(
          {heading: 'ความเห็นของหัวหน้าเจ้าหน้าที่', comments: ['................................................................'], signature: makeSignatory(s.divisionDirector)},
          {heading: 'ความเห็นของปลัดเทศบาล', comments: ['................................................................'], signature: makeSignatory(s.municipalClerk)},
          {heading: toThaiOfficialText(`ความคิดเห็นของนายก${a.municipalityName}`), comments: ['- ทราบ/เห็นชอบ'], signature: makeSignatory(s.mayor)},
        );
      }

      blocks.push({
        kind: 'signature-cluster',
        closing: p.closing.trim() ? [resolveSegments(folder, p.closing, options).text] : [],
        signatures: [makeSignatory(proposer)],
        approvals,
        approvalLayout,
      });

      const dept = p.department?.trim()
        ? p.department.trim()
        : `${a.sectionName} ${a.divisionName} ${a.municipalityName} โทร. ${a.phoneDisplay}`;
      const recipient = p.recipient.trim() || `นายก${a.municipalityName}`;
      const numberSegs = makeBlankOrValueSegments(
        officialNo,
        'เลขที่บันทึก',
        highlightBlanks,
        a.codes.internalMemoPrefix,
      );

      return {
        itemId: item.id,
        docType: 'INTERNAL_MEMO',
        family: 'MEMO',
        garudaCm: 1.5,
        title: subjectResolved.text,
        copies: item.copies,
        highlightBlanks,
        header: {
          lines: ['บันทึกข้อความ'],
          department: toThaiOfficialText(dept),
          number: numberSegs,
          date: dateSegs,
          subject: subjectResolved.segments,
          recipient: resolveSegments(folder, recipient, options).segments,
        },
        blocks,
        footerLines: [],
        continuationNote: toThaiOfficialText(
          `ใบต่อบันทึกข้อความ เรื่อง ${subjectResolved.text}${officialNo ? ` ที่ ${officialNo}` : ''} ลงวันที่ ${datePlain}`,
        ),
        routingStrip: null,
        layout: {
          density,
          marginsCm: {...SARABUN_RULES.marginsCm.memo},
        },
      };
    }

    case 'EXTERNAL_LETTER': {
      const p = item.payload;
      const blocks: CaseDocumentBlock[] = [];
      for (const body of p.bodyParagraphs) {
        if (body.trim()) blocks.push(makeParagraph(folder, body, options, {indent: true}));
      }
      for (const tbl of p.tables) {
        blocks.push(makeTable(folder, tbl, options));
      }
      blocks.push({
        kind: 'signature-cluster',
        closing: [resolveSegments(folder, p.closing || 'ขอแสดงความนับถือ', options).text],
        signatures: [makeSignatory(p.signer ?? s.mayor)],
        approvals: [],
        approvalLayout: 'grid',
      });

      const footerLines = [
        toThaiOfficialText(p.footerDivision || a.subDepartmentFooter),
        toThaiOfficialText(`โทร. ${p.footerPhone || a.phoneShort}`),
        ...(p.footerFax || a.fax ? [toThaiOfficialText(`โทรสาร ${p.footerFax || a.fax}`)] : []),
      ];

      return {
        itemId: item.id,
        docType: 'EXTERNAL_LETTER',
        family: 'EXTERNAL_LETTER',
        garudaCm: 3,
        title: subjectResolved.text,
        copies: item.copies,
        highlightBlanks,
        header: {
          lines: [],
          number: makeBlankOrValueSegments(
            officialNo,
            'เลขหนังสือภายนอก',
            highlightBlanks,
            a.codes.externalLetterPrefix,
          ),
          addressLines: [toThaiOfficialText(a.officeTitle), toThaiOfficialText(a.externalAddressLine)],
          date: dateSegs,
          subject: subjectResolved.segments,
          recipient: resolveSegments(folder, p.recipient || '[ระบุผู้รับหนังสือ]', options).segments,
          references: p.references.filter(r => r.trim()).map(r => resolveSegments(folder, r, options).segments),
          enclosures: p.enclosures.filter(e => e.trim()).map(e => resolveSegments(folder, e, options).segments),
        },
        blocks,
        footerLines,
        continuationNote: toThaiOfficialText(
          `ใบต่อหนังสือภายนอก เรื่อง ${subjectResolved.text}${officialNo ? ` ที่ ${officialNo}` : ''} ลงวันที่ ${datePlain}`,
        ),
        routingStrip: null,
        layout: {
          density,
          marginsCm: {...SARABUN_RULES.marginsCm.official},
        },
      };
    }

    case 'MUNICIPAL_ORDER': {
      const p = item.payload;
      const blocks: CaseDocumentBlock[] = [];
      for (const para of p.preambleParagraphs) {
        if (para.trim()) blocks.push(makeParagraph(folder, para, options, {indent: true}));
      }
      p.appointees.forEach((ap, idx) => {
        const line = `${toThaiDigits(idx + 1)}. ${ap.fullName}${ap.position ? ` ตำแหน่ง ${ap.position}` : ''}${ap.role ? ` เป็น${ap.role}` : ''}`;
        blocks.push(makeParagraph(folder, line, options, {indent: false}));
      });
      for (const duty of p.dutiesParagraphs) {
        if (duty.trim()) blocks.push(makeParagraph(folder, duty, options, {indent: true}));
      }
      if (p.effectiveNote.trim()) {
        blocks.push(makeParagraph(folder, p.effectiveNote, options, {indent: true}));
      }
      blocks.push({
        kind: 'signature-cluster',
        closing: [
          item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
            ? `สั่ง ณ ${formatThaiSignatureDate(item.date)}`
            : highlightBlanks
              ? 'สั่ง ณ [วันที่ เดือน พ.ศ.]'
              : 'สั่ง ณ วันที่ ........ เดือน ................ พ.ศ. ........',
        ],
        signatures: [makeSignatory(p.signer ?? s.mayor)],
        approvals: [],
        approvalLayout: 'grid',
      });

      const orderNoText = officialNo || (highlightBlanks ? '[เลขที่คำสั่ง/พ.ศ.]' : '......../........');
      return {
        itemId: item.id,
        docType: 'MUNICIPAL_ORDER',
        family: 'ORDER',
        garudaCm: 3,
        title: subjectResolved.text,
        copies: item.copies,
        highlightBlanks,
        header: {
          lines: [
            toThaiOfficialText(`คำสั่ง${a.municipalityName}`),
            toThaiOfficialText(`ที่ ${orderNoText}`),
            `เรื่อง ${subjectResolved.text}`,
          ],
          centeredDivider: true,
        },
        blocks,
        footerLines: [],
        continuationNote: toThaiOfficialText(`ใบต่อคำสั่ง${a.municipalityName} ที่ ${orderNoText} เรื่อง ${subjectResolved.text}`),
        routingStrip: makeRoutingStrip(folder, p.routingStripMode),
        layout: {
          density,
          marginsCm: {...SARABUN_RULES.marginsCm.official},
        },
      };
    }

    case 'ANNOUNCEMENT': {
      const p = item.payload;
      const blocks: CaseDocumentBlock[] = [];
      for (const body of p.bodyParagraphs) {
        if (body.trim()) blocks.push(makeParagraph(folder, body, options, {indent: true}));
      }
      for (const tbl of p.tables) {
        blocks.push(makeTable(folder, tbl, options));
      }
      if (p.closingNote.trim()) {
        blocks.push(makeParagraph(folder, p.closingNote, options, {indent: true}));
      }
      blocks.push({
        kind: 'signature-cluster',
        closing: [
          item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
            ? `ประกาศ ณ ${formatThaiSignatureDate(item.date)}`
            : highlightBlanks
              ? 'ประกาศ ณ [วันที่ เดือน พ.ศ.]'
              : 'ประกาศ ณ วันที่ ........ เดือน ................ พ.ศ. ........',
        ],
        signatures: [makeSignatory(p.signer ?? s.mayor)],
        approvals: [],
        approvalLayout: 'grid',
      });

      // Track 3 announcements NEVER print registryLogNo on the document
      return {
        itemId: item.id,
        docType: 'ANNOUNCEMENT',
        family: 'ANNOUNCEMENT',
        garudaCm: 3,
        title: subjectResolved.text,
        copies: item.copies,
        highlightBlanks,
        header: {
          lines: [
            toThaiOfficialText(`ประกาศ${a.municipalityName}`),
            `เรื่อง ${subjectResolved.text}`,
          ],
          centeredDivider: true,
        },
        blocks,
        footerLines: [],
        continuationNote: toThaiOfficialText(`ใบต่อประกาศ${a.municipalityName} เรื่อง ${subjectResolved.text}`),
        routingStrip: makeRoutingStrip(folder, p.routingStripMode),
        layout: {
          density,
          marginsCm: {...SARABUN_RULES.marginsCm.official},
        },
      };
    }

    case 'CERTIFICATE_OR_INVITATION': {
      const p = item.payload;
      if (p.variant === 'CERTIFICATE') {
        const blocks: CaseDocumentBlock[] = [];
        for (const body of p.bodyParagraphs) {
          if (body.trim()) blocks.push(makeParagraph(folder, body, options, {indent: true}));
        }
        blocks.push({
          kind: 'signature-cluster',
          closing: [
            item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date)
              ? `ให้ไว้ ณ ${formatThaiSignatureDate(item.date)}`
              : highlightBlanks
                ? 'ให้ไว้ ณ [วันที่ เดือน พ.ศ.]'
                : 'ให้ไว้ ณ วันที่ ........ เดือน ................ พ.ศ. ........',
          ],
          signatures: [makeSignatory(p.signer ?? s.mayor)],
          approvals: [],
          approvalLayout: 'grid',
        });

        const certNo = p.certificateNo.trim() || officialNo;
        return {
          itemId: item.id,
          docType: 'CERTIFICATE_OR_INVITATION',
          family: 'ORDER',
          garudaCm: 3,
          title: subjectResolved.text,
          copies: item.copies,
          highlightBlanks,
          header: {
            lines: [
              'หนังสือรับรอง',
              toThaiOfficialText(a.officeTitle),
            ],
            certificateNo: makeBlankOrValueSegments(certNo, 'เลขที่หนังสือรับรอง', highlightBlanks),
            centeredDivider: true,
          },
          blocks,
          footerLines: [],
          continuationNote: toThaiOfficialText(`ใบต่อหนังสือรับรอง ${subjectResolved.text}`),
          routingStrip: null,
          layout: {
            density,
            marginsCm: {...SARABUN_RULES.marginsCm.official},
          },
        };
      }

      // INVITATION variant (formal external letter with event date/time/location + optional agenda table)
      const blocks: CaseDocumentBlock[] = [];
      for (const body of p.bodyParagraphs) {
        if (body.trim()) blocks.push(makeParagraph(folder, body, options, {indent: true}));
      }
      if (p.eventDate || p.eventTime || p.eventLocation) {
        const detailLine = [
          p.eventDate ? `วัน/วันที่ ${p.eventDate}` : '',
          p.eventTime ? `เวลา ${p.eventTime}` : '',
          p.eventLocation ? `ณ ${p.eventLocation}` : '',
        ]
          .filter(Boolean)
          .join(' ');
        if (detailLine.trim()) {
          blocks.push(makeParagraph(folder, detailLine, options, {indent: true}));
        }
      }
      if (p.agendaTable) {
        blocks.push(makeTable(folder, p.agendaTable, options));
      }
      blocks.push({
        kind: 'signature-cluster',
        closing: [resolveSegments(folder, p.closing || 'ขอแสดงความนับถือ', options).text],
        signatures: [makeSignatory(p.signer ?? s.mayor)],
        approvals: [],
        approvalLayout: 'grid',
      });

      return {
        itemId: item.id,
        docType: 'CERTIFICATE_OR_INVITATION',
        family: 'EXTERNAL_LETTER',
        garudaCm: 3,
        title: subjectResolved.text,
        copies: item.copies,
        highlightBlanks,
        header: {
          lines: [],
          number: makeBlankOrValueSegments(
            officialNo,
            `เลขหนังสือเชิญ (${a.codes.externalLetterPrefix}/...)`,
            highlightBlanks,
          ),
          addressLines: [toThaiOfficialText(a.officeTitle), toThaiOfficialText(a.externalAddressLine)],
          date: dateSegs,
          subject: subjectResolved.segments,
          recipient: resolveSegments(folder, p.recipient || '[ระบุผู้รับเชิญ]', options).segments,
          references: p.references.filter(r => r.trim()).map(r => resolveSegments(folder, r, options).segments),
          enclosures: p.enclosures.filter(e => e.trim()).map(e => resolveSegments(folder, e, options).segments),
        },
        blocks,
        footerLines: [
          toThaiOfficialText(a.subDepartmentFooter),
          toThaiOfficialText(`โทร. ${a.phoneShort}`),
        ],
        continuationNote: toThaiOfficialText(`ใบต่อหนังสือเชิญ เรื่อง ${subjectResolved.text}`),
        routingStrip: null,
        layout: {
          density,
          marginsCm: {...SARABUN_RULES.marginsCm.official},
        },
      };
    }

    case 'PROJECT_PROPOSAL_OR_ATTACHMENT': {
      const p = item.payload;
      const blocks: CaseDocumentBlock[] = [];
      let secNo = 1;
      const pushSection = (label: string, content: string) => {
        if (!content.trim()) return;
        blocks.push(makeParagraph(folder, content, options, {heading: `${toThaiDigits(secNo++)}. ${label}`, indent: true}));
      };
      pushSection('ชื่อโครงการ', p.projectName);
      pushSection('หลักการและเหตุผล', p.rationale);
      if (p.objectives.length) {
        const heading = `${toThaiDigits(secNo++)}. วัตถุประสงค์`;
        p.objectives.forEach((obj, idx) => {
          blocks.push(
            makeParagraph(folder, `${toThaiDigits(secNo - 1)}.${toThaiDigits(idx + 1)} ${obj}`, options, {
              heading: idx === 0 ? heading : undefined,
              indent: false,
            }),
          );
        });
      }
      if (p.targets.length) {
        const heading = `${toThaiDigits(secNo++)}. เป้าหมาย`;
        p.targets.forEach((tgt, idx) => {
          blocks.push(
            makeParagraph(folder, `${toThaiDigits(secNo - 1)}.${toThaiDigits(idx + 1)} ${tgt}`, options, {
              heading: idx === 0 ? heading : undefined,
              indent: false,
            }),
          );
        });
      }
      pushSection('ระยะเวลาและสถานที่ดำเนินการ', p.scheduleAndLocation);
      if (p.budgetSummary.trim() || p.budgetTable) {
        const heading = `${toThaiDigits(secNo++)}. งบประมาณ`;
        if (p.budgetSummary.trim()) {
          blocks.push(makeParagraph(folder, p.budgetSummary, options, {heading, indent: true}));
        } else {
          blocks.push(makeParagraph(folder, 'รายละเอียดค่าใช้จ่ายดังตารางต่อไปนี้', options, {heading, indent: true}));
        }
        if (p.budgetTable) {
          blocks.push(makeTable(folder, p.budgetTable, options));
        }
      }
      for (const extra of p.extraSections) {
        if (extra.heading.trim() || extra.body.trim()) {
          blocks.push(
            makeParagraph(folder, extra.body || ' ', options, {
              heading: extra.heading ? `${toThaiDigits(secNo++)}. ${extra.heading}` : undefined,
              indent: true,
            }),
          );
        }
      }

      const approvals: ApprovalBox[] = [
        {heading: 'ผู้เห็นชอบโครงการ', comments: [], signature: makeSignatory(p.reviewerPerson ?? s.municipalClerk)},
        {heading: 'ผู้อนุมัติโครงการ', comments: [], signature: makeSignatory(p.approverPerson ?? s.mayor)},
      ];
      blocks.push({
        kind: 'signature-cluster',
        closing: [],
        signatures: [makeSignatory(p.responsiblePerson ?? s.divisionDirector, 'ผู้รับผิดชอบโครงการ')],
        approvals,
        approvalLayout: 'grid',
      });

      return {
        itemId: item.id,
        docType: 'PROJECT_PROPOSAL_OR_ATTACHMENT',
        family: 'TOR',
        garudaCm: 0,
        title: subjectResolved.text,
        copies: item.copies,
        highlightBlanks,
        header: {
          lines: [
            subjectResolved.text,
            ...(p.subtitle.trim() ? [resolveSegments(folder, p.subtitle, options).text] : []),
          ],
        },
        blocks,
        footerLines: [],
        continuationNote: toThaiOfficialText(`ใบต่อเอกสาร เรื่อง ${subjectResolved.text}`),
        routingStrip: null,
        layout: {
          density,
          marginsCm: {...SARABUN_RULES.marginsCm.official},
        },
      };
    }

    case 'PHOTO_SHEET': {
      const p = item.payload;
      const columns: 1 | 2 = p.layout === 'GRID_2X2' ? 2 : 1;
      const maxHeightCm = p.layout === '1_PER_PAGE' ? 16 : p.layout === 'GRID_2X2' ? 8.5 : 9.5;
      const blocks: CaseDocumentBlock[] = [
        {
          kind: 'photo-grid',
          columns,
          maxHeightCm,
          photos: p.photos.map(ph => ({
            id: ph.id,
            source: ph.source,
            caption: resolveSegments(folder, ph.caption, options).text,
          })),
        },
        {
          kind: 'signature-cluster',
          closing: [resolveSegments(folder, p.certificationText || 'ขอรับรองว่าเป็นเอกสารที่ถูกต้อง', options).text],
          signatures: [makeSignatory(p.certifier ?? s.procurementOfficer)],
          approvals: [],
          approvalLayout: 'grid',
        },
      ];

      return {
        itemId: item.id,
        docType: 'PHOTO_SHEET',
        family: 'PHOTO_SHEET',
        garudaCm: 0,
        title: subjectResolved.text,
        copies: item.copies,
        highlightBlanks,
        header: {
          lines: [
            subjectResolved.text,
            ...(p.subtitle.trim() ? [resolveSegments(folder, p.subtitle, options).text] : []),
          ],
        },
        blocks,
        footerLines: [],
        continuationNote: toThaiOfficialText(`ใบต่อภาพประกอบ ${subjectResolved.text}`),
        routingStrip: null,
        layout: {
          density,
          marginsCm: {...SARABUN_RULES.marginsCm.official},
        },
      };
    }
  }
}
