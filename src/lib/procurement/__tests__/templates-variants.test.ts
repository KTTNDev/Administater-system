import {it, expect} from 'vitest';
import {renderDocumentHtml, SARABUN_RULES, pageRules, nextDensity, splitTableByMeasuredRows} from '../index';
import {templateFixture, modelsFor, findDoc, visibleText} from './templates-fixtures';

it('keeps the position with its acting capacity and prints the target office separately without duplication', () => {
  const input = templateFixture();
  input.signatories.mayor.actingLine = 'รองนายกเทศมนตรี ปฏิบัติราชการแทน';
  const closing = findDoc(modelsFor(input), '1').pages[0].blocks.find(b => b.kind === 'signature-cluster')!;
  expect(closing.approvals.at(-1)?.signature.lines).toEqual(['รองนายกเทศมนตรี ปฏิบัติราชการแทน', 'นายกเทศมนตรีตำบลฉลอง']);
  expect(closing.approvals[1].signature.lines).toEqual(['รองปลัดเทศบาล รักษาราชการแทน', 'ปลัดเทศบาลตำบลฉลอง']);
});

it('updates all price and counterparty references from a single edited case', () => {
  const input = templateFixture();
  input.vendor.shopName = 'ร้านใหม่ ทดสอบ';
  input.items[0].unitPrice = 600;
  input.budgetLine.transferInAmount = 100;
  input.budgetLine.transferOutAmount = 50;
  const models = modelsFor(input);
  for (const id of ['7', '8', '9', '10', '12', '13']) {
    const value = visibleText(findDoc(models, id));
    expect(value).toContain('ร้านใหม่ ทดสอบ');
    expect(value).toContain('๑,๕๔๐.๐๐');
    expect(value).not.toContain('๑,๕๒๐.๐๐');
  }
  const ledger = findDoc(models, '13').pages[0].blocks.find(b => b.kind === 'table')!;
  expect(ledger.rows.map(row => row.map(c => c.text))).toEqual([
    ['ตั้งไว้', '๓๐๐,๐๐๐.๐๐', 'โอนเพิ่ม', '๑๐๐.๐๐'],
    ['โอนลด', '๕๐.๐๐', 'รวมเป็นเงิน', '๓๐๐,๐๕๐.๐๐'],
    ['เบิกจ่ายแล้ว', '๑,๐๐๐.๐๐', 'คงเหลือ', '๒๙๙,๐๕๐.๐๐'],
  ]);
});

