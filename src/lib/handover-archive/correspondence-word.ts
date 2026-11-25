import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  PageOrientation,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlignTable,
  WidthType,
  type FileChild,
} from 'docx';
import {directionLabels, registerStats, thaiDay, type RegisterEntry} from '../correspondence';

const FONT = 'TH SarabunIT๙';
const mmToTwip = (mm: number) => Math.round((mm / 25.4) * 1440);
const pt = (sizePt: number) => Math.round(sizePt * 2);

const cellBorder = {style: BorderStyle.SINGLE, size: 4, color: '000000'} as const;
const borders = {
  top: cellBorder,
  bottom: cellBorder,
  left: cellBorder,
  right: cellBorder,
  insideHorizontal: cellBorder,
  insideVertical: cellBorder,
};

function p(
  text: string,
  opts: {
    bold?: boolean;
    sizePt?: number;
    align?: (typeof AlignmentType)[keyof typeof AlignmentType];
    after?: number;
    before?: number;
    keepNext?: boolean;
    pageBreakBefore?: boolean;
  } = {},
): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    keepNext: opts.keepNext,
    keepLines: true,
    pageBreakBefore: opts.pageBreakBefore,
    spacing: {before: opts.before ?? 0, after: opts.after ?? 40},
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        size: pt(opts.sizePt ?? 14),
        font: {ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT},
      }),
    ],
  });
}

function buildTable(headers: string[], rows: string[][], widthsPct: number[], contentWidthTwips: number): Table {
  const widths = widthsPct.map(pct => Math.round((contentWidthTwips * pct) / 100));
  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: headers.map(
      (h, idx) =>
        new TableCell({
          width: {size: widths[idx], type: WidthType.DXA},
          borders,
          shading: {fill: 'F2F4F3'},
          verticalAlign: VerticalAlignTable.CENTER,
          margins: {top: 40, bottom: 40, left: 60, right: 60},
          children: [p(h, {bold: true, sizePt: 14, align: AlignmentType.CENTER, after: 0})],
        }),
    ),
  });

  const bodyRows = rows.map(
    row =>
      new TableRow({
        cantSplit: true,
        children: row.map(
          (val, idx) =>
            new TableCell({
              width: {size: widths[idx], type: WidthType.DXA},
              borders,
              verticalAlign: VerticalAlignTable.TOP,
              margins: {top: 35, bottom: 35, left: 60, right: 60},
              children: [
                p(val || '—', {
                  sizePt: 14,
                  align: idx === 0 ? AlignmentType.CENTER : AlignmentType.LEFT,
                  after: 0,
                }),
              ],
            }),
        ),
      }),
  );

  return new Table({
    width: {size: contentWidthTwips, type: WidthType.DXA},
    columnWidths: widths,
    layout: TableLayoutType.FIXED,
    borders,
    rows: [headerRow, ...bodyRows],
  });
}

/**
 * Generates an editable Word (.docx) register book or statistics report for ทะเบียนรับ–ส่งหนังสือ
 * in A4 Landscape with TH SarabunIT๙ and repeating table headers (<w:tblHeader/>).
 */
export async function renderCorrespondenceWord(
  entries: readonly RegisterEntry[],
  options: {mode: 'book' | 'stats'; description: string},
): Promise<Buffer> {
  const pageWidthTwips = mmToTwip(297);
  const pageHeightTwips = mmToTwip(210);
  const marginTwips = mmToTwip(14);
  const contentWidth = pageWidthTwips - marginTwips * 2;
  const children: FileChild[] = [];

  if (options.mode === 'stats') {
    const stats = registerStats([...entries]);
    children.push(
      p('สถิติทะเบียนรับ–ส่งหนังสือ', {bold: true, sizePt: 20, align: AlignmentType.CENTER, keepNext: true, after: 40}),
      p(options.description, {sizePt: 14, align: AlignmentType.CENTER, keepNext: true, after: 100}),
      buildTable(
        ['เดือน / พ.ศ.', 'รับเข้า', 'ส่งออก', 'ดำเนินการแล้ว', 'รอดำเนินการ', 'ยกเลิก'],
        stats.length
          ? stats.map(r => [
              `${Number(r.month.slice(5))}/${Number(r.month.slice(0, 4)) + 543}`,
              String(r.incoming),
              String(r.outgoing),
              String(r.done),
              String(r.pending),
              String(r.cancelled),
            ])
          : [['ไม่มีรายการตามเงื่อนไข', '-', '-', '-', '-', '-']],
        [25, 15, 15, 15, 15, 15],
        contentWidth,
      ),
    );
  } else {
    const groups = new Map<string, RegisterEntry[]>();
    const sorted = [...entries].sort(
      (a, b) =>
        a.department.localeCompare(b.department) ||
        a.direction.localeCompare(b.direction) ||
        a.registeredDate.localeCompare(b.registeredDate) ||
        a.serial - b.serial,
    );
    for (const e of sorted) {
      const key = `${e.department}\0${e.direction}`;
      const list = groups.get(key) ?? [];
      list.push(e);
      groups.set(key, list);
    }

    if (groups.size === 0) {
      children.push(
        p('ทะเบียนรับ–ส่งหนังสือ', {bold: true, sizePt: 20, align: AlignmentType.CENTER, after: 60}),
        p(options.description, {sizePt: 14, align: AlignmentType.CENTER, after: 100}),
        p('ไม่พบรายการตามเงื่อนไข', {sizePt: 15, align: AlignmentType.CENTER}),
      );
    } else {
      let groupIdx = 0;
      for (const group of groups.values()) {
        const first = group[0];
        children.push(
          p(`ทะเบียนหนังสือ${directionLabels[first.direction]} — ${first.department || 'ทุกหน่วยงาน'}`, {
            bold: true,
            sizePt: 18,
            align: AlignmentType.CENTER,
            keepNext: true,
            after: 30,
            pageBreakBefore: groupIdx > 0,
          }),
          p(options.description, {sizePt: 14, align: AlignmentType.CENTER, keepNext: true, after: 80}),
          buildTable(
            [`เลขทะเบียน${directionLabels[first.direction]}`, 'ที่', 'ลงวันที่', 'จาก', 'ถึง', 'เรื่อง', 'การปฏิบัติ', 'หมายเหตุ'],
            group.map(r => [
              `${r.serial}/${r.year + 543}\n${thaiDay(r.registeredDate)}`,
              r.number || '—',
              thaiDay(r.documentDate),
              r.from,
              r.to,
              r.subject,
              r.practice || '—',
              [r.notes, r.status === 'cancelled' ? 'ยกเลิก' : ''].filter(Boolean).join(' · ') || '—',
            ]),
            [11, 11, 10, 12, 12, 22, 12, 10],
            contentWidth,
          ),
        );
        groupIdx += 1;
      }
    }
  }

  const doc = new Document({
    styles: {
      default: {
        document: {
          run: {
            font: {ascii: FONT, hAnsi: FONT, cs: FONT, eastAsia: FONT},
            size: pt(14),
            language: {value: 'th-TH'},
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            size: {width: pageWidthTwips, height: pageHeightTwips, orientation: PageOrientation.LANDSCAPE},
            margin: {top: marginTwips, right: marginTwips, bottom: marginTwips, left: marginTwips},
          },
        },
        children,
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
