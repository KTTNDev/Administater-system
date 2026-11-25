import 'server-only';
import sharp from 'sharp';
import JSZip from 'jszip';
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  ImageRun,
  LineRuleType,
  NumberFormat,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type FileChild,
  type IParagraphOptions,
} from 'docx';
import {loadGarudaAsset, loadSarabunFonts} from '../../procurement/assets/loader';
import {
  A4_TWIPS,
  blackBorders,
  cmToTwip,
  fontAttributes,
  noBorders,
  ptToHalfPt,
  sarabunWordStyles,
} from '../../procurement/exporters/docx/styles';
import {fitPhotoDimensions, normalizeInspectionPhoto} from '../../procurement/media/photo-processor';
import type {SignatureBlock} from '../../procurement/templates/ir';
import type {TextRunSegment} from '../types';
import {splitHighlightPrompts} from '../resolver';
import type {CaseDocumentBlock, CaseDocumentIR, CaseTableBlock} from './all-doc-builders';

interface DocxRenderCtx {
  font: string;
  contentWidth: number;
  garuda: {buffer: Buffer; width: number; height: number};
}

function makeTextRuns(
  segments: readonly TextRunSegment[],
  font: string,
  bold = false,
  sizePt = 16,
): TextRun[] {
  const runs: TextRun[] = [];
  for (const seg of segments) {
    const lines = seg.text.split('\n');
    lines.forEach((line, idx) => {
      runs.push(
        new TextRun({
          text: line,
          ...(idx > 0 ? {break: 1} : {}),
          font: fontAttributes(font),
          bold,
          boldComplexScript: bold,
          italics: false,
          italicsComplexScript: false,
          color: '000000',
          size: ptToHalfPt(sizePt),
          sizeComplexScript: ptToHalfPt(sizePt),
          ...(seg.highlightBlank ? {highlight: 'yellow'} : {}),
          language: {value: 'th-TH', eastAsia: 'th-TH', bidirectional: 'th-TH'},
        }),
      );
    });
  }
  return runs;
}

function plainPara(
  text: string,
  font: string,
  options: IParagraphOptions = {},
  bold = false,
  sizePt = 16,
): Paragraph {
  const linePt = sizePt === 29 ? 29 : sizePt === 18 ? 20.5 : sizePt * 1.15;
  return new Paragraph({
    ...options,
    spacing: {
      line: Math.round(linePt * 20),
      lineRule: LineRuleType.EXACT,
      after: 0,
      ...options.spacing,
    },
    children: makeTextRuns([{text, highlightBlank: false}], font, bold, sizePt),
  });
}

function segPara(
  segments: readonly TextRunSegment[],
  font: string,
  options: IParagraphOptions = {},
  bold = false,
  sizePt = 16,
): Paragraph {
  const linePt = sizePt === 29 ? 29 : sizePt === 18 ? 20.5 : sizePt * 1.15;
  return new Paragraph({
    ...options,
    spacing: {
      line: Math.round(linePt * 20),
      lineRule: LineRuleType.EXACT,
      after: 0,
      ...options.spacing,
    },
    children: makeTextRuns(segments, font, bold, sizePt),
  });
}

function borderlessGrid(
  cells: (Paragraph | Table)[][],
  widths: number[],
  verticalAlign: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable] = VerticalAlignTable.TOP,
  alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
): Table {
  return new Table({
    width: {size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA},
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    alignment,
    borders: noBorders,
    rows: [
      new TableRow({
        cantSplit: true,
        children: cells.map(
          (children, idx) =>
            new TableCell({
              width: {size: widths[idx], type: WidthType.DXA},
              verticalAlign,
              margins: {top: 0, bottom: 0, left: 35, right: 35},
              borders: noBorders,
              children: children.length ? children : [new Paragraph('')],
            }),
        ),
      }),
    ],
  });
}

function garudaParagraph(ctx: DocxRenderCtx, heightCm: number): Paragraph {
  const heightPx = (heightCm * 96) / 2.54;
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    keepNext: true,
    spacing: {after: 60, line: 240, lineRule: LineRuleType.AUTO},
    children: [
      new ImageRun({
        type: 'png',
        data: ctx.garuda.buffer,
        transformation: {
          width: (heightPx * ctx.garuda.width) / ctx.garuda.height,
          height: heightPx,
        },
      }),
    ],
  });
}

