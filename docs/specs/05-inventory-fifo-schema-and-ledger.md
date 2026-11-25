# Phase 5: Division Inventory (FIFO Ledger), 18-Category Standard Catalog & Two-Phase Requisition Domain

> **Target Repository:** `sarabun-workspace` (Next.js 16.4, TypeScript 5.9, Zod 4.6, Vitest 5)
> **Prerequisite:** Phases 1–4 (`src/lib/procurement/`) are implemented and passing `npm run typecheck && npm test`.
> **Objective:** Build the deterministic domain engine for a Municipal Division Supply Officer (เจ้าหน้าที่พัสดุประจำกอง) tailored to **เทศบาลตำบลฉลอง (กองสวัสดิการสังคม)** covering:
> 1. **Official 18-Category Material & Unit Catalog (`01`–`18`)** — standard Thai government material categories and units for consistent naming across Procurement and Inventory.
> 2. **Material Master & Multi-Lot Stock-In (`StockLot`)** — includes full Thai Stock Card metadata (`ลำดับที่`, `ขนาดหรือลักษณะ`, `ที่เก็บ`, `จำนวนอย่างสูง/อย่างต่ำ`) and 1-click intake from completed Procurement cases (`Doc 11.1`).
> 3. **Hybrid Two-Phase Requisition & Strict FIFO Engine** — reserves stock when printing the physical `ใบเบิกวัสดุ` (`PENDING_SIGNATURE`), supports separate `ผู้เบิก` and `ผู้รับของ`, splits quantities accurately across price-differentiated lots, and commits actual ledger deductions (`COMMITTED`) only after signed paper forms return.
> 4. **Immutable Official Stock Card Ledger (`บัญชีวัสดุ`)** — auto-populates standard accounting remarks (`บันทึกบัญชีเดบิท` for opening/in, `ค่าวัสดุใช้ไป` for out) and eliminates manual running-balance arithmetic errors.
> 5. **Division Fixed-Asset Registry, Loans & Fiscal Year-End Reconciliation (ระเบียบฯ พ.ศ. 2560 ข้อ 213)**.

---

## 1. File Architecture (`src/lib/inventory/`)

```text
src/lib/inventory/
├── types.ts                        # Inferred TypeScript types & status enums
├── schema.ts                       # Zod v4 schemas (MaterialItem, StockLot, Requisition, LedgerEntry, AssetItem, AssetLoan)
├── catalog/
│   └── standard-units.ts           # Official 18 categories (01–18), standard items & units, search/autocomplete helper
├── fifo-engine.ts                  # Pure FIFO allocator (preview, reserve, commit, cancel), multi-lot splitting
├── procurement-bridge.ts           # Maps completed ProcurementCaseInput (Doc 11.1) -> StockLot[] intake draft
├── reports.ts                      # Stock Card rows (with running balance & page/sheet metadata), Quarterly/Annual Cut-Off & Audit (ข้อ 213)
├── repository.ts                   # Persistence adapter matching existing sarabun-workspace storage pattern
└── __tests__/
    ├── catalog.test.ts             # Verifies all 18 categories & unit lookup
    ├── fifo-engine.test.ts         # Multi-lot split, reservation blocking, separate receiver, cancel rollback
    ├── procurement-bridge.test.ts  # Auto-import from Set 1 (1,520 THB) & Set 2 (22,890 THB)
    └── fiscal-year-sim.test.ts     # Full 1-year simulation (FY 2569: A4 multi-lot FIFO + Post-it 65->48 THB depletion)
```

---

## 2. Official 18-Category Standard Catalog (`catalog/standard-units.ts`)

Seed all **18 official Thai government material categories** (`code: "01"` to `"18"`):

