import {documentModel, paragraph as p, cluster, signatory, dateText, text, routingStrip, type TemplateContext} from '../helpers';
export function buildDoc08(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  const doc = documentModel(x, '8', 'ANNOUNCEMENT', `ประกาศ${a.municipalityName}`, [
    p(`ตามที่ ${a.municipalityName} ได้มีโครงการ${t.actionVerb}${x.title} จำนวน ${x.count} รายการ โดยวิธีเฉพาะเจาะจง นั้น`),
    p(`บัดนี้ ${t.actionVerb}${x.title} จำนวน ${x.count} รายการ ผู้ได้รับการคัดเลือก ได้แก่ ${c.vendor.shopName} (${c.vendor.businessTypeTag}) โดยเสนอราคา เป็นเงินทั้งสิ้น ${x.total} บาท (${x.amountWords}) ${x.vatInclusionPhrase}`),
    cluster([`ประกาศ ณ วันที่ ${dateText(c.docs.doc8_winnerAnnouncement.date)}`], [signatory(c.signatories.mayor)]),
  ]);
  // registryLogNo belongs exclusively to the registry, never to printable document content.
  doc.header.lines = [text(`ประกาศ${a.municipalityName}`), text(`เรื่อง ประกาศผู้ชนะการเสนอราคา${t.actionVerb}${x.title} จำนวน ${x.count} รายการ`), text(`ของ${a.divisionName} ${a.municipalityName} โดยวิธีเฉพาะเจาะจง`), '................................................................'];
  doc.routingStrip = routingStrip(x);
  return doc;
}
