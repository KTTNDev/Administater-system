import {pageRules, SARABUN_RULES as R} from '../sarabun-rules';
import type {DocumentFamily} from '../ir';

/** Fonts and Garuda are local static assets; no dependency on installed Windows fonts. */
export function sarabunStyles(family: DocumentFamily): string {
  const {marginsCm: m, garudaHeightCm} = pageRules(family);
  const tiers = Object.entries(R.density).map(([name, d]) => `[data-density="${name}"]{--body-size:${d.fontPt}pt;--line-height:${d.lineHeight};--paragraph-gap:${d.paragraphSpacingPt}pt;--signature-gap:${d.signatureGapPt}pt}`).join('\n');
  return `
@font-face{font-family:'TH Sarabun IT๙';src:url('/fonts/THSarabunIT9.ttf') format('truetype');font-weight:400;font-style:normal;font-display:block}
@font-face{font-family:'TH Sarabun IT๙';src:url('/fonts/THSarabunIT9-Bold.ttf') format('truetype');font-weight:700;font-style:normal;font-display:block}
@font-face{font-family:'TH Sarabun IT๙';src:url('/fonts/THSarabunIT9-Italic.ttf') format('truetype');font-weight:400;font-style:italic;font-display:block}
@font-face{font-family:'TH Sarabun IT๙';src:url('/fonts/THSarabunIT9-BoldItalic.ttf') format('truetype');font-weight:700;font-style:italic;font-display:block}
@font-face{font-family:'TH Sarabun New';src:url('/fonts/THSarabunNew.ttf') format('truetype');font-weight:400;font-style:normal;font-display:block}
@counter-style thai-page{system:numeric;symbols:'๐' '๑' '๒' '๓' '๔' '๕' '๖' '๗' '๘' '๙';suffix:''}
@page{size:A4 portrait;margin:${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm;
 @top-center{content:'- ' counter(page,thai-page) ' -';font-family:${R.fontFamily};font-size:16pt}
 @bottom-left{content:var(--continuation-note);font-family:${R.fontFamily};font-size:12pt}}
@page:first{@top-center{content:none}@bottom-left{content:none}}
@page attachment{margin:2.5cm 2cm 2cm 3cm}
*{box-sizing:border-box}html,body{margin:0;padding:0;color:#000;font-family:${R.fontFamily}}
body{background:#e9e8e6}${tiers}
.document{font-size:var(--body-size);line-height:var(--line-height)}
.sheet{width:210mm;min-height:297mm;margin:12px auto;background:#fff;padding:${m.top}cm ${m.right}cm ${m.bottom}cm ${m.left}cm;position:relative;overflow-wrap:anywhere}
.sheet[data-purpose="attachment"]{padding-top:2.5cm;page:attachment}
.sheet+.sheet{break-before:page;page-break-before:always}
.garuda{display:block;height:${garudaHeightCm}cm;width:auto;object-fit:contain;margin:0 auto 6pt}
.memo-brand{display:grid;grid-template-columns:1.5cm 1fr;align-items:end;gap:8mm;margin-bottom:5pt}
.memo-brand .garuda{height:1.5cm;margin:0}
.memo-brand h1{font-size:29pt;margin:0;text-align:center;font-weight:700;line-height:1}
h1,h2{font-size:18pt;line-height:1.14;text-align:center;margin:0 0 5pt;font-weight:700}
.official-heading{margin-bottom:12pt}.official-heading p{text-align:center;white-space:pre-line;margin:0}
.memo-fields{margin-bottom:8pt}.field{display:flex;align-items:baseline;width:100%;gap:4pt}
.field-label{font-size:18pt;font-weight:700;flex:none}.field-value{flex:1;min-width:0;border-bottom:1px dotted #000;padding-left:3pt}
.field-row{display:grid;grid-template-columns:1fr 1fr;gap:8pt}.recipient{margin:6pt 0 10pt}
.external-top,.metadata{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin-bottom:6pt}.external-date{margin-left:50%;margin-bottom:8pt}
.paragraph{margin:0 0 var(--paragraph-gap);text-align:justify;white-space:pre-line;orphans:2;widows:2}
.paragraph.indent{text-indent:2.5cm}.section-heading{font-size:18pt;font-weight:700;text-decoration:underline;margin:8pt 0 3pt;break-after:avoid;page-break-after:avoid}
.keep-body-tail{break-after:avoid;page-break-after:avoid;orphans:2;widows:2}
table{width:100%;border-collapse:collapse;table-layout:fixed;margin:6pt 0;font-size:inherit}
caption{font-weight:700;text-align:center}thead{display:table-header-group}tfoot{display:table-row-group}
th,td{vertical-align:top;padding:3pt 4pt;overflow-wrap:anywhere}th{font-weight:700;text-align:center}
.bordered th,.bordered td{border:1px solid #000}tr{break-inside:avoid;page-break-inside:avoid}
.table-continuation-label{display:none}.continued-table .table-continuation-label{display:table-row}
.signature-cluster{break-inside:avoid;page-break-inside:avoid;clear:both}
.closing{margin:0 0 var(--paragraph-gap);text-indent:2.5cm;white-space:pre-line}
.signatures{display:flex;justify-content:flex-end;flex-wrap:wrap;gap:8pt 12pt}.signature{flex:1 1 42%;max-width:100%;min-width:0;text-align:center;padding-top:var(--signature-gap);break-inside:avoid;page-break-inside:avoid}
.signatures>.signature:only-child{flex:0 1 65%}.signature p{margin:0;white-space:pre-line}.signature-line{display:flex;align-items:baseline;white-space:nowrap;gap:3pt}.signature-dots{flex:1;min-width:0;border-bottom:1px dotted #000}
.approval-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8pt 12pt;margin-top:8pt}.approval-grid>.approval:last-child:nth-child(odd){grid-column:2}
.approval p{margin:0;white-space:pre-line}.approval .signature{padding-top:var(--signature-gap)}
.approval-vertical{display:block}.approval-vertical>.approval{width:100%;margin-top:12pt}.approval-vertical .signature{width:65%;margin-left:auto}
.signature-cluster:has(>.signatures>.signature:only-child):has(>.approval-grid){display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8pt 10pt}
.signature-cluster:has(>.signatures>.signature:only-child):has(>.approval-grid>.approval:nth-child(3)){grid-template-columns:repeat(4,minmax(0,1fr))}
.signature-cluster:has(>.signatures>.signature:only-child):has(>.approval-grid)>.closing{grid-column:1/-1}
.signature-cluster:has(>.signatures>.signature:only-child):has(>.approval-grid)>.signatures{display:block}
.signature-cluster:has(>.signatures>.signature:only-child):has(>.approval-grid)>.approval-grid{display:contents}
.signature-cluster:has(>.signatures>.signature:only-child):has(>.approval-grid)>.approval-grid>.approval{grid-column:auto!important}
.signature-cluster:has(>.approval-grid) .signature{max-width:100%}
.routing-strip{font-size:14pt;line-height:1.05;margin-top:10pt;break-inside:avoid;page-break-inside:avoid;display:grid;grid-template-columns:1fr 1fr}
.routing-strip p{margin:0}.footer{margin-top:12pt;font-size:16pt}.footer p{margin:0}
.page-number{text-align:center;font-family:${R.fontFamily};font-size:16pt;margin:0 0 8pt}
.sheet[data-purpose="photos"] .closing{text-align:right;text-indent:0}
.continuation-note{font-size:12pt;margin-top:10pt}.photo-grid{display:grid;gap:4mm;align-items:start;margin:6pt 0}
.photo-grid figure{margin:0;break-inside:avoid;page-break-inside:avoid}.photo-grid img{display:block;width:100%;object-fit:contain;border:1px solid #d1d5db}
.photo-placeholder{border:1px dashed #777;min-height:4cm;display:grid;place-items:center}.checkbox-group{margin:6pt 0}.choice{display:inline-block;margin-right:12pt}
@media print{html,body{background:#fff}.sheet{width:auto;min-height:0;margin:0;padding:0;box-shadow:none}.sheet[data-purpose="attachment"]{padding:0}.page-number,.continuation-note{display:none}}
`;
}
