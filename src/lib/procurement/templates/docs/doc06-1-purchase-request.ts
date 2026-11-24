import {memo, paragraph as p, itemsTable, needsAttachment, inspectorList, cluster, signatory, approvalBoxes, moneyText, text, type TemplateContext} from '../helpers';
export function buildDoc061(x: TemplateContext) {
  const {c, agency: a, terms: t} = x, attached = needsAttachment(x);
  const doc = memo(x, '6.1', `รายงานขอ${t.shortVerb}${x.title}`, [
    p(`ด้วย ${a.divisionName} ${a.municipalityName} มีความประสงค์จะขอ${t.shortVerb}${x.title} โดยขอเบิกจ่ายตาม${x.budgetBasis} คงเหลือ ${moneyText(c.budgetRemainingBefore)} บาท เบิกจ่ายครั้งนี้ ${x.total} บาท ซึ่งมีรายละเอียดดังต่อไปนี้`),
    p(c.purposeText, '๑. เหตุผลและความจำเป็น'),
    p(attached ? 'รายละเอียดตามที่แนบ' : c.items.map((item, i) => `${i + 1}. ${item.description} จำนวน ${item.quantity} ${item.unit}`).join('\n'), '๒. รายละเอียดของพัสดุ'),
    p(`ราคากลางพัสดุที่จะ${t.shortVerb} เป็น ${x.total} บาท`, '๓. ราคากลาง'),
    p(`วงเงินที่จะขอ${t.shortVerb}ครั้งนี้ ${x.total} บาท (${x.amountWords})`, '๔. วงเงิน'),
    p(`กำหนดเวลาที่ต้องการใช้พัสดุ ภายใน ${c.deliveryDays} วัน นับถัดจากวันลงนามใน${t.orderDocTitle}`, '๕. กำหนดเวลา'),
    p(`${t.shortVerb}โดยวิธีเฉพาะเจาะจง เนื่องจากเป็นสินค้า งานบริการ หรืองานก่อสร้างทั่วไปที่มีวงเงินไม่เกิน ๕๐๐,๐๐๐ บาท ตามพระราชบัญญัติการจัดซื้อจัดจ้างฯ พ.ศ. ๒๕๖๐ มาตรา ๕๖ วรรคหนึ่ง (๒) (ข)`, `๖. วิธีที่จะ${t.shortVerb}และเหตุผล`),
    p('โดยใช้เกณฑ์ราคา', '๗. หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ'),
    p(`เห็นควรแต่งตั้ง${x.inspectorTitle} ตามเสนอ`, '๘. ข้อเสนออื่น ๆ'),
    ...inspectorList(x),
    cluster(['จึงเรียนมาเพื่อโปรดพิจารณา', `๑. เห็นชอบในรายงานขอ${t.shortVerb}ดังกล่าวข้างต้น`, `๒. อนุมัติแต่งตั้ง${x.inspectorTitle}ตามรายชื่อที่เสนอข้างต้น`], [signatory(c.signatories.procurementOfficer, 'เจ้าหน้าที่พัสดุ')], approvalBoxes(x, 3, '6.1')),
  ]);
  if (attached) doc.pages.push({purpose: 'attachment', heading: ['เอกสารแนบท้าย', text(`${c.budgetLine.categoryType} จำนวน ${x.count} รายการ`)], blocks: [p(`แนบท้ายรายงานขอ${t.shortVerb} ที่ ${doc.header.number} ลงวันที่ ${doc.header.date}`, undefined, false), itemsTable(x)]});
  return doc;
}
