# Phase 2: Official Document Templates (All 15 Docs) & Thai Sarabun Pagination Rules

> **Target Repository:** `sarabun-workspace`
> **Prerequisite:** Phase 1 (`src/lib/procurement/` domain schemas, calculations, numbering, validator, and manifest) MUST be completed and passing `npm run typecheck && npm test`.
> **Objective:** Build a renderer-agnostic **Document View-Model Layer** (IR: Intermediate Representation) for all 15 Thai municipal procurement documents, plus strict Thai official Sarabun layout & pagination rules (Anti-Orphan Signatures, Auto Attachment Pages, and Continuation Tables with repeated headers).
> **Scope of Phase 2:** Shared View-Model builders (`buildDocumentModels`) + Sarabun layout tokens/rules + HTML template generators (for preview & Playwright PDF in Phase 3) + unit/snapshot tests. Do NOT write PDF/DOCX binary export routes yet (Phase 3).

---

## 1. Architectural Principle: Single View-Model -> Dual Renderers

To guarantee **zero drift** between PDF output (Phase 3 Playwright) and Word output (Phase 3 `docx`), NEVER hardcode Thai legal text separately inside PDF HTML and DOCX builders.

Instead, build a **Structured Document IR (`ProcurementDocumentModel`)**:
1. Input: `ComputedProcurementCase` + `AgencyConfig` (from Phase 1).
2. Output: A typed array of `RenderedDocumentSpec` objects where **every single number, date, currency amount, cross-reference, and Thai term (`ซื้อ/จ้าง`, `ผู้ขาย/ผู้รับจ้าง`, `ผู้ตรวจรับ/คณะกรรมการ`) is already resolved and formatted in Thai numerals (`๐-๙`)**.
3. Both the HTML/PDF renderer and the DOCX renderer consume this exact same `RenderedDocumentSpec`.

### Folder Structure for Phase 2
```text
src/lib/procurement/
├── templates/
│   ├── ir.ts                      # Structured Document IR types (Memo, Order, Announcement, ExternalLetter, PO, InspectionSheet, PhotoSheet, TOR)
│   ├── sarabun-rules.ts           # Paper size, margins, font tokens, Garuda sizes, compression steps, pagination thresholds
│   ├── helpers.ts                 # Term dictionary (BUY/HIRE), signatory block builders, committee list builders, approval box builders
│   ├── build-all.ts               # Master orchestrator: generates active docs per workflowMode (<=5000 vs >5000 e-GP)
│   ├── docs/
│   │   ├── doc01-approve-principle.ts
│   │   ├── doc02-assign-spec.ts
│   │   ├── doc03-report-spec.ts
│   │   ├── doc04-1-tor.ts
│   │   ├── doc06-1-purchase-request.ts
│   │   ├── doc06-2-inspector-order.ts
│   │   ├── doc07-eval-report.ts
│   │   ├── doc08-winner-announcement.ts
│   │   ├── doc09-contract-notice.ts
│   │   ├── doc10-purchase-order.ts
│   │   ├── doc11-1-inspection-report.ts
│   │   ├── doc11-2-inspection-sheet.ts
│   │   ├── doc11-3-photo-sheet.ts
│   │   ├── doc12-final-summary.ts
│   │   └── doc13-disbursement.ts
│   └── html/
│       ├── styles.css.ts          # Official Sarabun CSS (@page, TH Sarabun IT๙, print rules, table-header-group, anti-orphan)
│       └── render-html.ts         # Converts any RenderedDocumentSpec -> standalone printable HTML string
└── __tests__/
    ├── templates-set1.test.ts     # Verifies all 15 docs in MANUAL_UNDER_5000 mode + zero typos/Arabic leaks
    ├── templates-set2.test.ts     # Verifies EGP_OVER_5000 mode (only 1,2,3,4.1,11.1,11.3) + attachment page logic
    └── templates-variants.test.ts # Verifies HIRE, Non-VAT, and 3-person Committee variants
```

---

## 2. Thai Official Sarabun Layout & Typography Standards (`sarabun-rules.ts`)

### 2.1 Page & Margin Specification (A4 Portrait: `210mm x 297mm`)
Follow ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณ:

| Document Family | Docs | Garuda Height | Top Margin | Bottom Margin | Left Margin | Right Margin |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: |
| **บันทึกข้อความ (Internal Memo)** | `1, 2, 3, 6.1, 7, 11.1, 12, 13` | `1.5 cm` (top-left) | `1.5 cm` | `2.0 cm` | `3.0 cm` | `2.0 cm` |
| **คำสั่ง / ประกาศ / หนังสือภายนอก / ใบสั่งซื้อ** | `6.2, 8, 9, 10` | `3.0 cm` (top-center) | `2.0 cm` | `2.0 cm` | `3.0 cm` | `2.0 cm` |
| **เอกสารประกอบ (ไม่มีครุฑ)** | `4.1, 11.2, 11.3, เอกสารแนบท้าย` | None | `2.5 cm` | `2.0 cm` | `3.0 cm` | `2.0 cm` |

- **Garuda Asset:** Embed crisp monochrome SVG/PNG Garuda (ตราครุฑ) from local static assets (`public/assets/garuda.svg` or `garuda.png` — check if already present in `sarabun-workspace` first and reuse it).
- **Font Family:** `'TH Sarabun IT๙', 'TH Sarabun New', 'Sarabun', sans-serif` (embed `@font-face` WOFF2/TTF locally in `public/fonts/` so Playwright renders identically on every machine without system font drift).
- **Font Sizes:**
  - `บันทึกข้อความ` header title: `29pt` bold (per Sarabun spec) or `24pt` bold aligned cleanly next to 1.5 cm Garuda.
  - Section headers (`ส่วนราชการ`, `ที่`, `วันที่`, `เรื่อง`, `เรียน`, `คำสั่ง`, `ประกาศ`, `ใบสั่งซื้อ`): `18pt–20pt` bold.
  - Body text & tables: `16pt` regular, line-height `1.22` (normal), paragraph first-line indent `2.5 cm` (`tab-indent`).
  - Routing initial block at bottom of `6.2` and `8`: `14pt` compact so it never pushes onto page 2.

### 2.2 Anti-Orphan Signature & Smart Pagination Rules (CRITICAL PAIN POINT)

Implement these **4 non-negotiable layout rules** in both CSS and the Phase 3 Playwright measurement pass:

