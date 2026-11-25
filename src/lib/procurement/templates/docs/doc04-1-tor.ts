import {toThaiDigits} from '../../formatting';
import {documentModel, paragraph as p, itemsTable, cluster, signatory, moneyText, type TemplateContext} from '../helpers';
export function buildDoc041(x: TemplateContext) {
  const {c, agency: a, terms: t} = x;
  const warrantyDisplay = c.warrantyText?.trim() ? c.warrantyText.trim() : c.warrantyYears && c.warrantyYears > 0 ? `${c.warrantyYears} ปี` : '-';
  const doc = documentModel(x, '4.1', 'TOR', `รายละเอียดคุณลักษณะเฉพาะค่า${t.actionVerb}${x.title} จำนวน ${x.count} รายการ`, [
    p(`ด้วย ${a.divisionName} จะ${t.actionVerb}${x.title} จำนวน ${x.count} รายการ`, '๑. ความเป็นมา'),
    p(`เพื่อใช้ในการปฏิบัติงานราชการของ${a.divisionName} ให้เป็นไปอย่างเรียบร้อยและเกิดความสะดวกแก่เจ้าหน้าที่ผู้ปฏิบัติงาน`, '๒. วัตถุประสงค์'),
    p('๓.๑ ผู้ประสงค์จะเสนอราคาต้องเป็นผู้ประกอบการที่มีคุณสมบัติตรงตามเงื่อนไขที่เทศบาลกำหนดและผู้ประสงค์จะเสนอราคาจะต้องมีอาชีพเกี่ยวข้องกับลักษณะงานที่เทศบาลต้องการ', '๓. คุณสมบัติของผู้ยื่นราคา'),
    p('๓.๒ ไม่เป็นบุคคลซึ่งถูกระบุชื่อไว้ในบัญชีรายชื่อผู้ทิ้งงานและได้แจ้งเวียนชื่อให้เป็นผู้ทิ้งงานของหน่วยงานของรัฐในระบบเครือข่ายสารสนเทศของกรมบัญชีกลาง ซึ่งรวมถึงนิติบุคคลที่ผู้ทิ้งงานเป็นหุ้นส่วนผู้จัดการ กรรมการผู้จัดการ ผู้บริหารผู้มีอำนาจในการกิจการของนิติบุคคลนั้นด้วย'),
    p('๓.๓ ผู้ประสงค์จะเสนอราคาต้องไม่เป็นผู้มีประโยชน์ร่วมกันกับผู้ประสงค์จะเสนอราคารายอื่นหรือไม่เป็นผู้กระทำการอันเป็นการขัดขวางการแข่งขันราคาอย่างเป็นธรรม'),
    p('', '๔. รายละเอียดคุณลักษณะเฉพาะและเงื่อนไขของงาน'),
    p('', `๔.๑ รายละเอียดคุณลักษณะเฉพาะของค่า${x.title}`),
    {...itemsTable(x), bordered: false},
    p(`๔.๒.๑ ${t.counterpartyLabel}จะต้องส่งมอบ${t.deliveryObject}ให้กับ${t.buyerLabel}ภายใน ${c.deliveryDays} วัน นับถัดจากวันที่ลงนามในสัญญา/${t.orderDocTitle} ${a.deliveryAddressFull}`, `๔.๒ เงื่อนไขของงาน${t.shortVerb}`),
    p(`๔.๒.๒ ${t.buyerLabel}จะจ่ายเงินให้กับ${t.counterpartyLabel} เมื่อได้รับมอบ${t.deliveryObject}ถูกต้อง ครบถ้วน และ${x.inspectorTitle}ได้ตรวจรับไว้ถูกต้อง ครบถ้วนตามคุณลักษณะที่${a.municipalityName}กำหนดไว้`),
    p(`กำหนดส่งมอบ${t.deliveryObject}ภายใน ${c.deliveryDays} วัน นับถัดจากวันลงนามใน${t.orderDocTitle}`, '๕. กำหนดเวลาส่งมอบพัสดุ'),
    p('ใช้เกณฑ์พิจารณาถึงประโยชน์ของหน่วยงานของรัฐและวัตถุประสงค์ของการใช้งานเป็นสำคัญโดยการคำนึงถึงเกณฑ์ราคา', '๖. หลักเกณฑ์การพิจารณาคัดเลือกข้อเสนอ'),
    p(`เบิกจ่ายตาม${x.budgetBasis} คงเหลือ ${moneyText(c.budgetRemainingBefore)} บาท`, '๗. วงเงินงบประมาณ/วงเงินที่ได้รับจัดสรร'),
    p(`${toThaiDigits(c.installmentCount)} งวดงาน`, '๘. งวดงานและการจ่ายเงิน'),
    p(`คิดค่าปรับเป็นรายวันในอัตราร้อยละ ${c.penaltyRatePercent.toFixed(2)} ของราคา${t.penaltyBaseLabel}ที่ยังไม่ได้รับมอบ แต่ต้องไม่ต่ำกว่าวันละ ${moneyText(c.minPenaltyPerDay)} บาท`, '๙. อัตราค่าปรับ'),
    p(warrantyDisplay, '๑๐. การกำหนดระยะเวลารับประกันความชำรุดบกพร่อง (ถ้ามี)'),
    cluster([], [signatory(c.signatories.procurementOfficer, 'เจ้าหน้าที่กำหนดคุณลักษณะเฉพาะฯ')]),
  ]);
  doc.header.lines.push('โดยวิธีเฉพาะเจาะจง');
  return doc;
}
