import {it,expect} from 'vitest';import fs from 'node:fs';import JSZip from 'jszip';import {embedProcurementFont} from '../src/lib/procurement-word-font';
it('embeds all four IT9 faces and changes text styles without modifying source artwork or checkbox symbols',async()=>{
 const source=fs.readFileSync('output/procurement-suite/templates/D11.docx'),before=await JSZip.loadAsync(source),after=await JSZip.loadAsync(await embedProcurementFont(source));
 const table=await after.file('word/fontTable.xml')!.async('string');expect(table).toContain('w:name="TH SarabunIT๙"');for(const face of ['Regular','Bold','Italic','BoldItalic'])expect(table).toContain('w:embed'+face);
 for(const part of Object.keys(before.files).filter(n=>n.startsWith('word/media/')&&!before.files[n].dir))expect(await after.file(part)!.async('nodebuffer')).toEqual(await before.file(part)!.async('nodebuffer'));
 const xml=await after.file('word/document.xml')!.async('string');expect(xml).toContain('w:font="Wingdings 2"');expect(xml).not.toContain('TH Sarabun New');expect(await after.file('word/styles.xml')!.async('string')).not.toContain('TH Sarabun New');
});
