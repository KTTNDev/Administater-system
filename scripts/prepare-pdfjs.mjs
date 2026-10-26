import fs from 'node:fs';
import path from 'node:path';

const source = path.resolve('node_modules/pdfjs-dist');
const {version} = JSON.parse(fs.readFileSync(path.join(source, 'package.json'), 'utf8'));
const target = path.resolve('public/vendor/pdfjs', version);

// npm ci should not mark vendored files as modified when their bytes already match.
// This also avoids needless filesystem writes on a fresh or repeat install.
function copyIfChanged(from, to) {
  if (fs.existsSync(to)) {
    const sourceSize = fs.statSync(from).size;
    if (sourceSize === fs.statSync(to).size && fs.readFileSync(from).equals(fs.readFileSync(to))) return;
  }
  fs.mkdirSync(path.dirname(to), {recursive: true});
  fs.copyFileSync(from, to);
}
function copyDirectory(from, to) {
  for (const entry of fs.readdirSync(from, {withFileTypes: true})) {
    const sourceFile = path.join(from, entry.name);
    const targetFile = path.join(to, entry.name);
    if (entry.isDirectory()) copyDirectory(sourceFile, targetFile);
    else if (entry.isFile()) copyIfChanged(sourceFile, targetFile);
    else throw new Error(`Unexpected PDF.js asset: ${sourceFile}`);
  }
}

copyIfChanged(path.join(source, 'build/pdf.worker.min.mjs'), path.join(target, 'pdf.worker.min.mjs'));
copyIfChanged(path.join(source, 'build/pdf.min.mjs'), path.join(target, 'pdf.min.mjs'));
for (const name of ['cmaps', 'standard_fonts', 'wasm']) copyDirectory(path.join(source, name), path.join(target, name));
console.log('Prepared local PDF.js assets ' + version);
