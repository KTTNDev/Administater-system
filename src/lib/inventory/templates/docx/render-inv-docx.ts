import fs from 'node:fs';
import path from 'node:path';
import JSZip from 'jszip';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ImageRun,
  LineRuleType,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  VerticalMergeType,
  WidthType,
  type FileChild,
  type IParagraphOptions,
} from 'docx';
import {
  A4_TWIPS,
  blackBorders,
  cmToTwip,
  fontAttributes,
  noBorders,
  ptToHalfPt,
  sarabunWordStyles,
} from '../../../procurement/exporters/docx/styles';
import type {
  Inv01RequisitionForm,
  Inv02StockCardForm,
  Inv03AssetLoanForm,
  Inv04CutOffSummaryForm,
  Inv05AnnualAudit213Form,
  InventoryFormIR,
  InvSignaturePerson,
  InvTableCell,
  InvTableModel,
} from '../ir';

const FONT_NAME = 'TH SarabunIT๙';

function toAlign(align?: 'left' | 'center' | 'right') {
  if (align === 'center') return AlignmentType.CENTER;
  if (align === 'right') return AlignmentType.RIGHT;
  return AlignmentType.LEFT;
}

function para(
  text: string,
  options: IParagraphOptions & {bold?: boolean; sizePt?: number; lineFactor?: number} = {},
): Paragraph {
  const {bold = false, sizePt = 16, lineFactor = 1.16, ...rest} = options;
  return new Paragraph({
    ...rest,
    spacing: {
      after: 40,
      line: Math.round(sizePt * 20 * lineFactor),
      lineRule: LineRuleType.EXACT,
      ...rest.spacing,
    },
    children: [
      new TextRun({
        text,
        font: fontAttributes(FONT_NAME),
        color: '000000',
        size: ptToHalfPt(sizePt),
        sizeComplexScript: ptToHalfPt(sizePt),
        bold,
        boldComplexScript: bold,
        italics: false,
        italicsComplexScript: false,
        language: {value: 'th-TH', eastAsia: 'th-TH', bidirectional: 'th-TH'},
      }),
    ],
  });
}

function borderlessGrid(
  rows: (Paragraph | Table)[][][],
  widths: number[],
  bordered = false,
): Table {
  const totalWidth = widths.reduce((a, b) => a + b, 0);
  return new Table({
    width: {size: totalWidth, type: WidthType.DXA},
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders: bordered ? blackBorders : noBorders,
    rows: rows.map(
      row =>
        new TableRow({
          cantSplit: true,
          children: row.map(
            (children, colIdx) =>
              new TableCell({
                width: {size: widths[colIdx], type: WidthType.DXA},
                borders: bordered ? blackBorders : noBorders,
                verticalAlign: VerticalAlignTable.TOP,
                margins: {top: 20, bottom: 20, left: 40, right: 40},
                children,
              }),
          ),
        }),
    ),
  });
}

function sigParagraphs(sig: InvSignaturePerson, dots = '....................................', keepTail = false): Paragraph[] {
  const lines = [
    `(ลงชื่อ)${dots}${sig.roleLabel}`,
    `(${sig.fullName})`,
    ...sig.positionLines,
  ];
  return lines.map((line, i) =>
    para(line, {
      alignment: AlignmentType.CENTER,
      sizePt: 15,
      keepNext: keepTail || i < lines.length - 1,
      keepLines: true,
      spacing: {before: i === 0 ? 440 : 0, after: 0},
    }),
  );
}

/**
 * Renders any 1-tier or 2-tier merged-header InvTableModel to a native Word table
 * with <w:tblHeader/> on every header row and <w:cantSplit/> on every row.
 */
