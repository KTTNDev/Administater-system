import fs from 'node:fs';
const dir='output/legal-research-2026-09-14';
const sources=JSON.parse(fs.readFileSync(dir+'/additional-sources.json','utf8'));
for(const row of sources){try{const response=await fetch(row.url,{signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('HTTP '+response.status);const bytes=Buffer.from(await response.arrayBuffer());if(bytes.subarray(0,5).toString()!=='%PDF-'||bytes.length>10*1024*1024)throw new Error('Invalid PDF');fs.writeFileSync(dir+'/'+row.file,bytes);console.log(JSON.stringify({file:row.file,bytes:bytes.length}));}catch(e){console.log(JSON.stringify({file:row.file,error:e.message}));}}