1. **Rule A — Zero Orphan Signatures (`keepWithPrevious`):**
   - Wrap the **closing line** (`จึงเรียนมาเพื่อโปรดพิจารณา...`) + **primary signatory block** + **approval comment boxes (ผอ.กอง / รองปลัดฯ / รองนายกฯ)** inside a semantic container `.signature-cluster` with `break-inside: avoid; page-break-inside: avoid;`.
   - Attach `break-after: avoid` to the last 2 lines of the final body paragraph (`ข้อพิจารณาและข้อเสนอ` / `ข้อเสนอเพื่อพิจารณา`) so that if a page break MUST happen, **at least 2 lines of body text move to the new page together with the signature cluster**.

2. **Rule B — Controlled Single-Page Fit Compression (for 1-page Memos & Orders):**
   - For standard single-page documents (`1, 2, 3, 6.2, 7, 8, 9, 11.1, 11.2, 13`), define **3 density tiers** (`data-density="normal" | "compact" | "tight"`):
     - `normal`: font `16pt`, line-height `1.22`, paragraph spacing `6pt`, signature gap `28pt`.
     - `compact`: font `16pt`, line-height `1.14`, paragraph spacing `4pt`, signature gap `22pt`.
     - `tight`: font `15.5pt`, line-height `1.10`, paragraph spacing `2.5pt`, signature gap `18pt`.
   - During rendering (Phase 3 Playwright auto-fit loop), if a single-page doc overflows onto page 2 by `<= 15%` of page height, step down `normal -> compact -> tight` automatically until it fits cleanly on 1 page without breaking readability. If it STILL overflows, break cleanly with Rule A + Rule D.

3. **Rule C — Auto Attachment Page (`เอกสารแนบท้าย`) for Doc 6.1:**
   - In `Doc 6.1 (รายงานขอซื้อ/ขอจ้าง)` Clause 2 (`รายละเอียดของวัสดุ/งาน`):
     - If `items.length <= 3` AND total description length `<= 240` chars -> render itemized list inline inside Clause 2.
     - If `items.length >= 4` OR description length `> 240` chars -> render `"รายละเอียดตามที่แนบ"` in Clause 2, insert an explicit page break, and render a dedicated **`เอกสารแนบท้าย`** page with header `[categoryType] จำนวน [itemCount] รายการ` and a bordered 4-column table (`ลำดับ | รายละเอียด | จำนวน | หน่วย`).

4. **Rule D — Continuation Pages (`ใบต่อ`) & Repeated Table Headers:**
   - Whenever any multi-page document (`4.1 TOR`, `6.1 เอกสารแนบท้าย`, `10 ใบสั่งซื้อ/จ้าง`, `11.3 รูปภาพประกอบ`, or any memo exceeding 1 page) spans 2+ pages:
     - **Page numbering:** Suppress page number on page 1; show centered Thai numeral page number **`- ๒ -`**, **`- ๓ -`** in the top header of pages 2+.
     - **Continuation Tables (`ใบต่อตาราง`):** Every data table MUST use semantic `<thead>` (`display: table-header-group`) and `tr { break-inside: avoid; }`. When a table continues onto page 2+, repeat the column header row automatically and display a subtle continuation caption (`ตารางรายการ (ต่อ)`) at the top of the continued page.

---

## 3. Exact Specification of All 15 Official Documents

All literal texts below MUST fix every legacy typo found in the agency's old Word files (e.g., `กฏหมาย -> กฎหมาย`, `ที่ คำสั่ง... ที่ -> คำสั่ง... ที่`, `ผู้รับซื้อ -> ผู้ขาย/ผู้รับจ้าง`, `เลขประจำตัวผู้เสีย -> เลขประจำตัวผู้เสียภาษี`, `นั้น-ภ -> นั้น`, `เจ้าพนักงานธุรการปฏิบัติงานสังคมสงเคราะห์ -> เจ้าพนักงานธุรการปฏิบัติงาน`).

All dynamic placeholders `{{...}}` MUST output **Thai numerals** via `toThaiOfficialText` / `toThaiDigits`.

### Reusable Approval Box Patterns
- **3-Tier Approval Grid** (used in Docs `1, 3, 6.1, 7, 11.1`):
  - **Box 1 (ผอ.กอง / หัวหน้าเจ้าหน้าที่):**
    - `เรียน ปลัด{{agency.municipalityName}}`
    - `- เพื่อโปรดทราบ/พิจารณา` / `- เห็นควรอนุมัติ` (Doc 1: `- เพื่อโปรดพิจารณาอนุมัติ`)
    - `({{signatories.divisionDirector.fullName}})` / `{{signatories.divisionDirector.position}}`
  - **Box 2 (ปลัดฯ / รองปลัดฯ ปฏิบัติราชการแทน):**
    - `เรียน นายก{{agency.municipalityName}}`
    - `- เพื่อโปรดพิจารณา` (Doc 1 & 2: `- เพื่อโปรดพิจารณาอนุมัติ`)
    - `({{signatories.municipalClerk.fullName}})` / `{{signatories.municipalClerk.actingLine}}` / `{{signatories.municipalClerk.actingTarget}}`
  - **Box 3 (นายกฯ / รองนายกฯ ปฏิบัติราชการแทน):**
    - `อนุมัติ`
    - `({{signatories.mayor.fullName}})` / `{{signatories.mayor.actingLine}}` / `{{signatories.mayor.actingTarget}}`
- **2-Tier Approval Grid** (used in Docs `2, 13` where ผอ.กอง is the primary proposer):
  - Contains **Box 2 (ปลัดฯ/รองปลัดฯ)** and **Box 3 (นายกฯ/รองนายกฯ)** with full names & titles (fixing the missing names in legacy Doc 13!).
- **Routing Initials Strip** (bottom of Docs `6.2` and `8`, configurable `showRoutingStrip: true` on copy 1 or all copies):
  - Compact lines: `........ รองนายกเทศมนตรี`, `........ ปลัดเทศบาล`, `........ รองปลัดเทศบาล`, `........ ผอ.{{agency.divisionName}}`, `........ หัวหน้าฝ่าย`, `........ หัวหน้างาน`, `........ จนท./ร่าง/พิมพ์/ทาน`.

---

