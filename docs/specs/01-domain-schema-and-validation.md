# Phase 1: Procurement Domain Schema, Financial Engine & Timeline/Numbering Validator

> **Target Repository:** `sarabun-workspace` (Next.js 16.4, React 19, TypeScript 5.9, Zod 4.6, Vitest 5)
> **Objective:** Build a strict, Single-Source-of-Truth TypeScript domain layer for Thai municipal procurement (วิธีเฉพาะเจาะจง) that eliminates copy-paste errors across all documents, computes all financial/Thai-numeral values deterministically, and validates document numbers, cross-references, and official Thai working-day timelines.
> **Scope of Phase 1:** Pure TypeScript domain modules + Zod schemas + unit tests ONLY. Do NOT build PDF/DOCX renderers or UI pages in this phase (those belong to Phases 2–4).

---

## 1. Non-Destructive Integration Rules for Codex

1. Inspect the existing repository structure first (especially `scripts/procurement-lab.mjs`, `scripts/procurement-main-demo.mjs`, and `src/`).
2. Create the new domain layer under a clean namespace: `src/lib/procurement/` (or adapt to the existing `src/` procurement folder if one already exists—do NOT break existing imports or scripts).
3. All functions in Phase 1 must be **pure, deterministic, and side-effect free** (no DOM, no filesystem writes, no network calls), except optional JSON repository adapters if already patterned in the codebase.
4. Use **Zod v4** (`zod` ^4.6.7) strictly for runtime validation and TypeScript type inference (`z.infer<typeof ...>`).
5. Every exported rule must have unit tests in `Vitest`. Run `npm run typecheck` and `npm test` before finishing Phase 1.

---

## 2. Core Business Rules (Hard Requirements)

### 2.1 Procurement Threshold Mode (Auto-Selected with Manual Override)
- **`MANUAL_UNDER_5000`** (`grandTotal <= 5000` THB):
  - Full manual Word/PDF generation for all 15 official documents:
    `1, 2, 3, 4.1, 6.1, 6.2, 7, 8, 9, 10, 11.1, 11.2, 11.3, 12, 13`
  - External/system slots in binder checklist:
    `4.2` (Winner Quotation), `5.1` (LAAS Purchase Report), `5.2` (LAAS Agreement), `11.4` (Vendor Delivery Order), `11.5` (Vendor Docs + 2 Competitor Quotations).
- **`EGP_OVER_5000`** (`grandTotal > 5000` THB):
  - System generates **only** the manual documents outside e-GP:
    - Pre-eGP phase: **`1, 2, 3, 4.1`**
    - Inspection phase: **`11.1, 11.3`**
  - All intermediate and post-eGP documents (`6.1, 6.2, 7, 8, 9, 10, 11.2, 12, 13`) are marked as `source: 'EGP_OR_LAAS_SYSTEM'` in the binder manifest (not generated as manual drafts unless the user explicitly enables an override flag).
  - Note: Even in `EGP_OVER_5000` mode, the user can still input the e-GP Order Number (`6.2`), PO Number (`10`), and Delivery Due Date so that `11.1` (รายงานผลการตรวจรับพัสดุ) references them accurately without typos.

### 2.2 Procurement Type (`BUY` vs `HIRE`)
Support both purchasing and hiring via a dictionary helper `getProcurementTerms(type)`:
- **`BUY` (จัดซื้อ):**
  - `actionVerb`: `"ซื้อ"` / `"จัดซื้อ"`
  - `orderDocTitle`: `"ใบสั่งซื้อ"`
  - `counterpartyLabel`: `"ผู้ขาย"`
  - `buyerLabel`: `"ผู้ซื้อ"` / `"ผู้สั่งซื้อ"`
  - `deliveryObject`: `"พัสดุ"` / `"สินค้า"`
  - `defaultPenaltyRatePercent`: **`0.20`** (ร้อยละ ๐.๒๐ ต่อวัน, ขั้นต่ำวันละ ๑๐๐ บาท)
- **`HIRE` (จัดจ้าง):**
  - `actionVerb`: `"จ้าง"` / `"จัดจ้าง"`
  - `orderDocTitle`: `"ใบสั่งจ้าง"`
  - `counterpartyLabel`: `"ผู้รับจ้าง"`
  - `buyerLabel`: `"ผู้ว่าจ้าง"` / `"ผู้สั่งจ้าง"`
  - `deliveryObject`: `"งาน"` / `"พัสดุ"`
  - `defaultPenaltyRatePercent`: **`0.10`** (ร้อยละ ๐.๑๐ ต่อวัน, ขั้นต่ำวันละ ๑๐๐ บาท)