function signatureParas(
  sig: SignatureBlock,
  font: string,
  width: number,
  contentWidth: number,
): Paragraph[] {
  const dots = '.'.repeat(Math.max(14, Math.min(40, Math.round((40 * width) / contentWidth))));
  const lines = [
    ...(sig.showSignatureLine ? [`(ลงชื่อ)${dots}`] : []),
    `(${sig.name})`,
    ...sig.lines,
    ...(sig.label ? [sig.label] : []),
    ...(sig.date ? [sig.date] : []),
  ];
  return lines.map((line, i) =>
    plainPara(line, font, {
      alignment: AlignmentType.CENTER,
      keepNext: i < lines.length - 1,
      keepLines: true,
      spacing: {before: i === 0 ? 320 : 0, after: 0},
    }),
  );
}

function buildHeaderChildren(ir: CaseDocumentIR, ctx: DocxRenderCtx): FileChild[] {
  const {font, contentWidth} = ctx;

  if (ir.family === 'MEMO') {
    const dottedField = (label: string, segs: readonly TextRunSegment[]) =>
      new Paragraph({
        keepNext: true,
        keepLines: true,
        spacing: {after: 0, line: 420, lineRule: LineRuleType.EXACT},
        border: {bottom: {style: BorderStyle.DOTTED, size: 3, space: 2, color: '000000'}},
        children: [
          new TextRun({
            text: `${label} `,
            font: fontAttributes(font),
            bold: true,
            boldComplexScript: true,
            size: ptToHalfPt(18),
            sizeComplexScript: ptToHalfPt(18),
            color: '000000',
            language: {value: 'th-TH', eastAsia: 'th-TH', bidirectional: 'th-TH'},
          }),
          ...makeTextRuns(segs, font, false, 16),
        ],
      });

    const half = Math.round(contentWidth / 2);
    return [
      borderlessGrid(
        [
          [garudaParagraph(ctx, 1.5)],
          [plainPara('บันทึกข้อความ', font, {alignment: AlignmentType.CENTER, keepNext: true}, true, 29)],
        ],
        [cmToTwip(1.6), contentWidth - cmToTwip(1.6)],
        VerticalAlignTable.BOTTOM,
      ),
      dottedField('ส่วนราชการ', [{text: ir.header.department ?? '', highlightBlank: false}]),
      borderlessGrid(
        [
          [dottedField('ที่', ir.header.number ?? [])],
          [dottedField('วันที่', ir.header.date ?? [])],
        ],
        [half, contentWidth - half],
      ),
      dottedField('เรื่อง', ir.header.subject ?? []),
      segPara(
        [{text: 'เรียน ', highlightBlank: false}, ...(ir.header.recipient ?? [])],
        font,
        {keepNext: true, spacing: {before: 100, after: 120}},
      ),
    ];
  }

  if (ir.family === 'EXTERNAL_LETTER') {
    const half = Math.round(contentWidth / 2);
    const out: FileChild[] = [
      garudaParagraph(ctx, 3),
      borderlessGrid(
        [
          [segPara([{text: 'ที่ ', highlightBlank: false}, ...(ir.header.number ?? [])], font, {keepNext: true})],
          (ir.header.addressLines ?? []).map(line => plainPara(line, font, {keepNext: true})),
        ],
        [half, contentWidth - half],
      ),
      segPara(ir.header.date ?? [], font, {indent: {left: half}, keepNext: true, spacing: {before: 80, after: 60}}),
      segPara([{text: 'เรื่อง ', highlightBlank: false}, ...(ir.header.subject ?? [])], font, {keepNext: true}),
      segPara([{text: 'เรียน ', highlightBlank: false}, ...(ir.header.recipient ?? [])], font, {keepNext: true}),
    ];
    for (const [idx, refSegs] of (ir.header.references ?? []).entries()) {
      out.push(
        segPara(
          [{text: idx === 0 ? 'อ้างถึง ' : '          ', highlightBlank: false}, ...refSegs],
          font,
          {keepNext: true},
        ),
      );
    }
    for (const [idx, encSegs] of (ir.header.enclosures ?? []).entries()) {
      out.push(
        segPara(
          [{text: idx === 0 ? 'สิ่งที่ส่งมาด้วย ' : '                  ', highlightBlank: false}, ...encSegs],
          font,
          {keepNext: true},
        ),
      );
    }
    return out;
  }

  const out: FileChild[] = [];
  if (ir.garudaCm > 0) out.push(garudaParagraph(ctx, ir.garudaCm));
  for (const line of ir.header.lines) {
    out.push(
      segPara(
        splitHighlightPrompts(line, ir.highlightBlanks),
        font,
        {alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 40}},
        true,
        18,
      ),
    );
  }
  if (ir.header.certificateNo) {
    out.push(
      segPara(
        [{text: 'เลขที่ ', highlightBlank: false}, ...ir.header.certificateNo],
        font,
        {alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 40}},
      ),
    );
  }
  if (ir.header.centeredDivider) {
    out.push(
      plainPara('....................................................', font, {
        alignment: AlignmentType.CENTER,
        keepNext: true,
        spacing: {after: 100},
      }),
    );
  }
  return out;
}

