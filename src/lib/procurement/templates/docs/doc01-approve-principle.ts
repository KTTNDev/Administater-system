import {memo, paragraph as p, cluster, signatory, approvalBoxes, type TemplateContext} from '../helpers';
export function buildDoc01(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  return memo(x, '1', `ขออนุมัติ${t.action}ตามระเบียบพัสดุ`, [
    p(x.budgetNarrative, 'เรื่องเดิม'),
    p(`เนื่องจาก ${a.divisionName} มีความจำเป็นต้อง${t.actionVerb}${x.title} จำนวน ${x.count} รายการ เพื่อใช้ในการปฏิบัติงานราชการภายในสำนักงาน${a.divisionName}`, 'ข้อเท็จจริง'),
    p(c.purposeText, 'เหตุผลและความจำเป็น'),
    p('ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๒๒ ข้อ ๒๘ ข้อ ๗๘ ข้อ ๗๙ และข้อ ๘๖', 'ข้อระเบียบและกฎหมาย'),
    p('เพื่อให้เจ้าหน้าที่พัสดุดำเนินงานเป็นไปอย่างถูกต้องตามระเบียบฯ ข้างต้น เห็นควรดำเนินการ ดังนี้', 'ข้อพิจารณาและข้อเสนอ'),
    p(`${t.action}กรณีวิธีเฉพาะเจาะจง`),
    p(`๑. อนุมัติ${t.action} โดยวิธีเฉพาะเจาะจง\n๒. อนุมัติรายงานขอ${t.shortVerb}\n๓. อนุมัติรายงานผลการพิจารณาและอนุมัติสั่ง${t.shortVerb}\n๔. อนุมัติให้เบิกจ่ายเงินแก่เจ้าหนี้ต่อไป`),
    cluster(['จึงเรียนมาเพื่อโปรดทราบ และพิจารณาอนุมัติดำเนินการต่อไป'], [signatory(c.signatories.procurementOfficer, 'เจ้าหน้าที่พัสดุ')], approvalBoxes(x, 3, '1')),
  ]);
}
