# Phase 8: Case Folder Workspace UI, Local Word Handoff Kit & Portable Archive

> **Target Repository:** `sarabun-workspace` (Next.js 16.4 App Router, React 19, TypeScript 5.9, Playwright 1.63, pdf-lib 1.17, docx 9.10, jszip 3.10)
> **Prerequisite:** Phase 7 (`src/lib/cases/`) and Phases 1–6 are completed and passing tests.
> **Core-First Architecture Rule (Mandatory):** Every generated document in a Case Folder MUST map to and bind with a real **Core `SavedDraft`** (`documents` table + `case_core_drafts`) using `documentHtml`, `renderPdf`, and `renderWord` as the single source of truth. Officers must be able to click **"เปิดแก้ไขในระบบร่างหนังสือ (Core)"** on any Case Folder document, edit freely (text, signatures, floating text boxes, appendix images, attachments), return to the Case Folder, and export PDF Binders / Local Word Handoff Kits directly from their saved Core drafts.
> **Objective:** Build the interactive **"แฟ้มงานสารบรรณ" (Case Folder)** UI and export pipelines so officers can manage multi-document jobs with a live roadmap ("ลายแทง"), link Procurement & Inventory records seamlessly, generate standalone Local Word files for colleagues outside the system, and print complete merged binders.

---

## 1. File Architecture for Phase 8

```text
src/lib/cases/exporters/
├── case-pdf-binder.ts              # Merges generated docs (1x/2x/3x copies), uploaded PDFs/dividers, AND linked Procurement/Inventory PDFs via pdf-lib
├── local-handoff-zip.ts            # Builds the offline "Local Word Handoff Kit" .zip (ordered folders + 00_ลายแทง.docx + .docx files with optional highlightBlanks + linked files)
└── portable-archive.ts             # Exports/Imports .sarabun-case.json (or .zip) for cross-PC transfer & Google Drive backup

src/app/api/cases/
├── preview-html/route.ts           # POST: Instant HTML preview of any of the 7 doc types
├── export/
│   ├── pdf-binder/route.ts         # POST: Full or By-Stage merged PDF binder
│   ├── local-handoff/route.ts      # POST: Offline Local Word Handoff Kit (.zip)
│   ├── blank-word/route.ts         # POST: Quick Blank Local Word Form (.docx) for any of the 7 types
│   └── portable/route.ts           # POST/PUT: Export & Import portable case package
└── backup-drive/route.ts           # POST (Optional graceful integration if Google Drive OAuth is configured in workspace)

src/components/cases/
├── CaseFolderListPage.tsx          # Grid/Table of project folders + filter by fiscal year/status + "+ สร้างแฟ้มงานใหม่" + "สร้าง Word เปล่าแจกเพื่อน"
├── CaseFolderWorkspace.tsx         # Inside a folder: Left Roadmap ("ลายแทง") & Variables | Center Editor | Right Live A4 Preview & Validator
├── roadmap/
│   ├── RoadmapSidebar.tsx          # Stage-grouped roadmap with up/down reorder, status pills, copy badges, "+ เพิ่มเอกสาร / แนบไฟล์ / ผูกงานจัดซื้อ-พัสดุ"
│   └── CaseVariablesBar.tsx        # Quick-edit shared variables ({{var.xxx}}) with 1-click insert into active document
├── editor/
│   ├── DocumentFormEditor.tsx      # Adaptive editor for all 7 doc types + "@อ้างอิงเอกสารในแฟ้ม" picker + External Word Override uploader
│   └── LinkModuleModal.tsx         # Picker to link existing Procurement cases or Inventory requisitions into this folder
└── modals/
    ├── NewCaseFromBlueprintModal.tsx # Create blank folder OR start from saved Blueprint / Safe Clone
    ├── QuickBlankWordModal.tsx       # 3-second local Word generator (pick 1 of 7 types + toggle highlightBlanks -> instant .docx download)
    └── ExportCaseModal.tsx           # Unified export dialog: (1) Print PDF Binder, (2) Local Word Handoff Kit, (3) Portable Backup

e2e/
└── case-folder-workflow.spec.ts    # End-to-end Playwright test verifying folder creation, @ref sync, cross-module link & Local Handoff ZIP
```

