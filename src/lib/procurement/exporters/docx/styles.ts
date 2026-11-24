import {BorderStyle, LineRuleType, type IStylesOptions} from 'docx';
import {SARABUN_RULES} from '../../templates/sarabun-rules';
import type {Density} from '../../templates/ir';

export const cmToTwip = (cm: number) => Math.round(cm * 566.929);
export const ptToHalfPt = (pt: number) => pt * 2;
export const A4_TWIPS = {width: 11906, height: 16838};
export const fontAttributes = (name: string) => ({ascii: name, hAnsi: name, eastAsia: name, cs: name});
export const noBorders = Object.fromEntries(['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical'].map(side => [side, {style: BorderStyle.NONE, size: 0, color: 'FFFFFF'}]));
export const blackBorders = Object.fromEntries(['top', 'bottom', 'left', 'right', 'insideHorizontal', 'insideVertical'].map(side => [side, {style: BorderStyle.SINGLE, size: 4, color: '000000'}]));
export function sarabunWordStyles(family: string, density: Density): IStylesOptions {
  const d = SARABUN_RULES.density[density];
  return {default: {document: {
    run: {font: fontAttributes(family), size: ptToHalfPt(d.fontPt), sizeComplexScript: ptToHalfPt(d.fontPt), color: '000000', italics: false, italicsComplexScript: false, bold: false, boldComplexScript: false, language: {value: 'th-TH', eastAsia: 'th-TH', bidirectional: 'th-TH'}},
    paragraph: {spacing: {after: Math.round(d.paragraphSpacingPt * 20), line: Math.round(d.fontPt * 20 * d.lineHeight), lineRule: LineRuleType.EXACT}},
  }}, paragraphStyles: [{id: 'Title', name: 'Title', basedOn: 'Normal', run: {font: fontAttributes(family), color: '000000', size: 36, sizeComplexScript: 36, bold: true}, paragraph: {spacing: {after: 100}, keepNext: true, keepLines: true}}]};
}
