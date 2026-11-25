import fs from 'node:fs';
import path from 'node:path';
import {SARABUN_RULES} from '../../../procurement/templates/sarabun-rules';
import type {
  Inv01RequisitionForm,
  Inv02StockCardForm,
  Inv03AssetLoanForm,
  Inv04CutOffSummaryForm,
  Inv05AnnualAudit213Form,
  InventoryFormIR,
  InvSignaturePerson,
  InvTableModel,
} from '../ir';

export interface InventoryPrintAssets {
  regularFontUri: string;
  boldFontUri: string;
  garudaUri: string;
}

let cachedAssets: InventoryPrintAssets | null = null;

export function loadInventoryPrintAssets(): InventoryPrintAssets {
  if (cachedAssets) return cachedAssets;
  const root = process.cwd();
  const readUri = (rel: string, mime: string) => {
    const filePath = path.join(root, rel);
    return fs.existsSync(filePath)
      ? `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`
      : '';
  };
  cachedAssets = {
    regularFontUri: readUri('public/fonts/THSarabunIT9.ttf', 'font/ttf'),
    boldFontUri: readUri('public/fonts/THSarabunIT9-Bold.ttf', 'font/ttf'),
    garudaUri: readUri('public/assets/garuda.png', 'image/png'),
  };
  return cachedAssets;
}

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function renderTable(table: InvTableModel, extraClass = ''): string {
  const colgroup = `<colgroup>${table.columnWidthsPct.map(w => `<col style="width:${w}%">`).join('')}</colgroup>`;
  const thead = `<thead>${table.headerRows
    .map(
      row =>
        `<tr>${row
          .map(cell => {
            const attrs = [
              cell.colSpan && cell.colSpan > 1 ? `colspan="${cell.colSpan}"` : '',
              cell.rowSpan && cell.rowSpan > 1 ? `rowspan="${cell.rowSpan}"` : '',
              cell.align ? `style="text-align:${cell.align}"` : '',
            ]
              .filter(Boolean)
              .join(' ');
            return `<th${attrs ? ' ' + attrs : ''}>${esc(cell.text)}</th>`;
          })
          .join('')}</tr>`,
    )
    .join('')}</thead>`;

  const tbody = `<tbody>${table.bodyRows
    .map(row => {
      const cls = [
        row.isSubtotal ? 'inv-subtotal' : '',
        row.isGrandTotal ? 'inv-grand-total' : '',
        row.isFiller ? 'inv-filler' : '',
      ]
        .filter(Boolean)
        .join(' ');
      return `<tr${cls ? ` class="${cls}"` : ''}>${row.cells
        .map(cell => {
          const styles = [
            cell.align ? `text-align:${cell.align}` : '',
            cell.bold ? 'font-weight:700' : '',
          ]
            .filter(Boolean)
            .join(';');
          const attrs = [
            cell.colSpan && cell.colSpan > 1 ? `colspan="${cell.colSpan}"` : '',
            cell.rowSpan && cell.rowSpan > 1 ? `rowspan="${cell.rowSpan}"` : '',
            styles ? `style="${styles}"` : '',
          ]
            .filter(Boolean)
            .join(' ');
          return `<td${attrs ? ' ' + attrs : ''}>${cell.text ? esc(cell.text) : '&nbsp;'}</td>`;
        })
        .join('')}</tr>`;
    })
    .join('')}</tbody>`;

  const fontStyle = table.fontPt ? ` style="font-size:${table.fontPt}pt"` : '';
  return `<table class="inv-table${table.compact ? ' inv-table-compact' : ''}${extraClass ? ' ' + extraClass : ''}"${fontStyle}>${colgroup}${thead}${tbody}</table>`;
}

function renderSigCell(sig: InvSignaturePerson, dots = '......................................'): string {
  const posHtml = sig.positionLines.map(line => `<div class="inv-sig-pos">${esc(line)}</div>`).join('');
  return `<div class="inv-sig-cell">
    <div class="inv-sig-space"></div>
    <div class="inv-sig-line">(ลงชื่อ)${dots}${esc(sig.roleLabel)}</div>
    <div class="inv-sig-name">(${esc(sig.fullName)})</div>
    ${posHtml}
  </div>`;
}

