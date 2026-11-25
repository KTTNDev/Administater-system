import {formatThaiDate, toThaiDigits} from '../../procurement/formatting';
import {defaultAgency} from '../../procurement/presets/default-agency';
import type {AgencyConfig, Person, SignatoryChain} from '../../procurement/types';
import {effectiveReceiverName, round2, roundQty} from '../fifo-engine';
import {buildAnnualAudit213Report, buildFiscalYearSummary, buildStockCard} from '../reports';
import {THAI_MONTHS_SHORT} from '../../procurement/workspace/tracker';
import type {
  AssetCondition,
  AssetLoan,
  InventoryDomainState,
  MaterialItem,
  Requisition,
  StockLedgerEntry,
} from '../types';
import type {
  Inv01RequisitionForm,
  Inv02StockCardForm,
  Inv02StockCardPage,
  Inv03AssetLoanForm,
  Inv04CutOffSummaryForm,
  Inv05AnnualAudit213Form,
  InvSignaturePerson,
  InvTableRow,
} from './ir';

export interface InventoryFormContext {
  agency?: AgencyConfig;
  signatories?: Partial<SignatoryChain>;
}

const DEFAULT_SIGNATORIES: SignatoryChain = {
  procurementOfficer: {
    id: 'officer',
    fullName: 'นายกิตตินันท์ พลรบ',
    position: 'เจ้าพนักงานธุรการปฏิบัติงาน',
  },
  divisionDirector: {
    id: 'director',
    fullName: 'นางกุลวดี ส่งแสง',
    position: 'ผู้อำนวยการกองสวัสดิการสังคม',
  },
  municipalClerk: {
    id: 'clerk',
    fullName: 'นายชัยณิวัฒน์ สายสุวรรณ์',
    position: 'รองปลัดเทศบาล',
    actingLine: 'ปฏิบัติราชการแทน',
    actingTarget: 'ปลัดเทศบาลตำบลฉลอง',
  },
  mayor: {
    id: 'mayor',
    fullName: 'นายชัยรัตน์ ตันทวีวงศ์',
    position: 'รองนายกเทศมนตรี',
    actingLine: 'ปฏิบัติราชการแทน',
    actingTarget: 'นายกเทศมนตรีตำบลฉลอง',
  },
};

function resolveAgency(ctx?: InventoryFormContext): AgencyConfig {
  return ctx?.agency ?? defaultAgency;
}

function resolveSignatories(ctx?: InventoryFormContext): SignatoryChain {
  return {
    procurementOfficer: ctx?.signatories?.procurementOfficer ?? DEFAULT_SIGNATORIES.procurementOfficer,
    divisionDirector: ctx?.signatories?.divisionDirector ?? DEFAULT_SIGNATORIES.divisionDirector,
    municipalClerk: ctx?.signatories?.municipalClerk ?? DEFAULT_SIGNATORIES.municipalClerk,
    mayor: ctx?.signatories?.mayor ?? DEFAULT_SIGNATORIES.mayor,
  };
}

function personPositionLines(person: Person): string[] {
  const lines = [person.position];
  if (person.actingLine && person.actingTarget) {
    lines.push(`${person.actingLine} ${person.actingTarget}`);
  } else if (person.actingLine) {
    lines.push(person.actingLine);
  }
  return lines.map(line => toThaiDigits(line)).filter(Boolean);
}

function toSig(roleLabel: string, person: Person): InvSignaturePerson {
  return {
    roleLabel,
    fullName: toThaiDigits(person.fullName),
    positionLines: personPositionLines(person),
  };
}

/** Converts all digits to Thai ๐-๙; strips Arabic digits completely. */
export const thaiText = (value: string | number): string => toThaiDigits(String(value));

export function thaiQty(value: number): string {
  const rounded = roundQty(value);
  const str = Number.isInteger(rounded)
    ? rounded.toLocaleString('en-US')
    : rounded.toLocaleString('en-US', {maximumFractionDigits: 2});
  return toThaiDigits(str);
}

export function thaiMoney(value: number): string {
  const str = round2(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return toThaiDigits(str);
}

/** Short official Thai date in Thai digits e.g. "๑ ต.ค. ๖๘", "๑๒ ม.ค. ๖๙". */
export function formatThaiCompactStockDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return toThaiDigits(iso);
  const yearShort = String(y + 543).slice(-2);
  return toThaiDigits(`${d} ${THAI_MONTHS_SHORT[m - 1]} ${yearShort}`);
}

