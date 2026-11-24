import {PDFDict, PDFName, PDFRawStream, PDFRef, decodePDFRawStream, type PDFDocument} from 'pdf-lib';

// Verified against the post-table glyph names in the bundled THSarabunIT9*.ttf.
// Chromium can expose these legacy Thai shaping alternates as PUA in ToUnicode.
// Only the search/extraction map changes; the embedded font and painted glyphs stay intact.
const alternates = [0x0e10, 0x0e34, 0x0e35, 0x0e36, 0x0e37, 0x0e48, 0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, 0x0e48, 0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, 0x0e0d, 0x0e31, 0x0e4d, 0x0e47, 0x0e48, 0x0e49, 0x0e4a, 0x0e4b, 0x0e4c, 0x0e38, 0x0e39, 0x0e3a, 0x0e0e, 0x0e0f, 0x0e2c];
function unicode(hex: string) {
  return hex.replace(/.{4}/g, unit => {const cp = parseInt(unit, 16); return cp >= 0xf700 && cp <= 0xf71d ? alternates[cp - 0xf700].toString(16).padStart(4, '0') : unit;});
}
export function normalizeThaiCMaps(document: PDFDocument) {
  for (const [, object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict)) continue;
    const font = object.get(PDFName.of('BaseFont'));
    if (!(font instanceof PDFName) || !/Sarabun/i.test(font.decodeText())) continue;
    const ref = object.get(PDFName.of('ToUnicode'));
    const stream = document.context.lookup(ref);
    if (!(stream instanceof PDFRawStream)) continue;
    const cmap = Buffer.from(decodePDFRawStream(stream).decode()).toString('latin1');
    if (!/f7(?:0[0-9a-f]|1[0-9a-d])/i.test(cmap)) continue;
    const pairs: [string, string][] = [];
    let rewritten = cmap.replace(/\d+\s+beginbfchar([\s\S]*?)endbfchar/g, (_, body: string) => {
      for (const match of body.matchAll(/<([\da-f]+)>\s*<([\da-f]+)>/gi)) pairs.push([match[1], unicode(match[2])]);
      return '';
    }).replace(/\d+\s+beginbfrange([\s\S]*?)endbfrange/g, (_, body: string) => {
      for (const match of body.matchAll(/<([\da-f]+)>\s*<([\da-f]+)>\s*(<([\da-f]+)>|\[([^\]]*)\])/gi)) {
        const first = parseInt(match[1], 16), last = parseInt(match[2], 16);
        const array = match[5] ? [...match[5].matchAll(/<([\da-f]+)>/gi)].map(m => m[1]) : null;
        for (let code = first; code <= last; code++) {
          const dest = array ? array[code - first] : (BigInt('0x' + match[4]) + BigInt(code - first)).toString(16).padStart(match[4].length, '0');
          if (!dest) throw new Error('ตาราง Unicode ของฟอนต์ไม่สมบูรณ์');
          pairs.push([code.toString(16).padStart(match[1].length, '0'), unicode(dest)]);
        }
      }
      return '';
    });
    let entries = '';
    for (let start = 0; start < pairs.length; start += 100) {
      const batch = pairs.slice(start, start + 100);
      entries += `${batch.length} beginbfchar\n${batch.map(([source, dest]) => `<${source}> <${dest}>`).join('\n')}\nendbfchar\n`;
    }
    rewritten = rewritten.replace('endcmap', entries + 'endcmap');
    const replacement = document.context.flateStream(Buffer.from(rewritten, 'latin1'));
    if (ref instanceof PDFRef) document.context.assign(ref, replacement);
    else object.set(PDFName.of('ToUnicode'), document.context.register(replacement));
  }
}
