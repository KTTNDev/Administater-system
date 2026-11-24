import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';import ts from 'typescript';
const root=path.resolve(fileURLToPath(new URL('../',import.meta.url))),exercise=process.argv.includes('--exercise');
const folder=path.join(root,'tmp/pdfs/code-walkthrough',exercise?'exercise-lab':'solution-lab'),src=path.join(folder,'src'),out=path.join(folder,'out');fs.mkdirSync(src,{recursive:true});
const docs=path.join(root,'docs/code-walkthrough');
for(const [from,to] of [[exercise?'exercises.ts':'solutions.ts','answer.ts'],['lab-types.ts','lab-types.ts'],['lab-tests.ts','lab-tests.ts']])fs.copyFileSync(path.join(docs,from),path.join(src,to));
const program=ts.createProgram([path.join(src,'answer.ts'),path.join(src,'lab-types.ts'),path.join(src,'lab-tests.ts')],{strict:true,noEmitOnError:true,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,moduleResolution:ts.ModuleResolutionKind.Node10,esModuleInterop:true,skipLibCheck:true,types:['node'],typeRoots:[path.join(root,'node_modules/@types')],rootDir:src,outDir:out});
const diagnostics=ts.getPreEmitDiagnostics(program);if(diagnostics.length){console.error(ts.formatDiagnosticsWithColorAndContext(diagnostics,{getCanonicalFileName:f=>f,getCurrentDirectory:()=>root,getNewLine:()=> '\n'}));process.exit(1);}
program.emit();fs.writeFileSync(path.join(out,'package.json'),JSON.stringify({type:'commonjs'}));execFileSync(process.execPath,[path.join(out,'lab-tests.js')],{stdio:'inherit'});