function agencyDistrictLine(agency: AgencyConfig): string {
  if (agency.deliveryAddressFull.includes('อำเภอเมืองภูเก็ต') || agency.deliveryAddressFull.includes('อ.เมืองภูเก็ต')) {
    return 'อำเภอเมืองภูเก็ต จังหวัดภูเก็ต';
  }
  return thaiText(agency.externalAddressLine);
}

/**
 * Form INV-01: ใบเบิกวัสดุ (Exact Chalong 5-Column Layout)
 * Columns: ลำดับ (8%) | รายการ (42%) | จำนวน (14%) | คงเหลือ (14%) | หมายเหตุ (22%)
 */
export function buildInv01RequisitionForm(
  state: InventoryDomainState,
  requisition: Requisition,
  ctx?: InventoryFormContext,
): Inv01RequisitionForm {
  const agency = resolveAgency(ctx);
  const sigs = resolveSignatories(ctx);
  const materialsById = new Map(state.materials.map(m => [m.id, m]));
  const lotsById = new Map(state.lots.map(l => [l.id, l]));

  const bodyRows: InvTableRow[] = [];
  let rowIndex = 0;

  for (const line of requisition.lines) {
    const material = materialsById.get(line.materialId);
    const matName = material ? material.name : line.materialId;
    const matSpec = material?.specification?.trim() ? ` (${material.specification.trim()})` : '';
    const unit = material?.unit ?? 'หน่วย';

    if (line.allocations.length <= 1) {
      rowIndex += 1;
      const alloc = line.allocations[0];
      const lot = alloc ? lotsById.get(alloc.lotId) : undefined;
      const qty = alloc ? alloc.allocatedQty : line.approvedQty || line.requestedQty;
      const refText = alloc
        ? lot?.sourceType === 'OPENING_BALANCE'
          ? `ยอดยกมา${alloc.referenceDocNo ? ` ${alloc.referenceDocNo}` : ''}`
          : alloc.referenceDocNo || lot?.sourceLabel || ''
        : '';
      const remark =
        line.remarkOverride?.trim() ||
        (alloc ? `ราคา ${thaiMoney(alloc.unitPrice)} บ.${refText ? ` (${thaiText(refText)})` : ''}` : '');

      bodyRows.push({
        cells: [
          {text: thaiQty(rowIndex), align: 'center'},
          {text: thaiText(`${matName}${matSpec}`), align: 'left'},
          {text: `${thaiQty(qty)} ${thaiText(unit)}`, align: 'center'},
          {text: alloc ? `${thaiQty(alloc.balanceAfterThisSplit)} ${thaiText(unit)}` : '-', align: 'center'},
          {text: thaiText(remark), align: 'left'},
        ],
      });
    } else {
      // Multi-lot FIFO split: render 1 row per price lot so FIFO cost & running balance are 100% transparent.
      line.allocations.forEach((alloc, splitIdx) => {
        rowIndex += 1;
        const lot = lotsById.get(alloc.lotId);
        const refText =
          lot?.sourceType === 'OPENING_BALANCE'
            ? `ยอดยกมา${alloc.referenceDocNo ? ` ${alloc.referenceDocNo}` : ''}`
            : alloc.referenceDocNo || lot?.sourceLabel || '';
        const remark =
          line.remarkOverride?.trim() && splitIdx === 0
            ? `${line.remarkOverride.trim()} · ราคา ${thaiMoney(alloc.unitPrice)} บ. (${thaiText(refText)})`
            : `ราคา ${thaiMoney(alloc.unitPrice)} บ.${refText ? ` (${thaiText(refText)})` : ''}`;

        bodyRows.push({
          cells: [
            {text: thaiQty(rowIndex), align: 'center'},
            {text: thaiText(`${matName}${matSpec}`), align: 'left'},
            {text: `${thaiQty(alloc.allocatedQty)} ${thaiText(unit)}`, align: 'center'},
            {text: `${thaiQty(alloc.balanceAfterThisSplit)} ${thaiText(unit)}`, align: 'center'},
            {text: thaiText(remark), align: 'left'},
          ],
        });
      });
    }
  }

  // Pad to minimum 8 visual rows when single-page so voucher looks crisp and balanced.
  const minRows = 8;
  while (bodyRows.length < minRows) {
    bodyRows.push({
      isFiller: true,
      cells: [
        {text: '', align: 'center'},
        {text: '', align: 'left'},
        {text: '', align: 'center'},
        {text: '', align: 'center'},
        {text: '', align: 'left'},
      ],
    });
  }

  const receiverName = effectiveReceiverName(requisition);
  const runningNo = thaiText(`${requisition.requisitionRunningNo}/${requisition.fiscalYearBE}`);

  return {
    formCode: 'INV-01',
    title: 'ใบเบิกวัสดุ',
    requisitionNoDisplay: `เลขที่ใบเบิกพัสดุ ${runningNo}`,
    agencyOfficeTitle: thaiText(agency.officeTitle),
    agencyLocationLine: agencyDistrictLine(agency),
    requestDateDisplay: `วันที่ ${formatThaiDate(requisition.requestDate)}`,
    requesterLine: `ข้าพเจ้า ${thaiText(requisition.requesterName)} ตำแหน่ง ${thaiText(requisition.requesterPosition)}`,
    purposeCertification: thaiText(
      `ขอเบิกวัสดุตามรายการข้างล่างนี้${requisition.purpose ? requisition.purpose : `เพื่อใช้ในการปฏิบัติราชการ งาน${agency.divisionName} ${agency.municipalityName}`} และขอรับรองว่าได้นำไปใช้ในราชการด้วยความสัตย์จริง`,
    ),
    table: {
      columnWidthsPct: [8, 42, 14, 14, 22],
      headerRows: [
        [
          {text: 'ลำดับ', align: 'center', bold: true},
          {text: 'รายการ', align: 'center', bold: true},
          {text: 'จำนวน', align: 'center', bold: true},
          {text: 'คงเหลือ', align: 'center', bold: true},
          {text: 'หมายเหตุ', align: 'center', bold: true},
        ],
      ],
      bodyRows,
      fontPt: 15,
    },
    signatures: {
      requester: {
        roleLabel: 'ผู้เบิก',
        fullName: thaiText(requisition.requesterName),
        positionLines: [],
      },
      approver: toSig('ผู้อนุมัติ', sigs.divisionDirector),
      issuer: toSig('ผู้จ่ายวัสดุ', sigs.procurementOfficer),
      receiver: {
        roleLabel: 'ผู้รับของ',
        fullName: thaiText(receiverName),
        positionLines: [],
      },
    },
  };
}