it('uses hire vocabulary and the same 0.10 percent fine in TOR and purchase order', () => {
  const input = templateFixture(); input.procurementType = 'HIRE';
  const models = modelsFor(input);
  for (const id of ['4.1', '10']) expect(visibleText(findDoc(models, id))).toContain('๐.๑๐');
  expect(visibleText(findDoc(models, '10'))).toContain('ใบสั่งจ้าง');
  expect(visibleText(findDoc(models, '10'))).toContain('ผู้รับจ้าง');
  expect(visibleText(findDoc(models, '4.1'))).toContain('ผู้ว่าจ้าง');
  input.penaltyRatePercent = 0.35;
  for (const id of ['4.1', '10']) expect(visibleText(findDoc(modelsFor(input), id))).toContain('๐.๓๕');
});
it.each([true, false])('conditionally includes VAT rows (registered=%s)', registered => {
  const input = templateFixture(); input.vendor.isVatRegistered = registered;
  for (const id of ['7', '10']) {
    const value = visibleText(findDoc(modelsFor(input), id));
    expect(value.includes('ภาษีมูลค่าเพิ่ม ๗%')).toBe(registered);
    if (!registered) expect(value).not.toContain('๙๙.๔๔');
  }
});
it('uses the same chair and two members in every inspection-related document', () => {
  const input = templateFixture(); input.inspectorMode = 'COMMITTEE_3';
  input.inspectors = (['CHAIRPERSON', 'MEMBER', 'MEMBER'] as const).map((role, i) => ({fullName: `ผู้ตรวจรับหมายเลข ${i + 1}`, position: 'เจ้าหน้าที่', role}));
  for (const id of ['6.1', '6.2', '11.1', '11.2', '11.3']) {
    const value = visibleText(findDoc(modelsFor(input), id));
    for (const n of ['๑', '๒', '๓']) expect(value).toContain(`ผู้ตรวจรับหมายเลข ${n}`);
    expect(value).toContain('ประธานกรรมการ');
    expect(value).toContain('กรรมการ');
  }
});
it('supports itemized PO rows with quantity and unit in their correct columns', () => {
  const doc = findDoc(modelsFor(templateFixture(), {poTableMode: 'ITEMIZED'}), '10');
  const table = doc.pages[0].blocks.find(b => b.kind === 'table')!;
  expect(table.rows).toHaveLength(2);
  expect(table.rows[0].map(c => c.text)).toEqual(['๑', 'กล่องพลาสติกมีฝาปิด ขนาด ๑๒๐ ลิตร', '๒', 'ใบ', '๕๙๐.๐๐', '๑,๑๘๐.๐๐']);
});
it('does not certify successful receipt or recommend payment for incomplete inspection', () => {
  const input = templateFixture(); input.inspectionResult.isComplete = false;
  const models = modelsFor(input);
  const inspection = visibleText(findDoc(models, '11.1'));
  expect(inspection).toContain('ต้องดำเนินการแก้ไขก่อนรับมอบ');
  expect(inspection).not.toContain('เห็นควรอนุมัติเบิกจ่ายเงินให้กับ');
  expect(visibleText(findDoc(models, '11.2'))).toContain('☑ ไม่ครบถ้วนตามสัญญา');
});
it('escapes HTML, styles and image URLs while preserving model codes and email addresses', () => {
  const input = templateFixture();
  input.projectTitleShort = '</style><script>alert(1)</script>';
  input.items[0].description = 'Brother BT-5000 TN-269 D 60 test123@example.com จำนวน 120';
  input.attachments.photoPaths = ['javascript:alert(1)', '/uploads/a" onerror="alert(1).png'];
  const models = modelsFor(input), html = renderDocumentHtml(findDoc(models, '1'));
  expect(html).not.toContain('<script>');
  expect(html).toContain('&lt;script&gt;');
  expect(html.match(/<\/style>/g)).toHaveLength(1);
  const request = visibleText(findDoc(models, '6.1'));
  expect(request).toContain('BT-5000 TN-269 D 60 test123@example.com จำนวน ๑๒๐');
  const photos = renderDocumentHtml(findDoc(models, '11.3'));
  expect(photos).not.toContain('src="javascript:');
  expect(photos).not.toContain(' onerror="');
});
it('defines the exact paper, margins, Garuda sizes, density tiers and anti-orphan CSS', () => {
  expect(SARABUN_RULES.paper).toEqual({widthMm: 210, heightMm: 297});
  expect(pageRules('MEMO')).toMatchObject({garudaHeightCm: 1.5, marginsCm: {top: 1.5, left: 3, right: 2, bottom: 2}});
  expect(pageRules('ORDER').garudaHeightCm).toBe(3);
  expect(pageRules('TOR')).toMatchObject({garudaHeightCm: 0, marginsCm: {top: 2.5}});
  expect(nextDensity('1', 'normal', 1100, 1000)).toBe('compact');
  expect(nextDensity('1', 'compact', 1150, 1000)).toBe('tight');
  expect(nextDensity('1', 'tight', 1100, 1000)).toBeNull();
  expect(nextDensity('1', 'normal', 1151, 1000)).toBeNull();
  expect(nextDensity('4.1', 'normal', 1100, 1000)).toBeNull();
  expect(nextDensity('1', 'normal', 900, 1000)).toBeNull();
  expect(() => nextDensity('1', 'normal', 1, 0)).toThrow();
  const html = renderDocumentHtml(findDoc(modelsFor(), '1'));
  for (const token of ['data-keep-trailing-lines="2"', 'class="signature-cluster"', 'break-inside:avoid', 'orphans:2', 'widows:2', 'table-header-group', '@page:first', "symbols:'๐'", 'data-density="normal"']) expect(html).toContain(token);
});
it('splits measured table rows without loss, repeats headers and prints the footer only at the end', () => {
  const input = templateFixture(22890); input.workflowModeOverride = 'MANUAL_UNDER_5000';
  const doc = findDoc(modelsFor(input, {poTableMode: 'ITEMIZED'}), '10');
  const source = doc.pages[0].blocks.find(b => b.kind === 'table')!;
  const before = JSON.stringify(source);
  const parts = splitTableByMeasuredRows(source, {headerHeight: 10, continuationCaptionHeight: 5, rowHeights: source.rows.map(() => 20), footerHeight: 30, firstPageHeight: 70, continuationPageHeight: 75});
  expect(parts.map(t => t.rows.length)).toEqual([3, 3, 1]);
  expect(parts.flatMap(t => t.rows)).toEqual(source.rows);
  expect(parts.map(t => t.continued)).toEqual([false, true, true]);
  expect(parts.every(t => t.repeatHeader)).toBe(true);
  expect(source.footerRows.length).toBeGreaterThan(0);
  expect(parts.slice(0, -1).flatMap(t => t.footerRows)).toEqual([]);
  expect(parts.at(-1)?.footerRows).toEqual(source.footerRows);
  expect(JSON.stringify(source)).toBe(before);
  const continued = structuredClone(doc); continued.pages[0].blocks = [parts[1]];
  expect(renderDocumentHtml(continued)).toContain('continued-table');
  expect(() => splitTableByMeasuredRows(source, {headerHeight: 10, continuationCaptionHeight: 0, rowHeights: [], footerHeight: 0, firstPageHeight: 1, continuationPageHeight: 1})).toThrow();
});