| Code | Category Name (`categoryName`) | Representative Seed Items & Standard Units (`allowedUnits`) |
| :---: | :--- | :--- |
| `01` | วัสดุสำนักงาน | กระดาษ (`แพค`, `รีม`), หมึก (`ตลับ`, `ขวด`), ดินสอ (`แท่ง`), ปากกา (`แท่ง`), ยางลบ (`ก้อน`), เทปกาว (`ม้วน`), ลวดเย็บกระดาษ (`กล่อง`), แฟ้ม (`แฟ้ม`), กระดาษโน้ต/โพสอิท (`แพค`, `แผง`), กล่องพลาสติก (`กล่อง`, `ใบ`), ตรายาง (`ชิ้น`, `อัน`) |
| `02` | วัสดุไฟฟ้าและวิทยุ | ไมโครโฟน (`ตัว`), หลอดไฟฟ้า (`หลอด`), สายไฟฟ้า (`เมตร`), ปลั๊กไฟฟ้า (`ตัว`), เบรกเกอร์ (`ตัว`), ถ่าน/แบตเตอรี่ (`ก้อน`), สายรัด Cable tie (`ถุง`), หัวแลน (`ถุง`) |
| `03` | วัสดุงานบ้านงานครัว | ผงซักฟอก (`ถุง`), สบู่ (`ก้อน`), น้ำยาดับกลิ่น/น้ำยาทำความสะอาด (`ขวด`), กระดาษชำระ (`ม้วน`), ถุงขยะ (`แพค`), ถังขยะ (`ถัง`), ไม้กวาด (`ด้าม`), ไม้ถูพื้น (`อัน`), ฟองน้ำ (`ก้อน`), น้ำดื่ม (`ขวด`) |
| `04` | วัสดุก่อสร้าง | ตลับเมตร (`อัน`, `ตลับ`), สี (`ถัง`, `กระป๋อง`), ปูนซีเมนต์ (`กระสอบ`), ท่อน้ำและอุปกรณ์ประปา (`ชิ้น`), ตะปู/สกรู (`ตัว`, `กล่อง`), ก๊อกน้ำ (`อัน`), ซิลิโคน (`หลอด`) |
| `05` | วัสดุยานพาหนะและขนส่ง | น้ำมันเบรก (`ขวด`), ใบปัดน้ำฝน (`ใบ`), ยางรถยนต์ (`เส้น`), แบตเตอรี่ (`ลูก`), กรวยจราจร (`กรวย`, `อัน`), เสื้อกั๊กสะท้อนแสง (`ตัว`) |
| `06` | วัสดุเชื้อเพลิงและหล่อลื่น | แก๊สหุงต้ม (`ถัง`), น้ำมันดีเซล (`ลิตร`), น้ำมันเบนซิน/แก๊สโซฮอล์ (`ลิตร`), น้ำมันเครื่อง (`ลิตร`), สเปรย์หล่อลื่น (`กระป๋อง`) |
| `07` | วัสดุวิทยาศาสตร์ | สำลีและผ้าพันแผล (`แพค`), แอลกอฮอล์/เจลแอลกอฮอล์ (`ขวด`), ถุงมือ (`คู่`), ผ้าปิดปาก/หน้ากาก (`อัน`, `กล่อง`), ชุดตรวจ (`ชุด`) |
| `08` | วัสดุการเกษตร | ปุ๋ย (`ถุง`), ดิน (`ถุง`), สายยาง (`เส้น`), กระถาง (`ใบ`), กรรไกรตัดกิ่ง (`อัน`), รองเท้าบูท (`คู่`) |
| `09` | วัสดุโฆษณาและเผยแพร่ | ขาตั้งกล้อง (`อัน`), ป้ายโรลอัพ/ป้ายโฆษณา (`ชุด`), โทรโข่ง (`ตัว`), แบตเตอรี่กล้อง (`ก้อน`), กระดาษโปสเตอร์ (`แผ่น`), ลำโพงขนาดเล็ก (`ตัว`) |
| `10` | วัสดุเครื่องแต่งกาย | เครื่องแบบ (`ชุด`), เสื้อ/กางเกง (`ตัว`), รองเท้า (`คู่`), หมวก (`ใบ`), ป้ายพลาสติกติดหน้าอก (`ชิ้น`), ชุดไทยธรรม (`ชุด`) |
| `11` | วัสดุกีฬา | ลูกฟุตบอล (`ลูก`), ลูกเปตอง (`ลูก`), นกหวีด (`อัน`), กรวยฝึกซ้อม (`อัน`, `ชุด`), ตาข่ายกีฬา (`ผืน`) |
| `12` | วัสดุคอมพิวเตอร์ | ตลับผงหมึกสำหรับเครื่องพิมพ์ (`กล่อง`, `ตลับ`), หมึกเครื่องพิมพ์ (`ขวด`), สายแลน (`เส้น`, `กล่อง`), เมาส์ (`อัน`), แป้นพิมพ์ (`อัน`), แผ่นรองเมาส์ (`แผ่น`), Flash drive (`อัน`), SSD (`ลูก`), แบตเตอรี่สำรองไฟ (`ลูก`), USB Hub (`ชิ้น`) |
| `13` | วัสดุการศึกษา | สื่อการเรียนการสอน (`ชิ้น`), หุ่น (`ชิ้น`), รหัสเข้าสอบ/License (`สิทธิ์`, `License`) |
| `14` | วัสดุดับเพลิง | ถังดับเพลิง (`ถัง`), ลูกบอลดับเพลิง (`ลูก`), เคมีภัณฑ์ดับเพลิง (`ถุง`) |
| `15` | วัสดุสนาม | เต็นท์สนาม (`หลัง`), ถุงนอน (`ถุง`), เปล (`เปล`), เตียงสนาม (`อัน`) |
| `16` | วัสดุสำรวจ | บันไดอลูมิเนียม (`อัน`), ตลับเมตร (`อัน`, `ตลับ`), เสากั้นเขตแดน (`ชุด`) |
| `17` | วัสดุดนตรี | ฉิ่ง (`คู่`), ฉาบ (`คู่`), ขลุ่ย (`เลา`), ไม้กลอง (`คู่`), สายกีตาร์ (`เส้น`) |
| `18` | วัสดุอื่น | หน้ากากอนามัย (`กล่อง`), ชุด PPE (`ชุด`), ทิชชูเปียก (`แพ็ค`), Power Bank (`อัน`), คูหาเลือกตั้ง (`คูหา`), หีบเลือกตั้ง (`ใบ`), เทปกั้นเขต (`ม้วน`) |

