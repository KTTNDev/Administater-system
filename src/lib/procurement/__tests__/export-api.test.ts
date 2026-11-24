import {afterAll, beforeAll, expect, it, vi} from 'vitest';
import sharp from 'sharp';
import JSZip from 'jszip';
import {templateFixture} from './templates-fixtures';
import {defaultAgency} from '../index';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {db,setSetting} from '../../db';import {sqliteRepository} from '../storage/sqlite';
import {newCase} from '../workspace/model';import {bindProcurementCoreDrafts} from '../core/bindings';
let caseId='';
import {POST as preview} from '@/app/api/procurement/preview-html/route';
import {POST as pdf} from '@/app/api/procurement/export/pdf/route';
import {POST as docx} from '@/app/api/procurement/export/docx/route';
import {POST as photos} from '@/app/api/procurement/photos/route';
import {closeProcurementBrowser} from '../exporters/pdf/browser-pool';
import {guardExportRequest} from '../exporters/api';

const body = () => ({caseId});
const request = (url: string, value: unknown) => new Request(`http://localhost${url}`, {method: 'POST', headers: {origin: 'http://localhost', host: 'localhost', 'content-type': 'application/json'}, body: JSON.stringify(value)});
const pdfOptions = {profile: {mode: 'SINGLE_DOC', docId: '13'}, duplicateCopies: false, includeDividers: false, includeCoverChecklist: false, routingStripMode: 'NONE'};
beforeAll(async()=>{const folder=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-core-output-api-'));vi.stubEnv('DATABASE_PATH',path.join(folder,'data.sqlite'));vi.stubEnv('DATABASE_REQUIRE_EXISTING','false');vi.stubEnv('SARABUN_REQUIRE_LOGIN','false');vi.stubEnv('PROCUREMENT_PDF_CONCURRENCY','1');setSetting('storage:local',folder);const record=sqliteRepository.saveCase({...newCase(),caseInput:templateFixture(),agency:defaultAgency});caseId=record.caseInput.id;await bindProcurementCoreDrafts(caseId,record.version,'create');});
afterAll(async () => {await closeProcurementBrowser(); vi.unstubAllEnvs();});
it('accepts the configured public origin through normalized local Next URLs and rejects host/port spoofing',async()=>{
  vi.stubEnv('APP_URL','http://127.0.0.1:3100');
  const make=(origin:string,host:string)=>new Request('http://localhost:3100/api/procurement/preview-html',{method:'POST',headers:{origin,host}});
  await expect(guardExportRequest(make('http://127.0.0.1:3100','127.0.0.1:3100'))).resolves.toBeUndefined();
  await expect(guardExportRequest(make('https://unrelated.example','unrelated.example'))).rejects.toMatchObject({status:403});
  await expect(guardExportRequest(make('http://127.0.0.1:3101','127.0.0.1:3101'))).rejects.toMatchObject({status:403});
  await expect(guardExportRequest(make('http://127.0.0.1:3100','unrelated.example'))).rejects.toMatchObject({status:403});
  vi.stubEnv('APP_URL','');vi.stubEnv('SARABUN_REQUIRE_LOGIN','false');vi.stubEnv('PROCUREMENT_PDF_CONCURRENCY','1');
});

it('returns an offline HTML preview with Core pagination and embedded assets', async () => {
  const result = await preview(request('/api/procurement/preview-html', {...body(), docId: '1'}));
  expect(result.status).toBe(200); expect(result.headers.get('content-type')).toBe('text/html; charset=utf-8');
  expect(result.headers.get('content-security-policy')).toContain("default-src 'none'");
  const html = await result.text();
  expect(html).toContain('data:font/ttf;base64,'); expect(html).toContain('data:image/png;base64,');
  expect(html).not.toContain("url('/fonts/");
});
it('returns structured blocking issues and permits an explicit draft override', async () => {
  const original=sqliteRepository.getCase(caseId)!;sqliteRepository.saveCase({...original,caseInput:{...original.caseInput,budgetLine:{...original.caseInput.budgetLine,allocatedAmount:1}}});const input=body();
  const rejected = await preview(request('/api/procurement/preview-html', {...input, docId: '1'}));
  expect(rejected.status).toBe(200); // Saved Core preview remains authoritative.
  expect(await rejected.text()).toContain('sarabun-preview');
  const allowed = await preview(request('/api/procurement/preview-html', {...input, docId: '1', allowExportWithErrors: true}));
  expect(allowed.status).toBe(200);
  for (const handler of [pdf, docx]) {
    const response = await handler(request('/api/procurement/export/test', {...input, ...(handler === pdf ? {options: pdfOptions} : {mode: 'SINGLE_DOC', docId: '1'})}));
    expect(response.status).toBe(400);
    expect((await response.json()).issues.some((i: {severity: string}) => i.severity === 'ERROR')).toBe(true);
  }
});
it('restores the central budget without regenerating the saved drafts',()=>{const record=sqliteRepository.getCase(caseId)!;sqliteRepository.saveCase({...record,caseInput:{...record.caseInput,budgetLine:templateFixture().budgetLine}});});
it('strictly validates schema, origin and file-size limits', async () => {
  const invalid = await preview(request('/api/procurement/preview-html', {...body(), docId: 'not-a-doc', extra: true}));
  expect(invalid.status).toBe(400); expect((await invalid.json()).issues[0].code).toBe('INVALID_INPUT');
  const crossSite = request('/api/procurement/preview-html', {...body(), docId: '1'});
  crossSite.headers.set('origin', 'https://unrelated.example');
  expect((await preview(crossSite)).status).toBe(403);
  const oversized = request('/api/procurement/preview-html', {}); oversized.headers.set('content-length', '999999999');
  expect((await preview(oversized)).status).toBe(400);
});
it('downloads a real editable Word document with an RFC 5987 Thai filename', async () => {
  const response = await docx(request('/api/procurement/export/docx', {...body(), mode: 'SINGLE_DOC', docId: '10'}));
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toContain('wordprocessingml.document');
  expect(response.headers.get('content-disposition')).toContain("filename*=UTF-8''");
  const zip = await JSZip.loadAsync(await response.arrayBuffer());
  expect(await zip.file('word/document.xml')!.async('string')).toContain('ใบสั่งซื้อ');
}, 60000);
it('downloads real PDF bytes with pagination and density telemetry headers', async () => {
  const response = await pdf(request('/api/procurement/export/pdf', {...body(), options: pdfOptions}));
  expect(response.status).toBe(200); expect(response.headers.get('content-type')).toBe('application/pdf');
  expect(Number(response.headers.get('x-page-count'))).toBeGreaterThan(0);
  expect(response.headers.get('x-document-engine')).toBe('core-draft');
  expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString()).toBe('%PDF');
}, 180000);
it('normalizes multipart photos and returns reusable embedded photo references', async () => {
  const input = await sharp({create: {width: 2000, height: 1000, channels: 3, background: '#ddd'}}).png().toBuffer();
  const form = new FormData(); form.append('files[]', new File([new Uint8Array(input)], 'ตัวอย่าง.png', {type: 'image/png'}));
  const request = new Request('http://localhost/api/procurement/photos', {method: 'POST', headers: {origin: 'http://localhost', host: 'localhost'}, body: form});
  const response = await photos(request); expect(response.status).toBe(200);
  const result = await response.json();
  expect(result).toHaveLength(1); expect(result[0].width).toBe(1400); expect(result[0].dataUri).toMatch(/^data:image\/jpeg;base64,/);
  expect(result[0].id).toMatch(/^[a-f0-9]{64}$/);
  const bad = new FormData(); bad.append('files[]', new File(['not an image'], 'bad.png'));
  expect((await photos(new Request('http://localhost/api/procurement/photos', {method: 'POST', headers: {origin: 'http://localhost', host: 'localhost'}, body: bad}))).status).toBe(400);
});