> **Critical Rule:** `penaltyRatePercent` must come from ONE field and synchronize identically between `4.1 TOR` (ข้อ 7) and `10 ใบสั่งซื้อ/ใบสั่งจ้าง` (เงื่อนไขข้อ 4). Emit a `WARNING` if the user overrides the default rate for the chosen type.

### 2.3 Inspection Structure (`SINGLE` vs `COMMITTEE_3`)
- **`SINGLE`** (default when `grandTotal <= 100000`): 1 person (`ผู้ตรวจรับพัสดุ`).
- **`COMMITTEE_3`** (required when `grandTotal > 100000`, optional below): 3 persons (`คณะกรรมการตรวจรับพัสดุ`: 1 `ประธานกรรมการ` + 2 `กรรมการ`).
- Validation rule: If `grandTotal > 100000` and `inspectorMode === 'SINGLE'`, emit a **`BLOCKING_ERROR`** (`INSPECTOR_COMMITTEE_REQUIRED`).
- Inspector data (full name, position, role) must propagate identically to `6.1`, `6.2`, `11.1`, `11.2`, and `11.3`.

### 2.4 Official Thai Numeral Policy (100% Consistency)
- Store all numbers internally in standard Arabic digits / JS `number` and dates as ISO `YYYY-MM-DD`.
- Provide dedicated formatting utilities so **all rendered official documents use Thai numerals (`๐๑๒๓๔๕๖๗๘๙`) consistently**—preventing mixed strings like `๒๕70` or `30,๐๐๐`.
- Implement two helpers:
  1. `toThaiDigits(input: string | number): string` — converts every `0-9` to `๐-๙`.
  2. `toThaiOfficialText(input: string, options?: { preserveModelCodes?: boolean }): string` — converts standalone Thai prose numbers, dates, phone numbers, tax IDs, and currency amounts to Thai digits while optionally preserving Latin-adjacent model/product codes (e.g., `Brother BT-5000`, `TN-269`, `D 60`) and emails (`jojo_pencil@hotmail.com`) so technical identifiers stay readable. Default: preserve Latin-attached codes and emails; convert all pure numeric tokens.

---

## 3. File Architecture for Phase 1

Create the following modular structure under `src/lib/procurement/`:

```text
src/lib/procurement/
├── types.ts                  # Inferred TS types & enums
├── schema.ts                 # Zod v4 schemas (MasterData, ProjectInput, DocRegistry)
├── formatting.ts             # toThaiDigits, toThaiOfficialText, toThaiBahtText, Thai date formatters
├── calculations.ts           # VAT 7% reverse-extraction, budget ledger, penalty, item counts, derived fields
├── holidays.ts               # Thai official holidays (B.E. 2568–2572) + working-day calculator
├── numbering.ts              # 5-track document numbering & next-number suggestion engine
├── validator.ts              # Cross-file consistency, chronology, holiday, budget & threshold checks
├── manifest.ts               # Document binder plan (which docs generate vs system/vendor slots, copy counts)
├── presets/
│   └── default-agency.ts     # Seed MasterData (เทศบาลตำบลฉลอง / กองสวัสดิการสังคม)
└── __tests__/
    ├── formatting.test.ts
    ├── calculations.test.ts
    ├── holidays.test.ts
    ├── validator.test.ts
    └── manifest.test.ts
```

---

## 4. Data Model & Zod Schemas (`schema.ts`)

Design a 3-layer data architecture: **MasterData** (reusable) + **ProcurementCaseInput** (per job) -> **ComputedProcurementCase** (pure derived output).

### 4.1 Master Data Schemas

