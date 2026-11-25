import {
  AlignmentType, BorderStyle, ImageRun, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, TableLayoutType,
  CheckBox, VerticalAlignTable, LineRuleType, type FileChild, type IParagraphOptions,
} from 'docx';
import type {DocumentBlock, RenderedDocumentSpec, SignatureBlock, TableBlock} from '../../templates/ir';
import type {NormalizedInspectionPhoto} from '../../media/photo-processor';
import {fitPhotoDimensions} from '../../media/photo-processor';
import {SARABUN_RULES, pageRules} from '../../templates/sarabun-rules';
import {cmToTwip, fontAttributes, noBorders, blackBorders, ptToHalfPt} from './styles';

export interface WordContext {model: RenderedDocumentSpec; font: string; width: number; garuda: {buffer: Buffer; width: number; height: number}; photos: Map<string, NormalizedInspectionPhoto>; photoReserveCm?: number}
export function wordParagraph(value: string, ctx: WordContext, options: IParagraphOptions = {}, bold = false, size?: number) {
  const lines = value.split('\n');
  const d = SARABUN_RULES.density[ctx.model.layout.density];
  const lineHeight = size === 29 ? 29 : size === 18 ? 18 * 1.14 : (size ?? d.fontPt) * d.lineHeight;
  return new Paragraph({...options, spacing: {line: Math.round(lineHeight * 20), lineRule: LineRuleType.EXACT, ...options.spacing}, children: lines.map((line, i) => new TextRun({text: line, ...(i ? {break: 1} : {}), font: fontAttributes(ctx.font), color: '000000', bold, boldComplexScript: bold, italics: false, italicsComplexScript: false, ...(size ? {size: ptToHalfPt(size), sizeComplexScript: ptToHalfPt(size)} : {})}))});
}
function grid(cells: (Paragraph | Table)[][], widths: number[], bordered = false, header = false, verticalAlign: (typeof VerticalAlignTable)[keyof typeof VerticalAlignTable] = VerticalAlignTable.TOP, alignment: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT) {
  return new Table({width: {size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA}, columnWidths: widths, layout: TableLayoutType.FIXED, alignment, borders: bordered ? blackBorders : noBorders,
    rows: [new TableRow({cantSplit: true, tableHeader: header, children: cells.map((children, i) => new TableCell({width: {size: widths[i], type: WidthType.DXA}, verticalAlign, margins: {top: 0, bottom: 0, left: 35, right: 35}, borders: bordered ? blackBorders : noBorders, children}))})]});
}
function signature(s: SignatureBlock, ctx: WordContext, keep = true, width = ctx.width): Paragraph[] {
  const gap = SARABUN_RULES.density[ctx.model.layout.density].signatureGapPt;
  const dots = '.'.repeat(Math.max(12, Math.min(45, Math.round(45 * width / ctx.width))));
  const values = [...(s.showSignatureLine ? [`(ลงชื่อ)${dots}`] : []), `(${s.name})`, ...s.lines, ...(s.label ? [s.label] : []), ...(s.date ? [s.date] : [])];
  return values.map((value, i) => wordParagraph(value, ctx, {alignment: AlignmentType.CENTER, keepNext: keep || i < values.length - 1, keepLines: true, spacing: {before: i === 0 ? gap * 20 : 0, after: 0}}));
}
function garuda(ctx: WordContext, heightCm: number) {
  const height = heightCm * 96 / 2.54;
  return new Paragraph({alignment: AlignmentType.CENTER, spacing: {after: 60, line: 240, lineRule: LineRuleType.AUTO}, keepNext: true, children: [new ImageRun({type: 'png', data: ctx.garuda.buffer, transformation: {width: height * ctx.garuda.width / ctx.garuda.height, height}})]});
}
export function memoHeader(ctx: WordContext): FileChild[] {
  const h = ctx.model.header;
  const labelField = (label: string, value: string) => new Paragraph({keepNext: true, keepLines: true, spacing: {after: 0, line: 420, lineRule: LineRuleType.EXACT}, border: {bottom: {style: BorderStyle.DOTTED, size: 3, space: 2, color: '000000'}}, children: [new TextRun({text: label + ' ', bold: true, boldComplexScript: true, italics: false, italicsComplexScript: false, size: 36, sizeComplexScript: 36}), new TextRun({text: value})]});
  return [
    grid([[garuda(ctx, 1.5)], [wordParagraph('บันทึกข้อความ', ctx, {alignment: AlignmentType.CENTER, keepNext: true, spacing: {after: 0}}, true, 29)]], [cmToTwip(1.5), ctx.width - cmToTwip(1.5)], false, false, VerticalAlignTable.BOTTOM),
    labelField('ส่วนราชการ', h.department ?? ''),
    grid([[labelField('ที่', h.number ?? '')], [labelField('วันที่', h.date ?? '')]], [Math.round(ctx.width / 2), ctx.width - Math.round(ctx.width / 2)]),
    labelField('เรื่อง', h.subject ?? ''),
    wordParagraph(`เรียน ${h.recipient ?? ''}`, ctx, {keepNext: true, spacing: {before: 100, after: 140}}),
  ];
}
export function documentHeader(ctx: WordContext): FileChild[] {
  const {model} = ctx, h = model.header;
  if (model.family === 'MEMO') return memoHeader(ctx);
  if (model.family === 'EXTERNAL_LETTER') return [
    garuda(ctx, 3),
    grid([[wordParagraph(`ที่ ${h.number}`, ctx, {keepNext: true})], (h.addressLines ?? []).map(t => wordParagraph(t, ctx, {keepNext: true, spacing: {after: 0}}))], [Math.round(ctx.width / 2), Math.round(ctx.width / 2)]),
    wordParagraph(h.date ?? '', ctx, {indent: {left: Math.round(ctx.width / 2)}, keepNext: true}),
    wordParagraph(`เรื่อง ${h.subject}`, ctx, {keepNext: true}), wordParagraph(`เรียน ${h.recipient}`, ctx, {keepNext: true}),
  ];
  return [
    ...(['ORDER', 'ANNOUNCEMENT', 'PURCHASE_ORDER'].includes(model.family) ? [garuda(ctx, 3)] : []),
    ...h.lines.map((line, i) => wordParagraph(line, ctx, {alignment: AlignmentType.CENTER, keepNext: true, keepLines: true, spacing: {after: 40}, ...(i === 0 ? {style: 'Title'} : {})}, true, 18)),
  ];
}
export function continuationTable(b: TableBlock, ctx: WordContext): Table {
  const widths = (b.columnWidths ?? b.columns.map(() => 100 / b.columns.length)).map(n => Math.round(ctx.width * n / 100));
  const makeRow = (row: TableBlock['rows'][number], header = false) => {
    let position = 0;
    return new TableRow({cantSplit: true, tableHeader: header, children: row.map(c => {
      const colspan = c.colspan ?? 1;
      const size = widths.slice(position, position + colspan).reduce((a, v) => a + v, 0); position += colspan;
      return new TableCell({width: {size, type: WidthType.DXA}, columnSpan: colspan, margins: {top: 45, bottom: 45, left: 65, right: 65}, borders: b.bordered ? blackBorders : noBorders,
        children: [wordParagraph(c.text, ctx, {keepLines: true, alignment: c.align === 'right' ? AlignmentType.RIGHT : header || c.align === 'center' ? AlignmentType.CENTER : AlignmentType.LEFT, spacing: {after: 0}}, c.bold || header)]});
    })});
  };
  return new Table({width: {size: ctx.width, type: WidthType.DXA}, columnWidths: widths, layout: TableLayoutType.FIXED, borders: b.bordered ? blackBorders : noBorders,
    rows: [...(b.continued ? [makeRow([{text: b.continuationCaption, colspan: b.columns.length}], true)] : []), makeRow(b.columns.map(text => ({text})), true), ...b.rows.map(r => makeRow(r)), ...b.footerRows.map(r => makeRow(r))]});
}
export function wordBlocks(block: DocumentBlock, ctx: WordContext): FileChild[] {
  switch (block.kind) {
    case 'paragraph': return [
      ...(block.heading ? [wordParagraph(block.heading, ctx, {keepNext: true, keepLines: true, spacing: {before: 80, after: 0}}, true, 18)] : []),
      wordParagraph(block.text, ctx, {alignment: AlignmentType.JUSTIFIED, indent: block.indent ? {firstLine: cmToTwip(2.5)} : undefined, keepNext: !!block.keepTrailingLines, widowControl: true}),
    ];
    case 'table': return [continuationTable(block, ctx)];
    case 'metadata': return [grid(block.columns.map(col => col.map(v => wordParagraph(v, ctx, {keepNext: true, keepLines: true, spacing: {after: 0}}))), block.columns.map(() => Math.floor(ctx.width / block.columns.length)))];
    case 'checkboxes': return block.groups.map(g => new Paragraph({keepNext: true, keepLines: true, children: [
      new TextRun({text: g.label + ' ', font: fontAttributes(ctx.font), italics: false, italicsComplexScript: false}),
      ...g.choices.flatMap(c => [new CheckBox({checked: c.checked, alias: c.text, checkedState: {value: '2611', font: 'Segoe UI Symbol'}, uncheckedState: {value: '2610', font: 'Segoe UI Symbol'}}), new TextRun({text: ` ${c.text}   `, font: fontAttributes(ctx.font), italics: false, italicsComplexScript: false})]),
    ]}));
    case 'signature-cluster': {
      const content: (Paragraph | Table)[] = block.closing.map(t => wordParagraph(t, ctx, {keepNext: true, keepLines: true, ...(ctx.model.family === 'PHOTO_SHEET' ? {alignment: AlignmentType.RIGHT} : {indent: {firstLine: cmToTwip(2.5)}})}));
      if (block.approvalLayout === 'grid' && block.approvals.length && block.signatures.length === 1) {
        const columnWidth = Math.floor(ctx.width / (block.approvals.length + 1));
        const cells = [signature(block.signatures[0], ctx, true, columnWidth), ...block.approvals.map((box, i) => [wordParagraph(box.heading, ctx, {keepNext: true, keepLines: true}, true), ...box.comments.map(t => wordParagraph(t, ctx, {keepNext: true, keepLines: true, spacing: {after: 0}})), ...signature(box.signature, ctx, i < block.approvals.length - 1, columnWidth)])];
        content.push(grid(cells, cells.map(() => Math.floor(ctx.width / cells.length))));
        content.push(wordParagraph('', ctx, {keepNext: false, keepLines: true, spacing: {after: 0, line: 1}}));
        return [grid([content], [ctx.width])];
      }
      if (block.signatures.length) {
        const width = block.signatures.length === 1 ? Math.round(ctx.width * 0.65) : Math.floor(ctx.width / block.signatures.length);
        content.push(grid(block.signatures.map(s => signature(s, ctx)), block.signatures.map(() => width), false, false, VerticalAlignTable.TOP, AlignmentType.RIGHT));
      }
      if (block.approvals.length) {
        if (block.approvalLayout === 'vertical') for (const [index, box] of block.approvals.entries()) content.push(grid([[
          wordParagraph(box.heading, ctx, {keepNext: true, keepLines: true, spacing: {before: 40, after: 0}}, true),
          ...box.comments.map(t => wordParagraph(t, ctx, {keepNext: true, keepLines: true, spacing: {after: 0}})),
          ...signature(box.signature, ctx, index < block.approvals.length - 1),
        ]], [ctx.width]));
        else content.push(grid(block.approvals.map((box, i) => [wordParagraph(box.heading, ctx, {keepNext: true, keepLines: true}, true), ...box.comments.map(t => wordParagraph(t, ctx, {keepNext: true, keepLines: true, spacing: {after: 0}})), ...signature(box.signature, ctx, i < block.approvals.length - 1)]), block.approvals.map(() => Math.floor(ctx.width / block.approvals.length))));
      }
      // A final non-kept paragraph terminates the native keep chain. The enclosing row cannot split.
      content.push(wordParagraph('', ctx, {keepNext: false, keepLines: true, spacing: {after: 0, line: 1}}));
      return [grid([content], [ctx.width])];
    }
    case 'photo-grid': {
      if (!block.photos.length) return [wordParagraph('ยังไม่มีรูปภาพประกอบ', ctx)];
      const widths = Array.from({length: block.columns}, () => Math.floor(ctx.width / block.columns));
      const rows: TableRow[] = [];
      for (let start = 0; start < block.photos.length; start += block.columns) {
        const children = widths.map((width, col) => {
          const photo = block.photos[start + col];
          if (!photo) return new TableCell({children: [new Paragraph('')], borders: noBorders});
          const image = ctx.photos.get(photo.source)!;
          const margins = pageRules(ctx.model.family).marginsCm;
          const rows = Math.ceil(block.photos.length / block.columns);
          const heightBudget = (29.7 - margins.top - margins.bottom - (ctx.photoReserveCm ?? 8)) / rows - 0.4;
          const fit = fitPhotoDimensions(image, 16 / block.columns - 0.4, Math.min(block.maxHeightCm, heightBudget));
          return new TableCell({width: {size: width, type: WidthType.DXA}, borders: noBorders, children: [new Paragraph({alignment: AlignmentType.CENTER, keepNext: true, keepLines: true, spacing: {after: cmToTwip(0.4), line: 240, lineRule: LineRuleType.AUTO}, children: [new ImageRun({type: 'jpg', data: image.buffer, transformation: {width: fit.widthPx, height: fit.heightPx}, altText: {title: photo.alt, description: photo.alt, name: photo.alt}})]})]});
        });
        rows.push(new TableRow({cantSplit: true, children}));
      }
      return [new Table({width: {size: ctx.width, type: WidthType.DXA}, columnWidths: widths, borders: noBorders, rows})];
    }
  }
}
export function routingStrip(ctx: WordContext, copyNumber: number): FileChild[] {
  const strip = ctx.model.routingStrip;
  if (!strip || strip.visibility === 'FIRST_COPY' && copyNumber !== 1) return [];
  const width = Math.floor(ctx.width / 2), rows: TableRow[] = [];
  for (let i = 0; i < strip.lines.length; i += 2) rows.push(new TableRow({cantSplit: true, children: [0, 1].map(col => new TableCell({width: {size: width, type: WidthType.DXA}, borders: noBorders, margins: {top: 0, bottom: 0, left: 0, right: 0}, children: [wordParagraph(strip.lines[i + col] ?? '', ctx, {keepNext: i + col < strip.lines.length - 1, keepLines: true, spacing: {after: 0, line: 294, lineRule: LineRuleType.EXACT}}, false, 14)]}))}));
  return [new Table({width: {size: ctx.width, type: WidthType.DXA}, columnWidths: [width, ctx.width - width], layout: TableLayoutType.FIXED, borders: noBorders, rows})];
}