function buildNativeTable(table: InvTableModel, contentWidthTwips: number): Table {
  const colWidths = table.columnWidthsPct.map(pct => Math.round((contentWidthTwips * pct) / 100));
  const totalCols = colWidths.length;
  const fontPt = table.fontPt ?? 15;
  const padV = table.compact ? 30 : 45;
  const padH = table.compact ? 45 : 65;

  const docxRows: TableRow[] = [];

  // Track vertical merges across header rows (supports 2-tier merged headers like INV-02 & INV-04).
  const activeVerticalMerges = new Set<number>();

  table.headerRows.forEach((rawRow, rowIdx) => {
    const cells: TableCell[] = [];
    let colCursor = 0;
    let cellIdx = 0;

    while (colCursor < totalCols) {
      if (rowIdx > 0 && activeVerticalMerges.has(colCursor)) {
        cells.push(
          new TableCell({
            width: {size: colWidths[colCursor], type: WidthType.DXA},
            verticalMerge: VerticalMergeType.CONTINUE,
            verticalAlign: VerticalAlignTable.CENTER,
            borders: blackBorders,
            margins: {top: padV, bottom: padV, left: padH, right: padH},
            children: [para('', {sizePt: fontPt, spacing: {after: 0}})],
          }),
        );
        colCursor += 1;
        continue;
      }

      const cell: InvTableCell | undefined = rawRow[cellIdx++];
      if (!cell) break;
      const span = cell.colSpan ?? 1;
      const cellWidth = colWidths.slice(colCursor, colCursor + span).reduce((a, b) => a + b, 0);
      const isRestart = (cell.rowSpan ?? 1) > 1;
      if (isRestart) {
        for (let c = colCursor; c < colCursor + span; c++) activeVerticalMerges.add(c);
      }

      cells.push(
        new TableCell({
          width: {size: cellWidth, type: WidthType.DXA},
          columnSpan: span > 1 ? span : undefined,
          verticalMerge: isRestart ? VerticalMergeType.RESTART : undefined,
          verticalAlign: VerticalAlignTable.CENTER,
          borders: blackBorders,
          shading: {fill: 'F4F4F4'},
          margins: {top: padV, bottom: padV, left: padH, right: padH},
          children: [
            para(cell.text, {
              bold: true,
              sizePt: fontPt,
              alignment: toAlign(cell.align ?? 'center'),
              keepLines: true,
              spacing: {after: 0},
            }),
          ],
        }),
      );
      colCursor += span;
    }

    docxRows.push(
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: cells,
      }),
    );
  });

  for (const bodyRow of table.bodyRows) {
    let colCursor = 0;
    const cells = bodyRow.cells.map(cell => {
      const span = cell.colSpan ?? 1;
      const cellWidth = colWidths.slice(colCursor, colCursor + span).reduce((a, b) => a + b, 0);
      colCursor += span;
      return new TableCell({
        width: {size: cellWidth, type: WidthType.DXA},
        columnSpan: span > 1 ? span : undefined,
        verticalAlign: VerticalAlignTable.CENTER,
        borders: blackBorders,
        shading: bodyRow.isGrandTotal ? {fill: 'EFEFEF'} : bodyRow.isSubtotal ? {fill: 'F8F8F8'} : undefined,
        margins: {top: padV, bottom: padV, left: padH, right: padH},
        children: [
          para(cell.text || (bodyRow.isFiller ? ' ' : ''), {
            bold: Boolean(cell.bold || bodyRow.isSubtotal || bodyRow.isGrandTotal),
            sizePt: fontPt,
            alignment: toAlign(cell.align ?? 'left'),
            keepLines: true,
            spacing: {after: 0},
          }),
        ],
      });
    });

    docxRows.push(
      new TableRow({
        cantSplit: true,
        children: cells,
      }),
    );
  }

  return new Table({
    width: {size: contentWidthTwips, type: WidthType.DXA},
    columnWidths: colWidths,
    layout: TableLayoutType.FIXED,
    borders: blackBorders,
    rows: docxRows,
  });
}

