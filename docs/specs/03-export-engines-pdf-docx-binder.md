# Phase 3: Dual Export Engines (Playwright PDF Binder + DOCX Builder), Sharp Photo Pipeline & Export APIs

> **Target Repository:** `sarabun-workspace` (Next.js 16.4, TypeScript 5.9, Playwright 1.63, pdf-lib 1.17, docx 9.10, jszip 3.10, sharp 0.35, pdfjs-dist 6.3, @xmldom/xmldom 0.9)
> **Prerequisite:** Phases 1 and 2 (`src/lib/procurement/` domain logic + `templates/` Document IR & HTML renderer) MUST be completed and passing `npm run typecheck && npm test`.
> **Objective:** Implement production-grade **Dual Export Engines** that consume the exact same Phase 2 `RenderedDocumentSpec` IR to output:
> 1. **Print-ready Official PDF Bundles** (with Auto-Fit single-page compression, Anti-Orphan Signature DOM checks, automatic 2x/3x copy duplication, stage-based bundles, and LAAS/e-GP/Vendor divider checklists).
> 2. **Clean Editable Word (`.docx`) Files & ZIP Archives** (using borderless layout tables instead of fragile floating text boxes, native Word `keepNext` / `tblHeader` / `cantSplit`, and matching TH Sarabun typography).
> **Constraint:** Use ONLY libraries already installed in `package.json`. Do NOT add new npm dependencies unless strictly justified.

---

## 1. Folder Architecture for Phase 3

```text
src/lib/procurement/
├── assets/
│   └── loader.ts                     # Loads local Garuda image & TH Sarabun fonts (buffer + base64 data URI cache)
├── media/
│   └── photo-processor.ts            # sharp pipeline: EXIF auto-rotate, print-ready resize, JPEG optimization
├── exporters/
│   ├── pdf/
│   │   ├── browser-pool.ts           # Managed Playwright Chromium singleton with idle cleanup (server-only)
│   │   ├── render-doc-pdf.ts         # Renders 1 RenderedDocumentSpec -> PDF bytes with Auto-Fit & Anti-Orphan loop
│   │   ├── divider-sheet.ts          # Generates clean checklist divider pages for external LAAS/e-GP/Vendor slots
│   │   └── binder.ts                 # pdf-lib assembler: FULL_BINDER, BY_STAGE, SINGLE_DOC + 1x/2x/3x duplication
│   └── docx/
│       ├── styles.ts                 # Twips converters, Sarabun margins, TH Sarabun IT๙ styles, table borders
│       ├── blocks.ts                 # Reusable DOCX builders: MemoHeader, GarudaHeader, ApprovalGrid (borderless table), RoutingStrip, ContinuationTable
│       ├── render-doc-docx.ts        # Converts RenderedDocumentSpec -> Buffer (.docx)
│       └── zip-packager.ts           # jszip bundler with ordered Thai filenames (01_... to 13_...)
└── __tests__/
    ├── photo-processor.test.ts       # Tests sharp EXIF rotation & bounding-box scaling
    ├── pdf-exporter.test.ts          # Generates real PDFs + verifies pages/text via pdfjs-dist
    └── docx-exporter.test.ts         # Generates real DOCX + verifies XML structure via jszip + @xmldom/xmldom

src/app/api/procurement/
├── preview-html/route.ts             # POST: Fast HTML preview of a single doc (no Chromium overhead)
├── export/
│   ├── pdf/route.ts                  # POST: Streams single PDF or merged binder PDF
│   └── docx/route.ts                 # POST: Streams single .docx or .zip archive of all active docs
└── photos/route.ts                   # POST: Accepts multipart photos, normalizes via sharp, returns previews/refs
```

> **Server Safety:** Add `import "server-only";` at the top of `browser-pool.ts`, `render-doc-pdf.ts`, `binder.ts`, `photo-processor.ts`, and `loader.ts` so client components can never accidentally import Node/Playwright binaries.

---

## 2. Local Asset & Font Guarantee (`assets/loader.ts`)

