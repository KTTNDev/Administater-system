import {toThaiDigits} from '../../formatting';
import type {DocumentBlock, RenderedDocumentSpec, SignatureBlock, TableCell, TableBlock} from '../ir';
import {sarabunStyles} from './styles.css';
import {SARABUN_RULES} from '../sarabun-rules';

const escape = (s: string) => s.replace(/[&<>"']/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[ch]!));
export interface HtmlRenderOptions {
  copyNumber?: number;
  /** Resolved by the Phase 3 asset adapter; this pure renderer never reads local paths. */
  resolveAssetUrl?: (source: string) => string;
}
function safeImage(source: string) {
  const s = source.trim();
  return /^(?:https?:\/\/|\/(?!\/)|\.\.?\/|data:image\/(?:png|jpeg|webp|gif);base64,)/i.test(s) ? s : '';
}
const signature = (s: SignatureBlock) => `<div class="signature">${s.showSignatureLine ? '<p class="signature-line"><span>(ลงชื่อ)</span><span class="signature-dots" aria-hidden="true"></span></p>' : ''}<p>(${escape(s.name)})</p>${s.lines.map(line => `<p>${escape(line)}</p>`).join('')}${s.label ? `<p>${escape(s.label)}</p>` : ''}${s.date ? `<p>${escape(s.date)}</p>` : ''}</div>`;
const cell = (c: TableCell, tag = 'td') => `<${tag}${c.colspan ? ` colspan="${c.colspan}"` : ''}${c.align ? ` style="text-align:${c.align}"` : ''}>${c.bold ? '<strong>' : ''}${escape(c.text)}${c.bold ? '</strong>' : ''}</${tag}>`;
function renderTable(b: TableBlock) {
  const widths = b.columnWidths ?? b.columns.map(() => 100 / b.columns.length);
  return `<table class="${b.bordered ? 'bordered' : 'borderless'}${b.continued ? ' continued-table' : ''}" data-repeat-header="true" data-continuation-caption="${escape(b.continuationCaption)}"><colgroup>${widths.map(width => `<col style="width:${width}%">`).join('')}</colgroup>${b.caption ? `<caption>${escape(b.caption)}</caption>` : ''}<thead><tr class="table-continuation-label"><th colspan="${b.columns.length}">${escape(b.continuationCaption)}</th></tr><tr>${b.columns.map(t => `<th scope="col">${escape(t)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(row => `<tr>${row.map(c => cell(c)).join('')}</tr>`).join('')}</tbody>${b.footerRows.length ? `<tfoot>${b.footerRows.map(row => `<tr>${row.map(c => cell(c)).join('')}</tr>`).join('')}</tfoot>` : ''}</table>`;
}
function renderBlock(b: DocumentBlock, options: HtmlRenderOptions): string {
  switch (b.kind) {
    case 'paragraph': return `${b.heading ? `<h2 class="section-heading" style="text-align:left">${escape(b.heading)}</h2>` : ''}<p class="paragraph${b.indent ? ' indent' : ''}${b.keepTrailingLines ? ' keep-body-tail' : ''}"${b.keepTrailingLines ? ' data-keep-trailing-lines="2"' : ''}>${escape(b.text)}</p>`;
    case 'table': return renderTable(b);
    case 'signature-cluster': return `<section class="signature-cluster" data-keep-with-previous="true">${b.closing.map(t => `<p class="closing">${escape(t)}</p>`).join('')}<div class="signatures">${b.signatures.map(signature).join('')}</div>${b.approvals.length ? `<div class="approval-${b.approvalLayout}">${b.approvals.map(box => `<div class="approval"><p><strong>${escape(box.heading)}</strong></p>${box.comments.map(t => `<p>${escape(t)}</p>`).join('')}${signature(box.signature)}</div>`).join('')}</div>` : ''}</section>`;
    case 'metadata': return `<div class="metadata">${b.columns.map(col => `<div>${col.map(t => `<div>${escape(t)}</div>`).join('')}</div>`).join('')}</div>`;
    case 'checkboxes': return b.groups.map(g => `<div class="checkbox-group"><strong>${escape(g.label)}</strong> ${g.choices.map(ch => `<span class="choice">${ch.checked ? '☑' : '☐'} ${escape(ch.text)}</span>`).join('')}</div>`).join('');
    case 'photo-grid': return `<div class="photo-grid" style="grid-template-columns:repeat(${b.columns},minmax(0,1fr))">${b.photos.length ? b.photos.map(photo => {
      const src = safeImage(options.resolveAssetUrl?.(photo.source) ?? photo.source);
      return `<figure>${src ? `<img src="${escape(src)}" alt="${escape(photo.alt)}" style="max-height:${b.maxHeightCm}cm">` : `<div class="photo-placeholder">${escape(photo.alt)} — รอแนบภาพ</div>`}</figure>`;
    }).join('') : '<div class="photo-placeholder">ยังไม่มีรูปภาพประกอบ</div>'}</div>`;
  }
}
function renderHeader(model: RenderedDocumentSpec, options: HtmlRenderOptions) {
  const h = model.header;
  const garudaUrl = safeImage(options.resolveAssetUrl?.(SARABUN_RULES.garuda.url) ?? SARABUN_RULES.garuda.url);
  const garuda = `<img class="garuda" src="${escape(garudaUrl)}" alt="ตราครุฑ">`;
  const field = (label: string, value: string) => `<div class="field"><span class="field-label">${label}</span><span class="field-value">${escape(value)}</span></div>`;
  if (model.family === 'MEMO') return `<header><div class="memo-brand">${garuda}<h1>บันทึกข้อความ</h1></div><div class="memo-fields">${field('ส่วนราชการ', h.department ?? '')}<div class="field-row">${field('ที่', h.number ?? '')}${field('วันที่', h.date ?? '')}</div>${field('เรื่อง', h.subject ?? '')}</div><p class="recipient"><strong>เรียน</strong> ${escape(h.recipient ?? '')}</p></header>`;
  if (model.family === 'EXTERNAL_LETTER') return `<header>${garuda}<div class="external-top"><div>ที่ ${escape(h.number ?? '')}</div><div>${h.addressLines?.map(t => `<div>${escape(t)}</div>`).join('') ?? ''}</div></div><div class="external-date">${escape(h.date ?? '')}</div><p><strong>เรื่อง</strong> ${escape(h.subject ?? '')}</p><p class="recipient"><strong>เรียน</strong> ${escape(h.recipient ?? '')}</p></header>`;
  const hasGaruda = ['ORDER', 'ANNOUNCEMENT', 'PURCHASE_ORDER'].includes(model.family);
  return `<header class="official-heading">${hasGaruda ? garuda : ''}${h.lines.map((line, i) => i === 0 ? `<h1>${escape(line)}</h1>` : `<p>${escape(line)}</p>`).join('')}</header>`;
}

/** All prose comes from the IR. No legal text or case calculations belong in this renderer. */
export function renderDocumentHtml(model: RenderedDocumentSpec, options: HtmlRenderOptions = {}): string {
  const copy = options.copyNumber ?? 1;
  if (!Number.isInteger(copy) || copy < 1 || copy > model.copies) throw new RangeError('ลำดับสำเนาไม่ถูกต้อง');
  const routing = model.routingStrip && (model.routingStrip.visibility === 'ALL_COPIES' || copy === 1)
    ? `<aside class="routing-strip">${model.routingStrip.lines.map(t => `<p>${escape(t)}</p>`).join('')}</aside>` : '';
  // CSS strings need their own escaping; HTML escaping alone cannot protect a style element.
  const note = model.continuationNote.replace(/[\\"\r\n<>]/g, ch => `\\${ch.charCodeAt(0).toString(16)} `);
  const css = sarabunStyles(model.family) + `\n@page{@bottom-left{content:"${note}"}}@page:first{@bottom-left{content:none}}`;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(model.title)}</title><style>${css}</style></head><body><main class="document" data-doc-id="${model.docId}" data-density="${model.layout.density}" data-single-page-preferred="${model.layout.singlePagePreferred}">${model.pages.map((page, i) => `<section class="sheet" data-purpose="${page.purpose}" data-page-index="${i + 1}">${i ? `<div class="page-number">- ${toThaiDigits(i + 1)} -</div>` : renderHeader(model, options)}${page.heading?.map(t => `<h2>${escape(t)}</h2>`).join('') ?? ''}${page.blocks.map(b => renderBlock(b, options)).join('')}${i === model.pages.length - 1 ? routing + (model.footerLines.length ? `<footer class="footer">${model.footerLines.map(t => `<p>${escape(t)}</p>`).join('')}</footer>` : '') : ''}${i ? `<footer class="continuation-note">${escape(model.continuationNote)}</footer>` : ''}</section>`).join('')}</main></body></html>`;
}
