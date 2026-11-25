import type {ApprovalBox, SignatureBlock} from '../../procurement/templates/ir';
import type {TextRunSegment} from '../types';
import {splitHighlightPrompts} from '../resolver';
import type {CaseDocumentBlock, CaseDocumentIR, CaseTableBlock} from './all-doc-builders';

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderSegmentsHtml(segments: readonly TextRunSegment[] | undefined): string {
  if (!segments || !segments.length) return '';
  return segments
    .map(seg =>
      seg.highlightBlank
        ? `<mark class="case-blank-highlight">${esc(seg.text)}</mark>`
        : esc(seg.text).replaceAll('\n', '<br>'),
    )
    .join('');
}

function renderSignatureHtml(sig: SignatureBlock): string {
  const dots = '.'.repeat(30);
  return `<div class="case-sig">
    ${sig.showSignatureLine ? `<p>(ลงชื่อ)${dots}</p>` : ''}
    <p>(${esc(sig.name)})</p>
    ${sig.lines.map(l => `<p>${esc(l)}</p>`).join('')}
    ${sig.label ? `<p>${esc(sig.label)}</p>` : ''}
    ${sig.date ? `<p>${esc(sig.date)}</p>` : ''}
  </div>`;
}

function renderApprovalHtml(box: ApprovalBox): string {
  return `<div class="case-approval">
    <p class="case-bold">${esc(box.heading)}</p>
    ${box.comments.map(c => `<p>${esc(c)}</p>`).join('')}
    ${renderSignatureHtml(box.signature)}
  </div>`;
}

function renderTableHtml(table: CaseTableBlock): string {
  const colgroup = table.columnWidths?.length
    ? `<colgroup>${table.columnWidths.map(w => `<col style="width:${w}%">`).join('')}</colgroup>`
    : '';
  const bodyRows = table.rows
    .map(
      row =>
        `<tr>${row.map(c => `<td class="align-${c.align ?? 'left'}${c.bold ? ' case-bold' : ''}">${renderSegmentsHtml(c.segments)}</td>`).join('')}</tr>`,
    )
    .join('');
  const footerRows = table.footerRows
    .map(
      row =>
        `<tr class="case-table-footer">${row.map(c => `<td class="align-${c.align ?? 'left'} case-bold">${renderSegmentsHtml(c.segments)}</td>`).join('')}</tr>`,
    )
    .join('');

  return `${table.caption ? `<p class="case-table-caption">${esc(table.caption)}</p>` : ''}
  <table class="case-table${table.bordered ? ' is-bordered' : ''}" data-repeat-header="true">
    ${colgroup}
    <thead><tr>${table.columns.map(col => `<th>${esc(col)}</th>`).join('')}</tr></thead>
    <tbody>${bodyRows}${footerRows}</tbody>
  </table>`;
}

function renderBlockHtml(
  block: CaseDocumentBlock,
  resolveAssetUrl: (src: string) => string,
): string {
  switch (block.kind) {
    case 'paragraph':
      return `${block.heading ? `<p class="case-heading">${esc(block.heading)}</p>` : ''}
      <p class="case-para${block.indent ? ' is-indented' : ''}${block.bold ? ' case-bold' : ''} align-${block.align ?? 'justify'}">${renderSegmentsHtml(block.segments)}</p>`;
    case 'table':
      return renderTableHtml(block);
    case 'photo-grid':
      if (!block.photos.length) {
        return '<p class="case-para">ยังไม่มีรูปภาพประกอบ</p>';
      }
      return `<div class="case-photo-grid cols-${block.columns}">
        ${block.photos
          .map(
            ph => `<figure class="case-photo-card">
              <img src="${esc(resolveAssetUrl(ph.source))}" alt="${esc(ph.caption || 'ภาพประกอบ')}" style="max-height:${block.maxHeightCm}cm" />
              ${ph.caption ? `<figcaption>${esc(ph.caption)}</figcaption>` : ''}
            </figure>`,
          )
          .join('')}
      </div>`;
    case 'signature-cluster': {
      const closing = block.closing
        .map(line => `<p class="case-closing">${esc(line)}</p>`)
        .join('');
      const sigs = `<div class="case-sigs">${block.signatures.map(renderSignatureHtml).join('')}</div>`;
      const approvals = block.approvals.length
        ? `<div class="case-approvals layout-${block.approvalLayout}">${block.approvals.map(renderApprovalHtml).join('')}</div>`
        : '';
      return `<section class="case-sign-cluster">${closing}${sigs}${approvals}</section>`;
    }
  }
}