### Doc `1` — บันทึกข้อความ ขออนุมัติจัดซื้อ/จัดจ้างตามระเบียบพัสดุ
- **Active in:** Both `MANUAL_UNDER_5000` & `EGP_OVER_5000` | **Copies:** `1`
- **Header:** `ส่วนราชการ {{agency.sectionName}} {{agency.divisionName}} {{agency.municipalityName}} โทร. {{agency.phoneDisplay}}` | `ที่ {{internalMemoPrefix}}/{{doc1.runningNo}}` | `วันที่ {{doc1.dateTh}}`
- **เรื่อง:** `ขออนุมัติจัดซื้อ/จัดจ้างตามระเบียบพัสดุ`
- **เรียน:** `นายก{{agency.municipalityName}}`
- **เรื่องเดิม:** `ตามเทศบัญญัติงบประมาณรายจ่ายประจำปี พ.ศ. {{budgetLine.fiscalYearBE}} {{agency.divisionName}} {{budgetLine.planName}} {{budgetLine.workName}} {{budgetLine.categoryGroup}} ประเภท{{budgetLine.categoryType}} ตั้งไว้ {{allocatedAmountFmt}}.- บาท ({{allocatedAmountText}}) นั้น`
- **ข้อเท็จจริง:** `เนื่องจาก {{agency.divisionName}} มีความจำเป็นต้อง{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ เพื่อใช้ในการปฏิบัติงานราชการภายในสำนักงาน{{agency.divisionName}}`
- **เหตุผลและความจำเป็น:** `{{purposeText}}`
- **ข้อระเบียบและกฎหมาย:** `ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๒๒ ข้อ ๒๘ ข้อ ๗๘ ข้อ ๗๙ และข้อ ๘๖`
- **ข้อพิจารณาและข้อเสนอ:**
  - `เพื่อให้เจ้าหน้าที่พัสดุดำเนินงานเป็นไปอย่างถูกต้องตามระเบียบฯ ข้างต้น เห็นควรดำเนินการ ดังนี้`
  - `จัดซื้อจัดจ้างกรณีวิธีเฉพาะเจาะจง`
  - `๑. อนุมัติจัดซื้อ/จัดจ้าง โดยวิธีเฉพาะเจาะจง`
  - `๒. อนุมัติรายงานขอซื้อ/ขอจ้าง`
  - `๓. อนุมัติรายงานผลการพิจารณาและอนุมัติสั่งซื้อ/สั่งจ้าง`
  - `๔. อนุมัติให้เบิกจ่ายเงินแก่เจ้าหนี้ต่อไป`
  - `จึงเรียนมาเพื่อโปรดทราบ และพิจารณาอนุมัติดำเนินการต่อไป`
- **Primary Signatory:** `({{signatories.procurementOfficer.fullName}})` / `เจ้าหน้าที่พัสดุ` + **3-Tier Approval Grid**.

---

### Doc `2` — บันทึกข้อความ ขออนุมัติมอบหมายหน้าที่การกำหนดคุณลักษณะเฉพาะ
- **Active in:** Both modes | **Copies:** `1`
- **Header:** `ที่ {{internalMemoPrefix}}/{{doc2.runningNo}}` | `วันที่ {{doc2.dateTh}}`
- **เรื่อง:** `ขออนุมัติมอบหมายหน้าที่การกำหนดคุณลักษณะเฉพาะค่า{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ`
- **เรื่องเดิม:** Same budget line sentence as Doc 1.
- **ข้อเท็จจริง:** `เนื่องจาก {{agency.divisionName}} {{agency.municipalityName}} มีความประสงค์จะดำเนินการ{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ เพื่อใช้ในการปฏิบัติงานราชการของ{{agency.divisionName}} ให้เป็นไปอย่างเรียบร้อยและเกิดความสะดวกแก่เจ้าหน้าที่ผู้ปฏิบัติงาน`
- **ข้อระเบียบและกฎหมาย:**
  - `๑. พระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐`
  - `๒. ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๒๑`
- **ข้อพิจารณาและข้อเสนอ:** `เพื่อความเป็นระเบียบเรียบร้อย และให้การ{{terms.actionVerb}}เป็นไปด้วยความเรียบร้อยถูกต้องตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ และระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๒๑ จึงมอบหมายให้ {{signatories.procurementOfficer.fullName}} ตำแหน่ง {{signatories.procurementOfficer.position}} เป็นเจ้าหน้าที่ โดยให้มีหน้าที่ดำเนินการกำหนดคุณลักษณะเฉพาะค่า{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ`
- **Closing:** `จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ และแจ้งเจ้าหน้าที่ที่เกี่ยวข้องดำเนินการต่อไป`
- **Primary Signatory:** `({{signatories.divisionDirector.fullName}})` / `{{signatories.divisionDirector.position}}` + **2-Tier Approval Grid** (Clerk & Mayor).

---

### Doc `3` — บันทึกข้อความ รายงานผลการจัดทำรายละเอียดคุณลักษณะเฉพาะ
- **Active in:** Both modes | **Copies:** `1`
- **Header:** `ที่ {{internalMemoPrefix}}/{{doc3.runningNo}}` | `วันที่ {{doc3.dateTh}}`
- **เรื่อง:** `รายงานผลการจัดทำรายละเอียดคุณลักษณะเฉพาะของ{{projectTitle}}ที่{{terms.actionVerb}}`
- **เรื่องเดิม:** `ตามบันทึกข้อความ{{agency.divisionName}} ที่ {{internalMemoPrefix}}/{{doc2.runningNo}} ลงวันที่ {{doc2.dateTh}} เรื่อง ขออนุมัติมอบหมายหน้าที่การกำหนดคุณลักษณะเฉพาะค่า{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ นั้น` *(Auto-synced with Doc 2!)*
- **ข้อเท็จจริง:** `บัดนี้เจ้าหน้าที่จัดทำรายละเอียดคุณลักษณะเฉพาะของพัสดุที่จะ{{terms.shortVerb}}เสร็จเรียบร้อยแล้ว และใช้ราคาอ้างอิงตามกฎกระทรวงกำหนดวงเงินการจัดซื้อจัดจ้างพัสดุโดยวิธีเฉพาะเจาะจงฯ พ.ศ. ๒๕๖๐ ข้อ ๑ การจัดซื้อจัดจ้างสินค้า งานบริการ หรืองานก่อสร้าง ที่มีการผลิต จำหน่าย ก่อสร้าง หรือให้บริการทั่วไป และมีวงเงินในการจัดซื้อจัดจ้างครั้งหนึ่งไม่เกิน ๕๐๐,๐๐๐.- บาท ให้ใช้วิธีเฉพาะเจาะจง`
- **ข้อระเบียบและกฎหมาย:** Same 2 items as Doc 2.
- **ข้อพิจารณาและข้อเสนอ:** `เพื่อให้การปฏิบัติงานเป็นไปอย่างเรียบร้อย มีประสิทธิภาพและประสิทธิผล จึงขออนุมัติใช้ประกอบการจัดซื้อจัดจ้างตามรายละเอียดเอกสารแนบมาพร้อมนี้` / `จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ และแจ้งเจ้าหน้าที่ที่เกี่ยวข้องดำเนินการต่อไป`
- **Primary Signatory:** `(ลงชื่อ).............................................เจ้าหน้าที่กำหนดคุณลักษณะเฉพาะฯ` / `({{signatories.procurementOfficer.fullName}})` / `{{signatories.procurementOfficer.position}}` + **3-Tier Approval Grid**.