function buildInv01Children(form: Inv01RequisitionForm, width: number): FileChild[] {
  const half = Math.floor(width / 2);

  return [
    para(form.requisitionNoDisplay, {sizePt: 15, alignment: AlignmentType.RIGHT, keepNext: true, spacing: {after: 40}}),
    para(form.title, {bold: true, sizePt: 20, alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 60}}),
    para(form.agencyOfficeTitle, {bold: true, sizePt: 16, alignment: AlignmentType.RIGHT, keepNext: true, spacing: {after: 0}}),
    para(form.agencyLocationLine, {bold: true, sizePt: 16, alignment: AlignmentType.RIGHT, keepNext: true, spacing: {after: 0}}),
    para(form.requestDateDisplay, {alignment: AlignmentType.RIGHT, keepNext: true, spacing: {before: 40, after: 100}}),
    para(form.requesterLine, {indent: {firstLine: cmToTwip(2.5)}, keepNext: true, spacing: {after: 20}}),
    para(form.purposeCertification, {alignment: AlignmentType.JUSTIFIED, keepNext: true, spacing: {after: 120}}),
    buildNativeTable(form.table, width),
    para('', {spacing: {after: 80}, keepNext: true}),
    borderlessGrid(
      [
        [sigParagraphs(form.signatures.requester), sigParagraphs(form.signatures.approver)],
        [sigParagraphs(form.signatures.issuer), sigParagraphs(form.signatures.receiver)],
      ],
      [half, width - half],
    ),
  ];
}

function buildInv02Children(form: Inv02StockCardForm, width: number): FileChild[] {
  const side = Math.round(width * 0.25);
  const center = width - side * 2;
  const leftMeta = Math.round(width * 0.52);
  const rightMeta = width - leftMeta;
  const children: FileChild[] = [];

  form.cards.forEach((card, idx) => {
    const f = card.headerFields;
    if (idx > 0) {
      children.push(para('', {pageBreakBefore: true, spacing: {after: 0}}));
    }
    children.push(
      borderlessGrid(
        [
          [
            [para(`หน้าที่ ${card.pageNoDisplay}`, {sizePt: 15, keepNext: true, spacing: {after: 0}})],
            [
              para(form.title, {bold: true, sizePt: 19, alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 0}}),
              para(card.municipalityName, {bold: true, sizePt: 16, alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 0}}),
            ],
            [
              para(`ลำดับที่ ${card.ledgerSeqNoDisplay}`, {sizePt: 15, alignment: AlignmentType.RIGHT, keepNext: true, spacing: {after: 0}}),
              para(`แผ่นที่ ${card.sheetNoDisplay}`, {sizePt: 15, alignment: AlignmentType.RIGHT, keepNext: true, spacing: {after: 0}}),
            ],
          ],
        ],
        [side, center, side],
      ),
      borderlessGrid(
        [
          [
            [para(`ชื่อหรือชนิดวัสดุ ${f.name}`, {sizePt: 15, keepNext: true, spacing: {after: 0}})],
            [para(`ประเภท ${f.categoryType}`, {sizePt: 15, keepNext: true, spacing: {after: 0}})],
          ],
          [
            [para(`ขนาดหรือลักษณะ ${f.specification}`, {sizePt: 15, keepNext: true, spacing: {after: 0}})],
            [para(`รหัส ${f.code}   หน่วยที่นับ ${f.unit}`, {sizePt: 15, keepNext: true, spacing: {after: 0}})],
          ],
          [
            [para(`ที่เก็บ ${f.storageLocation}`, {sizePt: 15, keepNext: true, spacing: {after: 0}})],
            [para(`จำนวนอย่างสูง ${f.maxStock}   จำนวนอย่างต่ำ ${f.minStock}`, {sizePt: 15, keepNext: true, spacing: {after: 0}})],
          ],
        ],
        [leftMeta, rightMeta],
      ),
      para('', {spacing: {after: 40}, keepNext: true}),
      buildNativeTable(card.table, width),
    );
  });

  return children;
}

