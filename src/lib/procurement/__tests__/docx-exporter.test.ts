import {it, expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import sharp from 'sharp';
import {DOMParser} from '@xmldom/xmldom';
import {modelsFor, findDoc, templateFixture} from './templates-fixtures';
import {renderDocumentDocx} from '../exporters/docx/render-doc-docx';
import {packageDocxZip, WORD_FILENAMES} from '../exporters/docx/zip-packager';
import {computeProcurementCase, defaultAgency} from '../index';
const namespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

it('packages all fifteen editable documents with a Thai filing/stamp checklist', async () => {
  const input = templateFixture();
  const bytes = await packageDocxZip(computeProcurementCase(input), defaultAgency);
  fs.mkdirSync('output/phase3', {recursive: true}); fs.writeFileSync('output/phase3/manual-documents.zip', bytes);
  const zip = await JSZip.loadAsync(bytes);
  expect(Object.keys(zip.files).filter(name => name.endsWith('.docx'))).toHaveLength(15);
  const checklist = await zip.file('00_รายการเรียงแฟ้มและเตือนวันที่.txt')!.async('string');
  expect(checklist).toContain('๑๓ พฤศจิกายน ๒๕๖๙'); expect(checklist).toContain('พิมพ์ ๓ ชุด');
  for (const id of ['1', '10', '12'] as const) {
    const doc = await JSZip.loadAsync(await zip.file(WORD_FILENAMES[id])!.async('nodebuffer'));
    const xml = await doc.file('word/document.xml')!.async('string');
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    expect(parsed.getElementsByTagNameNS(namespace, 'txbxContent').length).toBe(0);
    expect(parsed.getElementsByTagNameNS(namespace, 'keepNext').length).toBeGreaterThan(0);
    expect(parsed.getElementsByTagNameNS(namespace, 'cantSplit').length).toBeGreaterThan(0);
    // The bundled TTF's actual Word family omits the space before IT๙; the official display alias is retained.
    expect(await doc.file('word/styles.xml')!.async('string')).toContain('TH SarabunIT๙');
    expect(await doc.file('word/styles.xml')!.async('string')).toContain('w:lineRule="exact"');
    expect(await doc.file('word/fontTable.xml')!.async('string')).toContain('TH Sarabun IT๙');
    expect(Object.keys(doc.files).some(name => name.endsWith('.odttf'))).toBe(true);
    if (id === '12') expect([...parsed.getElementsByTagNameNS(namespace, 'tr')].some(row => (row.textContent || '').includes('จึงขอรายงานผลการพิจารณา') && (row.textContent || '').includes('ความเห็นของหัวหน้าเจ้าหน้าที่'))).toBe(true);
    fs.writeFileSync(`output/phase3/doc${id}.docx`, await zip.file(WORD_FILENAMES[id])!.async('nodebuffer'));
  }
  const inspection = await JSZip.loadAsync(await zip.file(WORD_FILENAMES['11.2'])!.async('nodebuffer'));
  const inspectionXml = new DOMParser().parseFromString(await inspection.file('word/document.xml')!.async('string'), 'application/xml');
  expect(inspectionXml.getElementsByTagNameNS('http://schemas.microsoft.com/office/word/2010/wordml', 'checkbox').length).toBe(5);
}, 180000);
it('embeds upright normalized photos with aspect-preserving dimensions and the final certification', async () => {
  const input = templateFixture();
  const source = await sharp({create: {width: 240, height: 120, channels: 3, background: '#dddddd'}}).withMetadata({orientation: 6}).jpeg().toBuffer();
  input.attachments.photoPaths = Array.from({length: 2}, () => `data:image/jpeg;base64,${source.toString('base64')}`);
  const bytes = await renderDocumentDocx(findDoc(modelsFor(input), '11.3'));
  const zip = await JSZip.loadAsync(bytes), xml = await zip.file('word/document.xml')!.async('string');
  const embedded = Object.keys(zip.files).find(name => /^word\/media\/.*\.jpg$/.test(name))!;
  const metadata = await sharp(await zip.file(embedded)!.async('nodebuffer')).metadata();
  expect([metadata.width, metadata.height]).toEqual([120, 240]);
  expect(metadata.orientation).toBeUndefined();
  expect(xml).toContain('ขอรับรองว่าเป็นเอกสารที่ถูกต้อง');
  const parsed = new DOMParser().parseFromString(xml, 'application/xml');
  const extents = [...parsed.getElementsByTagNameNS('http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing', 'extent')];
  expect(extents).toHaveLength(2);
  for (const extent of extents) expect(Number(extent.getAttribute('cx')) / Number(extent.getAttribute('cy'))).toBeCloseTo(0.5);
  fs.writeFileSync('output/phase3/photos-portrait.docx', bytes);
}, 60000);
it('uses native repeated headers and intact rows for a long attachment and an itemized PO', async () => {
  const input = templateFixture(22890); input.workflowModeOverride = 'MANUAL_UNDER_5000';
  const models = modelsFor(input, {poTableMode: 'ITEMIZED'});
  for (const id of ['6.1', '10'] as const) {
    const bytes = await renderDocumentDocx(findDoc(models, id));
    const zip = await JSZip.loadAsync(bytes), xml = await zip.file('word/document.xml')!.async('string');
    const parsed = new DOMParser().parseFromString(xml, 'application/xml');
    expect(parsed.getElementsByTagNameNS(namespace, 'tblHeader').length).toBeGreaterThan(0);
    expect(parsed.getElementsByTagNameNS(namespace, 'cantSplit').length).toBeGreaterThan(0);
    expect(parsed.getElementsByTagNameNS(namespace, 'txbxContent').length).toBe(0);
    expect(xml).toContain('thaiNumbers'); expect(xml).toContain('titlePg');
    if (id === '6.1') expect(xml).toContain('เอกสารแนบท้าย');
    fs.mkdirSync('output/phase3', {recursive: true}); fs.writeFileSync(`output/phase3/doc${id.replace('.', '-')}-long.docx`, bytes);
  }
}, 180000);
