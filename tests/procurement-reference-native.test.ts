import {expect,it} from 'vitest';
import fs from 'node:fs';
import {nativeD07Pdf,finalizeProcurementWord} from '../src/lib/procurement-preview';
it('fails closed for both retired Word renderer entry points on every platform',async()=>{
  await expect(nativeD07Pdf(Buffer.from('old Word'))).rejects.toMatchObject({status:410});
  await expect(finalizeProcurementWord(Buffer.from('old Word'))).rejects.toMatchObject({status:410});
});
it('does not ship executable legacy Word scripts or package a renderer script',()=>{
  for(const file of ['render-procurement-template.ps1','prepare-procurement-suite.ps1','check-procurement-word.ps1','verify-word-render.ps1'])expect(fs.existsSync('scripts/'+file)).toBe(false);
  expect(fs.readFileSync('scripts/build-desktop.mjs','utf8')).not.toContain('render-procurement-template.ps1');
  expect(fs.readFileSync('next.config.mjs','utf8')).not.toContain('render-procurement-template.ps1');
});
