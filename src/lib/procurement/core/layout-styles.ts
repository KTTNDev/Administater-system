/** Physical styles shared by Core preview, Chromium PDF and measured editable DOCX. */
export const procurementLayoutStyles=`
.procurement-document{color:#000;font-size:16pt;line-height:1.05}
.procurement-document p{margin-bottom:3pt}
.procurement-heading{margin:0 0 8pt;break-inside:avoid}
.procurement-heading h1{font-size:18pt;line-height:1.15;text-align:center;margin:0 10mm 3pt 0;font-weight:700}
.procurement-heading>p{text-align:center;margin:0 10mm 0 0}
.procurement-heading .center-emblem{margin-bottom:3pt}
.procurement-document .body-subheading{text-align:left;text-decoration:underline;margin-top:6pt;margin-bottom:0;break-after:avoid}
.procurement-document .body-text{text-indent:0;line-height:1.05;margin-top:0;margin-bottom:0}
.procurement-document .document-table{font-size:16pt;margin:5pt 0;break-inside:auto}
.procurement-document .document-table th,.procurement-document .document-table td{border-color:#000;background:transparent;padding:2pt 3pt}
.procurement-document tr{break-inside:avoid}.procurement-document thead{display:table-header-group}
.procurement-tor .body-text{text-indent:25mm}
.procurement-tor-items th,.procurement-tor-items td{border:0!important}
.procurement-tor-items th:first-child,.procurement-tor-items td:first-child{width:8%;text-align:center}
.procurement-tor-items th:nth-child(2){width:62%}
.procurement-tor-items td:nth-child(n+3){text-align:center}
.procurement-metadata{display:grid;grid-template-columns:1fr 1fr;gap:8mm;margin:6pt 0;break-inside:avoid}
.procurement-metadata p{margin:0;line-height:1.05;white-space:pre-wrap}
.procurement-items th:first-child,.procurement-items td:first-child{text-align:center}
.procurement-items tr:not(.procurement-total) td:nth-child(3),.procurement-items tr:not(.procurement-total) td:nth-child(4){text-align:center}
.procurement-items td:nth-child(n+5),.procurement-items td.money{text-align:right;white-space:nowrap}
.procurement-items .procurement-total td:first-child{text-align:right}
.procurement-items .procurement-total td:only-child{text-align:center}
.procurement-items .procurement-total td.procurement-words{text-align:center;vertical-align:middle}
.procurement-po .body-text{margin-bottom:0;line-height:1}
.procurement-po .document-table th,.procurement-po .document-table td{padding:1pt 3pt}
.procurement-po .procurement-metadata p{line-height:1}
.procurement-table-caption{text-align:center;font-weight:700}
.procurement-signatures{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5mm 8mm;break-inside:avoid;page-break-inside:avoid}
.procurement-signatures .signature{margin:0;width:100%;min-width:0;text-align:center}
.procurement-signatures .signature:only-child{grid-column:2}
.procurement-signatures .signature p{margin:0;line-height:1.05}
.procurement-signatures .sign-space{height:4lh}
.procurement-inspection .procurement-heading{margin-bottom:12mm}
.procurement-inspection .procurement-heading>p{text-align:right;margin-right:45mm;margin-top:6mm}
.procurement-inspection .body-text{text-indent:25mm;margin-bottom:6pt}
.procurement-inspection .body-text:has(.procurement-checkbox){text-indent:0;margin-left:25mm}
.procurement-inspection .body-text.procurement-subcheck{margin-left:38mm}
.procurement-inspection .procurement-check-label{text-indent:0;margin:8mm 0 6mm 25mm}
.procurement-inspection .body-text:has(.procurement-checkbox){margin-bottom:5mm}
.procurement-inspection .inspection-signatures{display:block;margin-top:6mm}
.procurement-inspection .inspection-signatures .signature{margin-left:56mm;width:104mm;text-align:center}
.procurement-inspection .inspection-signatures .signature .signature-role-line{white-space:nowrap}
.procurement-inspection .inspection-signatures .signature p:not(.signature-role-line){margin-right:12mm}
.procurement-inspection .inspection-signatures .sign-space{height:3lh}
.procurement-inspection:has(.inspection-committee) .procurement-heading{margin-bottom:6mm}
.procurement-inspection:has(.inspection-committee) .procurement-check-label{margin:4mm 0 3mm 25mm}
.procurement-inspection:has(.inspection-committee) .body-text:has(.procurement-checkbox){margin-bottom:3mm}
.procurement-inspection .inspection-committee{margin-top:3mm}
.procurement-inspection .inspection-committee .sign-space{height:1.8lh}
.procurement-checkbox{display:inline-block;white-space:nowrap}
.procurement-photo-sheet{gap:3mm}
.procurement-photo-sheet .procurement-heading{margin:0}
.procurement-photo-caption{text-align:center;margin:0;flex:none}
.procurement-photo-grid{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr);grid-auto-rows:minmax(0,1fr);gap:4mm}
.procurement-photo-grid figure{min-height:0;min-width:0;margin:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2mm}
.procurement-photo-frame{flex:0 1 auto;min-height:0;width:100%;display:flex;justify-content:center;align-items:center}
.procurement-photo-frame .appendix-img-wrap{max-width:100%;max-height:100%}
.procurement-photo-frame img{display:block;width:100%;height:auto;max-height:74mm;object-fit:contain}
.procurement-photo-sheet:not(.photo-columns) .procurement-photo-grid:has(figure:only-child) .procurement-photo-frame img{max-height:155mm}
.procurement-photo-sheet:has(.inspection-committee) .procurement-photo-frame img{max-height:61mm}
.procurement-photo-sheet:not(.photo-columns):has(.inspection-committee) .procurement-photo-grid:has(figure:only-child) .procurement-photo-frame img{max-height:130mm}
.procurement-photo-grid figcaption{flex:none;font-size:16pt;line-height:1.05;text-align:center}
.photo-columns .procurement-photo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
.photo-columns .procurement-photo-grid:has(figure:only-child){grid-template-columns:minmax(0,1fr)}
.procurement-photo-certification{flex:none;break-inside:avoid}
.procurement-photo-certification>.body-text{text-align:center;text-align-last:center;text-indent:0;margin-left:56mm;width:104mm;padding-right:12mm}
.procurement-photo-certification:has(.inspection-committee)>.body-text{margin-left:0;width:100%;padding-right:0;text-align:center;text-align-last:center}
.procurement-photo-sheet .photo-signatures{display:block;margin-top:2mm}
.procurement-photo-sheet .photo-signatures .signature{margin-left:56mm;width:104mm;text-align:center}
.procurement-photo-sheet .photo-signatures .signature .signature-role-line{white-space:nowrap}
.procurement-photo-sheet .photo-signatures .signature p:not(.signature-role-line){margin-right:12mm}
.procurement-photo-sheet .photo-signatures .sign-space{height:2.2lh}
.procurement-photo-sheet .photo-signatures.inspection-committee{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:2mm 6mm}
.procurement-photo-sheet .photo-signatures.inspection-committee .signature{margin-left:0;width:100%}
.procurement-photo-sheet .photo-signatures.inspection-committee .signature:nth-child(3){grid-column:1/-1;width:78mm;justify-self:center}
.procurement-photo-sheet .photo-signatures.inspection-committee .signature p:not(.signature-role-line){margin-right:10mm}
.procurement-photo-sheet .photo-signatures.inspection-committee .sign-space{height:1.5lh}
.procurement-photo-placeholder{min-height:30mm;display:grid;place-items:center;text-align:center;border:1px dashed #777}
`;