/** Word's keepNext across a paragraph-to-table boundary is renderer-dependent.
 * Put the body anchor and the closing table in one native, non-splitting row instead. */
export function wordPageBlocks(blocks: DocumentBlock[], ctx: WordContext): FileChild[] {
  const certification = blocks.find(b => b.kind === 'signature-cluster');
  // Reserve native Word's image baselines, headings and the final certification;
  // the Phase 2 photo sizes are upper bounds, never fixed stretched heights.
  ctx = {...ctx, photoReserveCm: certification?.kind === 'signature-cluster' ? certification.signatures.length > 1 ? 10 : 8 : 3.5};
  const result: FileChild[] = [];
  let from = 0;
  for (let at = 0; at < blocks.length; at++) {
    if (blocks[at].kind !== 'signature-cluster') continue;
    let start = at;
    const preceding = blocks[at - 1];
    if (preceding?.kind === 'paragraph') {
      start = at - 1;
      if (preceding.text.length < 150 && !preceding.text.includes('\n')) {
        for (let before = at - 2; before >= from; before--) {
          if (blocks[before].kind === 'table' || blocks[before].kind === 'photo-grid') break;
          if (blocks[before].kind === 'paragraph') {start = before; break;}
        }
      }
    } else if (preceding?.kind === 'photo-grid') start = at - 1;
    result.push(...blocks.slice(from, start).flatMap(b => wordBlocks(b, ctx)));
    const content = blocks.slice(start, at + 1).flatMap(b => wordBlocks(b, ctx)) as (Paragraph | Table)[];
    content.push(wordParagraph('', ctx, {keepNext: false, spacing: {after: 0, line: 1}}));
    result.push(grid([content], [ctx.width]));
    from = at + 1;
  }
  result.push(...blocks.slice(from).flatMap(b => wordBlocks(b, ctx)));
  return result;
}
