// Read-only smoke check of saved documents. No draft is created or changed.
import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {PDFDocument} from 'pdf-lib';
import JSZip from 'jszip';
const format=process.argv.includes('--word')?'word':'pdf';
const env=parseEnv(fs.readFileSync('.env.local','utf8'));
const db=new DatabaseSync(path.resolve(env.DATABASE_PATH||'data/sarabun.sqlite'),{readOnly:true});
try{
 const rows=()=>db.prepare('SELECT id,data,version,updated_at FROM documents WHERE deleted_at IS NULL ORDER BY id').all();
 const fingerprint=()=>createHash('sha256').update(JSON.stringify(rows())).digest('hex');
 const before=fingerprint(),results=[];
 for(const [index,row] of rows().entries()){
  const response=await fetch(`http://127.0.0.1:3000/api/documents/${row.id}/${format}`,{signal:AbortSignal.timeout(90000)});
  if(!response.ok)throw new Error(`Saved document ${index+1}: ${format} returned ${response.status}`);
  const bytes=await response.arrayBuffer();
  if(format==='word'){
   const zip=await JSZip.loadAsync(bytes),xml=await zip.file('word/document.xml')?.async('string');
   if(!xml?.includes('<w:t')||xml.includes('w:altChunk'))throw Error('Word content is not editable');
   results.push({sample:index+1,type:JSON.parse(row.data).type,sections:(xml.match(/<w:sectPr>/g)||[]).length});
  }else{
   const pdf=await PDFDocument.load(bytes);
   if(pdf.getPageCount()<1)throw new Error('Empty PDF');
   results.push({sample:index+1,type:JSON.parse(row.data).type,pages:pdf.getPageCount()});
  }
 }
 if(fingerprint()!==before)throw new Error('Saved documents changed during verification');
 const state=JSON.parse(db.prepare("SELECT value FROM settings WHERE key='backup:auto:state'").get()?.value||'{}');
 const report={checkedAt:new Date().toISOString(),documentsUnchanged:true,samples:results,automaticBackupSucceeded:!!state.lastSuccess&&!state.error};
 fs.mkdirSync('output/print-check',{recursive:true});fs.writeFileSync(`output/print-check/saved-documents${format==='word'?'-word':''}-check.json`,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
}finally{db.close();}