Export helper:
- `MATERIAL_CATEGORIES`: all 18 categories (`01`–`18`).
- `searchStandardCatalog(query: string, categoryCode?: string)`: fuzzy Thai/English search returning `{ categoryCode, categoryName, itemName, suggestedUnits: string[] }[]`. Allow custom user units (e.g. `แผง`, `ตลับ`) while surfacing standard units first.

---

## 3. Core Data Schemas (`schema.ts`)

### 3.1 Material Master (Aligned with Official Stock Card Header)
```ts
export const MaterialItemSchema = z.object({
  id: z.string(),
  ledgerSeqNo: z.number().int().positive(), // ลำดับที่ในเล่มทะเบียนวัสดุ e.g. 28
  code: z.string().default(""),             // รหัสวัสดุ (optional if agency leaves blank)
  name: z.string().min(1),                  // ชื่อหรือชนิดวัสดุ e.g. "กระดาษโพสอิท คั่นหน้า กองสวัสดิการสังคม"
  categoryCode: z.string().regex(/^(0[1-9]|1[0-8])$/), // "01".."18"
  categoryType: z.string().min(1),          // ประเภท e.g. "วัสดุสำนักงาน", "วัสดุคอมพิวเตอร์"
  specification: z.string().default(""),    // ขนาดหรือลักษณะ e.g. "เนื้อเทป ขนาด 0.5 x 1.7 นิ้ว"
  unit: z.string().min(1),                  // หน่วยที่นับ e.g. "แผง", "รีม", "ขวด"
  storageLocation: z.string().default("กองสวัสดิการสังคม"), // ที่เก็บ
  maxStockQty: z.number().nonnegative().nullable().default(null), // จำนวนอย่างสูง
  minStockQty: z.number().nonnegative().default(5),               // จำนวนอย่างต่ำ (Reorder alert threshold)
});
```

