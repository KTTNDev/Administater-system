import {documentModel, paragraph as p, cluster, signatory, dateText, text, type TemplateContext} from '../helpers';
export function buildDoc09(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  const doc = documentModel(x, '9', 'EXTERNAL_LETTER', 'แจ้งลงนามในสัญญา', [
    p(`ตามที่ ${a.municipalityName} มีความประสงค์${t.actionVerb}${x.title} จำนวน ${x.count} รายการ โดยวิธีเฉพาะเจาะจง และ ${c.vendor.shopName} โดย ${c.vendor.contactPersonName} ได้เสนอราคาเป็นเงินทั้งสิ้น ${x.total} บาท (${x.amountWords}) นั้น`),
    p(`ในการนี้ ${a.municipalityName} พิจารณาแล้วตกลง${t.actionVerb}เป็นเงินทั้งสิ้น ${x.total} บาท (${x.amountWords}) และขอให้ดำเนินการทำสัญญาภายใน ${c.deliveryDays} วัน นับถัดจากวันที่ได้รับหนังสือฉบับนี้`),
    cluster(['จึงเรียนมาเพื่อโปรดทราบ', 'ขอแสดงความนับถือ'], [signatory(c.signatories.mayor)]),
  ]);
  doc.header = {lines: [], number: text(x.numbers.doc9_contractNotice || `${a.codes.externalLetterPrefix}/........`), addressLines: [a.officeTitle, a.externalAddressLine].map(text), date: dateText(c.docs.doc9_contractNotice.date), subject: 'แจ้งลงนามในสัญญา', recipient: text(c.vendor.contactPersonName)};
  doc.footerLines = [a.divisionName, a.subDepartmentFooter, `โทร. ${a.phoneShort}`, `โทรสาร ${a.fax}`].map(text);
  return doc;
}
