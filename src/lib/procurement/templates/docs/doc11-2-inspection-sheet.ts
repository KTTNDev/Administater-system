import {documentModel, paragraph as p, cluster, inspectorSignatures, dateText, type TemplateContext} from '../helpers';
export function buildDoc112(x: TemplateContext) {
  const {c, agency: a, terms: t} = x, r = c.inspectionResult;
  const doc = documentModel(x, '11.2', 'INSPECTION_SHEET', `ใบตรวจรับการ${t.action}`, [
    p(`ตาม ${t.orderDocTitle} เลขที่ ${x.poNumber} ลงวันที่ ${dateText(c.docs.doc10_purchaseOrder.date)} ${a.municipalityName} ได้ตกลง${t.actionVerb}${x.title} จำนวน ${x.count} รายการ เป็นเงินทั้งสิ้น ${x.total} บาท (${x.amountWords})`),
    p(`${x.inspectorTitle} ได้ตรวจรับงานแล้ว ผลปรากฏว่า`),
    {kind: 'checkboxes', groups: [
      {label: 'ผลการตรวจรับ', choices: [{text: 'ถูกต้อง', checked: r.isCorrect}, {text: 'ครบถ้วนตามสัญญา', checked: r.isComplete}, {text: 'ไม่ครบถ้วนตามสัญญา', checked: !r.isComplete}]},
      {label: 'ค่าปรับ', choices: [{text: 'มีค่าปรับ', checked: r.hasPenalty}, {text: 'ไม่มีค่าปรับ', checked: !r.hasPenalty}]},
    ]},
    cluster([], inspectorSignatures(x)),
  ]);
  doc.header.lines.push(`วันที่ ${dateText(c.docs.doc11_1_inspectionReport.date)}`);
  return doc;
}