```ts
// 1. Agency & Division Profile
AgencyConfigSchema = z.object({
  municipalityName: z.string(),          // e.g. "เทศบาลตำบลฉลอง"
  officeTitle: z.string(),               // e.g. "สำนักงานเทศบาลตำบลฉลอง"
  divisionName: z.string(),              // e.g. "กองสวัสดิการสังคม"
  sectionName: z.string(),               // e.g. "งานธุรการ"
  subDepartmentFooter: z.string(),       // e.g. "ฝ่ายสังคมสงเคราะห์" (for external letter Doc 9)
  phoneDisplay: z.string(),              // e.g. "0-7638-3775 ต่อ 27, 31"
  phoneShort: z.string(),                // e.g. "076-383775 ต่อ 31"
  fax: z.string(),                       // e.g. "076-378305"
  externalAddressLine: z.string(),       // e.g. "ถนนหลวงพ่อแช่ม ภก 83130"
  deliveryAddressFull: z.string(),       // e.g. "ณ เทศบาลตำบลฉลอง หมู่ที่ 4 ต.ฉลอง อ.เมืองภูเก็ต จ.ภูเก็ต"
  poAgencyAddress: z.string(),           // e.g. "38 ม.4 ต.ฉลอง อ.เมือง จ.ภูเก็ต"
  codes: z.object({
    internalMemoPrefix: z.string(),      // e.g. "ภก 52906"
    externalLetterPrefix: z.string(),    // e.g. "ภก 52806"
    poPrefix: z.string(),                // e.g. "สว"
  }),
});

// 2. Personnel & Signatory Roles
PersonSchema = z.object({
  id: z.string(),
  fullName: z.string(),                  // e.g. "นายกิตตินันท์ พลรบ"
  position: z.string(),                  // e.g. "เจ้าพนักงานธุรการปฏิบัติงาน"
  actingLine: z.string().optional(),     // e.g. "รองนายกเทศมนตรี ปฏิบัติราชการแทน"
  actingTarget: z.string().optional(),   // e.g. "นายกเทศมนตรีตำบลฉลอง"
});

SignatoryChainSchema = z.object({
  procurementOfficer: PersonSchema,      // จนท.พัสดุ / ผู้กำหนดคุณลักษณะเฉพาะฯ
  divisionDirector: PersonSchema,        // ผอ.กอง / หัวหน้าเจ้าหน้าที่
  municipalClerk: PersonSchema,          // ปลัดฯ หรือ รองปลัดฯ ปฏิบัติราชการแทน
  mayor: PersonSchema,                   // นายกฯ หรือ รองนายกฯ ปฏิบัติราชการแทน
});

// 3. Vendor Master
VendorSchema = z.object({
  id: z.string(),
  shopName: z.string(),                  // e.g. "ร้านดินสอสี"
  contactPersonName: z.string(),         // e.g. "นายณัฐวิทย์ แซ่ลิ่ม"
  contactPersonTitle: z.string().default("ผู้จัดการ"),
  businessTypeTag: z.string().default("ขายส่ง,ขายปลีก,ให้บริการ,ผู้ผลิต"),
  address: z.string(),
  phone: z.string(),
  taxId: z.string().regex(/^\d{13}$/),
  isVatRegistered: z.boolean(),          // true = 7% VAT included; false = non-VAT
  isSmeRegistered: z.boolean().default(false),
  smeExpiryDate: z.string().optional(),  // ISO YYYY-MM-DD (warn if expired!)
});

// 4. Budget Line Master
BudgetLineSchema = z.object({
  id: z.string(),
  fiscalYearBE: z.number().int(),        // e.g. 2570
  planName: z.string(),                  // e.g. "แผนงานสังคมสงเคราะห์"
  workName: z.string(),                  // e.g. "งานบริหารทั่วไปเกี่ยวกับสังคมสงเคราะห์"
  categoryGroup: z.string(),             // e.g. "หมวดค่าวัสดุ"
  categoryType: z.string(),              // e.g. "วัสดุสำนักงาน" or "วัสดุคอมพิวเตอร์"
  allocatedAmount: z.number().nonnegative(),
  transferInAmount: z.number().nonnegative().default(0),
  transferOutAmount: z.number().nonnegative().default(0),
});
```

### 4.2 Procurement Case Input Schema (`ProcurementCaseInputSchema`)

