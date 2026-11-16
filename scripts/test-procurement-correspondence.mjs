import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
const base='http://127.0.0.1:3108',folder=path.resolve('output/procurement-correspondence');
assert.equal(fs.readFileSync('output/procurement-main-demo/SAFETY-TEST-ONLY','utf8').trim(),'SARABUN_PROCUREMENT_MAIN_DEMO_V1');fs.mkdirSync(folder,{recursive:true});
const api=async(url,body)=>{const response=await fetch(base+'/api/procurement'+url,body===undefined?{}:{method:'POST',headers:{Origin:base,'Content-Type':'application/json'},body:JSON.stringify(body)}),value=await response.json();assert(response.ok,JSON.stringify(value));return value;};
const sample=(await(await fetch('http://127.0.0.1:3110/api/procurement')).json()).cases.find(c=>c.title.startsWith('งานสาธิตเท่านั้น'));assert(sample);
const reportFile=path.join(folder,'report.json'),report=process.argv.includes('--resume')?JSON.parse(fs.readFileSync(reportFile,'utf8')):{isolated:true,cases:{}};
for(const variant of ['short','long']){
 let record=report.cases[variant]?(await api('')).cases.find(c=>c.id===report.cases[variant].id):null;
 if(!record){const {id,version,updatedAt,...data}=structuredClone(sample);data.title='ทดสอบสารบรรณ '+variant+' เท่านั้น';data.workflow={state:'preparing',events:[],packets:[]};data.d01Overrides={};data.d07Overrides={};
 Object.assign(data.common,variant==='short'?{department:'กองคลัง',proposer:'นาย ก',proposerPosition:'เจ้าพนักงานธุรการปฏิบัติงาน'}:{department:'งานธุรการ กองสวัสดิการสังคม เทศบาลตัวอย่างสำหรับตรวจสอบการจัดหน้าบันทึกข้อความและข้อมูลส่วนราชการหลายบรรทัด โทร. 000-000000 ต่อ 123',proposer:'นางสาวชื่อผู้เสนอสำหรับตรวจสอบ การจัดกึ่งกลาง',proposerPosition:'เจ้าพนักงานธุรการปฏิบัติงานและผู้รับผิดชอบงานจัดซื้อจัดจ้างของหน่วยงาน'});
 for(const config of Object.values(data.documents)){Object.assign(config,{primaryFileId:'',signedFileId:'',reviewedHash:'',signatureChecked:false});}record=await api('',{data});report.cases[variant]={id:record.id,documents:{}};}
 const codes=variant==='short'?['D01','D02','D03','D05','D07','D12','D13','D14']:['D01','D07'];
 for(const code of codes){if(process.argv.includes('--first')&&!['D01','D07'].includes(code))continue;if(process.argv.includes('--resume')&&report.cases[variant].documents[code]&&!process.argv.includes('--refresh'))continue;
  const result=await api('/generate/'+record.id+'?code='+code,{version:record.version}),response=await fetch(base+'/api/procurement/files/'+result.id);assert(response.ok);const disposition=response.headers.get('Content-Disposition');assert(disposition.includes("filename*=UTF-8''1%2C366.00"),disposition);assert(!disposition.includes(code+'-v'));
  const dest=path.join(folder,variant);fs.mkdirSync(dest,{recursive:true});fs.writeFileSync(path.join(dest,code+'.docx'),Buffer.from(await response.arrayBuffer()));
  const pdf=await fetch(base+'/api/procurement/file-preview/'+result.id);assert(pdf.ok,await pdf.clone().text());fs.writeFileSync(path.join(dest,code+'.pdf'),Buffer.from(await pdf.arrayBuffer()));
  report.cases[variant].documents[code]={fileId:result.id,download:decodeURIComponent(disposition.split("filename*=UTF-8''")[1])};fs.writeFileSync(reportFile,JSON.stringify(report,null,2));console.log(variant+' '+code+' verified');
 }
}
console.log(JSON.stringify({ok:true,folder}));
