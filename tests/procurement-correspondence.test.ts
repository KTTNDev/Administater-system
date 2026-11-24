import {it,expect} from 'vitest';
import fs from 'node:fs';
import JSZip from 'jszip';
import {DOMParser} from '@xmldom/xmldom';
import {procurementCorrespondence} from '../src/lib/procurement-correspondence';
const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
it.skipIf(!['D01','D02','D03','D05','D07','D12','D13','D14'].every(code=>fs.existsSync('output/procurement-reference-17/templates/'+code+'.docx')))('retains visible wording and image references without replacing original floating signature boxes',async()=>{
 for(const code of ['D01','D02','D03','D05','D07','D12','D13','D14']){
  const zip=await JSZip.loadAsync(fs.readFileSync('output/procurement-reference-17/templates/'+code+'.docx')),before=await zip.file('word/document.xml')!.async('string'),after=procurementCorrespondence(before);
  const parse=(xml:string)=>new DOMParser({onError:()=>{throw Error('Invalid XML');}}).parseFromString(xml.replace(/<mc:Fallback\b[^>]*>[\s\S]*?<\/mc:Fallback>/g,''),'application/xml'),a=parse(before),b=parse(after);
  const visibleParagraphs=(doc:ReturnType<typeof parse>)=>Array.from(doc.getElementsByTagNameNS(W,'p')).map(p=>Array.from(p.childNodes).filter(n=>n.nodeName==='w:r').flatMap(r=>Array.from(r.childNodes).filter(n=>n.nodeName==='w:t')).map(n=>n.textContent||'').join('').replace(/\s/g,'')).filter(Boolean).sort();
  expect(visibleParagraphs(b)).toEqual(visibleParagraphs(a));
  const embeds=(doc:ReturnType<typeof parse>)=>Array.from(doc.getElementsByTagName('a:blip')).map(n=>n.getAttribute('r:embed'));expect(embeds(b)).toEqual(embeds(a));
  expect(after.match(/<w:txbxContent>/g)?.length||0).toBe(before.match(/<w:txbxContent>/g)?.length||0);expect(after.match(/<wp:anchor\b/g)?.length||0).toBe(before.match(/<wp:anchor\b/g)?.length||0);expect(after.match(/<w:pgMar\b[^>]*\/>/)?.[0]).toBe(before.match(/<w:pgMar\b[^>]*\/>/)?.[0]);
  expect(after).toContain('<w:tab w:val="right" w:pos="9070"/>');
  const header=Array.from(b.getElementsByTagNameNS(W,'p')).find(p=>p.textContent?.startsWith('ส่วนราชการ'))!;
  expect(Array.from(header.getElementsByTagNameNS(W,'tab')).filter(t=>t.parentNode?.nodeName==='w:r')).toHaveLength(1);
  const body=b.getElementsByTagNameNS(W,'body')[0],outer=Array.from(b.getElementsByTagNameNS(W,'p')).filter(p=>p.parentNode===body);
  const name=outer.findIndex(p=>/^\([^()]+\)$/.test(Array.from(p.childNodes).filter(n=>n.nodeName==='w:r').map(n=>n.textContent).join('').trim()));
  if(name>=0&&outer[name+1]?.textContent?.trim()&&!outer[name+1].getElementsByTagNameNS(W,'drawing').length){
   for(const p of [outer[name],outer[name+1]])expect(p.getElementsByTagNameNS(W,'jc')[0]?.getAttribute('w:val')).toBe('center');
   expect(outer[name].getElementsByTagNameNS(W,'ind')[0]?.toString()).toBe(outer[name+1].getElementsByTagNameNS(W,'ind')[0]?.toString());
  }
 }
});
it('keeps spaces between styled name runs while removing only layout tabs and edge spaces',()=>{
 const xml='<w:document xmlns:w="'+W+'"><w:body><w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="4000"/></w:tabs></w:pPr><w:r><w:tab/><w:t> (นาย กิตติ </w:t></w:r><w:r><w:t>ทดสอบ) </w:t></w:r></w:p><w:p><w:r><w:tab/><w:t> เจ้าหน้าที่ธุรการ </w:t></w:r></w:p><w:sectPr/></w:body></w:document>',result=procurementCorrespondence(xml);
 expect(result).toContain('(นาย กิตติ ');expect(result).toContain('ทดสอบ)');expect(result).not.toContain('<w:tab/>');expect(result.match(/w:jc w:val="center"/g)).toHaveLength(2);
});