function buildStockCardRows(entries: readonly StockLedgerEntry[], padToRows = 0): InvTableRow[] {
  const rows: InvTableRow[] = entries.map(entry => ({
    cells: [
      {text: formatThaiCompactStockDate(entry.entryDate), align: 'center'},
      {text: thaiText(entry.partyDescription), align: 'left'},
      {text: thaiText(entry.docNo || '-'), align: 'center'},
      {text: thaiMoney(entry.unitPrice), align: 'right'},
      {text: entry.inQty > 0 ? thaiQty(entry.inQty) : '-', align: 'center'},
      {text: entry.outQty > 0 ? thaiQty(entry.outQty) : '-', align: 'center'},
      {text: thaiQty(entry.balanceQty), align: 'center', bold: true},
      {text: thaiText(entry.accountingNote), align: 'left'},
    ],
  }));

  while (rows.length < padToRows) {
    rows.push({
      isFiller: true,
      cells: Array.from({length: 8}, () => ({text: ''})),
    });
  }
  return rows;
}

function buildStockCardPage(
  material: MaterialItem,
  entries: readonly StockLedgerEntry[],
  pageNo: number,
  sheetNo: number,
  agency: AgencyConfig,
  padSingleSheet: boolean,
): Inv02StockCardPage {
  return {
    pageNoDisplay: thaiQty(pageNo),
    ledgerSeqNoDisplay: thaiQty(material.ledgerSeqNo),
    sheetNoDisplay: thaiQty(sheetNo),
    municipalityName: thaiText(agency.municipalityName),
    headerFields: {
      name: thaiText(material.name),
      specification: thaiText(material.specification.trim() || '-'),
      storageLocation: thaiText(material.storageLocation || agency.divisionName),
      categoryType: thaiText(material.categoryType),
      code: thaiText(material.code.trim() || '-'),
      unit: thaiText(material.unit),
      maxStock: material.maxStockQty === null ? '-' : thaiQty(material.maxStockQty),
      minStock: thaiQty(material.minStockQty),
    },
    table: {
      columnWidthsPct: [12, 23, 13, 11, 7, 7, 8, 19],
      headerRows: [
        [
          {text: 'วัน เดือน ปี', align: 'center', bold: true, rowSpan: 2},
          {text: 'รับจาก/จ่ายให้', align: 'center', bold: true, rowSpan: 2},
          {text: 'เลขที่เอกสาร', align: 'center', bold: true, rowSpan: 2},
          {text: 'ราคาต่อหน่วย', align: 'center', bold: true, rowSpan: 2},
          {text: 'จำนวน', align: 'center', bold: true, colSpan: 3},
          {text: 'หมายเหตุ', align: 'center', bold: true, rowSpan: 2},
        ],
        [
          {text: 'รับ', align: 'center', bold: true},
          {text: 'จ่าย', align: 'center', bold: true},
          {text: 'คงเหลือ', align: 'center', bold: true},
        ],
      ],
      bodyRows: buildStockCardRows(entries, padSingleSheet ? 10 : 0),
      fontPt: 14,
      compact: true,
    },
  };
}

