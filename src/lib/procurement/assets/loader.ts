import 'server-only';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export interface BinaryAsset {buffer: Buffer; dataUri: string}
const assetRoot = () => path.resolve(process.env.SARABUN_SOURCE_DIR || process.cwd(), 'public');
const garudas = new Map<string, Promise<BinaryAsset>>();
const fonts = new Map<string, Promise<SarabunFonts>>();
export interface SarabunFonts {
  family: 'TH Sarabun IT๙' | 'TH Sarabun New';
  nativeFamily: string;
  regular: Buffer; bold: Buffer; italic: Buffer; boldItalic: Buffer; css: string;
}
/** Word resolves embedded faces by the TTF's actual family name, unlike CSS @font-face aliases. */
function nativeFontFamily(data: Buffer, fallback: string): string {
  if (data.length < 12) return fallback;
  const tableCount = data.readUInt16BE(4);
  for (let i = 0; i < tableCount && 12 + (i + 1) * 16 <= data.length; i++) {
    const record = 12 + i * 16;
    if (data.toString('ascii', record, record + 4) !== 'name') continue;
    const base = data.readUInt32BE(record + 8);
    if (base + 6 > data.length) break;
    const count = data.readUInt16BE(base + 2), strings = base + data.readUInt16BE(base + 4);
    // Word's legacy embedded-font resolver uses name ID 1. This IT๙ fork retains
    // its ancestor's PSK name in typographic-family ID 16, which must not win.
    for (const nameId of [1, 16]) {
      const names: {language: number; value: string}[] = [];
      for (let j = 0; j < count; j++) {
        const at = base + 6 + j * 12;
        if (at + 12 > data.length) break;
        const platform = data.readUInt16BE(at);
        if (![0, 3].includes(platform) || data.readUInt16BE(at + 6) !== nameId) continue;
        const length = data.readUInt16BE(at + 8), start = strings + data.readUInt16BE(at + 10);
        if (start + length > data.length || length % 2) continue;
        names.push({language: data.readUInt16BE(at + 4), value: Buffer.from(data.subarray(start, start + length)).swap16().toString('utf16le')});
      }
      const name = names.find(n => n.language === 0x409) ?? names[0];
      if (name?.value) return name.value;
    }
  }
  return fallback;
}
export function loadGarudaAsset(): Promise<BinaryAsset> {
  const root = assetRoot();
  let cached = garudas.get(root);
  if (!cached) {
    cached = (async () => {
      let buffer: Buffer;
      try {buffer = await fs.readFile(path.join(root, 'assets/garuda.png'));}
      catch {buffer = await sharp(await fs.readFile(path.join(root, 'assets/garuda.svg'))).png().toBuffer();}
      return {buffer, dataUri: `data:image/png;base64,${buffer.toString('base64')}`};
    })();
    garudas.set(root, cached);
    void cached.catch(() => garudas.delete(root));
  }
  return cached;
}
export function loadSarabunFonts(): Promise<SarabunFonts> {
  const root = assetRoot();
  let cached = fonts.get(root);
  if (!cached) {
    cached = (async () => {
      const read = (name: string) => fs.readFile(path.join(root, 'fonts', name));
      let regular: Buffer, bold: Buffer, family: SarabunFonts['family'] = 'TH Sarabun IT๙';
      try {[regular, bold] = await Promise.all([read('THSarabunIT9.ttf'), read('THSarabunIT9-Bold.ttf')]);}
      catch {
        family = 'TH Sarabun New';
        console.warn(`ไม่พบ TH Sarabun IT๙ ครบชุด กรุณาเพิ่ม ${path.join(root, 'fonts/THSarabunIT9.ttf')} และ ${path.join(root, 'fonts/THSarabunIT9-Bold.ttf')}; ใช้ TH Sarabun New แทน`);
        [regular, bold] = await Promise.all([read('THSarabunNew.ttf'), read('THSarabunNew-Bold.ttf')]);
      }
      const italic = family === 'TH Sarabun IT๙' ? await read('THSarabunIT9-Italic.ttf').catch(() => regular) : regular;
      const boldItalic = family === 'TH Sarabun IT๙' ? await read('THSarabunIT9-BoldItalic.ttf').catch(() => bold) : bold;
      const css = ([[regular, 400, 'normal'], [bold, 700, 'normal'], [italic, 400, 'italic'], [boldItalic, 700, 'italic']] as const).map(([data, weight, style]) => `@font-face{font-family:'${family}';src:url(data:font/ttf;base64,${data.toString('base64')}) format('truetype');font-weight:${weight};font-style:${style};font-display:block}`).join('\n');
      return {family, nativeFamily: nativeFontFamily(regular, family), regular, bold, italic, boldItalic, css};
    })();
    fonts.set(root, cached);
    void cached.catch(() => fonts.delete(root));
  }
  return cached;
}
