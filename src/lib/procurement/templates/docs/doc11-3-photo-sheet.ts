import {documentModel, cluster, inspectorSignatures, text, type TemplateContext} from '../helpers';
import {SARABUN_RULES} from '../sarabun-rules';
import type {DocumentPage} from '../ir';
export function buildDoc113(x: TemplateContext) {
  const caption = text(x.c.attachments.photoCaptionOverride ?? `${x.title} จำนวน ${x.count} รายการ`);
  const photos = x.c.attachments.photoPaths;
  const pages: DocumentPage[] = [];
  for (let start = 0; start < Math.max(photos.length, 1); start += SARABUN_RULES.photosPerPage) {
    const batch = photos.slice(start, start + SARABUN_RULES.photosPerPage);
    // For 5+ photos every page retains the same two-column pagination grid.
    pages.push({purpose: 'photos', ...(start ? {heading: ['รูปภาพประกอบ (ต่อ)', caption]} : {}), blocks: [{kind: 'photo-grid', photos: batch.map((source, i) => ({source, alt: text(`ภาพประกอบ ${start + i + 1} ${caption}`)})), columns: photos.length <= 2 ? 1 : 2, maxHeightCm: photos.length <= 2 ? 9.5 : 8.5}]});
  }
  pages[pages.length - 1].blocks.push(cluster(['ขอรับรองว่าเป็นเอกสารที่ถูกต้อง'], inspectorSignatures(x)));
  const doc = documentModel(x, '11.3', 'PHOTO_SHEET', 'รูปภาพประกอบ', []);
  doc.header.lines.push(caption);
  doc.pages = pages;
  return doc;
}
