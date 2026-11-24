import 'server-only';
import sharp from 'sharp';
import JSZip from 'jszip';
import {Document, Packer, Header, Footer, Paragraph, TextRun, AlignmentType, PageNumber, NumberFormat, SectionType, LineRuleType, type ISectionOptions} from 'docx';
import type {RenderedDocumentSpec} from '../../templates/ir';
import {pageRules} from '../../templates/sarabun-rules';
import {loadGarudaAsset, loadSarabunFonts} from '../../assets/loader';
import {prepareInspectionPhotos} from '../../media/photo-processor';
import {A4_TWIPS, cmToTwip, fontAttributes, sarabunWordStyles} from './styles';
import {documentHeader, wordPageBlocks, wordParagraph, routingStrip, type WordContext} from './blocks';

export async function renderDocumentDocx(model: RenderedDocumentSpec, options: {copyNumber?: number; photos?: ReadonlyMap<string, Buffer>} = {}): Promise<Buffer> {
  const copyNumber = options.copyNumber ?? 1;
  if (!Number.isInteger(copyNumber) || copyNumber < 1 || copyNumber > model.copies) throw new RangeError('ลำดับสำเนาไม่ถูกต้อง');
  const [garuda, fonts, photos] = await Promise.all([loadGarudaAsset(), loadSarabunFonts(), prepareInspectionPhotos(model, options.photos)]);
  const metadata = await sharp(garuda.buffer).metadata();
  const ctx: WordContext = {model, font: fonts.nativeFamily, width: cmToTwip(16), garuda: {...garuda, width: metadata.width!, height: metadata.height!}, photos};
  const m = pageRules(model.family).marginsCm;
  const sections: ISectionOptions[] = model.pages.map((page, index) => ({
    properties: {type: SectionType.NEXT_PAGE, titlePage: index === 0, page: {size: A4_TWIPS, margin: {top: cmToTwip(page.purpose === 'attachment' ? 2.5 : m.top), bottom: cmToTwip(m.bottom), left: cmToTwip(m.left), right: cmToTwip(m.right), header: cmToTwip(0.6), footer: cmToTwip(0.6)}, pageNumbers: {formatType: NumberFormat.THAI_NUMBERS, ...(index === 0 ? {start: 1} : {})}}},
    headers: {first: new Header({children: [new Paragraph('')]}), default: new Header({children: [new Paragraph({alignment: AlignmentType.CENTER, children: [new TextRun({children: ['- ', PageNumber.CURRENT, ' -'], font: fontAttributes(fonts.nativeFamily), size: 32, sizeComplexScript: 32, color: '000000'})]})]})},
    footers: {first: new Footer({children: [new Paragraph('')]}), default: new Footer({children: [wordParagraph(model.continuationNote, ctx, {}, false, 12)]})},
    children: [...(index === 0 ? documentHeader(ctx) : []), ...(page.heading ?? []).map(h => wordParagraph(h, ctx, {alignment: AlignmentType.CENTER, keepNext: true}, true, 18)), ...wordPageBlocks(page.blocks, ctx), ...(index === model.pages.length - 1 ? [...routingStrip(ctx, copyNumber), ...model.footerLines.map(t => wordParagraph(t, ctx, {spacing: {after: 0}}))] : []), new Paragraph({children: [new TextRun({text: '', size: 2, sizeComplexScript: 2})], keepNext: false, spacing: {before: 0, after: 0, line: 20, lineRule: LineRuleType.EXACT}})],
  }));
  const bytes = await Packer.toBuffer(new Document({title: model.title, creator: 'sarabun', styles: sarabunWordStyles(fonts.nativeFamily, model.layout.density), features: {updateFields: true}, fonts: [{name: fonts.nativeFamily, data: fonts.regular, bold: fonts.bold, italic: fonts.italic, boldItalic: fonts.boldItalic}], sections}));
  if (fonts.nativeFamily === fonts.family) return bytes;
  const zip = await JSZip.loadAsync(bytes);
  const table = await zip.file('word/fontTable.xml')!.async('string');
  const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
  zip.file('word/fontTable.xml', table.replace(`<w:font w:name="${escape(fonts.nativeFamily)}">`, `<w:font w:name="${escape(fonts.nativeFamily)}"><w:altName w:val="${escape(fonts.family)}"/>`));
  return zip.generateAsync({type: 'nodebuffer', compression: 'DEFLATE'});
}
