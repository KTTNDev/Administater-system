import {memo, paragraph as p, cluster, signatory, approvalBoxes, law21, type TemplateContext} from '../helpers';
export function buildDoc02(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  return memo(x, '2', `ขออนุมัติมอบหมายหน้าที่การกำหนดคุณลักษณะเฉพาะค่า${t.actionVerb}${x.title} จำนวน ${x.count} รายการ`, [
    p(x.budgetNarrative, 'เรื่องเดิม'),
    p(`เนื่องจาก ${a.divisionName} ${a.municipalityName} มีความประสงค์จะดำเนินการ${t.actionVerb}${x.title} จำนวน ${x.count} รายการ เพื่อใช้ในการปฏิบัติงานราชการของ${a.divisionName} ให้เป็นไปอย่างเรียบร้อยและเกิดความสะดวกแก่เจ้าหน้าที่ผู้ปฏิบัติงาน`, 'ข้อเท็จจริง'),
    ...law21(),
    p(`เพื่อความเป็นระเบียบเรียบร้อย และให้การ${t.actionVerb}เป็นไปด้วยความเรียบร้อยถูกต้องตามพระราชบัญญัติการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ และระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๒๑ จึงมอบหมายให้ ${c.signatories.procurementOfficer.fullName} ตำแหน่ง ${c.signatories.procurementOfficer.position} เป็นเจ้าหน้าที่ โดยให้มีหน้าที่ดำเนินการกำหนดคุณลักษณะเฉพาะค่า${t.actionVerb}${x.title} จำนวน ${x.count} รายการ`, 'ข้อพิจารณาและข้อเสนอ'),
    cluster(['จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ และแจ้งเจ้าหน้าที่ที่เกี่ยวข้องดำเนินการต่อไป'], [signatory(c.signatories.divisionDirector)], approvalBoxes(x, 2, '2')),
  ]);
}
