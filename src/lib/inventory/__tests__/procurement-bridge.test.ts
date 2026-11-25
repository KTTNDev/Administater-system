import {describe,expect,it} from 'vitest';
import {computeProcurementCase} from '../../procurement/calculations';
import {templateFixture} from '../../procurement/__tests__/templates-fixtures';
import {createEmptyInventoryState, DuplicateProcurementImportError, round2} from '../fifo-engine';
import {importProcurementCaseToInventory, mapProcurementCaseToStockIntake} from '../procurement-bridge';
import {buildFiscalYearSummary} from '../reports';
import {MaterialItemSchema} from '../schema';

describe('procurement-to-inventory bridge (Doc 10 / Doc 11.1 -> StockLot)', () => {
  it('auto-imports Set 1 (1,520 THB: 2 items) with matched existing material & catalog suggestion for new item', () => {
    const set1 = computeProcurementCase(templateFixture(1520));
    const existingBox = MaterialItemSchema.parse({
      id: 'mat-box-120',
      ledgerSeqNo: 10,
      code: '01-010',
      name: 'กล่องพลาสติกมีฝาปิด ขนาด 120 ลิตร',
      categoryCode: '01',
      categoryType: 'วัสดุสำนักงาน',
      unit: 'ใบ',
      storageLocation: 'กองสวัสดิการสังคม',
    });

    const initialState = {...createEmptyInventoryState(), materials: [existingBox]};
    const preview = mapProcurementCaseToStockIntake(set1, initialState.materials, initialState.lots);
    expect(preview.alreadyImported).toBe(false);
    expect(preview.poNumber).toBe('สว 13/2570');
    expect(preview.poNumberThai).toBe('สว ๑๓/๒๕๗๐');
    expect(preview.inspectionDate).toBe(set1.docs.doc11_1_inspectionReport.date);
    expect(preview.drafts).toHaveLength(2);

    // Item 1 matched existing material
    expect(preview.drafts[0]).toMatchObject({
      matchedMaterialId: 'mat-box-120',
      isNewMaterial: false,
      unitPrice: 590,
      initialQty: 2,
      lineTotal: 1180,
      sourceLabel: 'รับจาก (ร้านดินสอสี)',
    });

    // Item 2 new material -> catalog suggests วัสดุก่อสร้าง (04) or วัสดุสำนักงาน with standard units including ตลับ
    expect(preview.drafts[1]).toMatchObject({
      matchedMaterialId: null,
      isNewMaterial: true,
      unitPrice: 340,
      initialQty: 1,
      lineTotal: 340,
    });
    expect(preview.drafts[1].suggestedUnits).toContain('ตลับ');

    const imported = importProcurementCaseToInventory(initialState, set1);
    expect(imported.createdMaterials).toHaveLength(1);
    expect(imported.createdMaterials[0].ledgerSeqNo).toBe(11);
    expect(imported.createdLots).toHaveLength(2);
    expect(imported.state.ledger).toHaveLength(2);
    expect(imported.state.ledger.every(e => e.accountingNote === 'บันทึกบัญชีเดบิท')).toBe(true);
    expect(round2(imported.state.ledger.reduce((s, e) => s + e.inAmount, 0))).toBe(1520);

    // Duplicate intake of the same completed case must be rejected!
    expect(() => importProcurementCaseToInventory(imported.state, set1)).toThrow(DuplicateProcurementImportError);
    expect(mapProcurementCaseToStockIntake(set1, imported.state.materials, imported.state.lots).alreadyImported).toBe(
      true,
    );
  });

  it('auto-imports Set 2 (22,890 THB: 7 items) with exact total valuation and balanced fiscal summary', () => {
    const set2 = computeProcurementCase(templateFixture(22890));
    const imported = importProcurementCaseToInventory(createEmptyInventoryState(), set2);

    expect(imported.createdMaterials).toHaveLength(7);
    expect(imported.createdLots).toHaveLength(7);
    expect(imported.state.ledger).toHaveLength(7);

    const summary = buildFiscalYearSummary(imported.state, set2.docs.doc10_purchaseOrder.fiscalYearBE!);
    expect(summary.allBalanced).toBe(true);
    expect(summary.totals.totalInAmount).toBe(22890);
    expect(summary.totals.closingAmount).toBe(22890);
    expect(summary.totals.lotRemainingAmount).toBe(22890);
  });
});
