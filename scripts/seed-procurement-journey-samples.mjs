import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {PDFDocument} from 'pdf-lib';import {journeySamples,journeySampleTitles} from './procurement-journey-samples.mjs';
import {request as httpRequest} from 'node:http';
const real=process.argv.includes('--real'),base=real?'http://127.0.0.1:3000':'http://127.0.0.1:3108',root=fs.realpathSync.native(process.cwd()),folder=path.resolve('output/procurement-journey-samples');fs.mkdirSync(folder,{recursive:true});
// --real is only for an explicitly user-authorized creation of sample records.
if(!real)assert.equal(fs.readFileSync('output/procurement-main-demo/SAFETY-TEST-ONLY','utf8').trim(),'SARABUN_PROCUREMENT_MAIN_DEMO_V1');
const health=await(await fetch(base+'/api/health')).json();assert.equal(health.application,'sarabun');if(real){assert.equal(health.mode,'start');assert.equal(health.instance,createHash('sha256').update(root.toLowerCase()).digest('hex').slice(0,24));}
// A native Word suite can take longer than fetch's response-header timeout.
const api=(url,body)=>new Promise((resolve,reject)=>{
 const payload=body===undefined?undefined:JSON.stringify(body),request=httpRequest(base+'/api/procurement'+url,{method:payload===undefined?'GET':'POST',headers:payload===undefined?{}:{Origin:base,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('error',reject);response.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks).toString());assert(response.statusCode>=200&&response.statusCode<300,JSON.stringify(value));resolve(value);}catch(error){reject(error);}});});request.setTimeout(30*60*1000,()=>request.destroy(Error('Timed out waiting for native Word suite')));request.on('error',reject);request.end(payload);
});
let snapshot=await api('');const baseline=snapshot.cases.filter(c=>!c.sample).map(c=>({id:c.id,version:c.version,data:JSON.stringify(c)}));
const reportFile=path.join(folder,real?'real.json':'test.json'),report=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')):{at:new Date().toISOString(),base,real,cases:{}};assert.equal(report.base,base);
const preset=await api('/presets?kind=purchase');
for(const sample of journeySamples(preset.data)){
 const knownId=report.cases[sample.variant]?.id;let record=knownId?snapshot.cases.find(c=>c.id===knownId):snapshot.cases.find(c=>c.title===sample.data.title);
 if(record)assert(record.sample,'Existing record is not a sample; nothing overwritten');
 else record=await api('',{data:sample.data});
 report.cases[sample.variant]={...report.cases[sample.variant],id:record.id,title:record.title,kind:record.kind,url:base+'/?view=procurement&case='+record.id};fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(sample.variant+': sample record ready '+record.id);
 const hasSelected=Object.values(record.documents).some(config=>config.primaryFileId||config.signedFileId||config.reviewedHash);
 if(!hasSelected&&record.workflow.state==='preparing'){
  const generated=await api('/generate-suite/'+record.id,{version:record.version});assert.equal(Object.keys(generated.ids).length,14);record=generated.record;report.cases[sample.variant].generated=14;fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(sample.variant+': 14 draft documents generated');
 }else console.log(sample.variant+': preserved existing document selections and progress');
 snapshot=await api('');const files=snapshot.files.filter(f=>f.caseId===record.id),progress=await api('/journey/'+record.id);
 report.cases[sample.variant].files=files.length;report.cases[sample.variant].current=progress.current;report.cases[sample.variant].state=record.workflow.state;
 // Read actual PDFs for representative short/long layout, without creating approvals.
 if(record.workflow.state==='preparing'&&progress.current==='D01'){
  for(const code of ['D01','D07','D14']){const file=files.find(f=>f.id===record.documents[code]?.primaryFileId);assert(file&&file.meta.origin==='draft');const response=await fetch(base+'/api/procurement/file-preview/'+file.id);assert(response.ok,await response.clone().text());const bytes=Buffer.from(await response.arrayBuffer()),pages=(await PDFDocument.load(bytes)).getPageCount();if(sample.variant==='long')assert(pages>1,code+' should span pages');const dest=path.join(folder,sample.variant);fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,code+'.pdf'),bytes);report.cases[sample.variant].pages={...report.cases[sample.variant].pages,[code]:pages};console.log(sample.variant+' '+code+': '+pages+' pages');}
 }
 fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
}
snapshot=await api('');for(const old of baseline){const current=snapshot.cases.find(c=>c.id===old.id);assert(current&&JSON.stringify(current)===old.data,'An existing real case changed');}
assert(journeySampleTitles.every(title=>snapshot.cases.some(c=>c.title===title&&c.sample)));
report.existingRealCasesUnchanged=baseline.length;report.finishedAt=new Date().toISOString();fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(JSON.stringify({ok:true,base,samples:Object.values(report.cases),existingRealCasesUnchanged:baseline.length}));