---

### Doc `4.1` — รายละเอียดคุณลักษณะเฉพาะ (TOR)
- **Active in:** Both modes | **Copies:** `1` | **No Garuda, No Doc No., No Date**
- **Title (Centered Bold 18pt):**
  - `รายละเอียดคุณลักษณะเฉพาะค่า{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ`
  - `โดยวิธีเฉพาะเจาะจง`
- **Clauses 1–9:**
  1. `ความเป็นมา`: `ด้วย {{agency.divisionName}} จะ{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ`
  2. `วัตถุประสงค์`: `เพื่อใช้ในการปฏิบัติงานราชการของ{{agency.divisionName}} ให้เป็นไปอย่างเรียบร้อยและเกิดความสะดวกแก่เจ้าหน้าที่ผู้ปฏิบัติงาน`
  3. `คุณสมบัติของผู้ยื่นราคา`: Standard 3.1, 3.2, 3.3 (exact municipal wording).
  4. `รายละเอียดคุณลักษณะเฉพาะและเงื่อนไขของงาน`:
     - `๔.๑ รายละเอียดคุณลักษณะเฉพาะของค่า{{projectTitle}}`: Render clean aligned list (or borderless 3-column grid: `ลำดับ. ชื่อรายการ | จำนวน | หน่วย`) for all `items`.
     - `๔.๒ เงื่อนไขของงาน{{terms.shortVerb}}`:
       - `๔.๒.๑ {{terms.counterpartyLabel}}จะต้องส่งมอบ{{terms.deliveryObject}}ให้กับ{{terms.buyerLabel}}ภายใน {{deliveryDays}} วัน นับถัดจากวันที่ลงนามในสัญญา/{{terms.orderDocTitle}} {{agency.deliveryAddressFull}}`
       - `๔.๒.๒ {{terms.buyerLabel}}จะจ่ายเงินให้กับ{{terms.counterpartyLabel}} เมื่อได้รับมอบ{{terms.deliveryObject}}ถูกต้อง ครบถ้วน และ{{inspectorTitle}}ได้ตรวจรับไว้ถูกต้อง ครบถ้วนตามคุณลักษณะที่{{agency.municipalityName}}กำหนดไว้`
  5. `ระยะเวลาดำเนินการ`: `ภายใน {{deliveryDays}} วัน นับถัดจากวันลงนามใน{{terms.orderDocTitle}}`
  6. `ระยะเวลาที่ส่งมอบงาน`: `กำหนดส่งมอบงานภายใน {{deliveryDays}} วัน นับถัดจากวันลงนามใน{{terms.orderDocTitle}}`
  7. `อัตราค่าปรับ`: `คิดค่าปรับเป็นรายวันในอัตราร้อยละ {{penaltyRateFmt}} ของราคา{{terms.penaltyBaseLabel}}ที่ยังไม่ได้รับมอบ แต่ต้องไม่ต่ำกว่าวันละ {{minPenaltyPerDayFmt}}.- บาท` *(Auto-synced: BUY = ๐.๒๐, HIRE = ๐.๑๐!)*
  8. `วงเงินในการจัดซื้อ/จัดจ้าง`: `เบิกจ่ายตามเทศบัญญัติงบประมาณรายจ่ายประจำปี พ.ศ. {{budgetLine.fiscalYearBE}} {{agency.divisionName}} {{budgetLine.planName}} {{budgetLine.workName}} {{budgetLine.categoryGroup}} ประเภท{{budgetLine.categoryType}} ตั้งไว้ {{allocatedAmountFmt}}.- บาท คงเหลือ {{budgetRemainingBeforeFmt}}.- บาท`
  9. `หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ`: `ใช้เกณฑ์พิจารณาถึงประโยชน์ของหน่วยงานของรัฐและวัตถุประสงค์ของการใช้งานเป็นสำคัญโดยการคำนึงถึงเกณฑ์ราคา`
- **Signatory:** `(ลงชื่อ).............................................เจ้าหน้าที่กำหนดคุณลักษณะเฉพาะฯ` / `({{signatories.procurementOfficer.fullName}})` / `{{signatories.procurementOfficer.position}}` *(Clean position only; fix legacy `สังคมสงเคราะห์` suffix bug)*.
- **Pagination:** Supports automatic page 2 (`- ๒ -`) with Anti-Orphan Signature if `items.length` pushes content past page 1.

---

### Doc `6.1` — บันทึกข้อความ รายงานขอซื้อ/ขอจ้าง (+ เอกสารแนบท้ายอัตโนมัติ)
- **Active in:** `MANUAL_UNDER_5000` only | **Copies:** `1`
- **Header:** `ที่ {{internalMemoPrefix}}/{{doc6_1.runningNo}}` | `วันที่ {{doc6_1.dateTh}}`
- **เรื่อง:** `รายงานขอ{{terms.shortVerb}}{{projectTitle}}`
- **Opening:** `ด้วย {{agency.divisionName}} {{agency.municipalityName}} มีความประสงค์จะขอ{{terms.shortVerb}}{{projectTitle}} โดยขอเบิกจ่ายตามเทศบัญญัติงบประมาณรายจ่ายประจำปี พ.ศ. {{budgetLine.fiscalYearBE}} {{budgetLine.planName}} {{budgetLine.workName}} {{budgetLine.categoryGroup}} ประเภท{{budgetLine.categoryType}} ตั้งไว้ {{allocatedAmountFmt}}.- บาท คงเหลือ {{budgetRemainingBeforeFmt}}.- บาท เบิกจ่ายครั้งนี้ {{grandTotalFmt}}.- บาท ซึ่งมีรายละเอียดดังต่อไปนี้`
- **Clauses 1–8:**
  1. เหตุผลและความจำเป็น
  2. รายละเอียดของพัสดุ: Applies **Rule C** (inline list if `<= 3` items; `"รายละเอียดตามที่แนบ"` + auto `เอกสารแนบท้าย` table page if `>= 4` items).
  3. `ราคากลางพัสดุที่จะ{{terms.shortVerb}} เป็น {{grandTotalFmt}}.- บาท`
  4. `วงเงินที่จะขอ{{terms.shortVerb}}ครั้งนี้ {{grandTotalFmt}}.- บาท ({{grandTotalText}})`
  5. `กำหนดเวลาที่ต้องการใช้พัสดุ ภายใน {{deliveryDays}} วัน นับถัดจากวันลงนามใน{{terms.orderDocTitle}}`
  6. `วิธีที่จะ{{terms.shortVerb}} และเหตุผลที่ต้อง{{terms.shortVerb}} {{terms.shortVerb}}โดยวิธีเฉพาะเจาะจง เนื่องจาก...`
  7. `หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ โดยใช้เกณฑ์ราคา`
  8. `ข้อเสนออื่น ๆ เห็นควรแต่งตั้ง{{inspectorTitle}} ตามเสนอ`