```ts
LineItemSchema = z.object({
  id: z.string(),
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  unitPrice: z.number().nonnegative(),   // VAT-inclusive unit price if vendor is VAT-registered
});

InspectorMemberSchema = z.object({
  personId: z.string().optional(),
  fullName: z.string().min(1),
  position: z.string().min(1),
  role: z.enum(["INSPECTOR", "CHAIRPERSON", "MEMBER"]),
});

DocumentNumberAndDateSchema = z.object({
  // Track 1: Internal Division Memos (ภก 52906/xxxx)
  doc1_approvePrinciple: z.object({ runningNo: z.string(), date: ISODateSchema }),
  doc2_assignSpec: z.object({ runningNo: z.string(), date: ISODateSchema }),
  doc3_reportSpec: z.object({ runningNo: z.string(), date: ISODateSchema }),
  doc6_1_purchaseRequest: z.object({ runningNo: z.string().optional(), date: ISODateSchema.optional() }),
  doc7_evalReport: z.object({ runningNo: z.string().optional(), date: ISODateSchema.optional() }),
  doc11_1_inspectionReport: z.object({ runningNo: z.string().optional(), date: ISODateSchema.optional() }),
  doc12_finalSummary: z.object({ runningNo: z.string().optional(), date: ISODateSchema.optional() }),
  doc13_disbursement: z.object({ runningNo: z.string().optional(), date: ISODateSchema.optional() }),

  // Track 2: Municipal Order (xxxx/25xx)
  doc6_2_inspectorOrder: z.object({
    runningNo: z.string().optional(),    // e.g. "2295"
    yearBE: z.number().int().optional(), // e.g. 2569
    date: ISODateSchema.optional(),
  }),

  // Track 3: Announcement Registry (logged in book only, not printed on doc 8)
  doc8_winnerAnnouncement: z.object({
    registryLogNo: z.string().optional(),
    date: ISODateSchema.optional(),
  }),

  // Track 4: External Letter (ภก 52806/xxxx)
  doc9_contractNotice: z.object({
    runningNo: z.string().optional(),
    date: ISODateSchema.optional(),
  }),

  // Track 5: Purchase/Hire Order (สว xx/25xx)
  doc10_purchaseOrder: z.object({
    runningNo: z.string().optional(),    // e.g. "13"
    fiscalYearBE: z.number().int().optional(), // e.g. 2570
    date: ISODateSchema.optional(),
  }),

  // External System References (LAAS / e-GP)
  laasPurchaseReportNo: z.string().optional(),   // e.g. "70-45-00231-5330100-00005"
  laasContractNo: z.string().optional(),         // e.g. "CNTR-00195/70"
  laasDate: ISODateSchema.optional(),
  egpProjectNo: z.string().optional(),
  inspectionControlNo: z.string().optional(),    // "เลขคุมตรวจรับ" (blank or "-" if none)
});

ProcurementCaseInputSchema = z.object({
  id: z.string(),
  procurementType: z.enum(["BUY", "HIRE"]),
  workflowModeOverride: z.enum(["AUTO", "MANUAL_UNDER_5000", "EGP_OVER_5000"]).default("AUTO"),
  budgetLine: BudgetLineSchema,
  budgetSpentBefore: z.number().nonnegative(),
  projectTitleShort: z.string().optional(),      // defaults to budgetLine.categoryType
  purposeText: z.string(),                       // default standard municipal purpose
  items: z.array(LineItemSchema).min(1),
  vendor: VendorSchema,
  deliveryDays: z.number().int().positive().default(3),
  warrantyYears: z.number().nonnegative().nullable().default(null), // null -> "-"
  penaltyRatePercent: z.number().positive().optional(),             // auto-default 0.20 (BUY) / 0.10 (HIRE)
  minPenaltyPerDay: z.number().nonnegative().default(100),
  inspectorMode: z.enum(["SINGLE", "COMMITTEE_3"]).default("SINGLE"),
  inspectors: z.array(InspectorMemberSchema).min(1),
  inspectionResult: z.object({
    isCorrect: z.boolean().default(true),
    isComplete: z.boolean().default(true),
    hasPenalty: z.boolean().default(false),
    deliveryDate: ISODateSchema.optional(),      // defaults to doc11_1 date
  }),
  signatories: SignatoryChainSchema,
  docs: DocumentNumberAndDateSchema,
  attachments: z.object({
    photoPaths: z.array(z.string()).default([]),
    photoCaptionOverride: z.string().optional(),
  }).default({ photoPaths: [] }),
});
```

---

## 5. Deterministic Calculation Engine (`calculations.ts` & `formatting.ts`)