/**
 * Form INV-02: บัญชีวัสดุ (Exact Chalong Stock Card Layout)
 * Pass `materialId` for a single material OR omit `materialId` for the Full Division Stock Card Binder.
 */
export function buildInv02StockCardForm(
  state: InventoryDomainState,
  fiscalYearBE: number,
  options: {materialId?: string; landscape?: boolean; rowsPerSheet?: number} = {},
  ctx?: InventoryFormContext,
): Inv02StockCardForm {
  const agency = resolveAgency(ctx);
  const targets = options.materialId
    ? state.materials.filter(m => m.id === options.materialId)
    : [...state.materials].sort((a, b) => a.ledgerSeqNo - b.ledgerSeqNo || a.id.localeCompare(b.id));

  if (!targets.length) {
    throw new Error(options.materialId ? `ไม่พบรายการวัสดุรหัส ${options.materialId}` : 'ยังไม่มีรายการวัสดุในคลัง');
  }

  const cards: Inv02StockCardPage[] = [];
  let runningPageNo = 0;

  for (const material of targets) {
    const report = buildStockCard(state, material.id, fiscalYearBE, options.rowsPerSheet ?? 20);
    if (options.rowsPerSheet) {
      report.sheets.forEach(sheet => {
        runningPageNo += 1;
        cards.push(buildStockCardPage(material, sheet.rows, runningPageNo, sheet.sheetNo, agency, sheet.totalSheets === 1));
      });
    } else {
      // Single continuous table per material so CSS thead & DOCX w:tblHeader repeat naturally across pages!
      runningPageNo += 1;
      cards.push(buildStockCardPage(material, report.entries, runningPageNo, 1, agency, report.entries.length < 10));
    }
  }

  return {
    formCode: 'INV-02',
    title: 'บัญชีวัสดุ',
    landscape: options.landscape ?? false,
    cards,
  };
}

/**
 * Form INV-03: ใบยืม-คืนครุภัณฑ์ (Equipment Loan & Return Form)
 */
