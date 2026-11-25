import {describe, it, expect} from 'vitest';
import {renderDocumentHtml} from '../index';
import {templateFixture, modelsFor, findDoc, visibleText} from './templates-fixtures';

describe('Phase 2: 1,520 baht manual binder', () => {
  const models = modelsFor();
  it('builds exactly the fifteen documents in official filing order without mutating input', () => {
    const input = templateFixture(), before = JSON.stringify(input);
    expect(modelsFor(input)).toEqual(modelsFor(input));
    expect(JSON.stringify(input)).toBe(before);
    expect(models.map(d => d.docId)).toEqual(['1', '2', '3', '4.1', '6.1', '6.2', '7', '8', '9', '10', '11.1', '11.2', '11.3', '12', '13']);
    expect(models).toMatchSnapshot();
  });
  it.each(models.map(d => [d.docId, d] as const))('%s has no Arabic numeric prose, unresolved placeholders or legacy typos', (_, model) => {
    const rendered = visibleText(model);
    expect(rendered).not.toMatch(/[0-9]/);
    expect(rendered).not.toMatch(/undefined|NaN|\{\{|กฏหมาย|นั้น-ภ|ผู้รับซื้อ|ที่ คำสั่ง/);
    expect(renderDocumentHtml(model)).toContain('lang="th"');
    expect(renderDocumentHtml(model)).toContain('THSarabunIT9.ttf');
  });
  it('references the current assignment and PO instead of stale numbers', () => {
    expect(visibleText(findDoc(models, '3'))).toContain('ภก ๕๒๙๐๖/๑๔๔๖');
    for (const id of ['11.1', '11.2', '12']) {
      const text = visibleText(findDoc(models, id));
      expect(text).toContain('สว ๑๓/๒๕๗๐');
      expect(text).not.toContain('สว ๑๒๓/๒๕๖๙');
    }
    expect(visibleText(findDoc(models, '9'))).toContain('ภก ๕๒๘๐๖/๔๕๑๑');
  });
  it('keeps two items inline and synchronizes signature roles across all documents', () => {
    const request = findDoc(models, '6.1');
    expect(request.pages).toHaveLength(1);
    expect(visibleText(request)).not.toContain('เอกสารแนบท้าย');
    expect(visibleText(request)).toContain('กล่องพลาสติกมีฝาปิด ขนาด ๑๒๐ ลิตร');
    for (const id of ['6.1', '6.2', '11.1', '11.2', '11.3']) expect(visibleText(findDoc(models, id))).toContain('นางสาวศิริวรรณ ไทยมิตรชอบ');
    expect(visibleText(findDoc(models, '4.1'))).not.toContain('เจ้าพนักงานธุรการปฏิบัติงานสังคมสงเคราะห์');
    const doc111Text = visibleText(findDoc(models, '11.1'));
    expect(doc111Text).toContain('จึงได้ลงชื่อตามใบตรวจรับ ลงวันที่ ๒๔ พฤศจิกายน ๒๕๖๙ ไว้เป็นหลักฐาน');
    expect(doc111Text).not.toContain('เลขคุมตรวจรับ');
    for (const id of ['2', '13']) {
      const text = visibleText(findDoc(models, id));
      expect(text).toContain('นายปลัด ทดสอบ');
      expect(text).toContain('นายผู้อนุมัติ ทดสอบ');
      expect(text).toContain('ปฏิบัติราชการแทน');
    }
  });
  it('does not print announcement registry numbers and keeps routing-strip copy visibility explicit', () => {
    const input = templateFixture(); input.docs.doc8_winnerAnnouncement.registryLogNo = '987654321';
    const announcement = findDoc(modelsFor(input), '8');
    expect(visibleText(announcement)).not.toContain('๙๘๗๖๕๔๓๒๑');
    expect(renderDocumentHtml(announcement)).toContain('<aside class="routing-strip">');
    expect(renderDocumentHtml(announcement, {copyNumber: 2})).not.toContain('<aside class="routing-strip">');
    const allCopies = findDoc(modelsFor(input, {routingStripCopies: 'ALL_COPIES'}), '8');
    expect(renderDocumentHtml(allCopies, {copyNumber: 3})).toContain('<aside class="routing-strip">');
    expect(findDoc(modelsFor(input, {showRoutingStrip: false}), '6.2').routingStrip).toBeNull();
    expect(() => renderDocumentHtml(announcement, {copyNumber: 4})).toThrow();
  });
});
