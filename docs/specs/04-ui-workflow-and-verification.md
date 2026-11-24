# Phase 4: Single-Entry Procurement Workspace UI, Master Data Management & Playwright E2E Verification

> **Target Repository:** `sarabun-workspace` (Next.js 16.4 App Router, React 19, TypeScript 5.9, Lucide React 1.43, Playwright Test 1.63, Vitest 5)
> **Prerequisite:** Phases 1, 2, and 3 MUST be completed and passing `npm run typecheck && npm test`.
> **Objective:** Upgrade/build the interactive procurement workspace UI so an officer fills data **once**, immediately sees live timeline/numbering/budget alerts, previews official A4 Sarabun pages in real time, and exports print-ready PDF binders or editable Word (`.docx`) bundles with zero copy-paste leakage.
> **Constraint:** Inspect existing routes, layouts, CSS design tokens, and persistence adapters in `sarabun-workspace` first (including desktop scripts & Google Drive sync if present). Integrate seamlessly with the existing app shell rather than creating a disconnected island.

---

## 1. UX & Visual Design Direction

- **Design Philosophy:** Clean, modern, functional desktop workspace built for daily municipal administrative work (fast keyboard entry, high legibility for Thai numerals/dates, zero decorative clutter).
- **Layout:** Two-pane sticky split workspace (`1280px+` desktop primary; gracefully stacks on smaller screens):
  - **Left Pane (~55% width):** Structured Single-Entry Form with collapsible/tabbed sections and instant derived calculations.
  - **Right Pane (~45% width, sticky):** Live Validation & External-Stamp Alert Panel + Binder Checklist Navigator + Scaled A4 Document Preview + One-Click Export Bar.
- **Visual Hierarchy:**
  - Restrained neutral canvas (off-white / crisp white cards, subtle 1px borders) with calm emerald/teal primary actions and strict semantic status colors:
    - `ERROR` (Red): Blocks standard export (e.g., budget exceeded, backward memo number).
    - `WARNING` (Amber): Advises fix with one-click action (e.g., weekend date, non-standard penalty rate, expired SME cert).
    - `INFO` (Slate/Blue): Physical document stamp reminders (e.g., stamp vendor quotation with Doc 3 date).

---

## 2. Folder & Component Architecture

Adapt paths to match the existing Next.js App Router structure in `src/app/` (inspect `scripts/procurement-lab.mjs` and `scripts/procurement-main-demo.mjs` first to locate existing procurement routes):

```text
src/lib/procurement/
└── storage/
    └── repository.ts               # Persistence adapter for Cases, MasterData, and 5-Track Running Number Registry (reuses existing workspace storage or local JSON/localStorage safely)

src/components/procurement/
├── ProcurementWorkspace.tsx        # Top-level split workspace state orchestrator (React 19)
├── TopCommandBar.tsx               # Case title, Auto-mode badge (<=5,000 vs e-GP), Safe Clone button, Export dropdowns
├── sections/
│   ├── JobBudgetSection.tsx        # BUY/HIRE toggle, workflow mode override, BudgetLine picker, live ledger bar
│   ├── ItemsVendorSection.tsx      # Dynamic item rows, Vendor picker, live VAT 7% + Thai Baht text readout
│   ├── InspectorsSignatoriesSection.tsx # SINGLE vs COMMITTEE_3 toggle, personnel pickers, auto-lock >100k warning
│   ├── TimelineNumberingSection.tsx     # 5-track running number & date matrix with holiday badges + "Suggest Next" buttons
│   └── InspectionPhotosSection.tsx      # Drag-and-drop upload -> /api/procurement/photos, preview thumbnails, reorder/delete
├── right-pane/
│   ├── ValidationPanel.tsx         # Grouped ERROR/WARNING/INFO alerts with jump-to-field & 1-click "Apply Fix"
│   ├── BinderNavigator.tsx         # 20-step official filing list showing Generated vs LAAS/e-GP/Vendor badges & copy counts (2x/3x)
│   └── LiveA4Preview.tsx           # Scaled A4 iframe/container fed by /api/procurement/preview-html (debounced 250ms) + density selector
├── modals/
│   ├── MasterDataDrawer.tsx        # Manage Agency, Signatories, Inspectors, Vendors (with SME expiry status), Budget Lines
│   ├── ExportPdfModal.tsx          # Profile selector (Full / Stage 1–4 / Current Doc) + switches (2x/3x copies, Dividers, Cover Checklist, Routing Strip)
│   └── BlockingErrorModal.tsx      # Warns before draft export when hard ERROR validation issues exist
└── hooks/
    └── useProcurementCase.ts       # Debounced computation (Phase 1), validation, auto-save draft, undo-safe updates

e2e/
└── procurement-workflow.spec.ts    # Full Playwright E2E verification suite
```

