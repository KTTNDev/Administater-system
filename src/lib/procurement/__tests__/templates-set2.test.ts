import {it, expect} from 'vitest';
import {renderDocumentHtml} from '../index';
import {templateFixture, modelsFor, findDoc, visibleText} from './templates-fixtures';

it('builds seven manual documents including Doc 13 in the 22,890 baht system workflow', () => {
  const models = modelsFor(templateFixture(22890));
  expect(models.map(d => d.docId)).toEqual(['1', '2', '3', '4.1', '11.1', '11.3', '13']);
  expect(models).toMatchSnapshot();
  expect(visibleText(findDoc(models, '11.1'))).toContain('๒๓ พฤศจิกายน ๒๕๖๙');
  expect(visibleText(findDoc(models, '11.1'))).toContain('จึงได้ลงชื่อตามเลขคุมตรวจรับ CNTR........ ลงวันที่ ๒๔ พฤศจิกายน ๒๕๖๙ ไว้เป็นหลักฐาน');
  const withCtrl = templateFixture(22890);
  withCtrl.docs.inspectionControlNo = 'CNTR-00558/70';
  expect(visibleText(findDoc(modelsFor(withCtrl), '11.1'))).toContain('จึงได้ลงชื่อตามเลขคุมตรวจรับ CNTR-00558/70 ลงวันที่ ๒๔ พฤศจิกายน ๒๕๖๙ ไว้เป็นหลักฐาน');
  const numericCtrl = templateFixture(22890);
  numericCtrl.docs.inspectionControlNo = '-00558/70';
  expect(visibleText(findDoc(modelsFor(numericCtrl), '11.1'))).toContain('จึงได้ลงชื่อตามเลขคุมตรวจรับ CNTR-00558/70 ลงวันที่ ๒๔ พฤศจิกายน ๒๕๖๙ ไว้เป็นหลักฐาน');
  for (const id of ['11.1', '11.3']) expect(visibleText(findDoc(models, id))).toContain('นางสาวศิริวรรณ ไทยมิตรชอบ');
});
it('automatically attaches all seven items with a repeating four-column table when manual drafting is selected', () => {
  const input = templateFixture(22890); input.workflowModeOverride = 'MANUAL_UNDER_5000';
  const request = findDoc(modelsFor(input), '6.1');
  expect(request.pages).toHaveLength(2);
  expect(request.pages[1].purpose).toBe('attachment');
  expect(visibleText(request)).toContain('รายละเอียดตามที่แนบ');
  expect(visibleText(request)).toContain('เอกสารแนบท้าย');
  const itemTable = request.pages[1].blocks.find(b => b.kind === 'table');
  expect(itemTable?.rows).toHaveLength(7);
  expect(itemTable?.columns).toEqual(['ลำดับ', 'รายละเอียด', 'จำนวน', 'หน่วย']);
  const html = renderDocumentHtml(request);
  expect(html).toContain('<thead>');
  expect(html).toContain('data-repeat-header="true"');
  expect(html).toContain('- ๒ -');
  expect(html).toContain('ใบต่อบันทึกข้อความ เรื่อง รายงานขอซื้อ');
  expect(html).toContain('ภก ๕๒๙๐๖/๑๔๖๓ ลงวันที่ ๑๗ พฤศจิกายน ๒๕๖๙');
});
it.each([[3, 240, false], [3, 241, true], [4, 4, true]] as const)('honors attachment boundaries (%s items, %s characters)', (count, chars, attached) => {
  const input = templateFixture();
  input.items = Array.from({length: count}, (_, i) => ({...input.items[0], id: String(i), description: i === 0 ? 'ก'.repeat(chars - count + 1) : 'ข'}));
  expect(findDoc(modelsFor(input), '6.1').pages.length > 1).toBe(attached);
});
it.each([0, 1, 2, 3, 4, 5, 9])('paginates %s photographs without duplicating the certification block', count => {
  const input = templateFixture(); input.attachments.photoPaths = Array.from({length: count}, (_, i) => `/uploads/photo-${i}.png`);
  const doc = findDoc(modelsFor(input), '11.3');
  expect(doc.pages).toHaveLength(Math.max(1, Math.ceil(count / 4)));
  const grids = doc.pages.flatMap(p => p.blocks).filter(b => b.kind === 'photo-grid');
  expect(grids.flatMap(g => g.photos)).toHaveLength(count);
  expect(grids[0].columns).toBe(count <= 2 ? 1 : 2);
  expect(grids[0].maxHeightCm).toBe(count <= 2 ? 9.5 : 8.5);
  expect(doc.pages.flatMap(p => p.blocks).filter(b => b.kind === 'signature-cluster')).toHaveLength(1);
  expect(doc.pages.at(-1)?.blocks.at(-1)?.kind).toBe('signature-cluster');
});
