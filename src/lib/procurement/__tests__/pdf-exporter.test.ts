import {afterAll, beforeAll, it, expect, vi} from 'vitest';
import fs from 'node:fs';
import {getDocument} from 'pdfjs-dist/legacy/build/pdf.mjs';
import {templateFixture, modelsFor, findDoc} from './templates-fixtures';
import {renderDocumentPdf} from '../exporters/pdf/render-doc-pdf';
import {closeProcurementBrowser} from '../exporters/pdf/browser-pool';
import {assemblePdfBinder} from '../exporters/pdf/binder';
import {computeProcurementCase, defaultAgency} from '../index';
import {selectBinderEntries, type PdfBinderOptions} from '../exporters/profiles';
import sharp from 'sharp';

beforeAll(() => {vi.stubEnv('PROCUREMENT_PDF_CONCURRENCY', '1'); fs.mkdirSync('output/phase3', {recursive: true});});
afterAll(async () => {await closeProcurementBrowser(); vi.unstubAllEnvs();});
export async function pdfText(bytes: Uint8Array) {
  const task = getDocument({data: new Uint8Array(bytes), useSystemFonts: false});
  const pdf = await task.promise;
  const pages: string[] = [];
    try {for (let i = 1; i <= pdf.numPages; i++) {const p = await pdf.getPage(i); const content = await p.getTextContent(); pages.push(content.items.map(item => 'str' in item ? item.str : '').join('')); p.cleanup();}}
  finally {await task.destroy();}
  return pages;
}
it('exports the real IR with local fonts and Thai text, and reports measured pagination', async () => {
  const model = findDoc(modelsFor(templateFixture()), '1');
  const result = await renderDocumentPdf(model);
  fs.writeFileSync('output/phase3/doc01.pdf', result.pdfBytes);
  fs.writeFileSync('output/phase3/doc01-telemetry.json', JSON.stringify({...result, pdfBytes: undefined}, null, 2));
  const pages = await pdfText(result.pdfBytes);
  expect(pages.length).toBe(result.pageCount);
  expect(pages.join('')).toContain('บันทึกข้อความ');
  expect(pages.join('')).not.toMatch(/[0-9]/);
  expect(result.signaturePages.every(p => p.bodyBefore)).toBe(true);
  expect(result.pageCount).toBe(1);
}, 180000);
const binderOptions: PdfBinderOptions = {profile: {mode: 'FULL_BINDER'}, duplicateCopies: true, includeDividers: false, includeCoverChecklist: false, routingStripMode: 'FIRST_COPY_ONLY'};
const compact = (value: string) => value.replace(/\s/g, '').normalize('NFKC');
it('prints every official copy in the 1,520 baht binder exactly once per prescribed copy, with one-page standard memos', async () => {
  const result = await assemblePdfBinder(computeProcurementCase(templateFixture()), defaultAgency, binderOptions);
  fs.writeFileSync('output/phase3/manual-binder.pdf', result.pdfBytes);
  fs.writeFileSync('output/phase3/manual-binder.json', JSON.stringify(result.entries, null, 2));
  const pages = await pdfText(result.pdfBytes);
  expect(pages).toHaveLength(result.pageCount);
  expect(result.entries).toHaveLength(23);
  for (const id of ['6.2', '8', '9']) expect(result.entries.filter(e => e.docId === id)).toHaveLength(3);
  for (const id of ['10', '11.2']) expect(result.entries.filter(e => e.docId === id)).toHaveLength(2);
  for (const id of ['1', '2', '3', '7', '11.1', '13']) expect(result.entries.find(e => e.docId === id)?.pageCount, `memo ${id}`).toBe(1);
  expect(pages.join('')).not.toMatch(/[0-9]/);
  for (const id of ['6.2', '8']) {
    const copies = result.entries.filter(e => e.docId === id);
    expect(pages.slice(copies[0].startPage - 1, copies[0].startPage - 1 + copies[0].pageCount).join('')).toContain('จนท./ร่าง/พิมพ์/ทาน');
    expect(pages.slice(copies[1].startPage - 1, copies[1].startPage - 1 + copies[1].pageCount).join('')).not.toContain('จนท./ร่าง/พิมพ์/ทาน');
  }
}, 240000);
it('renders only six official forms in the e-GP binder and inserts all fourteen external checklists in filing order', async () => {
  const input = templateFixture(22890); input.docs.laasPurchaseReportNo = '70-45-00231-5330100-00005';
  const result = await assemblePdfBinder(computeProcurementCase(input), defaultAgency, {...binderOptions, duplicateCopies: false, includeDividers: true});
  fs.writeFileSync('output/phase3/egp-binder.pdf', result.pdfBytes);
  const pages = await pdfText(result.pdfBytes);
  expect(result.entries.filter(e => e.source === 'GENERATED').map(e => e.docId)).toEqual(['1', '2', '3', '4.1', '11.1', '11.3']);
  expect(result.entries.filter(e => e.source !== 'GENERATED')).toHaveLength(14);
  expect(result.entries.map(e => e.docId)).toEqual(['1', '2', '3', '4.1', '4.2', '5.1', '5.2', '6.1', '6.2', '7', '8', '9', '10', '11.1', '11.2', '11.3', '11.4', '11.5', '12', '13']);
  expect(compact(pages.join(''))).toContain(compact('แผ่นคั่นสำหรับจัดเรียงแฟ้ม'));
  expect(compact(pages.join(''))).toContain(compact('๑๓ พฤศจิกายน ๒๕๖๙'));
}, 240000);
it('continues long TOR and attachment tables with repeated headers, Thai page numbers and no orphan signatures', async () => {
  const input = templateFixture();
  input.items = Array.from({length: 15}, (_, i) => ({id: String(i), description: `รายการทดสอบที่ ${i + 1} ` + 'รายละเอียดคุณลักษณะของวัสดุสำหรับตรวจสอบตารางต่อเนื่อง '.repeat(6), quantity: 1, unit: 'ชิ้น', unitPrice: 100}));
  const models = modelsFor(input, {poTableMode: 'ITEMIZED'});
  for (const id of ['6.1', '4.1', '10']) {
    const result = await renderDocumentPdf(findDoc(models, id));
    const pages = await pdfText(result.pdfBytes);
    fs.writeFileSync(`output/phase3/long-${id.replace('.', '-')}.pdf`, result.pdfBytes);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages[0]).not.toContain('- ๑ -');
    expect(pages[1]).toContain('- ๒ -');
    expect(compact(pages.join(''))).toContain(compact('รายการทดสอบที่ ๑๕'));
    expect(compact(pages.join(''))).toContain(compact('ตารางรายการ (ต่อ)'));
    expect(result.signaturePages.every(p => p.bodyBefore)).toBe(true);
    expect(result.signaturePages.filter(p => p.page > 1).every(p => p.bodyLinesBefore >= 2)).toBe(true);
    if (id === '10') expect(compact(pages.join('')).match(/ภาษีมูลค่าเพิ่ม๗%/g)).toHaveLength(1);
    if (id === '6.1') expect(pages.join('')).toContain('เอกสารแนบท้าย');
  }
}, 180000);
it('supports stage/single-document profiles and an optional master checklist', async () => {
  const c = computeProcurementCase(templateFixture());
  expect(selectBinderEntries(c, {mode: 'BY_STAGE', stage: 'STAGE_4_DISBURSEMENT'}).map(e => e.docId)).toEqual(['13']);
  expect(selectBinderEntries(c, {mode: 'BY_STAGE', stage: 'STAGE_1_PRINCIPLE'}).map(e => e.docId)).toEqual(['1', '2', '3', '4.1', '4.2']);
  const result = await assemblePdfBinder(c, defaultAgency, {...binderOptions, profile: {mode: 'BY_STAGE', stage: 'STAGE_4_DISBURSEMENT'}, includeCoverChecklist: true});
  expect(result.entries.map(e => e.docId)).toEqual(['COVER', '13']);
  await expect(assemblePdfBinder(c, defaultAgency, {...binderOptions, profile: {mode: 'SINGLE_DOC', docId: '4.2'}})).rejects.toThrow('ไม่มีเอกสาร');
}, 180000);
it('embeds normalized photos and keeps the final committee certification with photo content', async () => {
  const input = templateFixture();
  const image = await sharp({create: {width: 300, height: 600, channels: 3, background: '#ddd'}}).withMetadata({orientation: 6}).jpeg().toBuffer();
  input.attachments.photoPaths = Array.from({length: 5}, () => `data:image/jpeg;base64,${image.toString('base64')}`);
  input.inspectorMode = 'COMMITTEE_3'; input.inspectors = (['CHAIRPERSON', 'MEMBER', 'MEMBER'] as const).map((role, i) => ({fullName: `กรรมการทดสอบ ${i + 1}`, position: 'เจ้าหน้าที่', role}));
  const result = await renderDocumentPdf(findDoc(modelsFor(input), '11.3'));
  const pages = await pdfText(result.pdfBytes);
  expect(result.pageCount).toBe(2);
  expect(pages[0]).not.toContain('ขอรับรองว่าเป็นเอกสารที่ถูกต้อง');
  expect(pages[1]).toContain('ขอรับรองว่าเป็นเอกสารที่ถูกต้อง');
  expect(pages[1]).toContain('ประธานกรรมการ');
  fs.writeFileSync('output/phase3/photos-committee.pdf', result.pdfBytes);
}, 180000);