---

## 3. Core Interactive Workflows & Must-Have Features

### 3.1 Single-Entry Reactive Form (Zero Redundant Typing)
1. **Job & Budget Section (`JobBudgetSection.tsx`):**
   - Toggle `จัดซื้อ (BUY)` vs `จัดจ้าง (HIRE)`: automatically updates default penalty rate (`0.20%` vs `0.10%`) and live terminology across all previews.
   - Select from saved `BudgetLine` presets -> auto-fills `fiscalYearBE`, `planName`, `workName`, `categoryGroup`, `categoryType`, and `allocatedAmount`.
   - Live Budget Meter shows: `ตั้งไว้` | `เบิกแล้ว` | `คงเหลือก่อนเบิก` | `ขอเบิกครั้งนี้` | `คงเหลือยกไป` (turns red immediately if negative).
   - Mode Badge displays live threshold detection:
     - `<= 5,000 บาท`: **"โหมดพิมพ์มือครบชุด (๑๕ ฉบับ)"**
     - `> 5,000 บาท`: **"โหมด e-GP (พิมพ์มือ ๖ ฉบับ: ๑–๔.๑ และ ๑๑.๑, ๑๑.๓)"**
     - Includes an explicit advanced toggle to override mode if needed.

2. **Items & Vendor Section (`ItemsVendorSection.tsx`):**
   - Spreadsheet-like compact table for items: `ชื่อรายการ | จำนวน | หน่วย | ราคา/หน่วย | รวม (อัตโนมัติ)`.
   - Live summary card directly underneath displays exact formatted Thai values:
     - Total items count (`จำนวน ๒ รายการ` / `จำนวน ๗ รายการ` + subtle indicator when `>= 4` items: *"ระบบจะตัดขึ้นหน้า 'เอกสารแนบท้าย' ในข้อ ๖.๑ อัตโนมัติ"*).
     - If vendor is VAT-registered: shows `มูลค่าสินค้า`, `VAT ๗%`, `รวมทั้งสิ้น` and **Thai Baht Text** (`สองหมื่นสองพันแปดร้อยเก้าสิบบาทถ้วน`).
   - Quick Vendor Dropdown from Master Data + inline button `"+ เพิ่มร้านค้าใหม่"` without leaving the form.

3. **5-Track Numbering & Timeline Matrix (`TimelineNumberingSection.tsx`):**
   - Clean compact table grouped by the **4 official timeline stages**:
     - **ช่วงที่ 1 (หลักการ & TOR):** Doc `1`, Doc `2`, Doc `3` (+ read-only reminder row for `4.2` stamp date = Doc 3 date).
     - **ช่วงที่ 2 (LAAS / e-GP & สั่งซื้อ):** LAAS date/refs, Doc `6.1`, Doc `6.2` (เลขคำสั่ง), Doc `7`, Doc `8` (เลขลงเล่มประกาศ), Doc `9` (เลขภายนอก `ภก 52806`), Doc `10` (ใบสั่งซื้อ `สว xx/25xx`).
     - **ช่วงที่ 3 (ตรวจรับ & ส่งตั้งหนี้):** Delivery Date, Auto-Calculated Due Date (shows `shiftedForHoliday` badge if pushed from weekend/holiday), Doc `11.1`, Doc `12`.
     - **ช่วงที่ 4 (วางฎีกาเบิกจ่าย):** Doc `13`.
   - **Productivity Helpers:**
     - **"รันเลขถัดไปอัตโนมัติ" (Suggest Next Numbers):** Uses the saved 5-track registry to suggest ascending numbers for empty fields without overwriting manually locked numbers.
     - **"จัดวันที่อัตโนมัติตามวันทำการ" (Smart Fill Timeline):** Given a start date (Doc 1), auto-fills subsequent stage dates skipping weekends and Thai holidays (`holidays.ts`).
     - Inline Thai weekday + holiday badge next to every date input (e.g., `พฤ. ๑๒ พ.ย. ๖๙ ✓` or `อา. ๒๒ พ.ย. ๖๙ ⚠ วันหยุด`).
   - In `EGP_OVER_5000` mode, dims non-generated intermediate docs (`6.1, 7, 8, 9, 12, 13`) while keeping **reference-only inputs** for `6.2 เลขคำสั่ง e-GP` and `10 เลขใบสั่งซื้อ/จ้าง` clearly highlighted because Doc `11.1` needs them!