- **Closing:**
  - `จึงเรียนมาเพื่อโปรดพิจารณา`
  - `๑. เห็นชอบในรายงานขอ{{terms.shortVerb}}ดังกล่าวข้างต้น`
  - `๒. อนุมัติแต่งตั้งให้:`
    - If `SINGLE`: `{{inspectors[0].fullName}} ตำแหน่ง {{inspectors[0].position}} เป็นผู้ตรวจรับพัสดุ`
    - If `COMMITTEE_3`: Numbered list of 3 members with roles (`ประธานกรรมการ`, `กรรมการ`, `กรรมการ`) เป็นคณะกรรมการตรวจรับพัสดุ.
- **Primary Signatory:** `({{signatories.procurementOfficer.fullName}})` / `เจ้าหน้าที่พัสดุ` + **3-Tier Approval Grid**.

---

### Doc `6.2` — คำสั่งเทศบาล แต่งตั้งผู้ตรวจรับพัสดุ / คณะกรรมการตรวจรับพัสดุ
- **Active in:** `MANUAL_UNDER_5000` only | **Copies:** **`3`** | **Garuda `3.0 cm` centered**
- **Header (Centered Bold — fix duplicate `ที่` bug):**
  - `คำสั่ง{{agency.municipalityName}}`
  - `ที่ {{doc6_2.runningNo}}/{{doc6_2.yearBE}}`
  - `เรื่อง แต่งตั้ง{{inspectorTitle}}`
  - `สำหรับการ{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ`
  - `ของ{{agency.divisionName}} {{agency.municipalityName}} โดยวิธีเฉพาะเจาะจง`
  - Divider: centered dotted line (`................................................................`)
- **Body:** Standard reference to ระเบียบกระทรวงการคลังฯ พ.ศ. ๒๕๖๐ + appointment of `SINGLE` person or `COMMITTEE_3` table/list + `อำนาจและหน้าที่ ทำการตรวจรับพัสดุให้เป็นไปตามเงื่อนไขของสัญญาหรือข้อตกลงนั้น`
- **Date:** `สั่ง ณ วันที่ {{doc6_2.dateTh}}`
- **Signatory:** Mayor (`signatories.mayor`) + **Routing Initials Strip** at bottom.

---

### Doc `7` — บันทึกข้อความ รายงานผลการพิจารณาและขออนุมัติสั่งซื้อสั่งจ้าง
- **Active in:** `MANUAL_UNDER_5000` only | **Copies:** `1`
- **Header:** `ที่ {{internalMemoPrefix}}/{{doc7.runningNo}}` | `วันที่ {{doc7.dateTh}}`
- **เรื่อง:** `รายงานผลการพิจารณาและขออนุมัติสั่งซื้อสั่งจ้าง`
- **Summary Table (Bordered):**
  - Columns: `รายการพิจารณา | รายชื่อผู้ยื่นข้อเสนอ | ราคาที่เสนอ* | ราคาที่ตกลงซื้อหรือจ้าง*`
  - Data row: `ค่า{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ` | `{{vendor.shopName}}` | `{{grandTotalDecFmt}}` | `{{grandTotalDecFmt}}`
  - Footer rows:
    - If `vendor.isVatRegistered === true`:
      - `รวมมูลค่าสินค้า` (colspan 3, right-aligned) | `{{subtotalExclVatDecFmt}}`
      - `ภาษีมูลค่าเพิ่ม ๗%` (colspan 3, right-aligned) | `{{vatAmountDecFmt}}`
      - `รวม` (colspan 3, right-aligned, bold) | `{{grandTotalDecFmt}}`
      - Footnote: `* ราคาที่เสนอ และราคาที่ตกลงซื้อหรือจ้าง เป็นราคารวมภาษีมูลค่าเพิ่มและภาษีอื่น ค่าขนส่ง ค่าจดทะเบียน และค่าใช้จ่ายอื่น ๆ ทั้งปวง`
    - If `vendor.isVatRegistered === false`:
      - `รวมเป็นเงินทั้งสิ้น` (colspan 3, right-aligned, bold) | `{{grandTotalDecFmt}}`
      - Footnote: `* ราคาที่เสนอ และราคาที่ตกลงซื้อหรือจ้าง เป็นราคารวมภาษีอื่น ค่าขนส่ง ค่าจดทะเบียน และค่าใช้จ่ายอื่น ๆ ทั้งปวง (ผู้ประกอบการไม่ได้จดทะเบียนภาษีมูลค่าเพิ่ม)`
- **Body & Closing:** Standard decision paragraph using `เกณฑ์ราคา` + `จึงเรียนมาเพื่อโปรดพิจารณา หากเห็นชอบขอได้โปรดอนุมัติให้สั่ง{{terms.shortVerb}}จากผู้เสนอราคาดังกล่าว`
- **Primary Signatory:** `({{signatories.procurementOfficer.fullName}})` / `{{signatories.procurementOfficer.position}}` + **3-Tier Approval Grid**.

---

### Doc `8` — ประกาศเทศบาล เรื่อง ประกาศผู้ชนะการเสนอราคา
- **Active in:** `MANUAL_UNDER_5000` only | **Copies:** **`3`** | **Garuda `3.0 cm` centered**
- **Note:** Do NOT print `doc8.registryLogNo` on the document (book-only log).
- **Header (Centered Bold):**
  - `ประกาศ{{agency.municipalityName}}`
  - `เรื่อง ประกาศผู้ชนะการเสนอราคา{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ`
  - `ของ{{agency.divisionName}} {{agency.municipalityName}} โดยวิธีเฉพาะเจาะจง`
  - Centered dotted divider