export function buildInv03AssetLoanForm(
  state: InventoryDomainState,
  loan: AssetLoan,
  ctx?: InventoryFormContext,
): Inv03AssetLoanForm {
  const agency = resolveAgency(ctx);
  const sigs = resolveSignatories(ctx);
  const asset = state.assets.find(a => a.id === loan.assetId);
  const assetCode = asset?.assetCode ?? loan.assetId;
  const assetLabel = asset ? `${asset.name}${asset.brandModel ? ` (${asset.brandModel})` : ''}` : loan.assetId;

  const bodyRows: InvTableRow[] = [
    {
      cells: [
        {text: thaiQty(1), align: 'center'},
        {text: thaiText(assetCode), align: 'center'},
        {text: thaiText(assetLabel), align: 'left'},
        {text: thaiText(loan.conditionBefore), align: 'center'},
        {text: formatThaiDate(loan.dueReturnDate), align: 'center'},
        {text: thaiText(asset?.note || '-'), align: 'left'},
      ],
    },
  ];

  return {
    formCode: 'INV-03',
    title: 'ใบยืมครุภัณฑ์',
    loanNoDisplay: thaiText(`เลขที่ ยค. ${loan.loanRunningNo}/${loan.fiscalYearBE}`),
    divisionHeader: thaiText(`${agency.divisionName} ${agency.municipalityName}`),
    loanDateDisplay: `วันที่ ${formatThaiDate(loan.loanDate)}`,
    borrowerInfoLines: [
      thaiText(`ผู้ยืม: ${loan.borrowerName}   ตำแหน่ง: ${loan.borrowerPosition}`),
      thaiText(`สังกัด: ${loan.borrowerDepartment}   วัตถุประสงค์การยืม: ${loan.purpose}`),
    ],
    table: {
      columnWidthsPct: [7, 19, 30, 15, 16, 13],
      headerRows: [
        [
          {text: 'ลำดับ', align: 'center', bold: true},
          {text: 'เลขครุภัณฑ์', align: 'center', bold: true},
          {text: 'รายการครุภัณฑ์ / ยี่ห้อ-รุ่น', align: 'center', bold: true},
          {text: 'สภาพก่อนยืม', align: 'center', bold: true},
          {text: 'กำหนดส่งคืน', align: 'center', bold: true},
          {text: 'หมายเหตุ', align: 'center', bold: true},
        ],
      ],
      bodyRows,
      fontPt: 15,
    },
    loanSignatures: [
      {roleLabel: 'ผู้ยืม', fullName: thaiText(loan.borrowerName), positionLines: [thaiText(loan.borrowerPosition)]},
      toSig('ผู้อนุญาตให้ยืม', sigs.divisionDirector),
      toSig('ผู้ส่งมอบ', sigs.procurementOfficer),
    ],
    returnSection: {
      actualReturnDateDisplay: loan.actualReturnDate
        ? `วันที่ส่งคืนจริง ${formatThaiDate(loan.actualReturnDate)}`
        : 'วันที่ส่งคืนจริง ................................................................',
      conditionAfterDisplay: loan.conditionAfter
        ? `สภาพหลังส่งคืน ${thaiText(loan.conditionAfter)}`
        : 'สภาพหลังส่งคืน ................................................................',
      returner: {roleLabel: 'ผู้ส่งคืน', fullName: thaiText(loan.borrowerName), positionLines: []},
      inspector: toSig('ผู้ตรวจรับคืน', sigs.procurementOfficer),
    },
  };
}

/**
 * Form INV-04: รายงานสรุปการรับ-จ่าย-คงเหลือวัสดุ (Grouped by Category 01–18)
 */