1. Inspect `public/` or existing asset folders in `sarabun-workspace` first to reuse existing Garuda SVG/PNG and `TH Sarabun IT๙` / `TH Sarabun New` font files if already present.
2. Provide cached loaders (`loadGarudaAsset()`, `loadSarabunFonts()`):
   - Return raw `Buffer` (for `docx` `ImageRun`) AND `data:image/...;base64,...` / `@font-face` inline CSS (for Playwright HTML so Chromium renders offline with zero network/file-path issues).
3. If `TH Sarabun IT๙` TTF/WOFF2 is missing in the repo, fall back gracefully to `TH Sarabun New` (while still applying Phase 1 `toThaiDigits()` so all numerals remain Thai `๐-๙`) and emit a startup console warning documenting the exact path to drop the font file (`public/fonts/THSarabunIT9.ttf` and `THSarabunIT9-Bold.ttf`).

---

## 3. Photo Optimization Pipeline (`media/photo-processor.ts`)

Phone photos uploaded for **Doc `11.3` (รูปภาพประกอบการตรวจรับ)** are often 4–12 MB with rotated EXIF metadata, which causes huge DOCX/PDF files or sideways prints.

Implement `normalizeInspectionPhoto(inputBuffer: Buffer)`:
- Use `sharp(inputBuffer)`:
  1. `.rotate()` — automatically respects and strips EXIF orientation so portrait/landscape photos always render upright.
  2. `.resize({ width: 1400, height: 1400, fit: "inside", withoutEnlargement: true })` — crisp 300 DPI print clarity while keeping file size under ~200 KB per image.
  3. `.jpeg({ quality: 85, mozjpeg: true })`
- Return `{ buffer: Buffer, dataUri: string, width: number, height: number, mimeType: "image/jpeg" }`.
- Also calculate exact fit dimensions in centimeters/EMU for both HTML (`max-height` grid from Phase 2) and DOCX (`ImageRun` `transformation: { width, height }` preserving aspect ratio).

---

## 4. Playwright PDF Engine with Auto-Fit & Anti-Orphan Verification (`exporters/pdf/`)

### 4.1 Managed Browser Pool (`browser-pool.ts`)
- Launch a single headless Chromium instance (`playwright.chromium.launch({ headless: true })`) and reuse a fresh `BrowserContext`/`Page` per render job instead of spawning Chromium per document.
- Implement an idle timeout (e.g., close browser after 2 minutes of inactivity) + graceful cleanup on `SIGINT`/`SIGTERM`.
- Support parallel rendering with bounded concurrency (`maxConcurrency = 3`) so rendering all 15 documents takes ~2–4 seconds total.

### 4.2 Smart Pagination & Anti-Orphan Loop (`render-doc-pdf.ts`)
For each `RenderedDocumentSpec`:

1. **Single-Page Auto-Fit Loop** (applies to documents flagged `preferSinglePage: true`: Docs `1, 2, 3, 6.2, 7, 8, 9, 11.1, 11.2, 13`):
   - Load rendered HTML into Playwright page with A4 viewport (`794px x 1123px` at 96 DPI) and wait for `document.fonts.ready`.
   - Measure total scrollable content height against printable A4 height (`usableHeightPx`).
   - Run stepped compression only if overflowing slightly (`1.0 < ratio <= 1.16`):
     1. Try `data-density="normal"` -> if `pages === 1`, DONE.
     2. Try `data-density="compact"` -> if `pages === 1`, DONE.
     3. Try `data-density="tight"` -> if `pages === 1`, DONE.
   - If content STILL exceeds 1 page (e.g., long committee list or unusually long narrative), revert to `normal` density and engage **Multi-Page Anti-Orphan Mode** below.

2. **DOM Anti-Orphan Signature Guard (CRITICAL):**
   - Inspect `.signature-cluster` bounding rect in the Playwright page before calling `page.pdf()`.
   - If the document spans 2+ pages AND `.signature-cluster` is the **sole element on the final page** (no body text preceding it on that page):
     - Add class `.force-break-before` to the preceding `.keep-with-signature-anchor` (the last paragraph / `ข้อพิจารณาและข้อเสนอ` / last 2 lines) so at least 2 lines of prose move onto the final page alongside the signatures.