### 5.1 Financial & VAT Calculations
- **Line Total:** `lineTotal = round2(item.quantity * item.unitPrice)`
- **Grand Total:** `grandTotal = round2(sum(lineTotals))`
- **VAT Reverse-Extraction (`vendor.isVatRegistered === true`):**
  - `subtotalExclVat = round2((grandTotal * 100) / 107)`
  - `vatAmount = round2(grandTotal - subtotalExclVat)`
  - **Invariant:** `round2(subtotalExclVat + vatAmount) === grandTotal` MUST ALWAYS HOLD.
  - Reference test vectors from real municipal cases:
    - `1520.00` -> `subtotalExclVat = 1420.56`, `vatAmount = 99.44`
    - `22890.00` -> `subtotalExclVat = 21392.52`, `vatAmount = 1497.48`
- **Non-VAT Vendor (`vendor.isVatRegistered === false`):**
  - `subtotalExclVat = grandTotal`, `vatAmount = 0`

### 5.2 Budget Ledger Calculations
- `totalBudget = allocatedAmount + transferInAmount - transferOutAmount`
- `budgetRemainingBefore = round2(totalBudget - budgetSpentBefore)`
- `budgetRemainingAfter = round2(budgetRemainingBefore - grandTotal)`

### 5.3 Thai Baht Text Converter (`toThaiBahtText`)
Implement an exact, dependency-free Thai baht text converter supporting up to hundreds of millions + satang:
- `1520` -> `"หนึ่งพันห้าร้อยยี่สิบบาทถ้วน"`
- `22890` -> `"สองหมื่นสองพันแปดร้อยเก้าสิบบาทถ้วน"`
- `30000` -> `"สามหมื่นบาทถ้วน"`
- `101.50` -> `"หนึ่งร้อยเอ็ดบาทห้าสิบสตางค์"`
- `21.25` -> `"ยี่สิบเอ็ดบาทยี่สิบห้าสตางค์"`
- `0` -> `"ศูนย์บาทถ้วน"`
- Must properly handle `เอ็ด` (1 in units place when tens/higher exist), `ยี่` (2 in tens place), `สิบ` (omit `หนึ่ง` in tens place), and multi-million grouping (`ล้าน`).

### 5.4 Thai Official Date Formatters
- Full formal date: `2026-11-18` -> `"๑๘ พฤศจิกายน ๒๕๖๙"`
- Signature date (PO Doc 10): `2026-11-18` -> `"วันที่ ๑๘ เดือนพฤศจิกายน พ.ศ. ๒๕๖๙"`
- Order/Announcement date: `2026-11-17` -> `"๑๗ พฤศจิกายน ๒๕๖๙"`
- Auto-convert CE year (`YYYY`) to BE year (`YYYY + 543`).