- **Body:**
  - `ตามที่ {{agency.municipalityName}} ได้มีโครงการ{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ โดยวิธีเฉพาะเจาะจง นั้น`
  - `บัดนี้ {{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ ผู้ได้รับการคัดเลือก ได้แก่ {{vendor.shopName}} ({{vendor.businessTypeTag}}) โดยเสนอราคา เป็นเงินทั้งสิ้น {{grandTotalFmt}}.- บาท ({{grandTotalText}}) {{vatInclusionPhrase}}`
- **Date:** `ประกาศ ณ วันที่ {{doc8.dateTh}}`
- **Signatory:** Mayor (`signatories.mayor`) + **Routing Initials Strip**.

---

### Doc `9` — หนังสือภายนอก เรื่อง แจ้งลงนามในสัญญา
- **Active in:** `MANUAL_UNDER_5000` only | **Copies:** **`3`** | **Garuda `3.0 cm` centered**
- **Official External Letter Header:**
  - Left: `ที่ {{agency.codes.externalLetterPrefix}}/{{doc9.runningNo}}` (Track 4 prefix `ภก ๕๒๘๐๖/...`)
  - Right: `{{agency.officeTitle}}` / `{{agency.externalAddressLine}}`
  - Date (center-right): `{{doc9.dateTh}}`
  - `เรื่อง` `แจ้งลงนามในสัญญา`
  - `เรียน` `{{vendor.contactPersonName}}` *(Mandatory non-empty)*
- **Body:**
  - `ตามที่ {{agency.municipalityName}} มีความประสงค์{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ โดยวิธีเฉพาะเจาะจง และ {{vendor.shopName}} โดย {{vendor.contactPersonName}} ได้เสนอราคาเป็นเงินทั้งสิ้น {{grandTotalFmt}}.- บาท ({{grandTotalText}}) นั้น`
  - `ในการนี้ {{agency.municipalityName}} พิจารณาแล้วตกลง{{terms.actionVerb}}เป็นเงินทั้งสิ้น {{grandTotalFmt}}.- บาท ({{grandTotalText}}) และขอให้ดำเนินการทำสัญญาภายใน {{deliveryDays}} วัน นับถัดจากวันที่ได้รับหนังสือฉบับนี้`
  - `จึงเรียนมาเพื่อโปรดทราบ`
- **Closing & Signatory:** `ขอแสดงความนับถือ` + Mayor (`signatories.mayor`)
- **Bottom-Left Agency Footer:**
  - `{{agency.divisionName}}` / `{{agency.subDepartmentFooter}}` / `โทร. {{agency.phoneShort}}` / `โทรสาร {{agency.fax}}`

---

### Doc `10` — ใบสั่งซื้อ / ใบสั่งจ้าง
- **Active in:** `MANUAL_UNDER_5000` only | **Copies:** **`2`** | **Garuda `3.0 cm` centered**
- **Title:** `{{terms.orderDocTitle}}` (`ใบสั่งซื้อ` or `ใบสั่งจ้าง`)
- **Two-Column Metadata Header (fix legacy label typos):**
  - Left Column: `{{terms.counterpartyLabel}} {{vendor.shopName}}`, `ที่อยู่ {{vendor.address}}`, `โทรศัพท์ {{vendor.phone}}`, `เลขประจำตัวผู้เสียภาษี {{vendor.taxId}}`
  - Right Column: `{{terms.orderDocTitle}} เลขที่ {{agency.codes.poPrefix}} {{doc10.runningNo}}/{{doc10.fiscalYearBE}}`, `วันที่ {{doc10.dateTh}}`, `ส่วนราชการ {{agency.municipalityName}}`, `ที่อยู่ {{agency.poAgencyAddress}}`, `โทรศัพท์ {{agency.phoneShort}}`
- **Items Table (fix swapped `จำนวน`/`หน่วย` columns):**
  - Columns: `ลำดับ | รายการ | จำนวน | หน่วย | ราคาต่อหน่วย (บาท) | จำนวนเงิน (บาท)`
  - Support `poTableMode: 'SUMMARY' | 'ITEMIZED'` (default `'SUMMARY'` matching agency practice: 1 row `ค่า{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ | {{itemCount}} | รายการ | {{grandTotalDecFmt}} | {{grandTotalDecFmt}}`; optional `'ITEMIZED'` lists every item with Rule D continuation table).
  - Footer rows: Left side shows `({{grandTotalText}})`; right side shows VAT breakdown (if `isVatRegistered`) and bold `รวมเป็นเงินทั้งสิ้น`.
- **Conditions 1–6:**
  1. `กำหนดส่งมอบภายใน {{deliveryDays}} วัน นับถัดจากวันลงนามใน{{terms.orderDocTitle}}`
  2. `สถานที่ส่งมอบ {{agency.deliveryAddressFull}}`
  3. `ระยะเวลารับประกัน {{warrantyDisplay}} ปี` (`-` if null)
  4. `สงวนสิทธิ์ค่าปรับกรณีส่งมอบเกินกำหนด โดยคิดค่าปรับเป็นรายวันในอัตราร้อยละ {{penaltyRateFmt}} ของราคา{{terms.penaltyBaseLabel}}ที่ยังไม่ได้รับมอบ แต่จะต้องไม่ต่ำกว่าวันละ {{minPenaltyPerDayFmt}} บาท`
  5. `ส่วนราชการสงวนสิทธิ์ที่จะไม่รับมอบถ้าปรากฏว่า...`
  6. `การประเมินผลการปฏิบัติงานของผู้ประกอบการ...`
- **หมายเหตุ:**
  1. `การติดอากรแสตมป์ให้เป็นไปตามประมวลกฎหมายรัษฎากร หากต้องการให้{{terms.orderDocTitle}}มีผลตามกฎหมาย`
  2. `{{terms.orderDocTitle}} เลขที่ {{poNumberFull}} {{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ โดยวิธีเฉพาะเจาะจง` *(Auto-synced!)*
- **Dual Signature Block (Right-aligned stacked or 2-column):**
  - `(ลงชื่อ).............................................{{terms.buyerLabel}}` / `({{signatories.divisionDirector.fullName}})` / `{{signatories.divisionDirector.position}}` / `{{doc10.signatureDateTh}}`
  - `(ลงชื่อ).............................................ผู้รับ{{terms.orderDocTitle}}` / `({{vendor.contactPersonName}})` / `{{vendor.contactPersonTitle}}` / `{{doc10.signatureDateTh}}`

---

