import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {embedProcurementFont} from '../src/lib/procurement-word-font';
it.skipIf(!fs.existsSync('output/procurement-suite/templates/D01.docx'))('embeds four Sarabun faces, normalizes Thai digits and preserves source artwork and is idempotent',async()=>{
 const input=fs.readFileSync('output/procurement-suite/templates/D01.docx'),bytes=await embedProcurementFont(input),before=await JSZip.loadAsync(input),after=await JSZip.loadAsync(bytes);
 const normalize=(xml:string)=>xml.replace(/<w:rFonts\b[^>]*\/>/g,'<FONT/>').replace(/(<w:t\b[^>]*>)([\s\S]*?)(<\/w:t>)/g,(_,a,t,b)=>a+t.replace(/[0-9]/g,(c:string)=>'๐๑๒๓๔๕๖๗๘๙'[Number(c)])+b);
 expect(normalize(await after.file('word/document.xml')!.async('string'))).toBe(normalize(await before.file('word/document.xml')!.async('string')));
 expect(await after.file('word/fontTable.xml')!.async('string')).toContain('w:embedRegular');expect(await after.file('word/fontTable.xml')!.async('string')).toContain('w:embedBold');
 expect(Object.keys(after.files).filter(name=>name.startsWith('word/fonts/sarabun-it9-')&&name.endsWith('.odttf'))).toHaveLength(4);
 for(const name of Object.keys(before.files))if(name.startsWith('word/media/'))expect(await after.file(name)!.async('uint8array')).toEqual(await before.file(name)!.async('uint8array'));
 expect(await embedProcurementFont(bytes)).toEqual(bytes);
},20000);
