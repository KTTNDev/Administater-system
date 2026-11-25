import {expect, test} from '@playwright/test';
import {DOMParser} from '@xmldom/xmldom';
import JSZip from 'jszip';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {PDFDocument} from 'pdf-lib';
import {templateFixture} from '../../src/lib/procurement/__tests__/templates-fixtures';
import {defaultAgency} from '../../src/lib/procurement/presets/default-agency';
import {domainSql} from '../../src/lib/procurement/storage/sql-schema';
import {pdfDefaults, type StoredCase} from '../../src/lib/procurement/workspace/model';

test.skip(!process.env.SARABUN_E2E_DATA_ROOT, 'Disposable installation only');

function extractDocxText(xml: string): string {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const nodes = doc.getElementsByTagName('w:t');
  let out = '';
  for (let i = 0; i < nodes.length; i += 1) {
    out += nodes[i].textContent ?? '';
  }
  return out;
}

test('full Hybrid FIFO workflow: procurement intake -> 2-lot requisition w/ proxy -> reserve -> PDF/DOCX -> commit -> INV-02/03/04/05 reconciliation', async ({
  page,
}) => {
  test.setTimeout(240000);

  const root = process.env.SARABUN_E2E_DATA_ROOT!;
  expect(fs.existsSync(path.join(root, 'SAFETY-TEST-ONLY'))).toBe(true);

  // 1. Seed a completed BUY procurement case (1,520 THB: 2 items) into the disposable E2E DB
  const seededCaseInput = templateFixture(1520);
  const storedCase: StoredCase = {
    caseInput: seededCaseInput,
    agency: defaultAgency,
    version: 1,
    updatedAt: '2026-10-16T09:00:00.000Z',
    dueAcknowledged: false,
    pdfDefaults,
    tracker: {status: 'COMPLETED', workMonth: '2026-10', note: 'E2E FIFO intake fixture'},
    externalFiles: [],
  };

  const dbPath = path.join(root, 'data/sarabun.sqlite');
  const conn = new DatabaseSync(dbPath);
  for (const [table, sql] of Object.entries(domainSql)) {
    conn.exec(`CREATE TABLE IF NOT EXISTS ${table} (${sql})`);
  }
  // Ensure clean inventory_domain_state for deterministic assertions
  conn.exec(
    'CREATE TABLE IF NOT EXISTS inventory_domain_state (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL)',
  );
  conn.prepare("DELETE FROM inventory_domain_state WHERE id = 'default'").run();
  conn
    .prepare(
      'INSERT OR REPLACE INTO procurement_domain_cases (id, data, version, updated_at) VALUES (?, ?, ?, ?)',
    )
    .run(storedCase.caseInput.id, JSON.stringify(storedCase), 1, storedCase.updatedAt);
  conn.close();

  // 2. Navigate to existing "พัสดุและครุภัณฑ์" menu
  await page.goto('/?view=inventory');
  const app = page.getByRole('region', {name: 'คลังพัสดุและครุภัณฑ์'});
  await expect(app.getByTestId('inventory-fifo-workspace')).toBeVisible();

  // 3. Intake from completed procurement case (Doc 11.1)
  await app.getByRole('button', {name: '+ รับวัสดุเข้าคลัง', exact: true}).click();
  const intakeDialog = page.getByRole('dialog', {name: 'รับวัสดุเข้าคลัง'});
  await expect(intakeDialog).toBeVisible();
  await expect(intakeDialog).toContainText('สว 13/2570');
  await expect(intakeDialog).toContainText('ร้านดินสอสี');
  await intakeDialog.getByRole('button', {name: /รับเข้าคลังทั้งหมด \(2 รายการ\)/}).click();
  await expect(intakeDialog).toHaveCount(0);
  await expect(app.getByRole('status')).toContainText('นำเข้าวัสดุจากงานจัดซื้อจัดจ้าง');

  const boxRow = app.locator('tr', {hasText: 'กล่องพลาสติกมีฝาปิด ขนาด 120 ลิตร'}).first();
  await expect(boxRow).toBeVisible();
  await expect(boxRow).toContainText('590.00 บ.');
  await expect(app.locator('tr', {hasText: 'ตลับเมตรสายวัดยาว 50 เมตร'}).first()).toBeVisible();

  // 4. Add a 2nd price lot manually (5 ใบ @ 610.00 THB on 2026-12-05, after PO inspection 2026-11-24) so box spans 2 FIFO lots (2@590 + 5@610 = 7)
  await app.getByRole('button', {name: '+ รับวัสดุเข้าคลัง', exact: true}).click();
  await expect(intakeDialog).toBeVisible();
  await intakeDialog.getByRole('button', {name: 'รับเข้าด้วยตนเอง / ตั้งยอดยกมา', exact: true}).click();
  await intakeDialog.getByLabel('ปีงบประมาณ พ.ศ.', {exact: true}).fill('2570');
  await intakeDialog.getByLabel('วันที่รับเข้า', {exact: true}).fill('2026-12-05');
  await intakeDialog.getByLabel('รับจาก / แหล่งที่มา', {exact: true}).fill('รับจาก (ร้านอุปกรณ์ใหม่)');
  await intakeDialog.getByLabel('เลขที่เอกสารอ้างอิง / ใบสั่งซื้อ', {exact: true}).fill('สว 25/2570');
  await intakeDialog.getByLabel('จำนวนรับเข้า', {exact: true}).fill('5');
  await intakeDialog.getByLabel('ราคา/หน่วย (บาท)', {exact: true}).fill('610');
  await intakeDialog.getByRole('button', {name: 'บันทึกรับวัสดุเข้าคลัง', exact: true}).click();
  await expect(intakeDialog).toHaveCount(0);

  // Confirm box now has remaining = 7, reserved = 0, available = 7
  const origin = new URL(page.url()).origin;
  const domainAfterIntake = await (await page.request.get('/api/inventory/domain')).json();
  const boxMaterial = domainAfterIntake.record.data.materials.find((m: {name: string}) =>
    m.name.includes('กล่องพลาสติกมีฝาปิด'),
  );
  expect(boxMaterial).toBeTruthy();
  await expect(app.getByTestId(`mat-remaining-${boxMaterial.id}`)).toContainText('7 ใบ');
  await expect(app.getByTestId(`mat-reserved-${boxMaterial.id}`)).toContainText('0 ใบ');
  await expect(app.getByTestId(`mat-available-${boxMaterial.id}`)).toContainText('7 ใบ');

  // 5. Create Requisition spanning 2 FIFO lots (4 ใบ = 2@590 + 2@610) with separate proxy ผู้รับของ
  await app.getByRole('button', {name: '+ สร้างใบเบิกวัสดุ (FIFO)', exact: true}).click();
  const reqDialog = page.getByRole('dialog', {name: 'สร้างใบเบิกวัสดุ (FIFO)'});
  await expect(reqDialog).toBeVisible();
  await reqDialog.getByLabel('ปีงบประมาณ พ.ศ.', {exact: true}).fill('2570');
  await reqDialog.getByLabel('วันที่เบิก', {exact: true}).fill('2026-12-10');
  await reqDialog.getByLabel('ชื่อผู้เบิก', {exact: true}).fill('นางสาวณกัญญา ดีเบา');
  await reqDialog.getByLabel('ตำแหน่งผู้เบิก', {exact: true}).fill('นักพัฒนาชุมชนปฏิบัติการ');
  await reqDialog.getByLabel('ผู้รับของ (ถ้ามี / รับแทน)', {exact: true}).fill('นายสมชาย รับแทน');
  await reqDialog.getByRole('combobox', {name: 'รายการวัสดุ #1', exact: true}).selectOption(boxMaterial.id);
  await reqDialog.getByLabel('จำนวนขอเบิก', {exact: true}).fill('4');

  // Verify live 2-lot FIFO split preview + post-issue remaining balance (3 ใบ)
  const preview = reqDialog.getByTestId('fifo-preview-0');
  await expect(preview).toContainText('2 ล็อต');
  await expect(preview).toContainText('590.00');
  await expect(preview).toContainText('610.00');
  await expect(preview).toContainText('3 ใบ');
  await expect(preview).toContainText('2,400.00');

  await reqDialog.getByRole('button', {name: 'จองยอดรอลงนาม', exact: true}).click();
  await expect(reqDialog).toHaveCount(0);

  // 6. Verify Reservation Queue shows รอเซ็นรับของจริง while physical remaining is UNCHANGED (7) and reserved is 4
  const pendingQueue = app.getByRole('region', {name: 'คิวใบเบิกรอเซ็นรับของจริง'});
  await expect(pendingQueue).toBeVisible();
  await expect(pendingQueue).toContainText('รอเซ็นรับของจริง');
  await expect(pendingQueue).toContainText('นางสาวณกัญญา ดีเบา');
  await expect(pendingQueue).toContainText('นายสมชาย รับแทน');
  await expect(app.getByTestId(`mat-remaining-${boxMaterial.id}`)).toContainText('7 ใบ');
  await expect(app.getByTestId(`mat-reserved-${boxMaterial.id}`)).toContainText('4 ใบ');
  await expect(app.getByTestId(`mat-available-${boxMaterial.id}`)).toContainText('3 ใบ');

  // 7. Export INV-01 PDF & DOCX via API and verify authentic Chalong 5-column + 4-role + 100% Thai digits
  const domainPending = await (await page.request.get('/api/inventory/domain')).json();
  const reqId: string = domainPending.record.data.requisitions[0].id;
  expect(reqId).toBeTruthy();

  const inv01PdfRes = await page.request.post('/api/inventory/export/pdf', {
    headers: {Origin: origin},
    data: {kind: 'INV-01', requisitionId: reqId},
  });
  expect(inv01PdfRes.status()).toBe(200);
  const inv01PdfBytes = await inv01PdfRes.body();
  expect(inv01PdfBytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect((await PDFDocument.load(inv01PdfBytes)).getPageCount()).toBe(1);

  const inv01DocxRes = await page.request.post('/api/inventory/export/docx', {
    headers: {Origin: origin},
    data: {kind: 'INV-01', requisitionId: reqId},
  });
  expect(inv01DocxRes.status()).toBe(200);
  const inv01Zip = await JSZip.loadAsync(await inv01DocxRes.body());
  const inv01Xml = await inv01Zip.file('word/document.xml')!.async('string');
  expect(inv01Xml).toContain('TH SarabunIT๙');
  const inv01Text = extractDocxText(inv01Xml);
  for (const token of ['ใบเบิกวัสดุ', 'ลำดับ', 'รายการ', 'จำนวน', 'คงเหลือ', 'หมายเหตุ', 'ผู้เบิก', 'ผู้อนุมัติ', 'ผู้จ่ายวัสดุ', 'ผู้รับของ', 'นายสมชาย รับแทน']) {
    expect(inv01Text).toContain(token);
  }
  expect(inv01Text).not.toMatch(/[0-9]/);

  // 8. Click ยืนยันตัดสต๊อก (เซ็นรับแล้ว) and commit permanently
  await pendingQueue.getByRole('button', {name: 'ยืนยันตัดสต๊อก (เซ็นรับแล้ว)', exact: true}).click();
  const commitDialog = page.getByRole('dialog', {name: 'ยืนยันตัดสต๊อกหลังลงนาม'});
  await expect(commitDialog).toBeVisible();
  await expect(commitDialog).toContainText('นายสมชาย รับแทน');
  await commitDialog.getByRole('button', {name: 'ยืนยันตัดสต๊อกและลงบัญชีวัสดุ', exact: true}).click();
  await expect(commitDialog).toHaveCount(0);

  // Pending queue is now empty; physical balance dropped to 3, reserved back to 0
  await expect(pendingQueue).toHaveCount(0);
  await expect(app.getByTestId(`mat-remaining-${boxMaterial.id}`)).toContainText('3 ใบ');
  await expect(app.getByTestId(`mat-reserved-${boxMaterial.id}`)).toContainText('0 ใบ');
  await expect(app.getByTestId(`mat-available-${boxMaterial.id}`)).toContainText('3 ใบ');

  // 9. Inspect Stock Card (INV-02) inline and verify accounting entries & PDF/DOCX export
  await boxRow.getByRole('button', {name: 'ดูบัญชีวัสดุ (INV-02)', exact: true}).click();
  const stockCard = app.getByRole('region', {name: 'บัญชีวัสดุ (INV-02)'});
  await expect(stockCard).toBeVisible();
  await expect(stockCard).toContainText('บันทึกบัญชีเดบิท');
  await expect(stockCard).toContainText('ค่าวัสดุใช้ไป');
  await expect(stockCard).toContainText('1,830.00');

  const inv02Pdf = await page.request.post('/api/inventory/export/pdf', {
    headers: {Origin: origin},
    data: {kind: 'INV-02', fiscalYearBE: 2570, materialId: boxMaterial.id},
  });
  expect(inv02Pdf.status()).toBe(200);
  expect((await inv02Pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

  // 10. Asset Registry & Loan (INV-03) smoke test
  await app.getByRole('button', {name: 'ทะเบียนครุภัณฑ์ & ยืม-คืน', exact: true}).click();
  await app.getByRole('button', {name: '+ เพิ่มครุภัณฑ์', exact: true}).click();
  await app.getByLabel('เลขครุภัณฑ์', {exact: true}).fill('7440-001-0001/70');
  await app.getByLabel('ชื่อรายการครุภัณฑ์', {exact: true}).fill('เครื่องคอมพิวเตอร์โน้ตบุ๊ก');
  await app.getByLabel('ราคาทุน (บาท)', {exact: true}).fill('28500');
  await app.getByLabel('ผู้รับผิดชอบดูแล', {exact: true}).fill('นางสาวณกัญญา ดีเบา');
  await app.getByRole('button', {name: 'บันทึกทะเบียนครุภัณฑ์', exact: true}).click();
  await expect(app.getByRole('status')).toContainText('บันทึกทะเบียนครุภัณฑ์เรียบร้อย');
  await expect(app.locator('tr', {hasText: '7440-001-0001/70'})).toBeVisible();

  // 11. Annual Audit & Cut-off Reconciliation (INV-04 & INV-05)
  await app.getByRole('button', {name: 'รายงานตัดพัสดุ & ตรวจนับประจำปี', exact: true}).click();
  const reconcileCard = app.getByTestId('reconciliation-card');
  await expect(reconcileCard).toBeVisible();
  await expect(reconcileCard).toContainText('กระทบยอดถูกต้องตรงกัน');
  // Remaining FIFO value: 3 boxes @ 610 (1,830.00) + 1 tape measure @ 340 (340.00) = 2,170.00 THB
  await expect(reconcileCard).toContainText('2,170.00');

  for (const payload of [
    {kind: 'INV-04', fiscalYearBE: 2570, asOfDate: '2027-09-30'},
    {kind: 'INV-05', fiscalYearBE: 2570, auditDate: '2027-09-30'},
    {kind: 'ANNUAL_AUDIT_BINDER', fiscalYearBE: 2570},
  ]) {
    const res = await page.request.post('/api/inventory/export/pdf', {headers: {Origin: origin}, data: payload});
    expect(res.status()).toBe(200);
    expect((await res.body()).subarray(0, 5).toString()).toBe('%PDF-');
  }

  for (const payload of [
    {kind: 'INV-04', fiscalYearBE: 2570, asOfDate: '2027-09-30'},
    {kind: 'INV-05', fiscalYearBE: 2570, auditDate: '2027-09-30'},
    {kind: 'ANNUAL_AUDIT_ZIP', fiscalYearBE: 2570},
  ]) {
    const res = await page.request.post('/api/inventory/export/docx', {headers: {Origin: origin}, data: payload});
    expect(res.status()).toBe(200);
    const zip = await JSZip.loadAsync(await res.body());
    expect(Object.keys(zip.files).length).toBeGreaterThan(0);
  }

  // 12. Responsive check across mobile & desktop widths
  await app.getByRole('button', {name: 'คลังวัสดุ & เบิก-จ่าย (FIFO)', exact: true}).click();
  for (const width of [320, 375, 768, 1440]) {
    await page.setViewportSize({width, height: 1000});
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  }
});
