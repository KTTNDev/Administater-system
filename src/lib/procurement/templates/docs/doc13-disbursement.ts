import {memo, paragraph as p, table, moneyText, cluster, signatory, approvalBoxes, type TemplateContext} from '../helpers';
export function buildDoc13(x: TemplateContext) {
  const {c, terms: t} = x;
  const display = (n: number) => n === 0 ? '-' : moneyText(n);
  return memo(x, '13', `ขออนุมัติเบิกจ่ายเงินค่า${x.title}`, [
    p(x.budgetNarrative, 'เรื่องเดิม'),
    table(['รายการ', 'จำนวนเงิน (บาท)', 'รายการ', 'จำนวนเงิน (บาท)'], [
      ['ตั้งไว้', moneyText(c.budgetLine.allocatedAmount), 'โอนเพิ่ม', display(c.budgetLine.transferInAmount)],
      ['โอนลด', display(c.budgetLine.transferOutAmount), 'รวมเป็นเงิน', moneyText(c.totalBudget)],
      ['เบิกจ่ายแล้ว', display(c.budgetSpentBefore), 'คงเหลือ', moneyText(c.budgetRemainingBefore)],
    ], false),
    p(`เห็นควรเบิกจ่ายค่า${t.actionVerb}${x.title} จำนวน ${x.count} รายการ ให้แก่ ${c.vendor.shopName} เป็นเงิน ${x.total} บาท (${x.amountWords}) ตามระเบียบฯ ต่อไป`, 'ข้อเท็จจริง'),
    p('จึงเรียนมาเพื่อโปรดพิจารณาอนุมัติ และโปรดลงนามในฎีกาที่แนบมาด้วยแล้ว', 'ข้อเสนอเพื่อพิจารณา'),
    cluster([], [signatory(c.signatories.divisionDirector)], approvalBoxes(x, 2, '13')),
  ]);
}