### 3.2 Stock Lots (FIFO Price Layers)
```ts
export const StockLotSchema = z.object({
  id: z.string(),                           // e.g. "LOT-69-01"
  materialId: z.string(),
  fiscalYearBE: z.number().int(),           // e.g. 2569
  receivedDate: ISODateSchema,              // FIFO sort key #1 (ASC)
  createdOrder: z.number().int(),           // FIFO sort key #2 tie-breaker (ASC)
  sourceType: z.enum(["OPENING_BALANCE", "PROCUREMENT_PO", "TRANSFER_IN", "DONATION"]),
  sourceLabel: z.string(),                  // "ยอดยกมา" or "รับจาก (ร้านดินสอสี)"
  referenceDocNo: z.string(),               // "ปี 2568", "สว 05/2569", "107/5339"
  sourceProcurementCaseId: z.string().optional(),
  unitPrice: z.number().nonnegative(),      // VAT-inclusive unit cost
  initialQty: z.number().positive(),
  remainingQty: z.number().nonnegative(),   // Physically unissued quantity
  reservedQty: z.number().nonnegative().default(0), // Locked by PENDING_SIGNATURE requisitions
});
```
- `availableQty(lot) = lot.remainingQty - lot.reservedQty`.

### 3.3 Hybrid Two-Phase Requisition (`ใบเบิกวัสดุ`)
```ts
export const RequisitionAllocationSchema = z.object({
  lotId: z.string(),
  referenceDocNo: z.string(),
  unitPrice: z.number().nonnegative(),
  allocatedQty: z.number().positive(),
  lineAmount: z.number().nonnegative(),     // round2(allocatedQty * unitPrice)
  balanceAfterThisSplit: z.number().nonnegative(), // Remaining total qty of material right after this row (for "คงเหลือ" column!)
});

export const RequisitionLineSchema = z.object({
  id: z.string(),
  materialId: z.string(),
  requestedQty: z.number().positive(),
  approvedQty: z.number().nonnegative(),
  allocations: z.array(RequisitionAllocationSchema), // Auto-computed FIFO lot splits
  remarkOverride: z.string().optional(),
});

export const RequisitionSchema = z.object({
  id: z.string(),
  requisitionRunningNo: z.string(),         // e.g. "01" -> displays as "๐๑/๒๕๖๙"
  fiscalYearBE: z.number().int(),           // e.g. 2569
  requestDate: ISODateSchema,
  requesterName: z.string().min(1),         // ผู้เบิก e.g. "นางสาวณกัญญา ดีเบา"
  requesterPosition: z.string().min(1),     // ตำแหน่ง
  receiverName: z.string().optional(),      // ผู้รับของ (defaults to requesterName if blank; supports proxy pickup!)
  purpose: z.string().default("เพื่อใช้ในการปฏิบัติราชการ งานกองสวัสดิการสังคม เทศบาลตำบลฉลอง"),
  status: z.enum([
    "DRAFT",
    "PENDING_SIGNATURE",                    // Printed ใบเบิกวัสดุ; stock reserved, waiting for 4 signatures
    "COMMITTED",                            // Signed paper returned; stock permanently deducted & posted to บัญชีวัสดุ
    "CANCELLED",                            // Released reserved stock
  ]),
  lines: z.array(RequisitionLineSchema).min(1),
  committedDate: ISODateSchema.optional(),
  signedScanAttachmentPath: z.string().optional(),
});
```