export function buildInv04CutOffSummaryForm(
  state: InventoryDomainState,
  fiscalYearBE: number,
  options: {asOfDate: string; periodLabel?: string; periodStart?: string; periodEnd?: string},
  ctx?: InventoryFormContext,
): Inv04CutOffSummaryForm {
  const agency = resolveAgency(ctx);
  const sigs = resolveSignatories(ctx);
  const summary = buildFiscalYearSummary(state, fiscalYearBE, {
    periodLabel: options.periodLabel,
    periodStart: options.periodStart,
    periodEnd: options.periodEnd,
  });

  // Group items by categoryCode (01..18)
  const grouped = new Map<string, typeof summary.items>();
  for (const item of summary.items) {
    const key = `${item.categoryCode} ${item.categoryType}`;
    const list = grouped.get(key) ?? [];
    list.push(item);
    grouped.set(key, list);
  }
  const sortedGroups = Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));

  const bodyRows: InvTableRow[] = [];
  let seq = 0;

  for (const [groupTitle, items] of sortedGroups) {
    bodyRows.push({
      isSubtotal: true,
      cells: [
        {text: thaiText(`หมวด ${groupTitle}`), align: 'left', bold: true, colSpan: 11},
      ],
    });

    let gOpenQty = 0, gOpenAmt = 0, gInQty = 0, gInAmt = 0, gOutQty = 0, gOutAmt = 0, gCloseQty = 0, gCloseAmt = 0;
    for (const item of items) {
      seq += 1;
      gOpenQty = roundQty(gOpenQty + item.openingQty);
      gOpenAmt = round2(gOpenAmt + item.openingAmount);
      gInQty = roundQty(gInQty + item.totalInQty);
      gInAmt = round2(gInAmt + item.totalInAmount);
      gOutQty = roundQty(gOutQty + item.totalOutQty);
      gOutAmt = round2(gOutAmt + item.totalOutAmount);
      gCloseQty = roundQty(gCloseQty + item.closingQty);
      gCloseAmt = round2(gCloseAmt + item.closingAmount);

      bodyRows.push({
        cells: [
          {text: thaiQty(seq), align: 'center'},
          {text: thaiText(item.name), align: 'left'},
          {text: thaiText(item.unit), align: 'center'},
          {text: thaiQty(item.openingQty), align: 'right'},
          {text: thaiMoney(item.openingAmount), align: 'right'},
          {text: thaiQty(item.totalInQty), align: 'right'},
          {text: thaiMoney(item.totalInAmount), align: 'right'},
          {text: thaiQty(item.totalOutQty), align: 'right'},
          {text: thaiMoney(item.totalOutAmount), align: 'right'},
          {text: thaiQty(item.closingQty), align: 'right'},
          {text: thaiMoney(item.closingAmount), align: 'right'},
        ],
      });
    }

    bodyRows.push({
      isSubtotal: true,
      cells: [
        {text: thaiText(`รวมหมวด ${groupTitle}`), align: 'right', bold: true, colSpan: 3},
        {text: thaiQty(gOpenQty), align: 'right', bold: true},
        {text: thaiMoney(gOpenAmt), align: 'right', bold: true},
        {text: thaiQty(gInQty), align: 'right', bold: true},
        {text: thaiMoney(gInAmt), align: 'right', bold: true},
        {text: thaiQty(gOutQty), align: 'right', bold: true},
        {text: thaiMoney(gOutAmt), align: 'right', bold: true},
        {text: thaiQty(gCloseQty), align: 'right', bold: true},
        {text: thaiMoney(gCloseAmt), align: 'right', bold: true},
      ],
    });
  }

  bodyRows.push({
    isGrandTotal: true,
    cells: [
      {text: 'รวมทั้งสิ้น', align: 'right', bold: true, colSpan: 3},
      {text: thaiQty(summary.totals.openingQty), align: 'right', bold: true},
      {text: thaiMoney(summary.totals.openingAmount), align: 'right', bold: true},
      {text: thaiQty(summary.totals.totalInQty), align: 'right', bold: true},
      {text: thaiMoney(summary.totals.totalInAmount), align: 'right', bold: true},
      {text: thaiQty(summary.totals.totalOutQty), align: 'right', bold: true},
      {text: thaiMoney(summary.totals.totalOutAmount), align: 'right', bold: true},
      {text: thaiQty(summary.totals.closingQty), align: 'right', bold: true},
      {text: thaiMoney(summary.totals.closingAmount), align: 'right', bold: true},
    ],
  });

  return {
    formCode: 'INV-04',
    title: 'รายงานสรุปการรับ-จ่าย และวัสดุคงเหลือ',
    headingLine1: thaiText(`รายงานสรุปการรับ-จ่าย และวัสดุคงเหลือ ประจำปีงบประมาณ พ.ศ. ${fiscalYearBE}`),
    headingLine2: thaiText(`ณ วันที่ ${formatThaiDate(options.asOfDate)} — ${agency.divisionName} ${agency.municipalityName}`),
    table: {
      columnWidthsPct: [5, 23, 6, 7, 9.5, 7, 9.5, 7, 9.5, 7, 9.5],
      headerRows: [
        [
          {text: 'ลำดับ', align: 'center', bold: true, rowSpan: 2},
          {text: 'รายการวัสดุ', align: 'center', bold: true, rowSpan: 2},
          {text: 'หน่วย', align: 'center', bold: true, rowSpan: 2},
          {text: 'ยอดยกมา', align: 'center', bold: true, colSpan: 2},
          {text: 'รับระหว่างปี', align: 'center', bold: true, colSpan: 2},
          {text: 'จ่ายระหว่างปี', align: 'center', bold: true, colSpan: 2},
          {text: 'คงเหลือสิ้นปี', align: 'center', bold: true, colSpan: 2},
        ],
        [
          {text: 'จำนวน', align: 'center', bold: true},
          {text: 'มูลค่า', align: 'center', bold: true},
          {text: 'จำนวน', align: 'center', bold: true},
          {text: 'มูลค่า', align: 'center', bold: true},
          {text: 'จำนวน', align: 'center', bold: true},
          {text: 'มูลค่า', align: 'center', bold: true},
          {text: 'จำนวน', align: 'center', bold: true},
          {text: 'มูลค่า', align: 'center', bold: true},
        ],
      ],
      bodyRows,
      fontPt: 13.5,
      compact: true,
    },
    signatures: [
      toSig('ผู้จัดทำรายงาน', sigs.procurementOfficer),
      toSig('ผู้รับรองความถูกต้อง', sigs.divisionDirector),
    ],
  };
}

const CONDITION_LABELS: Record<AssetCondition, string> = {
  GOOD: 'ใช้งานได้',
  DAMAGED_REPAIRABLE: 'ชำรุดรอซ่อม',
  UNSERVICEABLE_DISPOSE: 'เสื่อมสภาพขอจำหน่าย',
  MISSING: 'สูญหาย',
};