function renderHeaderHtml(
  ir: CaseDocumentIR,
  garudaUrl: string,
): string {
  const garuda =
    ir.garudaCm > 0
      ? `<img class="case-garuda" src="${esc(garudaUrl)}" alt="ตราครุฑ" style="height:${ir.garudaCm}cm" />`
      : '';

  if (ir.family === 'MEMO') {
    return `<header class="case-header-memo">
      <div class="case-memo-top">${garuda}<h1>บันทึกข้อความ</h1></div>
      <div class="case-memo-line"><strong>ส่วนราชการ</strong> <span>${esc(ir.header.department ?? '')}</span></div>
      <div class="case-memo-split">
        <div class="case-memo-line"><strong>ที่</strong> <span>${renderSegmentsHtml(ir.header.number)}</span></div>
        <div class="case-memo-line"><strong>วันที่</strong> <span>${renderSegmentsHtml(ir.header.date)}</span></div>
      </div>
      <div class="case-memo-line"><strong>เรื่อง</strong> <span>${renderSegmentsHtml(ir.header.subject)}</span></div>
      <p class="case-memo-recipient">เรียน ${renderSegmentsHtml(ir.header.recipient)}</p>
    </header>`;
  }

  if (ir.family === 'EXTERNAL_LETTER') {
    const refs = (ir.header.references ?? [])
      .map((r, i) => `<p class="case-ext-meta">${i === 0 ? 'อ้างถึง ' : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}${renderSegmentsHtml(r)}</p>`)
      .join('');
    const encs = (ir.header.enclosures ?? [])
      .map((e, i) => `<p class="case-ext-meta">${i === 0 ? 'สิ่งที่ส่งมาด้วย ' : '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;'}${renderSegmentsHtml(e)}</p>`)
      .join('');
    return `<header class="case-header-external">
      <div class="case-garuda-center">${garuda}</div>
      <div class="case-ext-top">
        <div>ที่ ${renderSegmentsHtml(ir.header.number)}</div>
        <div class="case-ext-address">${(ir.header.addressLines ?? []).map(l => `<p>${esc(l)}</p>`).join('')}</div>
      </div>
      <p class="case-ext-date">${renderSegmentsHtml(ir.header.date)}</p>
      <p class="case-ext-meta">เรื่อง ${renderSegmentsHtml(ir.header.subject)}</p>
      <p class="case-ext-meta">เรียน ${renderSegmentsHtml(ir.header.recipient)}</p>
      ${refs}
      ${encs}
    </header>`;
  }

  return `<header class="case-header-centered">
    ${garuda ? `<div class="case-garuda-center">${garuda}</div>` : ''}
    ${ir.header.lines.map(l => `<h2 class="case-center-title">${renderSegmentsHtml(splitHighlightPrompts(l, ir.highlightBlanks))}</h2>`).join('')}
    ${ir.header.certificateNo ? `<p class="case-center-sub">เลขที่ ${renderSegmentsHtml(ir.header.certificateNo)}</p>` : ''}
    ${ir.header.centeredDivider ? '<p class="case-divider">....................................................</p>' : ''}
  </header>`;
}

export interface CaseHtmlRenderOptions {
  garudaUrl?: string;
  resolveAssetUrl?: (src: string) => string;
  copyNumber?: number;
  regularFontUri?: string;
  boldFontUri?: string;
  printMode?: boolean;
}

/**
 * Standalone HTML renderer for all 7 official document types inside a CaseFolder.
 */
