import {memo, paragraph as p, cluster, signatory, dateText, type TemplateContext} from '../helpers';
export function buildDoc12(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  const doc = memo(x, '12', `รายงานผลการพิจารณารายละเอียดวิธีการและขั้นตอนการ${t.actionVerb}พร้อมทั้งเอกสารหลักฐานประกอบการ${t.actionVerb}`, [
    p(`ตามที่ ${a.divisionName} ได้ดำเนินการ${t.actionVerb}${x.title} จำนวน ${x.count} รายการ โดยขออนุมัติ${t.shortVerb}จาก ${c.vendor.shopName} ตั้งอยู่เลขที่ ${c.vendor.address} เลขประจำตัวผู้เสียภาษี ${c.vendor.taxId} โทร. ${c.vendor.phone} โดยวิธีเฉพาะเจาะจง ตาม${t.orderDocTitle} เลขที่ ${x.poNumber} ลงวันที่ ${dateText(c.docs.doc10_purchaseOrder.date)} เป็นจำนวนเงิน ${x.total} บาท (${x.amountWords}) ซึ่ง${t.counterpartyLabel}ได้ส่งมอบงานเมื่อวันที่ ${dateText(c.deliveryDate)} และ${x.inspectorTitle}ได้ตรวจรับพัสดุในวันที่ ${dateText(c.docs.doc11_1_inspectionReport.date)} ผลการตรวจรับ${c.inspectionResult.isCorrect && c.inspectionResult.isComplete ? 'ถูกต้อง ครบถ้วนแล้ว' : 'ยังไม่ถูกต้องหรือไม่ครบถ้วนตามสัญญา'} นั้น`, 'เรื่องเดิม'),
    p(`ได้รวบรวมเอกสารหลักฐานประกอบการ${t.actionVerb} ดังนี้`, 'ข้อเท็จจริง'),
    p(`๑. ร่างขอบเขตของงานหรือรายละเอียดคุณลักษณะเฉพาะ\n๒. รายงานขอ${t.shortVerb}\n๓. คำสั่งแต่งตั้ง${x.inspectorTitle}\n๔. บันทึกรายงานการพิจารณาและขออนุมัติสั่ง${t.shortVerb}\n๕. ประกาศผู้ชนะการเสนอราคา\n๖. ${t.orderDocTitle}\n๗. บันทึกรายงานผลการตรวจรับพัสดุ`),
    p('การจัดซื้อจัดจ้างโครงการใดจะต้องมีเอกสารหลักฐานใดให้เป็นไปตามวิธีการจัดซื้อจัดจ้างนั้น ทั้งนี้การจัดซื้อจัดจ้างที่ได้ดำเนินการผ่านระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์ หน่วยงานของรัฐสามารถใช้เอกสารที่จัดทำในระบบจัดซื้อจัดจ้างภาครัฐด้วยอิเล็กทรอนิกส์เป็นเอกสารประกอบบันทึกรายงานผลการพิจารณาตามวรรคหนึ่งได้'),
    p('ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๑๖', 'ข้อระเบียบและกฎหมาย'),
    p(`${a.divisionName} จึงขอรายงานผลการพิจารณารายละเอียดวิธีการและขั้นตอนการจัดซื้อจัดจ้างพร้อมทั้งเอกสารหลักฐานประกอบการ${t.actionVerb}ที่แนบมาพร้อมนี้`, 'ข้อเสนอเพื่อพิจารณา'),
    cluster(['จึงเรียนมาเพื่อโปรดทราบ'], [signatory(c.signatories.procurementOfficer, 'เจ้าหน้าที่พัสดุ')], [
      {heading: 'ความเห็นของหัวหน้าเจ้าหน้าที่', comments: ['................................................................'], signature: signatory(c.signatories.divisionDirector)},
      {heading: 'ความเห็นของปลัดเทศบาล', comments: ['................................................................'], signature: signatory(c.signatories.municipalClerk)},
      {heading: `ความคิดเห็นของนายก${a.municipalityName}`, comments: ['- ทราบ/เห็นชอบ'], signature: signatory(c.signatories.mayor)},
    ], 'vertical'),
  ]);
  return doc;
}