4. **Safe Clone Case ("คัดลอกงานเดิมแบบปลอดภัย"):**
   - One of the user's biggest pain points is copying old Word files and forgetting to wipe old numbers/dates/inspectors/photos.
   - Implement `cloneCaseSafely(sourceCase)`:
     - **Keeps:** `agency`, `signatories`, `budgetLine` (prompts to refresh `budgetSpentBefore`), `vendor`, `procurementType`, `purposeText`.
     - **Wipes cleanly to blank/default:** ALL 5-track running numbers, ALL dates, LAAS/e-GP reference numbers, uploaded photos (`11.3`), and resets `inspectionResult` to defaults.
     - Displays a toast confirming: *"คัดลอกโครงสร้างงานเดิมแล้ว และล้างเลขที่หนังสือ วันที่ และรูปภาพเก่าออกทั้งหมดเพื่อป้องกันข้อมูลค้าง"*

### 3.2 Right Sticky Pane: Validation, Binder & Live A4 Preview
1. **Validation & Stamp Alert Panel (`ValidationPanel.tsx`):**
   - Collapsible summary header: e.g., `0 ข้อผิดพลาด | 1 คำเตือน | 2 แจ้งเตือนปั๊มวันที่`.
   - Clicking any issue scrolls to and focuses the offending input field.
   - Issues with `suggestedFix` render a one-click **`แก้ไขทันที`** button (e.g., shift holiday date to next working day, or reset penalty rate to standard `0.20%`/`0.10%`).
2. **Binder Navigator (`BinderNavigator.tsx`):**
   - Renders all 20 steps from `buildBinderManifest()` in exact official filing order (`การเรียงแฟ้ม`).
   - Color-coded pills: `ระบบสร้าง` (clickable to preview), `LAAS`, `e-GP`, `ร้านค้า`, plus copy badges (`พิมพ์ ๓ ชุด`, `พิมพ์ ๒ ชุด`).
   - Shows which single-page docs can be toggled between `ปกติ / กระชับ / แน่น` directly in the preview bar.
3. **Live A4 Preview (`LiveA4Preview.tsx`):**
   - Debounces form changes (`250ms`) and POSTs to `/api/procurement/preview-html` for the currently selected generated document.
   - Renders inside an isolated `<iframe srcDoc={html} />` scaled cleanly via CSS transform to fit the right pane width while maintaining exact A4 aspect ratio (`210:297`), with a zoom toggle (`พอดีจอ / 100%`) and a quick **"โหลดฉบับนี้ (PDF / Word)"** split button.

### 3.3 Export Workflows (`TopCommandBar.tsx` & `ExportPdfModal.tsx`)
- **Primary Button: `ส่งออก PDF พร้อมพิมพ์`** opens `ExportPdfModal`:
  - Profile radio cards:
    1. **รวมทั้งแฟ้มเรียงตามลำดับ** (`FULL_BINDER`)
    2. **แยกพิมพ์ตามรอบเสนอแฟ้ม** (`BY_STAGE`: รอบ 1 หลักการ+TOR / รอบ 2 สั่งซื้อ+สัญญา / รอบ 3 ตรวจรับ+ตั้งหนี้ / รอบ 4 วางฎีกา)
    3. **เฉพาะเอกสารที่กำลังเปิดดู** (`SINGLE_DOC`)
  - Checkboxes (persisted as user defaults):
    - `[x]` เบิ้ลจำนวนชุดอัตโนมัติ (คำสั่ง/ประกาศ/ภายนอก ๓ ชุด, ใบสั่งซื้อ/ตรวจรับ ๒ ชุด)
    - `[x]` แทรกแผ่นคั่นจุดเสียบเอกสาร LAAS / e-GP / ร้านค้า พร้อมเตือนวันที่ต้องปั๊ม
    - `[ ]` แนบใบปะหน้า Checklist สรุปการเรียงแฟ้ม
    - Dropdown: แถบช่องเซ็นย่อท้ายคำสั่ง/ประกาศ (`เฉพาะคู่ฉบับแผ่นแรก` / `ทุกชุด` / `ไม่แสดง`)