function buildTableBlock(table: CaseTableBlock, ctx: DocxRenderCtx): FileChild[] {
  const {font, contentWidth} = ctx;
  const colCount = table.columns.length;
  const widths = (
    table.columnWidths?.length === colCount
      ? table.columnWidths
      : table.columns.map(() => 100 / colCount)
  ).map(pct => Math.round((contentWidth * pct) / 100));
  const sum = widths.reduce((a, b) => a + b, 0);
  if (widths.length > 0 && sum !== contentWidth) {
    widths[widths.length - 1] += contentWidth - sum;
  }

  const borders = table.bordered ? blackBorders : noBorders;

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: table.columns.map(
      (col, idx) =>
        new TableCell({
          width: {size: widths[idx], type: WidthType.DXA},
          borders,
          margins: {top: 45, bottom: 45, left: 65, right: 65},
          children: [plainPara(col, font, {alignment: AlignmentType.CENTER, keepLines: true}, true, 16)],
        }),
    ),
  });

  const makeRows = (rows: CaseTableBlock['rows']) =>
    rows.map(
      row =>
        new TableRow({
          cantSplit: true,
          children: row.map((cell, idx) => {
            const alignment =
              cell.align === 'right'
                ? AlignmentType.RIGHT
                : cell.align === 'center'
                  ? AlignmentType.CENTER
                  : AlignmentType.LEFT;
            return new TableCell({
              width: {size: widths[idx] ?? Math.round(contentWidth / colCount), type: WidthType.DXA},
              borders,
              margins: {top: 45, bottom: 45, left: 65, right: 65},
              children: [segPara(cell.segments, font, {alignment, keepLines: true}, Boolean(cell.bold), 16)],
            });
          }),
        }),
    );

  const out: FileChild[] = [];
  if (table.caption) {
    out.push(plainPara(table.caption, font, {keepNext: true, spacing: {before: 80, after: 40}}, true, 16));
  }
  out.push(
    new Table({
      width: {size: contentWidth, type: WidthType.DXA},
      columnWidths: widths,
      layout: TableLayoutType.FIXED,
      borders,
      rows: [headerRow, ...makeRows(table.rows), ...makeRows(table.footerRows)],
    }),
  );
  return out;
}

