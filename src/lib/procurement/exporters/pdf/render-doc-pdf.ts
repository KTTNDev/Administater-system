import 'server-only';
import {PDFDocument} from 'pdf-lib';
import {offlineDocumentHtml} from '../../assets/render-assets';
import type {Density, RenderedDocumentSpec} from '../../templates/ir';
import {pageRules} from '../../templates/sarabun-rules';
import {withProcurementPage} from './browser-pool';
import {paginateDom} from './paginate-dom';
import {PAGINATION_MEASUREMENT_CSS} from '../../layout/paginate-document';
import {normalizeThaiCMaps} from './thai-cmap';

export interface PdfDocumentResult {
  docId: string; pdfBytes: Buffer; pageCount: number; appliedDensity: Density; antiOrphanTriggered: boolean;
  signaturePages: {page: number; bodyBefore: boolean; bodyLinesBefore: number}[];
  measuredHeight: number; usableHeight: number;
}
export interface PdfRenderOptions {copyNumber?: number; photos?: ReadonlyMap<string, Buffer>}
export async function renderDocumentPdf(model: RenderedDocumentSpec, options: PdfRenderOptions = {}): Promise<PdfDocumentResult> {
  const html = await offlineDocumentHtml(model, {copyNumber: options.copyNumber}, options.photos);
  return withProcurementPage(async page => {
    await page.setContent(html, {waitUntil: 'load'});
    await page.evaluate(async () => {await document.fonts.ready; await Promise.all([...document.images].map(img => img.decode()));});
    const margins = pageRules(model.family).marginsCm;
    const usable = (29.7 - margins.top - margins.bottom) * 96 / 2.54;
    // Measure flow at the exact printable width; screen A4 padding otherwise distorts scroll metrics.
    await page.addStyleTag({content:PAGINATION_MEASUREMENT_CSS});
    const measure = () => page.evaluate(() => {
      const sheet = document.querySelector<HTMLElement>('.sheet')!;
      return Math.max(sheet.scrollHeight, sheet.getBoundingClientRect().height);
    });
    let appliedDensity: Density = model.layout.density;
    let height = await measure();
    if (model.layout.singlePagePreferred && model.pages.length === 1 && height > usable && height / usable <= 1.16) {
      for (const tier of ['compact', 'tight'] as const) {
        await page.locator('.document').evaluate((el, density) => {(el as HTMLElement).dataset.density = density;}, tier);
        appliedDensity = tier; height = await measure();
        if (height <= usable) break;
      }
    }
    if (height > usable && model.layout.singlePagePreferred) {
      appliedDensity = 'normal';
      await page.locator('.document').evaluate(el => {(el as HTMLElement).dataset.density = 'normal';});
    }
    const measuredHeight = await measure();
    const layout = await paginateDom(page, model.family);
    if (layout.horizontalOverflow || layout.overflows.length) throw new Error(`จัดหน้าไม่สำเร็จ เอกสาร ${model.docId} มีเนื้อหาล้นหน้า ${layout.overflows.join(',')}`);
    if (layout.physicalPages > 1 && layout.signaturePages.some(p => !p.bodyBefore)) throw new Error(`เอกสาร ${model.docId} มีชุดลงนามแยกจากเนื้อหา`);
    const printed = await page.pdf({format: 'A4', printBackground: true, preferCSSPageSize: true});
    const pdf = await PDFDocument.load(printed);
    normalizeThaiCMaps(pdf);
    const pdfBytes = Buffer.from(await pdf.save());
    const pageCount = pdf.getPageCount();
    if (pageCount !== layout.physicalPages) throw new Error(`จำนวนหน้าจริงไม่ตรงกับการตรวจจัดหน้า: ${pageCount}/${layout.physicalPages}`);
    return {docId: model.docId, pdfBytes, pageCount, appliedDensity, antiOrphanTriggered: layout.antiOrphanTriggered, signaturePages: layout.signaturePages, measuredHeight, usableHeight: usable};
  });
}