3. **Thai Page Numbers (`- ๒ -`, `- ๓ -`) on Multi-Page Docs:**
   - Use Chromium CSS Paged Media `@page` rules in `styles.css.ts`:
     ```css
     @page {
       size: A4 portrait;
       @top-center {
         content: "- " counter(page, thai) " -";
         font-family: 'TH Sarabun IT๙', 'TH Sarabun New', sans-serif;
         font-size: 16pt;
         vertical-align: bottom;
         padding-bottom: 4mm;
       }
     }
     @page :first {
       @top-center {
         content: none;
       }
     }
     ```
   - Call `page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true })`.
   - Record layout telemetry in return object: `{ docId, pdfBytes, pageCount, appliedDensity, antiOrphanTriggered }`.

### 4.3 External Checklist Divider Sheets (`divider-sheet.ts`)
When assembling a print binder with `includeDividers: true`, generate lightweight A4 placeholder/checklist pages (subtle dashed border, clean typography — ink-saving grayscale) for external slots (`4.2, 5.1, 5.2, 11.4, 11.5`, and in `EGP_OVER_5000` mode also `6.1–10, 11.2, 12, 13`):
- Clearly displays:
  - **ลำดับเข้าแฟ้ม:** e.g. `ลำดับที่ ๕ — เอกสารแทรกจากร้านค้า`
  - **ชื่อเอกสาร:** e.g. `๔.๒ ใบเสนอราคาผู้ชนะ (ราคากลาง)`
  - **คำเตือนวันที่ต้องปั๊ม / ตรวจสอบ:** e.g. `ต้องปั๊มวันที่เดียวกับข้อ ๓: ๑๓ พฤศจิกายน ๒๕๖๙`
  - **เลขอ้างอิง (ถ้ามี):** LAAS Report No. / Contract No. / e-GP Project No.
  - **หมายเหตุ:** `(แผ่นคั่นสำหรับจัดเรียงแฟ้ม — ดึงออกหลังเสียบเอกสารตัวจริง)`

### 4.4 PDF Binder Assembler (`binder.ts` via `pdf-lib`)
Implement `assemblePdfBinder(caseData, options)` supporting 3 export profiles:

```ts
export type PdfExportProfile =
  | { mode: "FULL_BINDER" }
  | { mode: "BY_STAGE"; stage: "STAGE_1_PRINCIPLE" | "STAGE_2_ORDER" | "STAGE_3_INSPECTION" | "STAGE_4_DISBURSEMENT" }
  | { mode: "SINGLE_DOC"; docId: string };

export interface PdfBinderOptions {
  profile: PdfExportProfile;
  duplicateCopies: boolean;          // true = auto-repeat 6.2/8/9 (x3) and 10/11.2 (x2)
  includeDividers: boolean;          // insert external LAAS/e-GP/Vendor checklist cards
  includeCoverChecklist: boolean;    // optional page 1: Master Filing & Stamp Checklist summary table
  routingStripMode: "FIRST_COPY_ONLY" | "ALL_COPIES" | "NONE"; // for Docs 6.2 & 8
}
```

**Stage Grouping Mapping (Matches Real Municipal Submission Rounds):**
- `STAGE_1_PRINCIPLE` (ขออนุมัติหลักการ & TOR): `1, 2, 3, 4.1` (+ divider `4.2`)
- `STAGE_2_ORDER` (ขอซื้อ อนุมัติสั่งซื้อ & แจ้งสัญญา): (dividers `5.1, 5.2` +) `6.1, 6.2 (x3), 7, 8 (x3), 9 (x3), 10 (x2)`
- `STAGE_3_INSPECTION` (ตรวจรับ & ส่งตั้งหนี้): `11.1, 11.2 (x2), 11.3` (+ dividers `11.4, 11.5` +) `12`
- `STAGE_4_DISBURSEMENT` (วางฎีกาเบิกจ่ายหลังคลังตั้งหนี้): `13`

**`routingStripMode` Behavior for Multi-Copy Docs (`6.2` & `8`):**
- When `duplicateCopies: true` and `routingStripMode === "FIRST_COPY_ONLY"`:
  - Copy 1 (คู่ฉบับเสนอแฟ้ม): rendered **with** the bottom routing initials strip (`รองนายกฯ / ปลัดฯ / ผอ.กอง / จนท.`).
  - Copies 2 & 3 (ฉบับปิดประกาศ/แจกจ่าย): rendered **without** the routing initials strip for a crisp public/official look.