function renderInv01(form: Inv01RequisitionForm): string {
  return `<section class="inv-doc inv-01">
    <div class="inv-01-no">${esc(form.requisitionNoDisplay)}</div>
    <h1 class="inv-01-title">${esc(form.title)}</h1>
    <div class="inv-01-right-meta">
      <div class="inv-01-agency">${esc(form.agencyOfficeTitle)}</div>
      <div class="inv-01-loc">${esc(form.agencyLocationLine)}</div>
      <div class="inv-01-date">${esc(form.requestDateDisplay)}</div>
    </div>
    <div class="inv-01-narrative">
      <p class="inv-indent">${esc(form.requesterLine)}</p>
      <p>${esc(form.purposeCertification)}</p>
    </div>
    ${renderTable(form.table, 'inv-01-table')}
    <div class="inv-sig-grid-2x2 inv-keep-together">
      ${renderSigCell(form.signatures.requester)}
      ${renderSigCell(form.signatures.approver)}
      ${renderSigCell(form.signatures.issuer)}
      ${renderSigCell(form.signatures.receiver)}
    </div>
  </section>`;
}

function renderInv02(form: Inv02StockCardForm): string {
  return form.cards
    .map((card, idx) => {
      const f = card.headerFields;
      return `<section class="inv-doc inv-02${idx > 0 ? ' inv-page-break' : ''}">
        <div class="inv-02-top">
          <div class="inv-02-left">หน้าที่ ${esc(card.pageNoDisplay)}</div>
          <div class="inv-02-center">
            <h1>${esc(form.title)}</h1>
            <div class="inv-02-muni">${esc(card.municipalityName)}</div>
          </div>
          <div class="inv-02-right">
            <div>ลำดับที่ ${esc(card.ledgerSeqNoDisplay)}</div>
            <div>แผ่นที่ ${esc(card.sheetNoDisplay)}</div>
          </div>
        </div>
        <table class="inv-meta-grid">
          <colgroup><col style="width:52%"><col style="width:48%"></colgroup>
          <tbody>
            <tr>
              <td><b>ชื่อหรือชนิดวัสดุ</b> ${esc(f.name)}</td>
              <td><b>ประเภท</b> ${esc(f.categoryType)}</td>
            </tr>
            <tr>
              <td><b>ขนาดหรือลักษณะ</b> ${esc(f.specification)}</td>
              <td><b>รหัส</b> ${esc(f.code)} &nbsp;&nbsp; <b>หน่วยที่นับ</b> ${esc(f.unit)}</td>
            </tr>
            <tr>
              <td><b>ที่เก็บ</b> ${esc(f.storageLocation)}</td>
              <td><b>จำนวนอย่างสูง</b> ${esc(f.maxStock)} &nbsp;&nbsp; <b>จำนวนอย่างต่ำ</b> ${esc(f.minStock)}</td>
            </tr>
          </tbody>
        </table>
        ${renderTable(card.table, 'inv-02-table')}
      </section>`;
    })
    .join('');
}

function renderInv03(form: Inv03AssetLoanForm): string {
  return `<section class="inv-doc inv-03">
    <div class="inv-03-top">
      <div class="inv-03-no">${esc(form.loanNoDisplay)}</div>
      <div class="inv-03-center">
        <h1>${esc(form.title)}</h1>
        <div>${esc(form.divisionHeader)}</div>
      </div>
      <div class="inv-03-date">${esc(form.loanDateDisplay)}</div>
    </div>
    <div class="inv-03-borrower">
      ${form.borrowerInfoLines.map(line => `<p>${esc(line)}</p>`).join('')}
    </div>
    ${renderTable(form.table, 'inv-03-table')}
    <div class="inv-03-stage inv-keep-together">
      <div class="inv-stage-heading">ส่วนที่ ๑ การยืมครุภัณฑ์</div>
      <div class="inv-sig-grid-3">
        ${form.loanSignatures.map(sig => renderSigCell(sig, '..........................')).join('')}
      </div>
    </div>
    <div class="inv-03-return-box inv-keep-together">
      <div class="inv-stage-heading">ส่วนที่ ๒ การส่งคืนครุภัณฑ์</div>
      <div class="inv-return-fields">
        <div>${esc(form.returnSection.actualReturnDateDisplay)}</div>
        <div>${esc(form.returnSection.conditionAfterDisplay)}</div>
      </div>
      <div class="inv-sig-grid-2">
        ${renderSigCell(form.returnSection.returner, '..............................')}
        ${renderSigCell(form.returnSection.inspector, '..............................')}
      </div>
    </div>
  </section>`;
}

