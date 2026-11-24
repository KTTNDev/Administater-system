import type {Density, DocumentFamily, GeneratedDocId} from './ir';

export const SARABUN_RULES = {
  paper: {widthMm: 210, heightMm: 297},
  fontFamily: "'TH Sarabun IT๙', 'TH Sarabun New', 'Sarabun', sans-serif",
  memoTitlePt: 29, headingPt: 18, routingPt: 14, firstLineIndentCm: 2.5,
  marginsCm: {
    memo: {top: 1.5, bottom: 2, left: 3, right: 2},
    official: {top: 2, bottom: 2, left: 3, right: 2},
    supporting: {top: 2.5, bottom: 2, left: 3, right: 2},
  },
  garuda: {memoHeightCm: 1.5, officialHeightCm: 3, url: '/assets/garuda.png'},
  density: {
    normal: {fontPt: 16, lineHeight: 1.22, paragraphSpacingPt: 6, signatureGapPt: 28},
    compact: {fontPt: 16, lineHeight: 1.14, paragraphSpacingPt: 4, signatureGapPt: 22},
    tight: {fontPt: 15.5, lineHeight: 1.10, paragraphSpacingPt: 2.5, signatureGapPt: 18},
  },
  maxCompressibleOverflowRatio: 0.15,
  attachment: {maxInlineItems: 3, maxInlineDescriptionChars: 240},
  photosPerPage: 4,
} as const;

const singlePageDocs: readonly GeneratedDocId[] = ['1', '2', '3', '6.2', '7', '8', '9', '11.1', '11.2', '13'];
export const prefersSinglePage = (id: GeneratedDocId) => singlePageDocs.includes(id);
export function pageRules(family: DocumentFamily) {
  if (family === 'MEMO') return {marginsCm: SARABUN_RULES.marginsCm.memo, garudaHeightCm: 1.5, garudaPosition: 'left' as const};
  if (['ORDER', 'ANNOUNCEMENT', 'EXTERNAL_LETTER', 'PURCHASE_ORDER'].includes(family)) {
    return {marginsCm: SARABUN_RULES.marginsCm.official, garudaHeightCm: 3, garudaPosition: 'center' as const};
  }
  return {marginsCm: SARABUN_RULES.marginsCm.supporting, garudaHeightCm: 0, garudaPosition: 'none' as const};
}

/** Pure policy for Phase 3's measured auto-fit loop. Never estimates heights from character counts. */
export function nextDensity(id: GeneratedDocId, current: Density, contentHeight: number, availableHeight: number): Density | null {
  if (!Number.isFinite(contentHeight) || !Number.isFinite(availableHeight) || contentHeight < 0 || availableHeight <= 0) throw new RangeError('ขนาดพื้นที่ไม่ถูกต้อง');
  const overflow = (contentHeight - availableHeight) / availableHeight;
  if (!prefersSinglePage(id) || overflow <= 0 || overflow > SARABUN_RULES.maxCompressibleOverflowRatio) return null;
  return current === 'normal' ? 'compact' : current === 'compact' ? 'tight' : null;
}