### 3.4 Official Stock Card Ledger (`บัญชีวัสดุ` Immutable Rows)
```ts
export const StockLedgerEntrySchema = z.object({
  id: z.string(),
  materialId: z.string(),
  fiscalYearBE: z.number().int(),
  entryDate: ISODateSchema,
  partyDescription: z.string(),             // "ยอดยกมา", "รับจาก (ร้านดินสอสี)", "จ่ายให้ นางสาวณกัญญา ดีเบา"
  docNo: z.string(),                        // "ปี 2568", "01/2569", "สว 05/2569"
  lotId: z.string(),
  unitPrice: z.number().nonnegative(),
  inQty: z.number().nonnegative().default(0),
  inAmount: z.number().nonnegative().default(0),
  outQty: z.number().nonnegative().default(0),
  outAmount: z.number().nonnegative().default(0),
  balanceQty: z.number().nonnegative(),     // Exact system-computed running balance (zero manual math error!)
  balanceAmount: z.number().nonnegative(),  // Exact FIFO remaining valuation after this entry
  accountingNote: z.string(),               // Auto: "บันทึกบัญชีเดบิท" (in/opening) | "ค่าวัสดุใช้ไป" (out)
});
```

### 3.5 Division Fixed-Asset Registry & Loans (`AssetItemSchema`, `AssetLoanSchema`)
```ts
export const AssetItemSchema = z.object({
  id: z.string(),
  assetCode: z.string().min(1),             // เลขครุภัณฑ์ e.g. "7440-001-0005/68"
  name: z.string().min(1),
  brandModel: z.string().default(""),
  acquiredDate: ISODateSchema,
  acquisitionCost: z.number().nonnegative(),
  assignedLocation: z.string().default("กองสวัสดิการสังคม"),
  custodianName: z.string().min(1),
  condition: z.enum(["GOOD", "DAMAGED_REPAIRABLE", "UNSERVICEABLE_DISPOSE", "MISSING"]),
  note: z.string().default(""),
});

export const AssetLoanSchema = z.object({
  id: z.string(),
  loanRunningNo: z.string(),                // e.g. "01" -> "ยค. ๐๑/๒๕๖๙"
  fiscalYearBE: z.number().int(),
  assetId: z.string(),
  borrowerName: z.string().min(1),
  borrowerPosition: z.string().min(1),
  borrowerDepartment: z.string().min(1),
  purpose: z.string().min(1),
  loanDate: ISODateSchema,
  dueReturnDate: ISODateSchema,
  actualReturnDate: ISODateSchema.optional(),
  conditionBefore: z.string().default("ปกติ ใช้งานได้"),
  conditionAfter: z.string().optional(),
  status: z.enum(["PENDING_SIGNATURE", "ACTIVE_LOAN", "RETURNED", "CANCELLED"]),
});
```

---

## 4. Strict FIFO & Two-Phase Commit Engine (`fifo-engine.ts`)

1. **Deterministic FIFO Sort:**
   Sort lots for `materialId` by `receivedDate ASC`, then `createdOrder ASC`, then `id ASC`.
2. **`previewFifoAllocation(lots, materialId, requestedQty)`:**
   - Computes total current available stock (`totalAvailable`) before allocation.
   - Walks sorted lots with `availableQty > 0`, consuming `take = Math.min(availableQty, remainingNeeded)`.
   - Tracks running `balanceAfterThisSplit` after each split row so the official Chalong `ใบเบิกวัสดุ` column **`คงเหลือ`** displays the exact post-issue stock balance for the Director to verify before signing.
   - Throws typed `InsufficientStockError` if `requestedQty > totalAvailable`.