function renderInv04(form: Inv04CutOffSummaryForm): string {
  return `<section class="inv-doc inv-04">
    <div class="inv-04-head">
      <h1>${esc(form.headingLine1)}</h1>
      <div class="inv-04-sub">${esc(form.headingLine2)}</div>
    </div>
    ${renderTable(form.table, 'inv-04-table')}
    <div class="inv-sig-grid-2 inv-keep-together">
      ${form.signatures.map(sig => renderSigCell(sig, '..................................')).join('')}
    </div>
  </section>`;
}

function renderInv05(form: Inv05AnnualAudit213Form, garudaUri: string): string {
  const m = form.memoHeader;
  const garudaHtml = garudaUri
    ? `<img class="inv-memo-garuda" src="${garudaUri}" alt="ตราครุฑ">`
    : '';
  return `<section class="inv-doc inv-05">
    <div class="inv-memo-head">
      ${garudaHtml}
      <div class="inv-memo-title">บันทึกข้อความ</div>
    </div>
    <div class="inv-memo-field"><b>ส่วนราชการ</b> <span>${esc(m.governmentUnit)}</span></div>
    <div class="inv-memo-row">
      <div class="inv-memo-field"><b>ที่</b> <span>${esc(m.docNo)}</span></div>
      <div class="inv-memo-field"><b>วันที่</b> <span>${esc(m.dateDisplay)}</span></div>
    </div>
    <div class="inv-memo-field"><b>เรื่อง</b> <span>${esc(m.subject)}</span></div>
    <div class="inv-memo-recipient">เรียน ${esc(m.recipient)}</div>
    ${form.paragraphs.map(text => `<p class="inv-indent">${esc(text)}</p>`).join('')}
    <h2 class="inv-section-title">๑. สรุปยอดวัสดุคงเหลือยกไปปีงบประมาณถัดไป</h2>
    ${renderTable(form.materialOverviewTable)}
    <h2 class="inv-section-title">๒. สรุปทะเบียนครุภัณฑ์ประจำกองแยกตามสภาพ</h2>
    ${renderTable(form.assetConditionTable)}
    <h2 class="inv-section-title">๓. รายละเอียดทะเบียนครุภัณฑ์ประจำกอง</h2>
    ${renderTable(form.assetDetailTable)}
    <div class="inv-sig-chain inv-keep-together">
      <div class="inv-sig-center-row">${renderSigCell(form.signatures.committee, '..................................')}</div>
      <div class="inv-sig-grid-2">
        ${renderSigCell(form.signatures.clerk, '..................................')}
        ${renderSigCell(form.signatures.mayor, '..................................')}
      </div>
    </div>
  </section>`;
}