/**
 * Form INV-05: รายงานผลการตรวจสอบพัสดุประจำปี (ระเบียบฯ พ.ศ. ๒๕๖๐ ข้อ ๒๑๓)
 */
export function buildInv05AnnualAudit213Form(
  state: InventoryDomainState,
  fiscalYearBE: number,
  options: {auditDate?: string; docNo?: string; committeeName?: string; committeePosition?: string} = {},
  ctx?: InventoryFormContext,
): Inv05AnnualAudit213Form {
  const agency = resolveAgency(ctx);
  const sigs = resolveSignatories(ctx);
  const defaultAuditIso = `${fiscalYearBE - 543}-09-30`;
  const auditDate = options.auditDate ?? defaultAuditIso;
  const audit = buildAnnualAudit213Report(state, fiscalYearBE, auditDate);
  const t = audit.materialSummary.totals;

  const materialOverviewTable = {
    columnWidthsPct: [40, 20, 40],
    headerRows: [
      [
        {text: 'รายการสรุปวัสดุคงคลัง', align: 'center' as const, bold: true},
        {text: 'จำนวนรวม', align: 'center' as const, bold: true},
        {text: 'มูลค่ารวม (บาท)', align: 'center' as const, bold: true},
      ],
    ],
    bodyRows: [
      {cells: [{text: 'ยอดวัสดุยกมาต้นปีงบประมาณ', align: 'left' as const}, {text: thaiQty(t.openingQty), align: 'right' as const}, {text: thaiMoney(t.openingAmount), align: 'right' as const}]},
      {cells: [{text: 'รับวัสดุเข้าคลังระหว่างปีงบประมาณ', align: 'left' as const}, {text: thaiQty(t.totalInQty), align: 'right' as const}, {text: thaiMoney(t.totalInAmount), align: 'right' as const}]},
      {cells: [{text: 'จ่ายวัสดุใช้ไปในราชการระหว่างปี', align: 'left' as const}, {text: thaiQty(t.totalOutQty), align: 'right' as const}, {text: thaiMoney(t.totalOutAmount), align: 'right' as const}]},
      {
        isGrandTotal: true,
        cells: [
          {text: 'ยอดวัสดุคงเหลือยกไปปีงบประมาณถัดไป', align: 'left' as const, bold: true},
          {text: thaiQty(t.closingQty), align: 'right' as const, bold: true},
          {text: thaiMoney(t.closingAmount), align: 'right' as const, bold: true},
        ],
      },
    ],
    fontPt: 15,
  };

  const conditionOrder: AssetCondition[] = ['GOOD', 'DAMAGED_REPAIRABLE', 'UNSERVICEABLE_DISPOSE', 'MISSING'];
  const assetConditionTable = {
    columnWidthsPct: [10, 55, 15, 20],
    headerRows: [
      [
        {text: 'ลำดับ', align: 'center' as const, bold: true},
        {text: 'สภาพครุภัณฑ์ประจำกอง', align: 'center' as const, bold: true},
        {text: 'จำนวน (รายการ)', align: 'center' as const, bold: true},
        {text: 'มูลค่ารวม (บาท)', align: 'center' as const, bold: true},
      ],
    ],
    bodyRows: [
      ...conditionOrder.map((cond, idx) => {
        const subset = audit.assets.items.filter(a => a.condition === cond);
        const sum = round2(subset.reduce((s, a) => s + a.acquisitionCost, 0));
        return {
          cells: [
            {text: thaiQty(idx + 1), align: 'center' as const},
            {text: CONDITION_LABELS[cond], align: 'left' as const},
            {text: thaiQty(subset.length), align: 'right' as const},
            {text: thaiMoney(sum), align: 'right' as const},
          ],
        };
      }),
      {
        isGrandTotal: true,
        cells: [
          {text: 'รวมครุภัณฑ์ทั้งสิ้น', align: 'right' as const, bold: true, colSpan: 2},
          {text: thaiQty(audit.assets.totalCount), align: 'right' as const, bold: true},
          {text: thaiMoney(audit.assets.totalAcquisitionCost), align: 'right' as const, bold: true},
        ],
      },
    ],
    fontPt: 15,
  };

  const assetDetailRows: InvTableRow[] = audit.assets.items.length
    ? audit.assets.items.map((asset, idx) => ({
        cells: [
          {text: thaiQty(idx + 1), align: 'center'},
          {text: thaiText(asset.assetCode), align: 'center'},
          {text: thaiText(`${asset.name}${asset.brandModel ? ` (${asset.brandModel})` : ''}`), align: 'left'},
          {text: thaiMoney(asset.acquisitionCost), align: 'right'},
          {text: thaiText(asset.custodianName), align: 'left'},
          {text: CONDITION_LABELS[asset.condition], align: 'center'},
        ],
      }))
    : [{cells: [{text: 'ไม่มีรายการครุภัณฑ์คงเหลือในทะเบียน', align: 'center', colSpan: 6}]}];

  const assetDetailTable = {
    columnWidthsPct: [7, 20, 31, 14, 15, 13],
    headerRows: [
      [
        {text: 'ลำดับ', align: 'center' as const, bold: true},
        {text: 'เลขครุภัณฑ์', align: 'center' as const, bold: true},
        {text: 'รายการครุภัณฑ์', align: 'center' as const, bold: true},
        {text: 'มูลค่า (บาท)', align: 'center' as const, bold: true},
        {text: 'ผู้รับผิดชอบ', align: 'center' as const, bold: true},
        {text: 'สภาพ', align: 'center' as const, bold: true},
      ],
    ],
    bodyRows: assetDetailRows,
    fontPt: 14,
    compact: true,
  };

  const sep30Display = `๓๐ กันยายน พ.ศ. ${thaiText(fiscalYearBE)}`;

  return {
    formCode: 'INV-05',
    title: 'รายงานผลการตรวจสอบพัสดุประจำปี',
    memoHeader: {
      governmentUnit: thaiText(`${agency.sectionName} ${agency.divisionName} ${agency.municipalityName} โทร. ${agency.phoneDisplay}`),
      docNo: thaiText(options.docNo || `${agency.codes.internalMemoPrefix}/`),
      dateDisplay: formatThaiDate(auditDate),
      subject: thaiText(`รายงานผลการตรวจสอบพัสดุประจำปีงบประมาณ พ.ศ. ${fiscalYearBE}`),
      recipient: thaiText(`นายก${agency.municipalityName}`),
    },
    paragraphs: [
      thaiText(
        `ตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๒๑๓ กำหนดให้หัวหน้าหน่วยงานของรัฐแต่งตั้งผู้รับผิดชอบการตรวจสอบพัสดุ เพื่อตรวจสอบการรับจ่ายพัสดุในงวดหนึ่งปีที่ผ่านมา และตรวจนับพัสดุประเภทที่คงเหลืออยู่เพียงวันสิ้นงวดนั้น ณ วันที่ ${sep30Display}`,
      ),
      thaiText(
        `บัดนี้ ผู้ตรวจสอบพัสดุประจำ${agency.divisionName} ได้ดำเนินการตรวจสอบบัญชีวัสดุและทะเบียนครุภัณฑ์ประจำปีงบประมาณ พ.ศ. ${fiscalYearBE} ณ วันที่ ${sep30Display} เสร็จเรียบร้อยแล้ว มีวัสดุคงเหลือจำนวน ${audit.materialSummary.items.length} รายการ (มูลค่ารวม ${thaiMoney(t.closingAmount)} บาท · สถานะกระทบยอด${audit.materialSummary.allBalanced ? 'ถูกต้องตรงกันครบถ้วน' : 'พบรายการต้องตรวจสอบเพิ่มเติม'}) และครุภัณฑ์ประจำกองจำนวน ${audit.assets.totalCount} รายการ (มูลค่ารวม ${thaiMoney(audit.assets.totalAcquisitionCost)} บาท) รายละเอียดปรากฏตามตารางสรุปด้านล่างนี้`,
      ),
      'จึงเรียนมาเพื่อโปรดทราบ และพิจารณาสั่งการตามระเบียบฯ ต่อไป',
    ],
    materialOverviewTable,
    assetConditionTable,
    assetDetailTable,
    signatures: {
      committee: {
        roleLabel: 'ผู้ตรวจสอบพัสดุ / คณะกรรมการตรวจสอบพัสดุประจำปี',
        fullName: thaiText(options.committeeName || sigs.divisionDirector.fullName),
        positionLines: [thaiText(options.committeePosition || sigs.divisionDirector.position)],
      },
      clerk: toSig('ปลัดเทศบาล', sigs.municipalClerk),
      mayor: toSig('นายกเทศมนตรี', sigs.mayor),
    },
  };
}
