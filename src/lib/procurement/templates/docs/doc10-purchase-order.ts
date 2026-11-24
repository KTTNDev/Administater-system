import {documentModel, paragraph as p, table, vatFooter, cluster, signatory, dateText, moneyText, text, type TemplateContext} from '../helpers';
export function buildDoc10(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  const rows = x.options.poTableMode === 'ITEMIZED'
    ? c.items.map((item, i) => [String(i + 1), item.description, String(item.quantity), item.unit, moneyText(item.unitPrice), moneyText(c.lineTotals[i])])
    : [['๑', `ค่า${t.actionVerb}${x.title} จำนวน ${x.count} รายการ`, x.count, 'รายการ', x.total, x.total]];
  const items = table(['ลำดับ', 'รายการ', 'จำนวน', 'หน่วย', 'ราคาต่อหน่วย (บาท)', 'จำนวนเงิน (บาท)'], rows);
  items.footerRows = [[{text: `(${x.amountWords})`, colspan: 6}], ...vatFooter(x, 6)];
  items.columnWidths = [7, 39, 10, 10, 17, 17];
  const doc = documentModel(x, '10', 'PURCHASE_ORDER', t.orderDocTitle, [
    {kind: 'metadata', columns: [
      [`${t.counterpartyLabel} ${c.vendor.shopName}`, `ที่อยู่ ${c.vendor.address}`, `โทรศัพท์ ${c.vendor.phone}`, `เลขประจำตัวผู้เสียภาษี ${c.vendor.taxId}`].map(text),
      [`${t.orderDocTitle} เลขที่ ${x.poNumber}`, `วันที่ ${dateText(c.docs.doc10_purchaseOrder.date)}`, `ส่วนราชการ ${a.municipalityName}`, `ที่อยู่ ${a.poAgencyAddress}`, `โทรศัพท์ ${a.phoneShort}`].map(text),
    ]}, items,
    p(`๑. กำหนดส่งมอบภายใน ${c.deliveryDays} วัน นับถัดจากวันลงนามใน${t.orderDocTitle}`, 'เงื่อนไข'),
    p(`๒. สถานที่ส่งมอบ ${a.deliveryAddressFull}`),
    p(`๓. ระยะเวลารับประกัน ${c.warrantyYears === null ? '-' : c.warrantyYears} ปี`),
    p(`๔. สงวนสิทธิ์ค่าปรับกรณีส่งมอบเกินกำหนด โดยคิดค่าปรับเป็นรายวันในอัตราร้อยละ ${c.penaltyRatePercent.toFixed(2)} ของราคา${t.penaltyBaseLabel}ที่ยังไม่ได้รับมอบ แต่จะต้องไม่ต่ำกว่าวันละ ${moneyText(c.minPenaltyPerDay)} บาท`),
    p(`๕. ส่วนราชการสงวนสิทธิ์ที่จะไม่รับมอบถ้าปรากฏว่า${t.deliveryObject}นั้นมีลักษณะไม่ตรงตามรายการที่ระบุไว้ใน${t.orderDocTitle}`),
    p('๖. การประเมินผลการปฏิบัติงานของผู้ประกอบการ หน่วยงานของรัฐสามารถนำผลการปฏิบัติงานแล้วเสร็จตามสัญญาหรือข้อตกลงไปใช้ในการประเมินผลการปฏิบัติงานของผู้ประกอบการตามหลักเกณฑ์ที่กำหนด'),
    p(`๑. การติดอากรแสตมป์ให้เป็นไปตามประมวลกฎหมายรัษฎากร หากต้องการให้${t.orderDocTitle}มีผลตามกฎหมาย`, 'หมายเหตุ'),
    p(`๒. ${t.orderDocTitle} เลขที่ ${x.poNumber} ${t.actionVerb}${x.title} จำนวน ${x.count} รายการ โดยวิธีเฉพาะเจาะจง`),
    cluster([], [
      signatory(c.signatories.divisionDirector, t.buyerLabel, c.docs.doc10_purchaseOrder.date),
      signatory({id: c.vendor.id, fullName: c.vendor.contactPersonName, position: c.vendor.contactPersonTitle}, `ผู้รับ${t.orderDocTitle}`, c.docs.doc10_purchaseOrder.date),
    ]),
  ]);
  return doc;
}