export function renderInventoryHtml(
  form: InventoryFormIR,
  assets: InventoryPrintAssets = loadInventoryPrintAssets(),
): string {
  const isLandscape = form.formCode === 'INV-02' && !!form.landscape;
  const isMemo = form.formCode === 'INV-05';
  const topMm = isMemo ? 15 : 18;
  const sideLeftMm = isMemo ? 30 : 18;
  const sideRightMm = isMemo ? 20 : 16;
  const bottomMm = 18;

  let bodyHtml = '';
  switch (form.formCode) {
    case 'INV-01':
      bodyHtml = renderInv01(form);
      break;
    case 'INV-02':
      bodyHtml = renderInv02(form);
      break;
    case 'INV-03':
      bodyHtml = renderInv03(form);
      break;
    case 'INV-04':
      bodyHtml = renderInv04(form);
      break;
    case 'INV-05':
      bodyHtml = renderInv05(form, assets.garudaUri);
      break;
  }

  return `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${esc(form.title)}</title>
<style>
  ${assets.regularFontUri ? `@font-face{font-family:'TH Sarabun IT๙';src:url('${assets.regularFontUri}') format('truetype');font-weight:400;font-style:normal;font-display:block}` : ''}
  ${assets.boldFontUri ? `@font-face{font-family:'TH Sarabun IT๙';src:url('${assets.boldFontUri}') format('truetype');font-weight:700;font-style:normal;font-display:block}` : ''}
  @page {
    size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
    margin: ${topMm}mm ${sideRightMm}mm ${bottomMm}mm ${sideLeftMm}mm;
  }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0; background: #fff; color: #000;
    font-family: ${SARABUN_RULES.fontFamily};
    font-size: 16pt; line-height: 1.18;
  }
  h1 { margin: 0; font-size: 20pt; font-weight: 700; line-height: 1.15; }
  h2.inv-section-title { margin: 10pt 0 4pt; font-size: 16pt; font-weight: 700; break-after: avoid; page-break-after: avoid; }
  p { margin: 0 0 4pt; }
  .inv-indent { text-indent: 25mm; }
  .inv-page-break { break-before: page; page-break-before: always; }
  .inv-keep-together { break-inside: avoid; page-break-inside: avoid; }

  /* INV-01 ใบเบิกวัสดุ */
  .inv-01-no { text-align: right; font-size: 15pt; margin-bottom: 2pt; }
  .inv-01-title { text-align: center; margin: 0 0 4pt; }
  .inv-01-right-meta { text-align: right; margin: 0 0 8pt; line-height: 1.18; }
  .inv-01-agency, .inv-01-loc { font-size: 16pt; font-weight: 700; }
  .inv-01-date { font-size: 16pt; margin-top: 2pt; }
  .inv-01-narrative { margin-bottom: 8pt; text-align: justify; }

  /* INV-02 บัญชีวัสดุ */
  .inv-02-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; margin-bottom: 4pt; }
  .inv-02-left { font-size: 15pt; }
  .inv-02-center { text-align: center; }
  .inv-02-center h1 { font-size: 19pt; }
  .inv-02-muni { font-size: 16pt; font-weight: 700; }
  .inv-02-right { text-align: right; font-size: 15pt; line-height: 1.15; }
  .inv-meta-grid { width: 100%; border-collapse: collapse; margin-bottom: 6pt; font-size: 15pt; }
  .inv-meta-grid td { border: 0; padding: 1.5pt 4pt 1.5pt 0; vertical-align: top; }

  /* INV-03 ใบยืม-คืนครุภัณฑ์ */
  .inv-03-top { display: grid; grid-template-columns: 1fr auto 1fr; align-items: start; margin-bottom: 8pt; }
  .inv-03-center { text-align: center; font-weight: 700; }
  .inv-03-date { text-align: right; }
  .inv-03-borrower { margin-bottom: 6pt; }
  .inv-stage-heading { font-weight: 700; margin: 8pt 0 4pt; }
  .inv-03-return-box { border: 1px solid #000; padding: 6pt 10pt 8pt; margin-top: 10pt; }
  .inv-return-fields { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; margin-bottom: 4pt; }

  /* INV-04 รายงานสรุป */
  .inv-04-head { text-align: center; margin-bottom: 8pt; }
  .inv-04-head h1 { font-size: 18pt; }
  .inv-04-sub { font-size: 16pt; font-weight: 700; }

  /* INV-05 บันทึกข้อความข้อ 213 */
  .inv-memo-head { position: relative; min-height: 16mm; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 6pt; }
  .inv-memo-garuda { position: absolute; left: 0; top: 0; height: 15mm; width: auto; }
  .inv-memo-title { font-size: 29pt; font-weight: 700; line-height: 1; }
  .inv-memo-field { border-bottom: 1px dotted #000; padding-bottom: 1pt; margin-bottom: 3pt; }
  .inv-memo-field b { font-size: 18pt; }
  .inv-memo-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .inv-memo-recipient { margin: 6pt 0; }

  /* Shared Tables (thead repeats cleanly on every PDF page!) */
  .inv-table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 4pt 0 8pt; font-size: 15pt; }
  .inv-table thead { display: table-header-group; }
  .inv-table tr { break-inside: avoid; page-break-inside: avoid; }
  .inv-table th, .inv-table td { border: 1px solid #000; padding: 3pt 4pt; vertical-align: middle; overflow-wrap: break-word; word-break: break-word; line-height: 1.15; }
  .inv-table th { font-weight: 700; text-align: center; background: #f6f6f6; }
  .inv-table-compact th, .inv-table-compact td { padding: 2pt 3pt; }
  .inv-table tr.inv-filler td { height: 22pt; }
  .inv-table tr.inv-subtotal td { background: #fafafa; font-weight: 700; }
  .inv-table tr.inv-grand-total td { background: #f1f1f1; font-weight: 700; }

  /* Signatures (Anti-Orphan) */
  .inv-sig-grid-2x2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 8mm; margin-top: 10pt; }
  .inv-sig-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm 8mm; margin-top: 8pt; }
  .inv-sig-grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4mm 4mm; margin-top: 6pt; }
  .inv-sig-center-row { max-width: 90mm; margin: 6pt auto 0; }
  .inv-sig-cell { text-align: center; font-size: 15pt; line-height: 1.18; }
  .inv-sig-space { height: 24pt; }
  .inv-sig-line { white-space: nowrap; }
</style>
</head>
<body>${bodyHtml}</body>
</html>`;
}