export function renderCaseDocumentHtml(
  ir: CaseDocumentIR,
  options: CaseHtmlRenderOptions = {},
): string {
  const garudaUrl = options.garudaUrl ?? '/assets/garuda.png';
  const resolveAssetUrl = options.resolveAssetUrl ?? (s => s);
  const copyNumber = options.copyNumber ?? 1;
  const m = ir.layout.marginsCm;
  const showRouting =
    ir.routingStrip &&
    (ir.routingStrip.visibility === 'ALL_COPIES' || copyNumber === 1);
  const regularFont = options.regularFontUri ?? '/fonts/THSarabunIT9.ttf';
  const boldFont = options.boldFontUri ?? '/fonts/THSarabunIT9-Bold.ttf';
  const fontFaceCss = `
@font-face {
  font-family: 'TH Sarabun IT๙';
  src: url('${regularFont}') format('truetype');
  font-weight: 400;
  font-style: normal;
}
@font-face {
  font-family: 'TH Sarabun IT๙';
  src: url('${boldFont}') format('truetype');
  font-weight: 700;
  font-style: normal;
}`;
  const pageBoxCss = options.printMode
    ? `.case-page { width: 100%; padding: 0; margin: 0; background: #fff; }`
    : `.case-page { width: 210mm; min-height: 297mm; padding: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm; margin: 0 auto; background: #fff; }`;

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8" />
<title>${esc(ir.title)}</title>
<style>
${fontFaceCss}
@page { size: A4; margin: ${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm; }
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: 'TH Sarabun IT๙', 'TH SarabunIT๙', 'TH Sarabun New', serif;
  font-size: 16pt;
  line-height: 1.15;
  color: #000;
  background: #fff;
}
${pageBoxCss}
.case-memo-top { display: flex; align-items: flex-end; gap: 12pt; margin-bottom: 4pt; }
.case-memo-top h1 { flex: 1; text-align: center; font-size: 29pt; margin: 0; line-height: 1; }
.case-memo-line { border-bottom: 1pt dotted #000; padding-bottom: 1pt; margin-bottom: 3pt; }
.case-memo-line strong { font-size: 18pt; margin-right: 4pt; }
.case-memo-split { display: grid; grid-template-columns: 1fr 1fr; gap: 12pt; }
.case-memo-recipient { margin: 6pt 0 8pt; }
.case-garuda-center { text-align: center; margin-bottom: 6pt; }
.case-ext-top { display: flex; justify-content: space-between; gap: 12pt; }
.case-ext-address p { margin: 0; }
.case-ext-date { margin: 6pt 0 6pt 50%; }
.case-ext-meta { margin: 2pt 0; }
.case-center-title { text-align: center; font-size: 18pt; margin: 2pt 0; font-weight: 700; }
.case-center-sub { text-align: center; margin: 2pt 0; }
.case-divider { text-align: center; margin: 4pt 0 10pt; letter-spacing: 1pt; }
.case-heading { font-weight: 700; font-size: 18pt; margin: 8pt 0 2pt; break-after: avoid; }
.case-para { margin: 0 0 4pt; }
.case-para.is-indented { text-indent: 2.5cm; }
.case-bold { font-weight: 700; }
.align-left { text-align: left; }
.align-center { text-align: center; }
.align-right { text-align: right; }
.align-justify { text-align: justify; }
.case-blank-highlight { background: #fff3a1; color: #5c3d00; padding: 0 3pt; border-radius: 2pt; }
.case-table { width: 100%; border-collapse: collapse; margin: 6pt 0; table-layout: fixed; }
.case-table th, .case-table td { padding: 3pt 5pt; vertical-align: top; }
.case-table.is-bordered th, .case-table.is-bordered td { border: 1px solid #000; }
.case-table thead { display: table-header-group; }
.case-table tr { break-inside: avoid; }
.case-table-caption { font-weight: 700; margin: 6pt 0 2pt; }
.case-photo-grid { display: grid; gap: 8pt; margin: 8pt 0; }
.case-photo-grid.cols-1 { grid-template-columns: 1fr; }
.case-photo-grid.cols-2 { grid-template-columns: 1fr 1fr; }
.case-photo-card { margin: 0; text-align: center; break-inside: avoid; }
.case-photo-card img { max-width: 100%; object-fit: contain; }
.case-photo-card figcaption { margin-top: 3pt; }
.case-sign-cluster { margin-top: 12pt; break-inside: avoid; }
.case-closing { text-indent: 2.5cm; margin: 0 0 12pt; }
.case-sigs { display: flex; justify-content: flex-end; gap: 16pt; margin-bottom: 10pt; }
.case-sig { text-align: center; min-width: 6.5cm; }
.case-sig p { margin: 0; }
.case-approvals.layout-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150pt, 1fr)); gap: 10pt; margin-top: 10pt; }
.case-approvals.layout-vertical { display: flex; flex-direction: column; gap: 10pt; margin-top: 10pt; }
.case-approval p { margin: 0; }
.case-routing { margin-top: 14pt; font-size: 14pt; display: grid; grid-template-columns: 1fr 1fr; gap: 2pt 12pt; }
.case-footer { margin-top: 16pt; font-size: 14pt; }
.case-footer p { margin: 0; }
.case-continuation { margin-top: 10pt; font-size: 12pt; color: #555; border-top: 1px dashed #ccc; padding-top: 3pt; }
</style>
</head>
<body>
<article class="case-page" data-doc-type="${esc(ir.docType)}" data-item-id="${esc(ir.itemId)}">
  ${renderHeaderHtml(ir, garudaUrl)}
  ${ir.blocks.map(b => renderBlockHtml(b, resolveAssetUrl)).join('\n')}
  ${showRouting ? `<aside class="case-routing">${ir.routingStrip!.lines.map(l => `<div>${esc(l)}</div>`).join('')}</aside>` : ''}
  ${ir.footerLines.length ? `<footer class="case-footer">${ir.footerLines.map(l => `<p>${esc(l)}</p>`).join('')}</footer>` : ''}
  <div class="case-continuation">${esc(ir.continuationNote)}</div>
</article>
</body>
</html>`;
}
