import {memo, paragraph as p, cluster, inspectorSignatures, approvalBoxes, dateText, type TemplateContext} from '../helpers';
/** Wording of clause 175(4) transcribed from the agency's latest inspection-report reference. */
const inspectionLaw = 'ระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ข้อ ๑๗๕ คณะกรรมการตรวจรับพัสดุในงานซื้อหรืองานจ้าง มีหน้าที่ ดังนี้ (๔) เมื่อตรวจถูกต้องครบถ้วนแล้ว ให้รับพัสดุไว้และถือว่าผู้ขายหรือผู้รับจ้างได้ส่งมอบพัสดุถูกต้องครบถ้วนตั้งแต่วันที่ผู้ขายหรือผู้รับจ้างนำพัสดุนั้นมาส่ง แล้วมอบแก่เจ้าหน้าที่พร้อมกับทำใบตรวจรับโดยลงชื่อไว้เป็นหลักฐานอย่างน้อย ๒ ฉบับ มอบแก่ผู้ขายหรือผู้รับจ้าง ๑ ฉบับ และเจ้าหน้าที่ ๑ ฉบับ เพื่อดำเนินการเบิกจ่ายเงินตามระเบียบของหน่วยงานของรัฐและรายงานให้หัวหน้าหน่วยงานของรัฐทราบ';
export function buildDoc111(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  const accepted = c.inspectionResult.isCorrect && c.inspectionResult.isComplete;
  const isEgp = c.workflowMode === 'EGP_OVER_5000';
  const rawCtrl = c.docs.inspectionControlNo?.trim() || '';
  const egpCtrl = rawCtrl
    ? (/^[-/\d๐-๙]+$/.test(rawCtrl) ? `CNTR${rawCtrl}` : rawCtrl)
    : 'CNTR........';
  const inspectionRef = isEgp
    ? `ตามเลขคุมตรวจรับ ${egpCtrl} ลงวันที่ ${dateText(c.docs.doc11_1_inspectionReport.date)}`
    : `ตามใบตรวจรับ ลงวันที่ ${dateText(c.docs.doc11_1_inspectionReport.date)}`;
  return memo(x, '11.1', 'รายงานผลการตรวจรับพัสดุ', [
    p(`ตามคำสั่ง${a.municipalityName} ที่ ${x.numbers.doc6_2_inspectorOrder || '........'} ลงวันที่ ${dateText(c.docs.doc6_2_inspectorOrder.date)} เรื่อง แต่งตั้ง${x.inspectorTitle} สำหรับการ${t.actionVerb}${x.title} จำนวน ${x.count} รายการ โดยวิธีเฉพาะเจาะจง และตาม${t.orderDocTitle} เลขที่ ${x.poNumber} ลงวันที่ ${dateText(c.docs.doc10_purchaseOrder.date)} โดยคู่สัญญาคือ ${c.vendor.shopName} ครบกำหนดส่งมอบวันที่ ${dateText(c.due?.effectiveDueDate)} นั้น`, 'เรื่องเดิม'),
    p(`${t.counterpartyLabel}ได้ส่งมอบ${t.deliveryObject} ตามใบตรวจรับการ${t.action} ลงวันที่ ${dateText(c.deliveryDate)} ${x.inspectorTitle}ได้ตรวจรับพัสดุในวันที่ ${dateText(c.docs.doc11_1_inspectionReport.date)} ผลปรากฏว่า${accepted ? 'ถูกต้องครบถ้วนตามที่ระบุไว้ในสัญญา' : 'ยังไม่ถูกต้องหรือไม่ครบถ้วนตามสัญญา ต้องดำเนินการแก้ไขก่อนรับมอบ'} จึงได้ลงชื่อ${inspectionRef} ไว้เป็นหลักฐาน`, 'ข้อเท็จจริง'),
    p(inspectionLaw, 'ข้อระเบียบและกฎหมาย'),
    p(`เพื่อให้เป็นไปตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ ${accepted ? `เห็นควรอนุมัติเบิกจ่ายเงินให้กับ${t.counterpartyLabel} เป็นเงิน ${x.total} บาท (${x.amountWords})` : 'เห็นควรแจ้งคู่สัญญาให้แก้ไขและดำเนินการตรวจรับใหม่ก่อนเสนอเบิกจ่ายเงิน'}`, 'ข้อเสนอเพื่อพิจารณา'),
    cluster(['จึงเรียนมาเพื่อโปรดทราบถึงผลการตรวจรับพัสดุดังกล่าว'], inspectorSignatures(x), approvalBoxes(x, 3, '11.1')),
  ]);
}