async function buildBlockChildren(
  block: CaseDocumentBlock,
  ir: CaseDocumentIR,
  ctx: DocxRenderCtx,
  suppliedPhotos?: ReadonlyMap<string, Buffer>,
): Promise<FileChild[]> {
  const {font, contentWidth} = ctx;
  switch (block.kind) {
    case 'paragraph': {
      const out: FileChild[] = [];
      if (block.heading) {
        out.push(
          plainPara(block.heading, font, {keepNext: true, keepLines: true, spacing: {before: 80, after: 20}}, true, 18),
        );
      }
      const alignment =
        block.align === 'center'
          ? AlignmentType.CENTER
          : block.align === 'right'
            ? AlignmentType.RIGHT
            : block.align === 'left'
              ? AlignmentType.LEFT
              : AlignmentType.JUSTIFIED;
      out.push(
        segPara(
          block.segments,
          font,
          {
            alignment,
            indent: block.indent ? {firstLine: cmToTwip(2.5)} : undefined,
            keepNext: block.keepNext,
            widowControl: true,
          },
          Boolean(block.bold),
          block.sizePt ?? 16,
        ),
      );
      return out;
    }

    case 'table':
      return buildTableBlock(block, ctx);

    case 'photo-grid': {
      if (!block.photos.length) {
        return [plainPara('ยังไม่มีรูปภาพประกอบ', font, {spacing: {before: 80, after: 80}})];
      }
      const widths = Array.from({length: block.columns}, () => Math.floor(contentWidth / block.columns));
      const rows: TableRow[] = [];
      for (let start = 0; start < block.photos.length; start += block.columns) {
        const cells: TableCell[] = [];
        for (let col = 0; col < block.columns; col++) {
          const ph = block.photos[start + col];
          if (!ph) {
            cells.push(new TableCell({width: {size: widths[col], type: WidthType.DXA}, borders: noBorders, children: [new Paragraph('')]}));
            continue;
          }
          let rawBuf = suppliedPhotos?.get(ph.source);
          if (!rawBuf) {
            const match = /^data:image\/(?:jpeg|png|webp|gif|tiff|heif);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(ph.source);
            if (!match) throw new Error('ไม่พบไฟล์ภาพประกอบ');
            rawBuf = Buffer.from(match[1], 'base64');
          }
          const normalized = await normalizeInspectionPhoto(rawBuf);
          const fit = fitPhotoDimensions(normalized, 16 / block.columns - 0.5, block.maxHeightCm);
          cells.push(
            new TableCell({
              width: {size: widths[col], type: WidthType.DXA},
              borders: noBorders,
              children: [
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  keepNext: Boolean(ph.caption),
                  spacing: {after: 60, line: 240, lineRule: LineRuleType.AUTO},
                  children: [
                    new ImageRun({
                      type: 'jpg',
                      data: normalized.buffer,
                      transformation: {width: fit.widthPx, height: fit.heightPx},
                      altText: {name: ph.caption || ph.id, title: ph.caption || ph.id, description: ph.caption || ph.id},
                    }),
                  ],
                }),
                ...(ph.caption
                  ? [plainPara(ph.caption, font, {alignment: AlignmentType.CENTER, spacing: {after: 120}}, false, 14)]
                  : []),
              ],
            }),
          );
        }
        rows.push(new TableRow({cantSplit: true, children: cells}));
      }
      return [
        new Table({
          width: {size: contentWidth, type: WidthType.DXA},
          columnWidths: widths,
          layout: TableLayoutType.FIXED,
          borders: noBorders,
          rows,
        }),
      ];
    }

    case 'signature-cluster': {
      const content: (Paragraph | Table)[] = block.closing.map(c =>
        segPara(splitHighlightPrompts(c, ir.highlightBlanks), font, {
          keepNext: true,
          keepLines: true,
          ...(ir.family === 'PHOTO_SHEET'
            ? {alignment: AlignmentType.RIGHT}
            : {indent: {firstLine: cmToTwip(2.5)}}),
          spacing: {before: 100, after: 40},
        }),
      );

      if (block.signatures.length) {
        const sigW =
          block.signatures.length === 1
            ? Math.round(contentWidth * 0.62)
            : Math.floor(contentWidth / block.signatures.length);
        content.push(
          borderlessGrid(
            block.signatures.map(sig => signatureParas(sig, font, sigW, contentWidth)),
            block.signatures.map(() => sigW),
            VerticalAlignTable.TOP,
            AlignmentType.RIGHT,
          ),
        );
      }

      if (block.approvals.length) {
        if (block.approvalLayout === 'vertical') {
          for (const box of block.approvals) {
            content.push(
              borderlessGrid(
                [
                  [
                    plainPara(box.heading, font, {keepNext: true, keepLines: true, spacing: {before: 80}}, true, 16),
                    ...box.comments.map(c => plainPara(c, font, {keepNext: true, keepLines: true})),
                    ...signatureParas(box.signature, font, contentWidth, contentWidth),
                  ],
                ],
                [contentWidth],
              ),
            );
          }
        } else {
          const colW = Math.floor(contentWidth / block.approvals.length);
          content.push(
            borderlessGrid(
              block.approvals.map(box => [
                plainPara(box.heading, font, {keepNext: true, keepLines: true, spacing: {before: 80}}, true, 16),
                ...box.comments.map(c => plainPara(c, font, {keepNext: true, keepLines: true})),
                ...signatureParas(box.signature, font, colW, contentWidth),
              ]),
              block.approvals.map(() => colW),
            ),
          );
        }
      }

      content.push(plainPara('', font, {keepNext: false, spacing: {after: 0, line: 20}}));
      return [borderlessGrid([content], [contentWidth])];
    }
  }
}

export interface CaseDocxRenderOptions {
  copyNumber?: number;
  photos?: ReadonlyMap<string, Buffer>;
}

