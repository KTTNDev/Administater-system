import {expect, test} from '@playwright/test';
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

test('Phase 8 Case Folder workflow: multi-doc @ref sync, cross-module procurement link, Local Word Handoff ZIP, Quick Blank Word, and Safe Clone', async ({
  page,
}) => {
  test.setTimeout(240000);

  const root = process.env.SARABUN_E2E_DATA_ROOT!;
  expect(fs.existsSync(path.join(root, 'SAFETY-TEST-ONLY'))).toBe(true);

  // Seed deterministic disposable procurement case (PO สว 13/2570, 1,520.00 THB) & reset case_folder_domain_state
  const seededCaseInput = templateFixture(1520);
  const storedCase: StoredCase = {
    caseInput: seededCaseInput,
    agency: defaultAgency,
    version: 1,
    updatedAt: '2026-10-16T09:00:00.000Z',
    dueAcknowledged: false,
    pdfDefaults,
    tracker: {status: 'COMPLETED', workMonth: '2026-10', note: 'E2E Case Folder Link fixture'},
    externalFiles: [],
  };

  const dbPath = path.join(root, 'data/sarabun.sqlite');
  const conn = new DatabaseSync(dbPath);
  for (const [table, sql] of Object.entries(domainSql)) {
    conn.exec(`CREATE TABLE IF NOT EXISTS ${table} (${sql})`);
  }
  conn.exec(
    'CREATE TABLE IF NOT EXISTS case_folder_domain_state (id TEXT PRIMARY KEY, data TEXT NOT NULL, version INTEGER NOT NULL, updated_at TEXT NOT NULL)',
  );
  conn.exec(
    'CREATE TABLE IF NOT EXISTS case_core_drafts (id TEXT PRIMARY KEY, folder_id TEXT NOT NULL, item_id TEXT NOT NULL, draft_id TEXT NOT NULL, copies INTEGER NOT NULL, source_version INTEGER NOT NULL, synced_at TEXT NOT NULL, UNIQUE(folder_id, item_id))',
  );
  conn.prepare("DELETE FROM case_folder_domain_state WHERE id = 'default'").run();
  conn.prepare('DELETE FROM case_core_drafts').run();
  conn
    .prepare(
      'INSERT OR REPLACE INTO procurement_domain_cases (id, data, version, updated_at) VALUES (?, ?, ?, ?)',
    )
    .run(storedCase.caseInput.id, JSON.stringify(storedCase), 1, storedCase.updatedAt);
  conn.close();

  // -------------------------------------------------------------------------
  // 1. Multi-Doc Folder + Shared Variable + Live @ref Sync + Cross-Module Link
  // -------------------------------------------------------------------------
  await page.goto('/?view=cases');
  await expect(page.getByRole('heading', {name: /แฟ้มงานสารบรรณ/})).toBeVisible();

  await page.getByRole('button', {name: '+ สร้างแฟ้มงานใหม่'}).click();
  const newDialog = page.getByRole('dialog', {name: 'สร้างแฟ้มงานสารบรรณใหม่'});
  await expect(newDialog).toBeVisible();
  await newDialog
    .getByLabel('ชื่อแฟ้มงาน / โครงการ')
    .fill('โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ ประจำปี ๒๕๗๐');
  await newDialog.getByLabel('ปีงบประมาณ (พ.ศ.)').fill('2570');
  await newDialog.getByRole('button', {name: 'สร้างแฟ้มงาน', exact: true}).click();
  await expect(newDialog).toHaveCount(0);

  // Set shared variable `eventDate`, intentionally leaving `eventLocation` empty to trigger yellow blank highlight in Word ZIP
  await page.locator('#cf-var-eventDate').fill('2026-11-20');

  // Add Doc 1: INTERNAL_MEMO with running number 1510
  const roadmap = page.getByRole('complementary', {name: 'ลายแทงประจำแฟ้ม'});
  await roadmap.getByRole('button', {name: '+ สร้างเอกสารในระบบ'}).click();
  await roadmap.getByRole('button', {name: 'บันทึกข้อความ', exact: true}).click();
  await page.locator('#cf-doc-running-no').fill('1510');
  await page.locator('#cf-doc-date').fill('2026-10-15');

  // Add Doc 2: MUNICIPAL_ORDER referencing Doc 1 via `@ อ้างอิงเอกสารก่อนหน้า`
  await roadmap.getByRole('button', {name: '+ สร้างเอกสารในระบบ'}).click();
  await roadmap.getByRole('button', {name: 'คำสั่ง', exact: true}).click();
  await page.locator('#cf-doc-running-no').fill('250');
  await page.locator('#cf-doc-date').fill('2026-10-16');

  // Focus preamble textarea and insert @ref to Doc 1
  const preamble = page.locator('#cf-order-preamble');
  await preamble.click();
  await page.getByRole('button', {name: '@ อ้างอิงเอกสารก่อนหน้า'}).click();
  await page.getByRole('button', {name: 'แทรกอ้างอิงเต็ม (ที่ ... ลงวันที่ ...)'}).first().click();

  // Assert Doc 2 live preview contains ๑๕๑๐
  const previewFrame = page.frameLocator('iframe[title="ตัวอย่างเอกสาร A4"]');
  await expect(previewFrame.locator('body')).toContainText('๑๕๑๐', {timeout: 15000});

  // Change Doc 1's running number from 1510 -> 1515 -> assert Doc 2 preview updates immediately to ๑๕๑๕
  const doc1Row = roadmap.locator('[data-roadmap-item-id]').nth(0);
  const doc2Row = roadmap.locator('[data-roadmap-item-id]').nth(1);
  await doc1Row.click();
  await page.locator('#cf-doc-running-no').fill('1515');
  await doc2Row.click();
  await expect(previewFrame.locator('body')).toContainText('๑๕๑๕', {timeout: 15000});

  // Link the seeded Procurement case into Stage 2 -> assert roadmap displays PO number and amount live
  const stage2Option = await roadmap
    .locator('#cf-target-stage option')
    .nth(1)
    .getAttribute('value');
  await roadmap.locator('#cf-target-stage').selectOption(stage2Option!);
  await roadmap.getByRole('button', {name: '+ ผูกงานจัดซื้อจัดจ้าง / พัสดุ'}).click();

  const linkDialog = page.getByRole('dialog', {name: 'ผูกงานจัดซื้อจัดจ้างหรือพัสดุ'});
  await expect(linkDialog).toBeVisible();
  await expect(linkDialog).toContainText('1,520.00 บาท');
  await linkDialog.getByRole('button', {name: 'ผูกเข้าแฟ้ม'}).first().click();
  await expect(linkDialog).toHaveCount(0);

  // Verify roadmap live display of linked Procurement PO number & amount
  await expect(roadmap).toContainText('สว ๑๓/๒๕๗๐');
  await expect(roadmap).toContainText('1,520.00 บาท');

  // Save folder and save a Blueprint
  await page.getByRole('button', {name: 'บันทึกแฟ้มงาน'}).click();
  await expect(page.locator('.cf-notice')).toContainText('บันทึกแฟ้มงานสารบรรณเรียบร้อยแล้ว');
  await page.getByRole('button', {name: 'บันทึกเป็นแม่แบบ'}).click();
  await expect(page.locator('.cf-notice')).toContainText('บันทึกแฟ้มงานนี้เป็นแม่แบบ');

  // -------------------------------------------------------------------------
  // 2. Local Word Handoff Kit (.zip) + PDF Binder + Quick Blank Word (.docx)
  // -------------------------------------------------------------------------
  await page.getByRole('button', {name: 'ส่งออก PDF / ชุด Word (.zip)'}).click();
  const exportDialog = page.getByRole('dialog', {name: 'ส่งออกและสำรองแฟ้มงาน'});
  await expect(exportDialog).toBeVisible();

  // 2a. Download Local Word Handoff Kit (.zip) with highlightBlanks = true
  await exportDialog.getByRole('tab', {name: /ชุดส่งต่อ Word/}).click();
  const [handoffResp, handoffDownload] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/cases/export/local-handoff') && r.request().method() === 'POST',
      {timeout: 90000},
    ),
    page.waitForEvent('download', {timeout: 90000}),
    exportDialog.getByRole('button', {name: /ดาวน์โหลดชุดส่งต่อ Word/}).click(),
  ]);
  expect(handoffResp.status()).toBe(200);
  const handoffPath = await handoffDownload.path();
  expect(handoffPath).toBeTruthy();

  const handoffBuf = fs.readFileSync(handoffPath!);
  const handoffZip = await JSZip.loadAsync(handoffBuf);
  const zipEntries = Object.keys(handoffZip.files);
  expect(zipEntries).toContain('00_ลายแทงและเช็กลิสต์แฟ้มงาน.docx');
  expect(zipEntries).toContain('00_ลายแทงและเช็กลิสต์แฟ้มงาน.txt');

  const doc1ZipName = zipEntries.find(n => n.includes('01_') && n.endsWith('.docx'));
  const doc2ZipName = zipEntries.find(n => n.includes('02_') && n.endsWith('.docx'));
  expect(doc1ZipName).toBeDefined();
  expect(doc2ZipName).toBeDefined();

  const doc1Docx = await JSZip.loadAsync(await handoffZip.file(doc1ZipName!)!.async('nodebuffer'));
  const doc1Xml = await doc1Docx.file('word/document.xml')!.async('string');
  expect(doc1Xml).toContain('<w:highlight w:val="yellow"/>');
  expect(doc1Xml).toContain('๑๕๑๕');

  const doc2Docx = await JSZip.loadAsync(await handoffZip.file(doc2ZipName!)!.async('nodebuffer'));
  const doc2Xml = await doc2Docx.file('word/document.xml')!.async('string');
  expect(doc2Xml).toContain('๑๕๑๕');
  expect(doc2Xml).not.toContain('<w:txbxContent>');

  // 2b. Verify Print-Ready PDF Binder export (including linked Procurement PDFs) returns valid PDF
  await exportDialog.getByRole('tab', {name: /PDF พร้อมพิมพ์เข้าแฟ้ม/}).click();
  const [pdfResp, pdfDownload] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/cases/export/pdf-binder') && r.request().method() === 'POST',
      {timeout: 120000},
    ),
    page.waitForEvent('download', {timeout: 120000}),
    exportDialog.getByRole('button', {name: /ดาวน์โหลด PDF พร้อมพิมพ์เข้าแฟ้ม/}).click(),
  ]);
  expect(pdfResp.status()).toBe(200);
  const pdfPath = await pdfDownload.path();
  const pdfBytes = fs.readFileSync(pdfPath!);
  expect(pdfBytes.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  const pdfDoc = await PDFDocument.load(pdfBytes);
  expect(pdfDoc.getPageCount()).toBeGreaterThanOrEqual(3);

  await exportDialog.getByRole('button', {name: 'ปิด', exact: true}).click();
  await expect(exportDialog).toHaveCount(0);

  // 2b-core. Open Doc 2 directly in Core Editor -> edit in Core -> save -> return to Case Folder -> verify Core edit persists!
  await doc2Row.click();
  await page.getByRole('button', {name: /เปิดแก้ไขฉบับนี้ในระบบร่างหนังสือ/}).click();
  await expect(page.getByRole('heading', {name: 'แก้ไขร่างหนังสือ'})).toBeVisible({timeout: 15000});
  const returnCaseBtn = page.locator('.editor-actions').getByRole('button', {name: 'กลับแฟ้มงานสารบรรณ'});
  await expect(returnCaseBtn).toBeVisible();
  const coreBody = page.locator('#document-body');
  const existingBody = await coreBody.inputValue();
  await coreBody.fill(`${existingBody}\nแก้ไขเพิ่มเติมในระบบ Core จริง`);
  await page.getByRole('button', {name: 'บันทึกร่าง'}).click();
  await expect(page.getByText('บันทึกแล้ว', {exact: true})).toBeVisible({timeout: 15000});
  await returnCaseBtn.click();
  await expect(page.getByRole('heading', {name: /โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ/})).toBeVisible({timeout: 15000});
  await expect(previewFrame.locator('body')).toContainText('แก้ไขเพิ่มเติมในระบบ Core จริง', {timeout: 15000});

  // 2c. Return to list and test QuickBlankWordModal -> blank EXTERNAL_LETTER
  await page.getByRole('button', {name: 'กลับรายการแฟ้ม'}).click();
  await page.getByRole('button', {name: /สร้างฟอร์ม Word เปล่า/}).click();
  const quickDialog = page.getByRole('dialog', {name: 'สร้างฟอร์ม Word เปล่าสำหรับคนนอกระบบ'});
  await expect(quickDialog).toBeVisible();
  await quickDialog.locator('#cf-quick-doctype').selectOption('EXTERNAL_LETTER');

  const [blankResp, blankDownload] = await Promise.all([
    page.waitForResponse(
      r => r.url().includes('/api/cases/export/blank-word') && r.request().method() === 'POST',
      {timeout: 60000},
    ),
    page.waitForEvent('download', {timeout: 60000}),
    quickDialog.getByRole('button', {name: 'ดาวน์โหลด .docx ทันที'}).click(),
  ]);
  expect(blankResp.status()).toBe(200);
  const blankPath = await blankDownload.path();
  const blankBuf = fs.readFileSync(blankPath!);
  const blankZip = await JSZip.loadAsync(blankBuf);
  const blankXml = await blankZip.file('word/document.xml')!.async('string');
  expect(blankXml).toContain('ภก ๕๒๘๐๖');
  expect(blankXml).toContain('TH SarabunIT๙');
  expect(blankXml).toContain('<w:highlight w:val="yellow"/>');

  // -------------------------------------------------------------------------
  // 3. Safe Clone: preserves structure & blueprint, wipes numbers/dates/overrides
  // -------------------------------------------------------------------------
  const originalCard = page
    .locator('[data-folder-card-id]', {hasText: 'โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ'})
    .first();
  await expect(originalCard).toBeVisible();
  await originalCard.getByRole('button', {name: 'Safe Clone'}).click();

  // Wait for cloned folder workspace to open with "(สำเนา)"
  await expect(page.getByRole('heading', {name: /\(สำเนา\)/})).toBeVisible({timeout: 15000});

  const clonedRoadmap = page.getByRole('complementary', {name: 'ลายแทงประจำแฟ้ม'});
  // Preserves all 3 items (Doc 1, Doc 2, Linked slot)
  await expect(clonedRoadmap.locator('[data-roadmap-item-id]')).toHaveCount(3);

  // Verify Doc 1 & Doc 2 numbers and dates are wiped clean
  await clonedRoadmap.locator('[data-roadmap-item-id]').nth(0).click();
  await expect(page.locator('#cf-doc-running-no')).toHaveValue('');
  await expect(page.locator('#cf-doc-date')).toHaveValue('');

  await clonedRoadmap.locator('[data-roadmap-item-id]').nth(1).click();
  await expect(page.locator('#cf-doc-running-no')).toHaveValue('');
  await expect(page.locator('#cf-doc-date')).toHaveValue('');

  // Verify saved Blueprint remains available
  await page.getByRole('button', {name: 'กลับรายการแฟ้ม'}).click();
  await expect(page.getByText(/แม่แบบ 1 รายการ/)).toBeVisible();
});