function buildInv03Children(form: Inv03AssetLoanForm, width: number): FileChild[] {
  const third = Math.floor(width / 3);
  const half = Math.floor(width / 2);

  return [
    borderlessGrid(
      [
        [
          [para(form.loanNoDisplay, {sizePt: 15, keepNext: true, spacing: {after: 0}})],
          [
            para(form.title, {bold: true, sizePt: 20, alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 0}}),
            para(form.divisionHeader, {bold: true, sizePt: 16, alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 0}}),
          ],
          [para(form.loanDateDisplay, {sizePt: 15, alignment: AlignmentType.RIGHT, keepNext: true, spacing: {after: 0}})],
        ],
      ],
      [third, width - third * 2, third],
    ),
    ...form.borrowerInfoLines.map(line => para(line, {keepNext: true, spacing: {after: 20}})),
    buildNativeTable(form.table, width),
    para('ส่วนที่ ๑ การยืมครุภัณฑ์', {bold: true, keepNext: true, spacing: {before: 140, after: 40}}),
    borderlessGrid(
      [form.loanSignatures.map(sig => sigParagraphs(sig, '........................'))],
      [third, third, width - third * 2],
    ),
    para('', {spacing: {after: 100}, keepNext: true}),
    borderlessGrid(
      [
        [
          [
            para('ส่วนที่ ๒ การส่งคืนครุภัณฑ์', {bold: true, keepNext: true, spacing: {after: 40}}),
            para(`${form.returnSection.actualReturnDateDisplay}   ${form.returnSection.conditionAfterDisplay}`, {
              keepNext: true,
              spacing: {after: 40},
            }),
            borderlessGrid(
              [[sigParagraphs(form.returnSection.returner, '..........................'), sigParagraphs(form.returnSection.inspector, '..........................')]],
              [half - 80, width - half - 80],
            ),
          ],
        ],
      ],
      [width],
      true,
    ),
  ];
}

function buildInv04Children(form: Inv04CutOffSummaryForm, width: number): FileChild[] {
  const half = Math.floor(width / 2);
  return [
    para(form.headingLine1, {bold: true, sizePt: 18, alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 20}}),
    para(form.headingLine2, {bold: true, sizePt: 16, alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 120}}),
    buildNativeTable(form.table, width),
    para('', {spacing: {after: 120}, keepNext: true}),
    borderlessGrid(
      [[sigParagraphs(form.signatures[0]), sigParagraphs(form.signatures[1])]],
      [half, width - half],
    ),
  ];
}

