import {memo, paragraph as p, table, vatFooter, cluster, signatory, approvalBoxes, type TemplateContext} from '../helpers';
export function buildDoc07(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  const summary = table(['รายการพิจารณา', 'รายชื่อผู้ยื่นข้อเสนอ', 'ราคาที่เสนอ*', `ราคาที่ตกลง${t.shortVerb}*`], [[`ค่า${t.actionVerb}${x.title} จำนวน ${x.count} รายการ`, c.vendor.shopName, x.total, x.total]]);
  summary.footerRows = vatFooter(x, 4);
  summary.columnWidths = [35, 25, 20, 20];
  return memo(x, '7', `รายงานผลการพิจารณาและขออนุมัติสั่ง${t.shortVerb}`, [
    p(`ขอรายงานผลการพิจารณาค่า${t.actionVerb}${x.title} จำนวน ${x.count} รายการ โดยวิธีเฉพาะเจาะจง ดังนี้`), summary,
    p(`* ราคาที่เสนอ และราคาที่ตกลง${t.shortVerb} เป็นราคา${x.vatInclusionPhrase.replace('ซึ่ง', '')}`, undefined, false),
    p(`เกณฑ์การพิจารณาผลการยื่นข้อเสนอครั้งนี้ จะพิจารณาตัดสินโดยใช้หลักเกณฑ์ราคา ${a.municipalityName} พิจารณาแล้ว เห็นสมควร${t.action}จากผู้เสนอราคาดังกล่าว`, 'ผลการพิจารณา'),
    cluster([`จึงเรียนมาเพื่อโปรดพิจารณา หากเห็นชอบขอได้โปรดอนุมัติให้สั่ง${t.shortVerb}จากผู้เสนอราคาดังกล่าว`], [signatory(c.signatories.procurementOfficer)], approvalBoxes(x, 3, '7')),
  ]);
}
