import fs from 'node:fs';
import path from 'node:path';
const source=path.resolve('node_modules/pdfjs-dist');
const {version}=JSON.parse(fs.readFileSync(path.join(source,'package.json'),'utf8'));
const target=path.resolve('public/vendor/pdfjs',version);
fs.mkdirSync(target,{recursive:true});
fs.copyFileSync(path.join(source,'build/pdf.worker.min.mjs'),path.join(target,'pdf.worker.min.mjs'));
for(const name of ['cmaps','standard_fonts','wasm'])fs.cpSync(path.join(source,name),path.join(target,name),{recursive:true});
console.log('Prepared local PDF.js assets '+version);