### Doc `11.1` — บันทึกข้อความ รายงานผลการตรวจรับพัสดุ
- **Active in:** Both `MANUAL_UNDER_5000` & `EGP_OVER_5000` | **Copies:** `1`
- **Header:** `ส่วนราชการ {{inspectorTitle}} {{agency.municipalityName}}` | `ที่ {{internalMemoPrefix}}/{{doc11_1.runningNo}}` | `วันที่ {{doc11_1.dateTh}}`
- **เรื่อง:** `รายงานผลการตรวจรับพัสดุ`
- **เรื่องเดิม:** `ตามคำสั่ง{{agency.municipalityName}} ที่ {{doc6_2.runningNo}}/{{doc6_2.yearBE}} ลงวันที่ {{doc6_2.dateTh}} เรื่อง แต่งตั้ง{{inspectorTitle}} สำหรับการ{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ โดยวิธีเฉพาะเจาะจง และตาม{{terms.orderDocTitle}} เลขที่ {{poNumberFull}} ลงวันที่ {{doc10.dateTh}} โดยคู่สัญญาคือ {{vendor.shopName}} ครบกำหนดส่งมอบวันที่ {{effectiveDueDateTh}} นั้น` *(100% auto-synced; fix legacy `นั้น-ภ` typo)*
- **ข้อเท็จจริง:** `{{terms.counterpartyLabel}}ได้ส่งมอบพัสดุ ตามใบตรวจรับการจัดซื้อ/จัดจ้าง ลงวันที่ {{deliveryDateTh}} {{inspectorTitle}}ได้ตรวจรับพัสดุในวันที่ {{doc11_1.dateTh}} ผลปรากฏว่าถูกต้องครบถ้วนตามที่ระบุไว้ในสัญญา จึงได้ลงชื่อในใบตรวจรับการจัดซื้อ/จัดจ้าง เลขคุมตรวจรับ {{inspectionControlNoDisplay}} ลงวันที่ {{doc11_1.dateTh}} ไว้เป็นหลักฐาน`
- **ข้อระเบียบและกฎหมาย:** Exact ระเบียบฯ พ.ศ. ๒๕๖๐ ข้อ ๑๗๕ (๔) text.
- **ข้อเสนอเพื่อพิจารณา:** `เพื่อให้เป็นไปตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ จึงเรียนมาเพื่อโปรดทราบถึงผลการตรวจรับพัสดุดังกล่าว และเห็นควรอนุมัติเบิกจ่ายเงินให้กับ{{terms.counterpartyLabel}} เป็นเงิน {{grandTotalFmt}}.- บาท ({{grandTotalText}})`
- **Primary Signatory Block:**
  - If `SINGLE`: 1 inspector signature (`ผู้ตรวจรับพัสดุ`).
  - If `COMMITTEE_3`: 3 inspector signatures cleanly arranged (1 `ประธานกรรมการ`, 2 `กรรมการ` — keep compact with Rule A/B).
- Plus **3-Tier Approval Grid** (Director, Clerk, Mayor).

---

### Doc `11.2` — ใบตรวจรับการจัดซื้อ/จัดจ้าง
- **Active in:** `MANUAL_UNDER_5000` only | **Copies:** **`2`** | **No Garuda**
- **Title (Centered Bold):** `ใบตรวจรับการจัดซื้อ/จัดจ้าง` / `วันที่ {{doc11_1.dateTh}}`
- **Body:** `ตาม {{terms.orderDocTitle}} เลขที่ {{poNumberFull}} ลงวันที่ {{doc10.dateTh}} {{agency.municipalityName}} ได้ตกลง{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ เป็นเงินทั้งสิ้น {{grandTotalFmt}}.- บาท ({{grandTotalText}})` / `{{inspectorTitle}} ได้ตรวจรับงานแล้ว ผลปรากฏว่า`
- **Checkbox Section (Use crisp SVG/Unicode `☑` / `☐`):**
  - `ผลการตรวจรับ`: `[☑/☐] ถูกต้อง` | `[☑/☐] ครบถ้วนตามสัญญา` | `[☑/☐] ไม่ครบถ้วนตามสัญญา`
  - `ค่าปรับ`: `[☑/☐] มีค่าปรับ` | `[☑/☐] ไม่มีค่าปรับ`
- **Signatory Block:** Synced with `inspectors` (1 person or 3-person committee).

---

### Doc `11.3` — รูปภาพประกอบการตรวจรับ
- **Active in:** Both `MANUAL_UNDER_5000` & `EGP_OVER_5000` | **Copies:** `1` | **No Garuda**
- **Header (Centered Bold):** `รูปภาพประกอบ` / `{{photoCaption}}` (default: `{{projectTitle}} จำนวน {{itemCount}} รายการ`)
- **Responsive Photo Grid:**
  - `1–2` photos: 1 column stacked (max height `9.5 cm` per photo so 2 photos + certification fit on 1 A4 page!).
  - `3–4` photos: 2x2 grid (`max-height: 8.5 cm`, `object-fit: contain`, subtle `1px solid #d1d5db` frame).
  - `5+` photos: Paginate 4 photos per page with `- ๒ -` page header and keep certification block on the final page (Rule A).
- **Certification Block (Bottom-right, synced with `inspectors`):**
  - `ขอรับรองว่าเป็นเอกสารที่ถูกต้อง`
  - Inspector(s) signature lines (`SINGLE` or `COMMITTEE_3` — fixes stale name bug!).

---