---

## 5. Editable Word (`.docx`) Engine (`exporters/docx/`)

The DOCX engine exists so officers can open any generated file in Microsoft Word for minor line tweaks or collaboration—**without** inheriting the broken formatting of legacy Word files.

### 5.1 Core DOCX Architecture Rules (`docx` v9.10.0)
1. **Unit Conversion Helpers (`styles.ts`):**
   - `cmToTwip(cm) = Math.round(cm * 566.929)` (`1.5cm = 850`, `2.0cm = 1134`, `2.5cm = 1417`, `3.0cm = 1701`)
   - `ptToHalfPt(pt) = pt * 2` (`16pt = 32`, `18pt = 36`, `29pt = 58`)
   - A4 Page Size: `width: 11906`, `height: 16838` twips.
   - Default document font (`default.document.run`): `TH Sarabun IT๙` (ASCII, EastAsia, ComplexScript `cs` ALL set to `'TH Sarabun IT๙'`), size `32` (`16pt`).
2. **NO Floating Text Boxes:**
   - Legacy files used overlapping floating Word TextBoxes that duplicated/shifted whenever 1 line was added.
   - Build ALL **3-Tier / 2-Tier Approval Grids**, **Memo Header rows (`ที่` / `วันที่`)**, **External Letter headers**, **PO 2-column metadata**, and **Dual Signature blocks** using **clean borderless `Table` layouts** with explicit `WidthType.DXA` column widths.
3. **Native Word Anti-Orphan & Continuation Table Controls:**
   - Every paragraph in the closing/signature cluster MUST set `keepNext: true` (except the very last line of the cluster) and `keepLines: true`.
   - Every `TableRow` inside approval boxes and data tables MUST set `cantSplit: true`.
   - Every data table header row (Doc `6.1 เอกสารแนบท้าย`, Doc `7`, Doc `10`) MUST set `tableHeader: true` so Word automatically repeats column headers on continuation pages (`ใบต่อ`).
   - Multi-page documents set `titlePage: true` (Different First Page) so Page 1 has no header number, and Page 2+ headers display centered `- ` + `PageNumber.CURRENT` + ` -`.
4. **Embedded Garuda & Normalized Photos:**
   - Embed Garuda (`1.5cm` for memos, `3.0cm` for orders/announcements/external letters/PO) using `ImageRun` with `type: "png"`.
   - For Doc `11.3`, embed `sharp`-normalized JPEG buffers cleanly inside a centered borderless grid table with the inspector certification block locked below via `keepNext: true`.

### 5.2 ZIP Packager (`zip-packager.ts` via `jszip`)
When exporting all active documents for a case as Word:
- Generate `.docx` buffers for every `source === "GENERATED"` document in the manifest.
- Package into a `.zip` file with clean, sortable Thai filenames:
  - `01_บันทึกข้อความ_ขออนุมัติจัดซื้อจัดจ้าง.docx`
  - `02_บันทึกข้อความ_ขออนุมัติมอบหมายกำหนดคุณลักษณะ.docx`
  - `03_บันทึกข้อความ_รายงานผลกำหนดคุณลักษณะ.docx`
  - `04-1_รายละเอียดคุณลักษณะเฉพาะ_TOR.docx`
  - `06-1_บันทึกข้อความ_รายงานขอซื้อขอจ้าง.docx` *(<= 5,000 mode)*
  - ...
  - `11-1_บันทึกข้อความ_รายงานผลการตรวจรับพัสดุ.docx`
  - `11-3_รูปภาพประกอบการตรวจรับ.docx`
  - `12_บันทึกข้อความ_รายงานผลการพิจารณา_ส่งตั้งหนี้.docx` *(<= 5,000 mode)*
  - `13_บันทึกข้อความ_ขออนุมัติเบิกจ่ายเงิน.docx` *(<= 5,000 mode)*
- Also include a plain text `00_รายการเรียงแฟ้มและเตือนวันที่.txt` inside the ZIP summarizing the exact binder order, copy counts (2x/3x), and external document date-stamp reminders!