### 5.5 Due Date & Working Day Logic (`holidays.ts`)
- Include a static, extensible calendar of official Thai public holidays for **B.E. 2568–2572 (2025–2029)** (New Year, Makha Bucha, Chakri, Songkran, Coronation, Visakha Bucha, Queen Suthida's Birthday, Asalha Bucha, King's Birthday, Queen Mother's Birthday, Navamindra Day, Chulalongkorn Day, Father's Day, Constitution Day, New Year's Eve, plus observed substitute holidays).
- `isWorkingDay(isoDate)`: returns `false` for Saturday, Sunday, or any holiday in the calendar.
- `nextWorkingDay(isoDate)`: advances day-by-day until `isWorkingDay` is `true`.
- `calculateDeliveryDueDate(poDate, deliveryDays)`:
  - Raw due date = `poDate + deliveryDays` calendar days (counting from the day after signing PO: "นับถัดจากวันลงนามในใบสั่งซื้อ").
  - If `rawDueDate` is NOT a working day (e.g., Sunday `2026-11-22`), compute `effectiveDueDate = nextWorkingDay(rawDueDate)` (Monday `2026-11-23`) and flag `shiftedForHoliday: true`.

---

## 6. Validation & Smart Alert Engine (`validator.ts`)

Return structured issues with severity: `'ERROR' | 'WARNING' | 'INFO'`:

```ts
export interface ValidationIssue {
  code: string;
  severity: "ERROR" | "WARNING" | "INFO";
  docIds: string[];           // e.g. ["6.1", "7"]
  field?: string;
  messageTh: string;          // Clear, actionable Thai message for the officer
  suggestedFix?: string;      // Optional auto-fix value
}
```

### Mandatory Validation Rules to Implement
1. **Budget Sufficiency (`BUDGET_EXCEEDED` - ERROR):** `grandTotal > budgetRemainingBefore`.
2. **Committee Threshold (`INSPECTOR_COMMITTEE_REQUIRED` - ERROR):** `grandTotal > 100000 && inspectorMode === 'SINGLE'`, or `inspectorMode === 'COMMITTEE_3'` without exactly 1 `CHAIRPERSON` + 2 `MEMBER`s.
3. **Penalty Rate Mismatch (`PENALTY_RATE_NONSTANDARD` - WARNING):** Warn if `BUY` != `0.20%` or `HIRE` != `0.10%`.
4. **Internal Memo Running Number Order (`MEMO_NUMBER_OUT_OF_ORDER` - ERROR):**
   - Active docs on Track 1 (`ภก 52906/...`) must strictly ascend numerically:
     `doc1 < doc2 < doc3 < doc6_1 < doc7 < doc11_1 < doc12 < doc13`
   - Catch duplicates or backward numbers (e.g., Doc 7 having `1465` after Doc 6.1 has `1484`).
5. **Chronological Date Order (`DATE_OUT_OF_ORDER` - ERROR):**
   - `doc1.date <= doc2.date <= doc3.date`
   - `doc3.date <= (laasDate ?? doc6_1.date) <= doc6_1.date`
   - `doc6_1.date <= doc6_2.date`, `doc6_1.date <= doc7.date`, `doc7.date <= doc8.date`, `doc7.date <= doc9.date`
   - `doc9.date <= doc10.date <= doc11_1.date <= doc12.date <= doc13.date`
6. **Weekend / Public Holiday Check (`DATE_ON_NON_WORKING_DAY` - WARNING):**
   - Check EVERY document date. If any falls on Sat/Sun or a Thai holiday, warn with the holiday/weekday name and suggest the nearest next working day.
7. **Delivery Due Date Check (`DUE_DATE_ON_HOLIDAY` - INFO/WARNING):**
   - Notify when raw `poDate + deliveryDays` falls on a weekend/holiday and confirm automatic shift to `effectiveDueDate`.
8. **Late Delivery Penalty Trigger (`LATE_DELIVERY_PENALTY_CHECK` - WARNING):**
   - If `deliveryDate > effectiveDueDate` and `inspectionResult.hasPenalty === false`, warn and calculate exact late days and daily fine `max(grandTotal * penaltyRatePercent / 100, minPenaltyPerDay)`.
9. **Vendor SME Certificate Expiry (`VENDOR_SME_EXPIRED` - WARNING):**
   - If `vendor.isSmeRegistered` and `vendor.smeExpiryDate < doc3.date`, warn that the SME certificate is expired.
10. **External Document Stamp Reminders (`EXTERNAL_STAMP_REMINDER` - INFO):**
    - Always emit clear reminders for physical/external documents:
      - `4.2 ใบเสนอราคาผู้ชนะ` & `11.5 ใบเสนอราคาคู่เทียบ (2 ร้าน)` -> ปั๊มวันที่เดียวกับข้อ 3 (`doc3.date`)
      - `11.4 บิลส่งของร้านค้า` -> ลงวันที่เดียวกับใบตรวจรับ (`doc11_1.date`)

---

## 7. Binder Manifest & Copy Plan (`manifest.ts`)

Create `buildBinderManifest(computedCase)` returning an ordered array of binder entries matching the official filing order (`การเรียงแฟ้ม`):

| Step | Doc ID | Title | Mode `<= 5,000` Source | Mode `> 5,000` (e-GP) Source | Print Copies |
| :--- | :--- | :--- | :--- | :--- | :---: |
| 1 | `1` | บันทึกข้อความ ขออนุมัติจัดซื้อ/จัดจ้างตามระเบียบพัสดุ | `GENERATED` | `GENERATED` | 1 |
| 2 | `2` | บันทึกข้อความ ขออนุมัติมอบหมายกำหนดคุณลักษณะเฉพาะ | `GENERATED` | `GENERATED` | 1 |
| 3 | `3` | บันทึกข้อความ รายงานผลการจัดทำรายละเอียดคุณลักษณะเฉพาะ | `GENERATED` | `GENERATED` | 1 |
| 4 | `4.1` | รายละเอียดคุณลักษณะเฉพาะ (TOR) | `GENERATED` | `GENERATED` | 1 |
| 5 | `4.2` | ใบเสนอราคาผู้ชนะ (ราคากลาง) | `VENDOR_EXTERNAL` | `VENDOR_EXTERNAL` | 1 |
| 6 | `5.1` | รายงานขอซื้อ/ขอจ้างพัสดุ (LAAS) | `LAAS_EXTERNAL` | `LAAS_EXTERNAL` | 1 |
| 7 | `5.2` | บันทึกข้อตกลง (LAAS) | `LAAS_EXTERNAL` | `LAAS_EXTERNAL` | 1 |
| 8 | `6.1` | บันทึกข้อความ รายงานขอซื้อ/ขอจ้าง (+ เอกสารแนบท้ายถ้ามี) | `GENERATED` | `EGP_EXTERNAL` | 1 |
| 9 | `6.2` | คำสั่งเทศบาล แต่งตั้งผู้ตรวจรับ/คณะกรรมการตรวจรับพัสดุ | `GENERATED` | `EGP_EXTERNAL` | 3 |
| 10 | `7` | บันทึกข้อความ รายงานผลการพิจารณาและขออนุมัติสั่งซื้อ/สั่งจ้าง | `GENERATED` | `EGP_EXTERNAL` | 1 |
| 11 | `8` | ประกาศเทศบาล เรื่อง ประกาศผู้ชนะการเสนอราคา | `GENERATED` | `EGP_EXTERNAL` | 3 |
| 12 | `9` | หนังสือภายนอก แจ้งลงนามในสัญญา | `GENERATED` | `EGP_EXTERNAL` | 3 |
| 13 | `10` | ใบสั่งซื้อ / ใบสั่งจ้าง | `GENERATED` | `EGP_EXTERNAL` | 2 |
| 14 | `11.1` | บันทึกข้อความ รายงานผลการตรวจรับพัสดุ | `GENERATED` | `GENERATED` | 1 |
| 15 | `11.2` | ใบตรวจรับการจัดซื้อ/จัดจ้าง | `GENERATED` | `EGP_EXTERNAL` | 2 |
| 16 | `11.3` | รูปภาพประกอบการตรวจรับ | `GENERATED` | `GENERATED` | 1 |
| 17 | `11.4` | บิลส่งของร้านค้า | `VENDOR_EXTERNAL` | `VENDOR_EXTERNAL` | 1 |
| 18 | `11.5` | ทะเบียนพาณิชย์ + บัตร ปชช. + SME + ใบเสนอราคาคู่เทียบ | `VENDOR_EXTERNAL` | `VENDOR_EXTERNAL` | 1 |
| 19 | `12` | บันทึกข้อความ รายงานผลการพิจารณารายละเอียดวิธีการฯ (ส่งตั้งหนี้) | `GENERATED` | `EGP_EXTERNAL` | 1 |
| 20 | `13` | บันทึกข้อความ ขออนุมัติเบิกจ่ายเงิน + เอกสาร LAAS วางฎีกา | `GENERATED` | `EGP_EXTERNAL` | 1 |

---

## 8. Acceptance Criteria & Verification Commands

Before completing Phase 1, Codex MUST write and pass Vitest suites covering:
1. **Set 1 Fixture (`1,520.00` THB, 2 items, BUY, VAT):** verifies `MANUAL_UNDER_5000`, VAT split (`1420.56` / `99.44`), Baht text, Thai digits, 0 errors.
2. **Set 2 Fixture (`22,890.00` THB, 7 items, BUY, VAT):** verifies `EGP_OVER_5000`, VAT split (`21392.52` / `1497.48`), only `1, 2, 3, 4.1, 11.1, 11.3` marked `GENERATED`, Sunday due-date (`2026-11-22`) detected and shifted to Monday `2026-11-23`.
3. **Fault Injection Tests:**
   - Out-of-order memo numbers (`doc6_1 = 1484`, `doc7 = 1465`) -> triggers `MEMO_NUMBER_OUT_OF_ORDER`.
   - `grandTotal > 100000` with `SINGLE` inspector -> triggers `INSPECTOR_COMMITTEE_REQUIRED`.
   - Non-VAT vendor -> `vatAmount === 0`, `subtotalExclVat === grandTotal`.
   - `HIRE` mode -> default penalty rate `0.10%` vs `BUY` mode `0.20%`.

Run and ensure 100% pass:
```bash
npm run typecheck
npm test
```