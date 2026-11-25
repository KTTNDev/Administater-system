import {documentModel, paragraph as p, inspectorList, cluster, signatory, dateText, text, routingStrip, type TemplateContext} from '../helpers';
export function buildDoc062(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  const doc = documentModel(x, '6.2', 'ORDER', `คำสั่ง${a.municipalityName}`, [
    p(`ด้วย ${a.municipalityName} มีความประสงค์จะ${t.actionVerb}${x.title} จำนวน ${x.count} รายการ โดยวิธีเฉพาะเจาะจง เพื่อให้การตรวจรับพัสดุเป็นไปตามระเบียบกระทรวงการคลังว่าด้วยการจัดซื้อจัดจ้างและการบริหารพัสดุภาครัฐ พ.ศ. ๒๕๖๐ จึงแต่งตั้ง${x.inspectorTitle} ดังต่อไปนี้`),
    ...inspectorList(x),
    p('**อำนาจและหน้าที่** ทำการตรวจรับพัสดุให้เป็นไปตามเงื่อนไขของสัญญาหรือข้อตกลงนั้น'),
    cluster([`สั่ง ณ วันที่ ${dateText(c.docs.doc6_2_inspectorOrder.date)}`], [signatory(c.signatories.mayor)]),
  ]);
  doc.header.lines = [text(`คำสั่ง${a.municipalityName}`), text(`ที่ ${x.numbers.doc6_2_inspectorOrder || '........'}`), text(`เรื่อง แต่งตั้ง${x.inspectorTitle}`), text(`สำหรับการ${t.actionVerb}${x.title} จำนวน ${x.count} รายการ`), text(`ของ${a.divisionName} ${a.municipalityName} โดยวิธีเฉพาะเจาะจง`), '................................................................'];
  doc.routingStrip = routingStrip(x);
  return doc;
}