3. **State Transitions (`transitionRequisitionStatus`):**
   - `SUBMIT_FOR_SIGNATURE` (`DRAFT -> PENDING_SIGNATURE`): Locks `lot.reservedQty += allocatedQty` on each matched lot and freezes `allocations`.
   - `COMMIT_AFTER_SIGNATURE` (`PENDING_SIGNATURE -> COMMITTED`):
     - Permanently deducts `lot.reservedQty -= allocatedQty` and `lot.remainingQty -= allocatedQty`.
     - Appends one `StockLedgerEntry` per lot split with:
       - `partyDescription = "จ่ายให้ " + requisition.requesterName`
       - `docNo = requisition.requisitionRunningNo + "/" + requisition.fiscalYearBE`
       - `accountingNote = "ค่าวัสดุใช้ไป"`
       - Exact recomputed `balanceQty` and `balanceAmount` across all active lots of that material.
   - `CANCEL` (`PENDING_SIGNATURE -> CANCELLED`): Releases `lot.reservedQty -= allocatedQty` safely without altering `remainingQty`.
   - **Audit Immutability:** Forbid direct edits or deletion of `COMMITTED` requisitions.
4. **Stock-In (`recordStockIntake`):**
   - Creates a new `StockLot` (`OPENING_BALANCE` or `PROCUREMENT_PO`) and appends a `StockLedgerEntry` with:
     - `accountingNote = "บันทึกบัญชีเดบิท"`
     - `partyDescription = sourceType === "OPENING_BALANCE" ? "ยอดยกมา" : sourceLabel` (e.g. `"รับจาก (ร้านดินสอสี)"`).

---

## 5. Procurement-to-Inventory Bridge (`procurement-bridge.ts`)

Implement `mapProcurementCaseToStockIntake(computedCase, existingMaterials)`:
- Converts `computedCase.items` from a completed procurement case (using `Doc 10` PO number e.g. `สว ๑๓/๒๕๗๐` and `Doc 11.1` inspection date) into pre-filled `StockIntakeDraft[]`.
- Auto-matches existing `MaterialItem` by normalized name + unit; suggests `categoryCode` & standard `unit` from `catalog/standard-units.ts` for new items.
- Prevents duplicate intake by checking if `sourceProcurementCaseId` was already imported.

---

## 6. Reconciliation & Required Vitest Suites (`fiscal-year-sim.test.ts`)

Implement `buildFiscalYearSummary(state, fiscalYearBE)` asserting the accounting invariant for every material:
`openingQty + totalInQty - totalOutQty === closingQty`
AND
`round2(openingAmount + totalInAmount - totalOutAmount) === round2(sum(lot.remainingQty * lot.unitPrice))`

Codex MUST write and pass tests for **both** real-world fiscal scenarios:
1. **Scenario A — Multi-Lot Price Split (`กระดาษถ่ายเอกสาร A4 80 แกรม`, FY 2569):**
   - Opening `10 @ 115.00` -> Issue `8` -> Intake `30 @ 120.00` -> Issue `12` (auto-splits `2 @ 115` + `10 @ 120 = 1,430.00`) -> Intake `25 @ 118.00` -> Issue `22` (auto-splits `20 @ 120` + `2 @ 118 = 2,636.00`) -> Issue `15` -> Closing `8 @ 118.00 = 944.00` THB.
2. **Scenario B — Real Chalong Post-it Case (`กระดาษโพสอิท คั่นหน้า กองสวัสดิการสังคม`, `ลำดับที่ 28`, FY 2569):**
   - Opening `30 แผง @ 65.00` (`บันทึกบัญชีเดบิท`) -> Sequential issues (`2, 2, 3, 3, 3, 3, 5, 5, 4` = total `30`, each `ค่าวัสดุใช้ไป`, verifying balance drops `30 -> 28 -> 26 -> 23 -> 20 -> 17 -> 14 -> 9 -> 4 -> 0` with zero manual arithmetic drift) -> New intake `12 แผง @ 48.00` (`บันทึกบัญชีเดบิท`) -> Closing `12 แผง @ 48.00 = 576.00` THB.
3. **Scenario C — Reservation Guard & Cancel Rollback:**
   - Requisition #1 reserves 8 of 10 -> Requisition #2 requesting 3 throws `InsufficientStockError` (only 2 available) -> Cancel Requisition #1 -> Requisition #2 now succeeds.

Run and verify 100% pass:
```bash
npm run typecheck
npm test
```