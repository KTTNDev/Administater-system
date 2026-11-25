import 'server-only';
import {PDFDocument} from 'pdf-lib';
import {withProcurementPage} from '../../../procurement/exporters/pdf/browser-pool';
import {normalizeThaiCMaps} from '../../../procurement/exporters/pdf/thai-cmap';
import type {InventoryFormIR} from '../ir';
import {loadInventoryPrintAssets, renderInventoryHtml} from './render-inv-html';

export interface InventoryPdfResult {
  pdfBytes: Buffer;
  pageCount: number;
}

export async function renderInventoryPdf(form: InventoryFormIR): Promise<InventoryPdfResult> {
  const assets = loadInventoryPrintAssets();
  const html = renderInventoryHtml(form, assets);
  const isLandscape = form.formCode === 'INV-02' && !!form.landscape;

  return withProcurementPage(async page => {
    await page.setContent(html, {waitUntil: 'load'});
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all(Array.from(document.images).map(img => img.decode().catch(() => {})));
    });
    const raw = await page.pdf({
      format: 'A4',
      landscape: isLandscape,
      printBackground: true,
      preferCSSPageSize: true,
    });
    const pdf = await PDFDocument.load(raw);
    normalizeThaiCMaps(pdf);
    const pdfBytes = Buffer.from(await pdf.save());
    return {pdfBytes, pageCount: pdf.getPageCount()};
  });
}

export async function mergeInventoryPdfs(forms: readonly InventoryFormIR[]): Promise<InventoryPdfResult> {
  if (!forms.length) throw new Error('ไม่มีเอกสารสำหรับส่งออก PDF');
  if (forms.length === 1) return renderInventoryPdf(forms[0]);

  const binder = await PDFDocument.create();
  for (const form of forms) {
    const rendered = await renderInventoryPdf(form);
    const part = await PDFDocument.load(rendered.pdfBytes);
    for (const page of await binder.copyPages(part, part.getPageIndices())) {
      binder.addPage(page);
    }
  }
  return {pdfBytes: Buffer.from(await binder.save()), pageCount: binder.getPageCount()};
}