---

## 2. Key User Workflows & UX Details

### 2.1 Top Navigation Coexistence (Separate Menus, Seamless Linking)
Keep the sidebar navigation crystal clear with 3 complementary workspaces (integrating cleanly into existing `sarabun-workspace` navigation):
1. **แฟ้มงานสารบรรณ (Case Folders)** — General projects & multi-doc workflows (`Phase 7–8`).
2. **จัดซื้อจัดจ้าง (Procurement)** — Dedicated 15-doc / e-GP workflow (`Phase 1–4`).
3. **พัสดุและครุภัณฑ์ (Inventory & FIFO)** — Stock Card, FIFO Requisitions & Assets (`Phase 5–6`).

### 2.2 Inside a Case Folder (`CaseFolderWorkspace.tsx`)
- **Left Column — ลายแทงประจำแฟ้ม (Dynamic Roadmap):**
  - Displays items grouped by submission stages (`รอบที่ 1`, `รอบที่ 2`, ...), showing exact filing order (`1, 2, 3...`), doc type icon, running number, Thai date, copy badge (`3 ชุด`), and status (`ร่าง` / `เสนอเซ็น` / `เซ็นแล้ว`).
  - Bottom action buttons:
    - **`+ สร้างเอกสารในระบบ`** (pick any of the 7 official types)
    - **`+ แทรกไฟล์แนบ / แผ่นคั่น`** (upload PDF/image or create divider card)
    - **`+ ผูกงานจัดซื้อจัดจ้าง / พัสดุ`** (opens `LinkModuleModal` searching existing Procurement cases and Inventory requisitions)
  - Includes a compact **"พิมพ์/โหลดลายแทง"** button.
- **Top Strip — ตัวแปรกลางของแฟ้ม (`CaseVariablesBar.tsx`):**
  - Shows editable chips for `ชื่อโครงการ`, `วันจัดงาน`, `สถานที่`, `งบประมาณ`, etc. Editing once immediately refreshes every document preview in the folder.
- **Center Column — ตัวแก้ไขเอกสาร (`DocumentFormEditor.tsx`):**
  - Clean structured fields tailored to the selected doc type (no raw HTML editing needed).
  - Toolbar above text areas provides two 1-click insertion helpers:
    - **`+ แทรกตัวแปรแฟ้ม`** (inserts `{{var.projectName}}`, etc.)
    - **`@ อ้างอิงเอกสารก่อนหน้า`** (inserts live `{{ref:docId:full}}` chip so numbers/dates never go stale)
  - **"ส่งไฟล์นี้ให้เพื่อนแก้ข้างนอก / อัปโหลดฉบับที่แก้แล้ว":**
    - Button 1: `โหลดเป็น Word (.docx)` (single doc for colleague)
    - Button 2: `แนบฉบับแก้ไขภายนอก (Override)` (replaces printed output for this slot while preserving roadmap metadata).
- **Right Column — ตรวจความถูกต้อง & พรีวิว A4 สด:**
  - Live `ValidationPanel` catching reference chronology errors, holidays, and duplicate running numbers.
  - Scaled A4 HTML preview (debounced `250ms`) reusing Phase 4's `LiveA4Preview` component.