/**
 * Clean borderless-table native DOCX renderer for all 7 CaseFolder document types.
 * Produces ZERO `<w:txbxContent>` floating text boxes and supports yellow highlight
 * (`<w:highlight w:val="yellow"/>`) for blank/unresolved tokens when `highlightBlanks: true`.
 */
export async function renderCaseDocumentDocx(
  ir: CaseDocumentIR,
  options: CaseDocxRenderOptions = {},
): Promise<Buffer> {
  const copyNumber = options.copyNumber ?? 1;
  const [garuda, fonts] = await Promise.all([loadGarudaAsset(), loadSarabunFonts()]);
  const meta = await sharp(garuda.buffer).metadata();
  const m = ir.layout.marginsCm;
  const contentWidth = A4_TWIPS.width - cmToTwip(m.left) - cmToTwip(m.right);

  const ctx: DocxRenderCtx = {
    font: fonts.nativeFamily,
    contentWidth,
    garuda: {...garuda, width: meta.width!, height: meta.height!},
  };

  const children: FileChild[] = [...buildHeaderChildren(ir, ctx)];
  for (const block of ir.blocks) {
    children.push(...(await buildBlockChildren(block, ir, ctx, options.photos)));
  }

  const showRouting =
    ir.routingStrip &&
    (ir.routingStrip.visibility === 'ALL_COPIES' || copyNumber === 1);
  if (showRouting) {
    const half = Math.floor(contentWidth / 2);
    const lines = ir.routingStrip!.lines;
    const rows: TableRow[] = [];
    for (let i = 0; i < lines.length; i += 2) {
      rows.push(
        new TableRow({
          cantSplit: true,
          children: [0, 1].map(col =>
            new TableCell({
              width: {size: col === 0 ? half : contentWidth - half, type: WidthType.DXA},
              borders: noBorders,
              margins: {top: 0, bottom: 0, left: 0, right: 0},
              children: [plainPara(lines[i + col] ?? '', ctx.font, {keepLines: true}, false, 14)],
            }),
          ),
        }),
      );
    }
    children.push(
      new Table({
        width: {size: contentWidth, type: WidthType.DXA},
        columnWidths: [half, contentWidth - half],
        layout: TableLayoutType.FIXED,
        borders: noBorders,
        rows,
      }),
    );
  }

  for (const footLine of ir.footerLines) {
    children.push(plainPara(footLine, ctx.font, {spacing: {after: 0}}, false, 14));
  }

  const doc = new Document({
    title: ir.title,
    creator: 'sarabun-cases',
    styles: sarabunWordStyles(fonts.nativeFamily, ir.layout.density),
    features: {updateFields: true},
    fonts: [
      {
        name: fonts.nativeFamily,
        data: fonts.regular,
        bold: fonts.bold,
        italic: fonts.italic,
        boldItalic: fonts.boldItalic,
      },
    ],
    sections: [
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          titlePage: true,
          page: {
            size: A4_TWIPS,
            margin: {
              top: cmToTwip(m.top),
              bottom: cmToTwip(m.bottom),
              left: cmToTwip(m.left),
              right: cmToTwip(m.right),
              header: cmToTwip(0.6),
              footer: cmToTwip(0.6),
            },
            pageNumbers: {formatType: NumberFormat.THAI_NUMBERS, start: 1},
          },
        },
        headers: {
          first: new Header({children: [new Paragraph('')]}),
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: ['- ', PageNumber.CURRENT, ' -'],
                    font: fontAttributes(fonts.nativeFamily),
                    size: 32,
                    sizeComplexScript: 32,
                    color: '000000',
                  }),
                ],
              }),
            ],
          }),
        },
        footers: {
          first: new Footer({children: [new Paragraph('')]}),
          default: new Footer({
            children: [plainPara(ir.continuationNote, fonts.nativeFamily, {}, false, 12)],
          }),
        },
        children,
      },
    ],
  });

  const bytes = await Packer.toBuffer(doc);
  if (fonts.nativeFamily === fonts.family) return Buffer.from(bytes);
  const zip = await JSZip.loadAsync(bytes);
  const tableXml = await zip.file('word/fontTable.xml')!.async('string');
  const escapeXml = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  zip.file(
    'word/fontTable.xml',
    tableXml.replace(
      `<w:font w:name="${escapeXml(fonts.nativeFamily)}">`,
      `<w:font w:name="${escapeXml(fonts.nativeFamily)}"><w:altName w:val="${escapeXml(fonts.family)}"/>`,
    ),
  );
  return zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});
}
