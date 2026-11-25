# Phase 6: Chalong-Exact Official Supply/Asset Forms (PDF + DOCX) & Existing "พัสดุและครุภัณฑ์" UI Integration

> **Target Repository:** `sarabun-workspace` (Next.js 16.4, React 19, TypeScript 5.9, Playwright 1.63, pdf-lib 1.17, docx 9.10)
> **Prerequisite:** Phase 5 (`src/lib/inventory/`) and Phases 2–3 (`sarabun-rules.ts`, Playwright PDF & DOCX engines) are completed and passing tests.
> **Objective:**
> 1. Render **pixel-accurate Thai government printable forms** (both **PDF** via Playwright and editable **Word `.docx`** via shared IR) matching **เทศบาลตำบลฉลอง (กองสวัสดิการสังคม)** paper templates in 100% Thai numerals (`๐-๙`).
> 2. Upgrade the existing **"พัสดุและครุภัณฑ์"** navigation item in `sarabun-workspace` into a 3-tab operational workspace supporting the full Hybrid Paper + Digital lifecycle.

---

## 1. File Architecture for Phase 6

```text
src/lib/inventory/
├── templates/
│   ├── ir.ts                       # Shared Document IR for INV-01 through INV-05
│   ├── build-forms.ts              # Builds INV-01..INV-05 from Phase 5 state + AgencyConfig (all numerals in Thai ๐-๙)
│   ├── html/render-inv-html.ts     # Sarabun-compliant HTML renderer reusing Phase 2 CSS rules & @page continuation headers
│   └── docx/render-inv-docx.ts     # Borderless-table + native keepNext/tblHeader/cantSplit DOCX renderer
└── __tests__/
    ├── inv-forms-pdf.test.ts       # Renders real PDFs via Playwright & checks text/tables via pdfjs-dist
    └── inv-forms-docx.test.ts      # Renders real .docx & checks XML via jszip + @xmldom/xmldom

src/app/api/inventory/
├── export/pdf/route.ts             # POST: Single form or merged fiscal-year Stock Card / Audit PDF binder
└── export/docx/route.ts            # POST: Single .docx or ZIP archive of all Stock Cards / Annual Audit forms

src/components/inventory/
├── InventoryWorkspace.tsx          # 3-tab root workspace embedded in existing "พัสดุและครุภัณฑ์" route
├── tabs/
│   ├── MaterialFifoTab.tsx         # Pending-Signature queue, live stock table, 1-click Procurement intake, Stock Card viewer
│   ├── AssetRegistryTab.tsx        # Division fixed assets, condition filter, Loan/Return lifecycle + print INV-03
│   └── AnnualAuditTab.tsx          # Quarterly / Sep 30 cut-off reconciliation dashboard + INV-02/INV-04/INV-05 exports
└── modals/
    ├── StockIntakeModal.tsx        # Manual intake OR "ดึงรายการจากจัดซื้อจัดจ้าง (Doc 11.1)" + 18-category unit autocomplete
    ├── RequisitionModal.tsx        # Create ใบเบิกวัสดุ with live FIFO lot-split preview, separate ผู้รับของ, & immediate Print
    ├── CommitSignatureModal.tsx    # Confirm physical signatures received -> commit stock deduction (+ optional signed PDF/photo upload)
    └── AssetLoanModal.tsx          # Create/Return equipment loan & print INV-03

e2e/
└── inventory-hybrid-flow.spec.ts   # Playwright E2E test covering Procurement Intake -> FIFO Split -> Print -> Commit -> Year-End Audit
```

---

## 2. Exact Official Form Specifications (PDF + DOCX via Shared IR)