### 2.3 Quick Blank Local Word Generator (`QuickBlankWordModal.tsx`)
Accessible right from the Case Folder dashboard header via **`สร้างฟอร์ม Word เปล่า (สำหรับคนนอกระบบ)`**:
- Choose 1 of the 7 official types (บันทึกข้อความ / หนังสือภายนอก / คำสั่ง / ประกาศ / หนังสือรับรอง-เชิญ / ร่างโครงการ / หน้ารูปภาพ).
- Optional inputs: `ชื่อเรื่องเบื้องต้น`, `รูปแบบกล่องอนุมัติ`, checkbox `[x] ไฮไลต์สีเหลืองตรงจุดที่ต้องกรอกเพิ่ม`.
- Click **`ดาวน์โหลด .docx ทันที`** -> generates a pristine, Sarabun-compliant Word file with current Garuda, margins, `TH Sarabun IT๙`, and latest signatories ready to share over LINE/Email.

### 2.4 Unified Export Dialog (`ExportCaseModal.tsx`)
Offers 3 clear tabs matching real municipal workflows:
1. **PDF พร้อมพิมพ์เข้าแฟ้ม (Print-Ready PDF Binder):**
   - Choose `รวมทั้งแฟ้ม` or `เฉพาะรอบเสนอเซ็น (Stage)`.
   - Toggles: `[x] เบิ้ลจำนวนชุดอัตโนมัติ`, `[x] รวมไฟล์ PDF จากงานจัดซื้อจัดจ้าง/พัสดุที่ผูกไว้เข้าเล่มด้วย`, `[x] แทรกแผ่นคั่นสำหรับไฟล์ที่ยังไม่ได้อัปโหลด`, `[x] แนบใบปะหน้าลายแทง`.
2. **ชุดส่งต่อ Word ออฟไลน์ (Local Word Handoff Kit `.zip`):**
   - Toggles:
     - `[x] ไฮไลต์สีเหลืองตรงช่องที่ยังว่าง (ช่วยให้คนนอกระบบเห็นจุดต้องเติม)`
     - `[x] แนบไฟล์ลายแทง_00.docx และ .txt`
     - `[x] รวมโฟลเดอร์ไฟล์แนบและเอกสารจากงานจัดซื้อ/พัสดุที่ผูกไว้`
   - Downloads a structured Windows-friendly `.zip` folder ready for USB, shared LAN drive, or LINE/Email handoff.
3. **สำรองข้อมูล / ย้ายเครื่อง (Portable Archive):**
   - Export/Import `.sarabun-case.json` to move folders across computers, plus optional 1-click upload to Google Drive if Drive integration is active in `sarabun-workspace`.

---

## 3. End-to-End Verification (`e2e/case-folder-workflow.spec.ts`)

Implement automated Playwright E2E tests covering:
1. **Full Multi-Doc Folder + Live `@ref` + Cross-Module Link:**
   - Create folder `"โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ ประจำปี ๒๕๗๐"`, set shared variable `eventDate`.
   - Add Doc 1 (`INTERNAL_MEMO`, running no `1510`) and Doc 2 (`MUNICIPAL_ORDER` referencing Doc 1 via `@ref`).
   - Change Doc 1's running number to `1515` -> assert Doc 2's live preview updates immediately to `๑๕๑๕`.
   - Link an existing Procurement case into Stage 2 -> assert roadmap displays its PO number and amount live.
2. **Local Word Handoff Kit & Quick Blank Word:**
   - Trigger `Local Word Handoff Kit (.zip)` with `highlightBlanks: true` -> assert HTTP `200`, valid ZIP containing `00_ลายแทงและเช็กลิสต์แฟ้มงาน.docx`, all `.docx` files, and yellow highlight XML (`<w:highlight w:val="yellow"/>`) on empty placeholders.
   - Open `QuickBlankWordModal` -> generate blank `EXTERNAL_LETTER` -> assert HTTP `200` valid `.docx` with `ภก ๕๒๘๐๖` header and zero floating text boxes.
3. **Safe Clone & Release Gate:**
   - Run `Safe Clone` on the folder -> assert doc structure and Blueprint remain while running numbers, dates, and external overrides are cleared.
   - Pass all release gates with zero errors:

```bash
npm run typecheck
npm test
npm run test:e2e
npm run build
```