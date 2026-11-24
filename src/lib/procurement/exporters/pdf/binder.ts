import 'server-only';
import {PDFDocument} from 'pdf-lib';
import {buildDocumentModels} from '../../templates/build-all';
import {buildBinderManifest} from '../../manifest';
import type {AgencyConfig, ComputedProcurementCase} from '../../types';
import {PdfBinderOptionsSchema, selectBinderEntries, type PdfBinderOptions} from '../profiles';
import {buildCoverChecklist, renderDividerSheet} from './divider-sheet';
import {renderDocumentPdf, type PdfDocumentResult} from './render-doc-pdf';

export async function assemblePdfBinder(c: ComputedProcurementCase, agency: AgencyConfig, input: PdfBinderOptions) {
  const options = PdfBinderOptionsSchema.parse(input);
  const selected = selectBinderEntries(c, options.profile);
  const models = buildDocumentModels(c, agency, {density:options.density,showRoutingStrip: options.routingStripMode !== 'NONE', routingStripCopies: options.routingStripMode === 'ALL_COPIES' ? 'ALL_COPIES' : 'FIRST_COPY'});
  const allEntries = buildBinderManifest(c);
  const rendered = new Map<string, Promise<PdfDocumentResult>>();
  const jobs: {docId: string; copy: number; source: string; result: Promise<PdfDocumentResult>}[] = [];
  if (options.includeCoverChecklist) jobs.push({docId: 'COVER', copy: 1, source: 'CHECKLIST', result: renderDocumentPdf(buildCoverChecklist(c, selected))});
  for (const row of selected) {
    if (row.source !== 'GENERATED') {
      if (options.includeDividers) jobs.push({docId: row.docId, copy: 1, source: row.source, result: renderDividerSheet(c, row, allEntries.findIndex(r => r.docId === row.docId) + 1)});
      continue;
    }
    const model = models.find(d => d.docId === row.docId)!;
    for (let copy = 1; copy <= (options.duplicateCopies ? row.copies : 1); copy++) {
      const different = !!model.routingStrip && options.routingStripMode === 'FIRST_COPY_ONLY' && copy > 1;
      const key = `${row.docId}:${different ? 'no-routing' : 'main'}`;
      let result = rendered.get(key);
      if (!result) {result = renderDocumentPdf(model, {copyNumber: copy}); rendered.set(key, result);}
      jobs.push({docId: row.docId, copy, source: row.source, result});
    }
  }
  if (!jobs.length) throw new Error('ไม่มีเอกสารสำหรับส่งออก กรุณาเลือกแผ่นคั่นหรือเปิดการร่างเอกสารเอง');
  // Await every queued job before propagating failure, so contexts are always released.
  const results = await Promise.allSettled(jobs.map(j => j.result));
  const failed = results.find(r => r.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
  const binder = await PDFDocument.create();
  const entries: {docId: string; copy: number; source: string; startPage: number; pageCount: number; appliedDensity: string; antiOrphanTriggered: boolean}[] = [];
  for (let i = 0; i < jobs.length; i++) {
    const result = results[i] as PromiseFulfilledResult<PdfDocumentResult>;
    const doc = await PDFDocument.load(result.value.pdfBytes);
    const startPage = binder.getPageCount() + 1;
    for (const page of await binder.copyPages(doc, doc.getPageIndices())) binder.addPage(page);
    entries.push({docId: jobs[i].docId, copy: jobs[i].copy, source: jobs[i].source, startPage, pageCount: result.value.pageCount, appliedDensity: result.value.appliedDensity, antiOrphanTriggered: result.value.antiOrphanTriggered});
  }
  return {pdfBytes: Buffer.from(await binder.save()), pageCount: binder.getPageCount(), entries};
}
