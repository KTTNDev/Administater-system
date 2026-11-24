import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {journeySamples} from './procurement-journey-samples.mjs';
const base='http://127.0.0.1:3108',folder=path.resolve('output/procurement-layout-v3');assert.equal(fs.readFileSync('output/procurement-main-demo/SAFETY-TEST-ONLY','utf8').trim(),'SARABUN_PROCUREMENT_MAIN_DEMO_V1');fs.mkdirSync(folder,{recursive:true});
const arg=(key,defaultValue)=>process.argv.find(s=>s.startsWith('--'+key+'='))?.split('=')[1]||defaultValue,codes=arg('codes',Array.from({length:14},(_,i)=>'D'+String(i+1).padStart(2,'0')).join(',')).split(','),variants=arg('variants','short,long').split(',');
const api=async(url,body)=>{const response=await fetch(base+'/api/procurement'+url,body===undefined?{}:{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)}),value=await response.json();assert(response.ok,JSON.stringify(value));return value;};
const manifestFile=path.join(folder,'report.json'),report=fs.existsSync(manifestFile)?JSON.parse(fs.readFileSync(manifestFile,'utf8')):{isolated:true,cases:{}};
for(const sample of journeySamples((await api('/presets?kind=purchase')).data)){
 if(!variants.includes(sample.variant))continue;const old=report.cases[sample.variant];let record=old?(await api('')).cases.find(c=>c.id===old.id):null;
 if(!record){sample.data.title='ทดสอบระยะและฟอนต์ v3 เท่านั้น — '+sample.variant;record=await api('',{data:sample.data});report.cases[sample.variant]={id:record.id,documents:{}};fs.writeFileSync(manifestFile,JSON.stringify(report,null,2));}
 for(const code of codes){if(report.cases[sample.variant].documents[code]&&!process.argv.includes('--refresh'))continue;const generated=await api('/generate/'+record.id+'?code='+code,{version:record.version});const dir=path.join(folder,sample.variant);fs.mkdirSync(dir,{recursive:true});
  for(const [url,ext]of [['/files/','.docx'],['/file-preview/','.pdf']]){const response=await fetch(base+'/api/procurement'+url+generated.id);assert(response.ok,await response.clone().text());fs.writeFileSync(path.join(dir,code+ext),Buffer.from(await response.arrayBuffer()));}
  report.cases[sample.variant].documents[code]=generated.id;fs.writeFileSync(manifestFile,JSON.stringify(report,null,2));console.log(sample.variant+' '+code+' rendered');
 }
}console.log('Layout documents ready: '+folder);