---

## 6. Next.js 16 Export API Routes (`src/app/api/procurement/`)

All routes must:
- Validate inputs strictly with Zod v4 (`ProcurementCaseInputSchema` + export options).
- Return `400` JSON with structured `ValidationIssue[]` if `allowExportWithErrors !== true` and blocking `ERROR` issues exist (allow explicit override flag for draft printing, while defaulting to blocking on hard errors like `BUDGET_EXCEEDED` or `MEMO_NUMBER_OUT_OF_ORDER`).
- Set RFC 5987 UTF-8 `Content-Disposition` headers properly so Thai filenames download cleanly in Chrome/Edge (`filename*=UTF-8''...`).

| Endpoint | Method | Request Body | Response |
| :--- | :---: | :--- | :--- |
| `/api/procurement/preview-html` | `POST` | `{ caseInput, agency, docId, density? }` | `text/html; charset=utf-8` (instant preview) |
| `/api/procurement/export/pdf` | `POST` | `{ caseInput, agency, options: PdfBinderOptions }` | `application/pdf` + custom headers (`X-Page-Count`, `X-Applied-Densities`) |
| `/api/procurement/export/docx` | `POST` | `{ caseInput, agency, mode: 'ZIP_ALL' \| 'SINGLE_DOC', docId? }` | `application/zip` or `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| `/api/procurement/photos` | `POST` | `multipart/form-data` (`files[]`) | JSON array of normalized photo metadata + data URIs/temp IDs |

---

## 7. Acceptance Criteria & Automated Verification Tests (Phase 3)

Codex MUST write and pass these Vitest suites before finishing Phase 3:

1. **`photo-processor.test.ts`:**
   - Creates a synthetic high-res test image via `sharp` (e.g., 3000x2000), runs `normalizeInspectionPhoto`, asserts output width `<= 1400`, aspect ratio preserved, and valid JPEG buffer.
2. **`pdf-exporter.test.ts` (uses `playwright`, `pdf-lib`, and `pdfjs-dist`):**
   - **Set 1 Full Binder (`1,520` THB, `duplicateCopies: true`, `includeDividers: false`):**
     - Generates the merged PDF binder.
     - Parses the output PDF using `pdfjs-dist` to verify:
       - Exact expected copy multiplication: Docs `6.2`, `8`, `9` appear **3 times**; Docs `10`, `11.2` appear **2 times**; all other generated docs appear **1 time**.
       - Zero Arabic numeral leaks in extracted Thai dates/amounts.
       - Single-page memos (`1, 2, 3, 7, 11.1, 13`) each stay cleanly on **1 page** via Auto-Fit.
   - **Set 2 e-GP Binder (`22,890` THB, `EGP_OVER_5000`, `includeDividers: true`):**
     - Verifies ONLY the 6 manual docs (`1, 2, 3, 4.1, 11.1, 11.3`) are rendered as official forms, while e-GP/LAAS/Vendor steps appear as divider checklist sheets.
   - **Long Multi-Page Case (15 items in Doc `6.1` & `4.1`):**
     - Verifies Doc `6.1` creates the `เอกสารแนบท้าย` table page and multi-page docs include `- ๒ -` on page 2 while omitting page number on page 1.
3. **`docx-exporter.test.ts` (uses `docx`, `jszip`, and `@xmldom/xmldom`):**
   - Exports Set 1 as ZIP (`ZIP_ALL`) and unzips with `jszip`.
   - Verifies all 15 `.docx` files + `00_รายการเรียงแฟ้มและเตือนวันที่.txt` exist.
   - Opens `word/document.xml` from Docs `1`, `6.1` (7-item variant), `10`, and `12` via `@xmldom/xmldom` and asserts:
     - Font declarations reference `TH Sarabun IT๙`.
     - Signature cluster paragraphs contain `<w:keepNext/>`.
     - Data table headers contain `<w:tblHeader/>` and rows contain `<w:cantSplit/>`.
     - Zero `<w:txbxContent>` floating text boxes exist in generated documents.

Run and ensure 100% pass:
```bash
npm run typecheck
npm test
```