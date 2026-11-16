import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {embedProcurementFont} from '../src/lib/procurement-word-font';
it.skipIf(!fs.existsSync('output/procurement-suite/templates/D01.docx'))('embeds both Sarabun faces without changing source text or artwork and is idempotent',async()=>{
 const input=fs.readFileSync('output/procurement-suite/templates/D01.docx'),bytes=await embedProcurementFont(input),before=await JSZip.loadAsync(input),after=await JSZip.loadAsync(bytes);
 expect(await after.file('word/document.xml')!.async('string')).toBe(await before.file('word/document.xml')!.async('string'));
 expect(await after.file('word/fontTable.xml')!.async('string')).toContain('w:embedRegular');expect(await after.file('word/fontTable.xml')!.async('string')).toContain('w:embedBold');
 expect(Object.keys(after.files).filter(name=>name.startsWith('word/fonts/sarabun-new-')&&name.endsWith('.odttf'))).toHaveLength(2);
 for(const name of Object.keys(before.files))if(name.startsWith('word/media/'))expect(await after.file(name)!.async('uint8array')).toEqual(await before.file(name)!.async('uint8array'));
 expect(await embedProcurementFont(bytes)).toEqual(bytes);
},20000);