function buildInv05Children(form: Inv05AnnualAudit213Form, width: number): FileChild[] {
  const half = Math.floor(width / 2);
  const garudaPath = path.join(process.cwd(), 'public/assets/garuda.png');
  const garudaPara = fs.existsSync(garudaPath)
    ? new Paragraph({
        alignment: AlignmentType.LEFT,
        keepNext: true,
        spacing: {after: 0},
        children: [
          new ImageRun({
            type: 'png',
            data: fs.readFileSync(garudaPath),
            transformation: {width: 51, height: 57},
          }),
        ],
      })
    : para('', {keepNext: true});

  const dottedField = (label: string, value: string) =>
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: {after: 40, line: 420, lineRule: LineRuleType.EXACT},
      border: {bottom: {style: BorderStyle.DOTTED, size: 3, space: 2, color: '000000'}},
      children: [
        new TextRun({
          text: `${label} `,
          font: fontAttributes(FONT_NAME),
          bold: true,
          boldComplexScript: true,
          size: ptToHalfPt(18),
          sizeComplexScript: ptToHalfPt(18),
        }),
        new TextRun({
          text: value,
          font: fontAttributes(FONT_NAME),
          size: ptToHalfPt(16),
          sizeComplexScript: ptToHalfPt(16),
        }),
      ],
    });

  const m = form.memoHeader;
  return [
    borderlessGrid(
      [
        [
          [garudaPara],
          [para('บันทึกข้อความ', {bold: true, sizePt: 29, alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 0}})],
        ],
      ],
      [cmToTwip(1.8), width - cmToTwip(1.8)],
    ),
    dottedField('ส่วนราชการ', m.governmentUnit),
    borderlessGrid([[ [dottedField('ที่', m.docNo)], [dottedField('วันที่', m.dateDisplay)] ]], [half, width - half]),
    dottedField('เรื่อง', m.subject),
    para(`เรียน ${m.recipient}`, {keepNext: true, spacing: {before: 80, after: 100}}),
    ...form.paragraphs.map(text => para(text, {indent: {firstLine: cmToTwip(2.5)}, alignment: AlignmentType.JUSTIFIED})),
    para('๑. สรุปยอดวัสดุคงเหลือยกไปปีงบประมาณถัดไป', {bold: true, keepNext: true, spacing: {before: 120, after: 40}}),
    buildNativeTable(form.materialOverviewTable, width),
    para('๒. สรุปทะเบียนครุภัณฑ์ประจำกองแยกตามสภาพ', {bold: true, keepNext: true, spacing: {before: 120, after: 40}}),
    buildNativeTable(form.assetConditionTable, width),
    para('๓. รายละเอียดทะเบียนครุภัณฑ์ประจำกอง', {bold: true, keepNext: true, spacing: {before: 120, after: 40}}),
    buildNativeTable(form.assetDetailTable, width),
    para('', {spacing: {after: 80}, keepNext: true}),
    borderlessGrid([[sigParagraphs(form.signatures.committee)]], [width]),
    borderlessGrid(
      [[sigParagraphs(form.signatures.clerk), sigParagraphs(form.signatures.mayor)]],
      [half, width - half],
    ),
  ];
}

export async function renderInventoryDocx(form: InventoryFormIR): Promise<Buffer> {
  const isLandscape = form.formCode === 'INV-02' && !!form.landscape;
  const isMemo = form.formCode === 'INV-05';
  const marginTop = cmToTwip(isMemo ? 1.5 : 1.8);
  const marginBottom = cmToTwip(1.8);
  const marginLeft = cmToTwip(isMemo ? 3.0 : 1.8);
  const marginRight = cmToTwip(isMemo ? 2.0 : 1.6);

  const pageWidth = isLandscape ? A4_TWIPS.height : A4_TWIPS.width;
  const pageHeight = isLandscape ? A4_TWIPS.width : A4_TWIPS.height;
  const contentWidth = pageWidth - marginLeft - marginRight;

  let children: FileChild[] = [];
  switch (form.formCode) {
    case 'INV-01':
      children = buildInv01Children(form, contentWidth);
      break;
    case 'INV-02':
      children = buildInv02Children(form, contentWidth);
      break;
    case 'INV-03':
      children = buildInv03Children(form, contentWidth);
      break;
    case 'INV-04':
      children = buildInv04Children(form, contentWidth);
      break;
    case 'INV-05':
      children = buildInv05Children(form, contentWidth);
      break;
  }

  const doc = new Document({
    styles: sarabunWordStyles(FONT_NAME, 'normal'),
    sections: [
      {
        properties: {
          page: {
            size: {
              width: pageWidth,
              height: pageHeight,
              orientation: isLandscape ? PageOrientation.LANDSCAPE : PageOrientation.PORTRAIT,
            },
            margin: {
              top: marginTop,
              bottom: marginBottom,
              left: marginLeft,
              right: marginRight,
            },
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

export async function packageInventoryDocxZip(
  entries: ReadonlyArray<{filename: string; form: InventoryFormIR}>,
): Promise<Buffer> {
  const zip = new JSZip();
  for (const entry of entries) {
    const buffer = await renderInventoryDocx(entry.form);
    zip.file(entry.filename.endsWith('.docx') ? entry.filename : `${entry.filename}.docx`, buffer);
  }
  return Buffer.from(await zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'}));
}
