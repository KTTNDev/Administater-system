import fs from 'node:fs';
import ts from 'typescript';
export function sourceBlock(file,symbol){
 let text=fs.readFileSync(file,'utf8');let lineOffset=0;
 const range=/^@lines:(\d+)-(\d+)$/.exec(symbol);if(range){lineOffset=Number(range[1])-1;text=text.split(/\r?\n/).slice(lineOffset,Number(range[2])).join('\n');}
 const sf=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);
 let match;
 function visit(node){
  if(match)return;
  const name=node.name&&(ts.isIdentifier(node.name)||ts.isStringLiteral(node.name))?node.name.text:'';
  if(name===symbol && (ts.isFunctionDeclaration(node)||ts.isClassDeclaration(node)||ts.isTypeAliasDeclaration(node)||ts.isInterfaceDeclaration(node)||ts.isMethodDeclaration(node))){match=node;return;}
  if(ts.isVariableStatement(node)&&node.declarationList.declarations.some(d=>ts.isIdentifier(d.name)&&d.name.text===symbol)){match=node;return;}
  ts.forEachChild(node,visit);
 }
 if(symbol==='@file'||range)match=sf;else visit(sf);
 if(!match)throw Error('Missing symbol '+symbol+' in '+file);
 const original=text.slice(match.getStart(sf),match.getEnd());
 const offset=match.getStart(sf),breaks=new Set();
 const mark=pos=>{if(pos>=offset&&pos<=match.getEnd())breaks.add(pos-offset);};
 function layout(node){
  if(ts.isBlock(node)||ts.isClassDeclaration(node)){
   const open=node.getChildren(sf).find(c=>c.kind===ts.SyntaxKind.OpenBraceToken);
   const close=node.getChildren(sf).find(c=>c.kind===ts.SyntaxKind.CloseBraceToken);
   if(open)mark(open.end);if(close)mark(close.getStart(sf));
  }
  if(ts.isStatement(node)&&node!==match){mark(node.getStart(sf));mark(node.getEnd());}
  if(ts.isObjectLiteralExpression(node)&&node.getText(sf).length>85){
   mark(node.getStart(sf)+1);mark(node.end-1);
   node.properties.forEach(p=>mark(p.getStart(sf)));
  }
  if(ts.isTypeLiteralNode(node)){mark(node.getStart(sf)+1);mark(node.end-1);node.members.forEach(m=>mark(m.getStart(sf)));}
  ts.forEachChild(node,layout);
 }
 layout(match);
 let expanded=original;for(const pos of [...breaks].sort((a,b)=>b-a))expanded=expanded.slice(0,pos)+'\n'+expanded.slice(pos);
 const fileName=file.endsWith('.tsx')?'snippet.tsx':'snippet.ts';
 const host={getScriptFileNames:()=>[fileName],getScriptVersion:()=> '1',getScriptSnapshot:n=>n===fileName?ts.ScriptSnapshot.fromString(expanded):undefined,getCurrentDirectory:()=>process.cwd(),getCompilationSettings:()=>({jsx:ts.JsxEmit.Preserve}),getDefaultLibFileName:()=>'',fileExists:()=>true,readFile:()=>undefined};
 const service=ts.createLanguageService(host);
 const edits=service.getFormattingEditsForDocument(fileName,{...ts.getDefaultFormatCodeSettings(),indentSize:2,tabSize:2,newLineCharacter:'\n',convertTabsToSpaces:true});
 for(const edit of edits.sort((a,b)=>b.span.start-a.span.start))expanded=expanded.slice(0,edit.span.start)+edit.newText+expanded.slice(edit.span.start+edit.span.length);
 service.dispose();
 let printed=expanded.replace(/\n\s*\n/g,'\n').trim();
 // No source tokens are invented: only whitespace changes; preserve literals.
 const tokens=s=>{const parsed=ts.createSourceFile(file,s,ts.ScriptTarget.Latest,true,file.endsWith('.tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS),out=[];const walk=node=>{const children=node.getChildren(parsed);if(!children.length){if(node.kind!==ts.SyntaxKind.EndOfFileToken)out.push([node.kind,node.getText(parsed)]);}else children.forEach(walk);};walk(parsed);return out;};
 const originalTokens=JSON.stringify(tokens(original)),printedTokens=JSON.stringify(tokens(printed));
 const formatted=originalTokens===printedTokens;if(!formatted)printed=original;
 printed=printed.replaceAll('\r','');
 const start=sf.getLineAndCharacterOfPosition(match.getStart(sf)).line+1+lineOffset,end=sf.getLineAndCharacterOfPosition(match.getEnd()).line+1+lineOffset;
 return {file,symbol,start,end,formatted,original:text.slice(match.getStart(sf),match.getEnd()),code:printed,lines:printed.split('\n')};
}
if(process.argv[1]?.endsWith('handbook-code-source.mjs')&&process.argv[2]){const b=sourceBlock(process.argv[2],process.argv[3]);console.log(JSON.stringify({file:b.file,start:b.start,end:b.end,count:b.lines.length}));console.log(b.lines.map((l,i)=>String(i+1).padStart(3)+' '+l).join('\n'));}