- **Secondary Button: `ส่งออก Word (.docx)`**:
  - `โหลดทั้งหมดเป็นไฟล์ ZIP (.docx + ลายแทงเรียงแฟ้ม.txt)`
  - `โหลดเฉพาะฉบับที่กำลังดู (.docx)`
- **Pre-Export Guard:** If `validationIssues` has any `severity === 'ERROR'`, open `BlockingErrorModal` listing the exact errors before allowing an explicit "ส่งออกฉบับร่างทั้งที่มีข้อผิดพลาด" override.
- **Registry Commit Prompt:** After a successful full/stage export, offer a 1-click prompt *"บันทึกเลขที่หนังสือล่าสุดลงทะเบียนคุมเลขรัน?"* so the next case suggests the following running numbers automatically.

---

## 4. Persistence & Desktop/Existing App Compatibility (`storage/repository.ts`)

1. Inspect how `sarabun-workspace` currently persists workspace data (especially checking `scripts/desktop.mjs`, `scripts/build-desktop.mjs`, and `@googleapis/drive` usage).
2. Implement a clean `ProcurementRepository` interface with a default adapter matching the workspace's existing storage pattern (or local file/JSON API route for desktop mode + `localStorage` fallback for browser-only mode), supporting:
   - `listCases()`, `getCase(id)`, `saveCase(caseInput)`, `deleteCase(id)`
   - `getMasterData()`, `saveMasterData(masterData)` (seeded initially from `presets/default-agency.ts` — เทศบาลตำบลฉลอง / กองสวัสดิการสังคม)
   - `getNumberingRegistry()`, `advanceNumberingRegistry(caseInput)`

---

## 5. End-to-End Verification (`e2e/procurement-workflow.spec.ts`)

Implement automated Playwright E2E tests running against the local Next.js server (`npm run test:e2e`):

1. **Test 1 — Under 5,000 THB Full Manual Flow (Set 1: 1,520 THB, 2 items):**
   - Load workspace, fill Set 1 data once.
   - Assert mode badge shows `โหมดพิมพ์มือครบชุด` and live VAT reads `๑,๔๒๐.๕๖` / `๙๙.๔๔` / `หนึ่งพันห้าร้อยยี่สิบบาทถ้วน`.
   - Select Doc `12` in Binder Navigator -> assert preview iframe contains `สว ๑๓/๒๕๗๐` (auto-synced from Doc 10) and zero Arabic dates.
   - Trigger PDF Binder download -> assert HTTP `200`, `Content-Type: application/pdf`, non-empty PDF stream.
   - Trigger Word ZIP download -> assert HTTP `200`, `Content-Type: application/zip`, non-empty archive.
2. **Test 2 — Over 5,000 THB e-GP Flow & Cross-Doc Sync (Set 2: 22,890 THB, 7 items):**
   - Fill Set 2 data (7 items totaling 22,890 THB).
   - Assert mode badge automatically switches to `โหมด e-GP` and Binder Navigator shows only 6 generated docs (`1, 2, 3, 4.1, 11.1, 11.3`) while marking `6.1–10, 11.2, 12, 13` as `e-GP`.
   - Change inspector name to `นางสาวศิริวรรณ ไทยมิตรชอบ` -> verify BOTH Doc `11.1` and Doc `11.3` live previews immediately reflect the updated name.
   - Test weekend due date (`2026-11-22`) -> verify warning appears and clicking **`แก้ไขทันที`** shifts due date to `๒๓ พฤศจิกายน ๒๕๖๙`.
3. **Test 3 — Validation Guard & Safe Clone:**
   - Enter backward memo number (`doc7 < doc6_1`) -> assert `ERROR` alert displays and clicking Export PDF opens `BlockingErrorModal`.
   - Click Safe Clone -> assert vendor/budget remain while all running numbers, dates, and photos are cleared.

---

## 6. Final Release Gate (All Phases Complete)

Before declaring the project complete, Codex MUST run all 4 checks cleanly with zero errors:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```