### Doc `12` — บันทึกข้อความ รายงานผลการพิจารณารายละเอียดวิธีการฯ (รวมแฟ้มส่งตั้งหนี้)
- **Active in:** `MANUAL_UNDER_5000` only | **Copies:** `1`
- **Header:** `ที่ {{internalMemoPrefix}}/{{doc12.runningNo}}` | `วันที่ {{doc12.dateTh}}`
- **เรื่อง:** `รายงานผลการพิจารณารายละเอียดวิธีการและขั้นตอนการ{{terms.actionVerb}}พร้อมทั้งเอกสารหลักฐานประกอบการ{{terms.actionVerb}}`
- **เรื่องเดิม:** `ตามที่ {{agency.divisionName}} ได้ดำเนินการ{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ โดยขออนุมัติ{{terms.shortVerb}}จาก {{vendor.shopName}} ตั้งอยู่เลขที่ {{vendor.address}} เลขประจำตัวผู้เสียภาษี {{vendor.taxId}} โทร. {{vendor.phone}} โดยวิธีเฉพาะเจาะจง ตาม{{terms.orderDocTitle}} เลขที่ {{poNumberFull}} ลงวันที่ {{doc10.dateTh}} เป็นจำนวนเงิน {{grandTotalFmt}}.- บาท ({{grandTotalText}}) ซึ่ง{{terms.counterpartyLabel}}ได้ส่งมอบงานมีปริมาณและคุณภาพถูกต้องครบถ้วนตามหลักฐานที่ตกลงกันไว้ เมื่อวันที่ {{deliveryDateTh}} และ{{inspectorTitle}}ได้ตรวจรับพัสดุไว้ถูกต้อง ครบถ้วนแล้ว ในวันที่ {{doc11_1.dateTh}} นั้น` *(Auto-synced PO number — fixes legacy `สว 123/2569` bug!)*
- **ข้อเท็จจริง:** 7-item evidence checklist (1. ร่างขอบเขตของงานฯ, 2. รายงานขอซื้อ/ขอจ้าง, 3. คำสั่งแต่งตั้งฯ, 4. บันทึกรายงานการพิจารณาฯ, 5. ประกาศผู้ชนะฯ, 6. ใบสั่งซื้อ/ใบสั่งจ้าง, 7. บันทึกรายงานผลการตรวจรับพัสดุ) + statutory e-GP paragraph.
- **ข้อระเบียบและกฎหมาย:** `ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๑๖`
- **ข้อเสนอเพื่อพิจารณา:** `{{agency.divisionName}} จึงขอรายงานผลการพิจารณารายละเอียดวิธีการและขั้นตอนการจัดซื้อจัดจ้างพร้อมทั้งเอกสารหลักฐานประกอบการ{{terms.actionVerb}}ที่แนบมาพร้อมนี้` / `จึงเรียนมาเพื่อโปรดทราบ`
- **Vertical Full-Width Comment Chain** (matching legacy Doc 12 layout, protected by Rule A/D):
  1. `({{signatories.procurementOfficer.fullName}})` / `เจ้าหน้าที่พัสดุ`
  2. `ความเห็นของหัวหน้าเจ้าหน้าที่` + Director signature
  3. `ความเห็นของปลัดเทศบาล` + Clerk signature
  4. `ความคิดเห็นของนายกเทศมนตรีตำบลฉลอง` + `- ทราบ/เห็นชอบ` + Mayor signature

---

### Doc `13` — บันทึกข้อความ ขออนุมัติเบิกจ่ายเงิน (วางฎีกาหลังคลังตั้งหนี้)
- **Active in:** `MANUAL_UNDER_5000` only | **Copies:** `1`
- **Header:** `ที่ {{internalMemoPrefix}}/{{doc13.runningNo || '........'}}` | `วันที่ {{doc13.dateTh}}`
- **เรื่อง:** `ขออนุมัติเบิกจ่ายเงินค่า{{projectTitle}}`
- **เรื่องเดิม:** Budget narrative + clean 2-column borderless aligned budget ledger table:
  - Row 1: `ตั้งไว้` | `{{allocatedAmountFmt}}.- บาท` | `โอนเพิ่ม` | `{{transferInDisplay}} บาท`
  - Row 2: `โอนลด` | `{{transferOutDisplay}} บาท` | `รวมเป็นเงิน` | `{{totalBudgetFmt}}.- บาท`
  - Row 3: `เบิกจ่ายแล้ว` | `{{budgetSpentBeforeDisplay}} บาท` | `คงเหลือ` | `{{budgetRemainingBeforeFmt}}.- บาท`
- **ข้อเท็จจริง:** `เห็นควรเบิกจ่ายค่า{{terms.actionVerb}}{{projectTitle}} จำนวน {{itemCount}} รายการ ให้แก่ {{vendor.shopName}} เป็นเงิน {{grandTotalFmt}}.- บาท ({{grandTotalText}}) ตามระเบียบฯ ต่อไป`
- **ข้อเสนอเพื่อพิจารณา:** `จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ และโปรดลงนามในฎีกาที่แนบมาด้วยแล้ว`
- **Primary Signatory:** `({{signatories.divisionDirector.fullName}})` / `{{signatories.divisionDirector.position}}` + **2-Tier Approval Grid** (Clerk & Mayor with complete names/titles).

---

## 4. Acceptance Criteria & Verification Tests (Phase 2)

Codex MUST implement and pass these Vitest suites:
1. **`templates-set1.test.ts` (1,520 THB, 2 items, BUY, VAT):**
   - Builds all **15** generated documents.
   - Asserts **zero Arabic digits** in Thai dates, doc numbers, currency amounts, and phone numbers across all rendered HTML outputs.
   - Asserts Doc 3 contains Doc 2's running number (`๑๔๔๖`), and Docs `11.1`, `11.2`, `12` ALL contain `สว ๑๓/๒๕๗๐` (never stale `๑๒๓/๒๕๖๙`).
   - Asserts Doc `6.1` renders items **inline** (no `เอกสารแนบท้าย` page for 2 items).
   - Asserts none of the legacy typos (`กฏหมาย`, `นั้น-ภ`, `ผู้รับซื้อ`, `สังคมสงเคราะห์` suffix on TOR) appear in any generated HTML.
2. **`templates-set2.test.ts` (22,890 THB, 7 items, BUY, VAT):**
   - In default `EGP_OVER_5000` mode, builds **only 6 manual docs**: `1, 2, 3, 4.1, 11.1, 11.3`.
   - When `workflowModeOverride: 'MANUAL_UNDER_5000'` is tested with 7 items, asserts Doc `6.1` renders `"รายละเอียดตามที่แนบ"` AND generates the **`เอกสารแนบท้าย`** table with all 7 items and `<thead>` repeat markup.
   - Asserts Doc `11.1` and `11.3` both show `นางสาวศิริวรรณ ไทยมิตรชอบ` identically.
3. **`templates-variants.test.ts`:**
   - `HIRE` mode: verifies `ใบสั่งจ้าง`, `ผู้รับจ้าง`, `ผู้ว่าจ้าง`, and penalty rate `๐.๑๐` in both Doc `4.1` and Doc `10`.
   - `isVatRegistered: false`: verifies Doc `7` and Doc `10` omit the `ภาษีมูลค่าเพิ่ม ๗%` row.
   - `COMMITTEE_3`: verifies Docs `6.1`, `6.2`, `11.1`, `11.2`, `11.3` render all 3 committee members with `ประธานกรรมการ` and `กรรมการ`.

Run and verify 100% pass:
```bash
npm run typecheck
npm test
```