All forms use `TH Sarabun IT๙` (`16pt` body, `14pt–15pt` dense tables where needed), A4 portrait (or A4 landscape toggle for wide Stock Cards if desired; default **A4 Portrait** matching the municipality's physical sheets), `100% Thai numerals (๐-๙)`, Anti-Orphan signatures (`break-inside: avoid` / `keepNext`), and repeated `<thead>` (`tblHeader`) on multi-page tables.

### Form `INV-01`: ใบเบิกวัสดุ (Exact Chalong 5-Column Layout)
Matches `ใบเบิกวัสดุ.pdf` of สำนักงานเทศบาลตำบลฉลอง:
- **Top Header Row (Borderless 3-zone):**
  - Top-left: `เลขที่ใบเบิกพัสดุ {{requisitionRunningNo}}/{{fiscalYearBE}}` (e.g. `๐๑/๒๕๖๙`)
  - Center (Bold `20pt`): `ใบเบิกวัสดุ` / `สำนักงานเทศบาลตำบลฉลอง` / `อำเภอเมืองภูเก็ต จังหวัดภูเก็ต`
  - Right-aligned below title: `วันที่ {{requestDateTh}}` (e.g. `๑๘ กุมภาพันธ์ ๒๕๖๙`)
- **Official Certification Narrative:**
  - `ข้าพเจ้า {{requesterName}} ตำแหน่ง {{requesterPosition}}`
  - `ขอเบิกวัสดุตามรายการข้างล่างนี้เพื่อใช้ในการปฏิบัติราชการ งาน{{agency.divisionName}} {{agency.municipalityName}} และขอรับรองว่าได้นำไปใช้ในราชการด้วยความสัตย์จริง`
- **5-Column Bordered Table (Exact Agency Standard):**
  - Columns: **`ลำดับ` | `รายการ` | `จำนวน` | `คงเหลือ` | `หมายเหตุ`**
  - Column widths: `8% | 42% | 14% | 14% | 22%`
  - **FIFO Multi-Lot Display Rule:**
    - If a line consumes 1 lot: display 1 row (`ลำดับ`, `ชื่อวัสดุ (ขนาด/ลักษณะ)`, `จำนวน + หน่วย`, `คงเหลือหลังเบิก + หน่วย`, `ราคาต่อหน่วย (อ้างอิง Lot/ใบสั่งซื้อ)`).
    - If a line splits across 2+ FIFO lots (different prices): display 1 row per lot split so both physical quantity AND exact FIFO price/lot are transparent in `หมายเหตุ` (e.g. `ราคา ๑๑๕.๐๐ บ. (ยอดยกมาปี ๖๘)` on row 1, `ราคา ๑๒๐.๐๐ บ. (สว ๐๕/๒๕๖๙)` on row 2), with the running post-issue balance shown cleanly in `คงเหลือ`.
  - Keep a minimum visual body height (or subtle empty filler rows up to 8 rows when single-page) so the printed sheet looks crisp and balanced like an official voucher.
- **4-Role Physical Signature Block (2x2 Borderless Grid, `break-inside: avoid`):**
  - Top-left: `(ลงชื่อ)..............................................ผู้เบิก` / `({{requesterName}})`
  - Top-right: `(ลงชื่อ)..............................................ผู้อนุมัติ` / `({{signatories.divisionDirector.fullName}})` / `{{signatories.divisionDirector.position}}`
  - Bottom-left: `(ลงชื่อ)..............................................ผู้จ่ายวัสดุ` / `({{signatories.procurementOfficer.fullName}})` / `{{signatories.procurementOfficer.position}}`
  - Bottom-right: `(ลงชื่อ)..............................................ผู้รับของ` / `({{receiverName || requesterName}})` *(Separate line for physical receiver!)*

---

### Form `INV-02`: บัญชีวัสดุ (Exact Chalong Stock Card Layout)
Matches `ฟอร์มตัดพัสดุ.pdf` of เทศบาลตำบลฉลอง:
- **Top Metadata Bar:**
  - Left: `หน้าที่ {{pageNoTh}}` | Center (Bold `18pt–20pt`): `บัญชีวัสดุ` / `{{agency.municipalityName}}` | Right: `ลำดับที่ {{material.ledgerSeqNoTh}}` & `แผ่นที่ {{sheetNoTh}}`
- **10-Field Material Header Grid (Clean 2-Column Borderless Block):**
  - Left side: `ชื่อหรือชนิดวัสดุ: {{material.name}}` | `ขนาดหรือลักษณะ: {{material.specification || '-'}}` | `ที่เก็บ: {{material.storageLocation}}`
  - Right side: `ประเภท: {{material.categoryType}}` | `รหัส: {{material.code || '-'}}` | `หน่วยที่นับ: {{material.unit}}` | `จำนวนอย่างสูง: {{maxStockDisplay}}` | `จำนวนอย่างต่ำ: {{minStockDisplay}}`
- **Official 8-Column Table (2-Tier `<thead>` Repeated on Every Page):**
  - Top header row: `วัน เดือน ปี` (rowspan 2) | `รับจาก/จ่ายให้` (rowspan 2) | `เลขที่เอกสาร` (rowspan 2) | `ราคาต่อหน่วย` (rowspan 2) | **`จำนวน`** (`colspan="3"`) | `หมายเหตุ` (rowspan 2)
  - Sub-header row under `จำนวน`: **`รับ` | `จ่าย` | `คงเหลือ`**
  - Date format inside compact Stock Card column: Short official Thai date (`๑ ต.ค. ๖๘`, `๑๒ ม.ค. ๖๙`, `๒๙ มิ.ย. ๖๙`).
  - `หมายเหตุ` column auto-displays:
    - **`บันทึกบัญชีเดบิท`** on opening balance & stock-in rows.
    - **`ค่าวัสดุใช้ไป`** on every committed issue row.
- **Batch Print Mode:** Support exporting a single material's Stock Card OR a **Full Division Stock Card Binder** (all materials sorted by `ledgerSeqNo ASC` with continuous `หน้าที่` numbering and per-material `แผ่นที่ ๑, ๒...`).

---

### Form `INV-03`: ใบยืม-คืนครุภัณฑ์ (Equipment Loan & Return Form)
- **Header:** `ใบยืมครุภัณฑ์` | `เลขที่ ยค. {{loanRunningNo}}/{{fiscalYearBE}}` | `{{agency.divisionName}} {{agency.municipalityName}}` | `วันที่ {{loanDateTh}}`
- **Table:** `ลำดับ | เลขครุภัณฑ์ | รายการครุภัณฑ์ / ยี่ห้อ-รุ่น | สภาพก่อนยืม | กำหนดส่งคืน | หมายเหตุ`
- **Dual-Stage Signature Block (`break-inside: avoid`):**
  - **ส่วนการยืม:** `ผู้ยืม` (`borrowerName`) | `ผู้อนุญาตให้ยืม` (`divisionDirector`) | `ผู้ส่งมอบ` (`procurementOfficer`)
  - **ส่วนการส่งคืน (Bordered Box):** `วันที่ส่งคืนจริง` | `สภาพหลังส่งคืน` | `ผู้ส่งคืน` | `ผู้ตรวจรับคืน` (`procurementOfficer`).

---

### Form `INV-04`: รายงานสรุปการรับ-จ่าย-คงเหลือวัสดุ (รายงานตัดพัสดุประจำไตรมาส / สิ้นปีงบประมาณ)
- **Header:** `รายงานสรุปการรับ-จ่าย และวัสดุคงเหลือ ประจำปีงบประมาณ พ.ศ. {{fiscalYearBE}}` / `ณ วันที่ {{asOfDateTh}} — {{agency.divisionName}} {{agency.municipalityName}}`
- **Grouped by Official Category (`01`–`18`)** with subtotals per category and Grand Total at bottom:
  - Columns: `ลำดับ | รายการวัสดุ | หน่วย | ยอดยกมา (จำนวน / มูลค่า) | รับระหว่างปี (จำนวน / มูลค่า) | จ่ายระหว่างปี (จำนวน / มูลค่า) | คงเหลือสิ้นปี (จำนวน / มูลค่า)`
- **Signatory Block:** `ผู้จัดทำรายงาน (เจ้าหน้าที่พัสดุ)` -> `ผู้รับรองความถูกต้อง (ผู้อำนวยการกอง)`.

---

### Form `INV-05`: รายงานผลการตรวจสอบพัสดุประจำปี (ระเบียบฯ พ.ศ. ๒๕๖๐ ข้อ ๒๑๓)
- Official cover memo (`บันทึกข้อความ` with `1.5 cm` Garuda) + attached summary tables as of `๓๐ กันยายน พ.ศ. {{fiscalYearBE}}`:
  1. สรุปยอดวัสดุคงเหลือยกไปปีงบประมาณถัดไป (linked directly from `INV-04`).
  2. สรุปทะเบียนครุภัณฑ์ประจำกองแยกตามสภาพ (`ใช้งานได้`, `ชำรุดรอซ่อม`, `เสื่อมสภาพขอจำหน่าย`, `สูญหาย`).
  3. Signature chain: `ผู้ตรวจสอบพัสดุ / คณะกรรมการตรวจสอบพัสดุประจำปี` -> `ปลัดเทศบาล` -> `นายกเทศมนตรี`.

---

## 3. UI Integration in Existing "พัสดุและครุภัณฑ์" Menu

1. **Reuse Existing Route & Navigation:** Locate the existing `"พัสดุและครุภัณฑ์"` menu entry and page in `sarabun-workspace`. Embed `InventoryWorkspace` directly inside it without duplicating sidebar links.
2. **Tab 1: คลังวัสดุ & เบิก-จ่าย (FIFO)**
   - **Action Bar:**
     - `+ รับวัสดุเข้าคลัง` (opens `StockIntakeModal` with two tabs: *"ดึงจากงานจัดซื้อจัดจ้างที่ตรวจรับแล้ว (Doc 11.1)"* and *"รับเข้าด้วยตนเอง / ตั้งยอดยกมา"*, both powered by the **18-Category Standard Unit Autocomplete**).
     - `+ สร้างใบเบิกวัสดุ (FIFO)` (opens `RequisitionModal`: live FIFO lot-split preview, post-issue remaining balance preview, separate optional `ผู้รับของ` field, and button **"จองยอด & พิมพ์ใบเบิก (PDF / Word)"**).
   - **Pending Physical Signatures Queue (Pinned Banner/Card):**
     - Lists all `PENDING_SIGNATURE` requisitions with status badge `รอเซ็นรับของจริง` + 3 quick actions:
       1. `พิมพ์ใบเบิกซ้ำ (PDF / Word)`
       2. **`ยืนยันตัดสต๊อก (เซ็นรับแล้ว)`** -> opens `CommitSignatureModal` (confirm date + optional upload of scanned signed sheet -> executes `COMMIT_AFTER_SIGNATURE`)
       3. `ยกเลิกและคืนยอดจอง`
   - **Live Material Inventory Table:**
     - Filterable by the 18 official categories (`01`–`18`) and search text.
     - Displays: `ลำดับทะเบียน | ชื่อวัสดุ & ขนาด | หมวด | คงเหลือจริง | จองรอเซ็น | พร้อมเบิก | Lot ปัจจุบัน (ราคา) | สถานะ (ปกติ / ต่ำกว่าอย่างต่ำ / หมด)` + quick button **`ดูบัญชีวัสดุ (INV-02)`**.
3. **Tab 2: ทะเบียนครุภัณฑ์ & ยืม-คืน**
   - Full CRUD for division assets, condition status badges (`ใช้งานได้`, `ชำรุดรอซ่อม`, `ขอจำหน่าย`), active loan alerts (highlight overdue returns), and 1-click PDF/Word export for `INV-03 (ใบยืม-คืนครุภัณฑ์)`.
4. **Tab 3: รายงานตัดพัสดุ & ตรวจนับประจำปี**
   - Fiscal Year selector + Cut-off Date selector (Q1–Q4 presets + `30 กันยายน`).
   - Live Accounting Reconciliation Card verifying `ยอดยกมา + รับเข้า - จ่ายออก = คงเหลือจริง` (displays green checkmark + exact Baht total).
   - Export Center (both **PDF พร้อมพิมพ์** and **Word `.docx`**):
     - `พิมพ์บัญชีวัสดุทั้งกองเรียงตามลำดับทะเบียน (INV-02 Binder)`
     - `รายงานสรุปตัดพัสดุ / วัสดุคงเหลือ (INV-04)`
     - `ชุดรายงานตรวจสอบพัสดุประจำปี ข้อ ๒๑๓ (INV-05)`

---

## 4. Acceptance Criteria & Final Verification Gate

1. **`inv-forms-pdf.test.ts` & `inv-forms-docx.test.ts`:**
   - Assert `INV-01` has exact 5 columns (`ลำดับ`, `รายการ`, `จำนวน`, `คงเหลือ`, `หมายเหตุ`), all 4 signature roles (`ผู้เบิก`, `ผู้อนุมัติ`, `ผู้จ่ายวัสดุ`, `ผู้รับของ`), and zero Arabic digits.
   - Assert `INV-02` displays all 10 header fields, `บันทึกบัญชีเดบิท` on intake rows, `ค่าวัสดุใช้ไป` on issue rows, and repeats `<thead>` (`<w:tblHeader/>` in DOCX) when entries span 2+ pages.
2. **`e2e/inventory-hybrid-flow.spec.ts` (Playwright E2E):**
   - Navigate to existing `"พัสดุและครุภัณฑ์"` menu -> Intake from a completed procurement case -> Create requisition spanning 2 FIFO lots with a proxy `ผู้รับของ` -> Verify stock shows in `จองรอเซ็น` while `คงเหลือจริง` is unchanged -> Export `INV-01` PDF & DOCX -> Click `ยืนยันตัดสต๊อก` -> Verify `บัญชีวัสดุ (INV-02)` and `รายงานตัดพัสดุ (INV-04)` update and reconcile accurately.
3. Run all release gates with zero errors:
```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```