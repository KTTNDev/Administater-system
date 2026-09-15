import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const folder=path.resolve('output/legal-research-2026-09-14');
const parse=file=>JSON.parse(fs.readFileSync(path.join(folder,file),'utf8').replace(/^\uFEFF/,''));
const sources=parse('sources.json'),cloud=parse('drive-results.json'),db=new DatabaseSync('data/sarabun.sqlite');
db.exec('PRAGMA busy_timeout=5000');
const local=db.prepare("SELECT value FROM settings WHERE key='storage:local'").get()?.value||path.resolve('output/storage');
for(const x of sources){const bytes=fs.readFileSync(path.join(folder,x.file));if(bytes.subarray(0,5).toString()!=='%PDF-'||bytes.length>10*1024*1024)throw new Error('Invalid PDF '+x.file);const existing=db.prepare("SELECT id FROM legal_library WHERE json_extract(data,'$.url')=?").get(x.url);if(existing){console.log('Already imported '+x.file);continue;}const id=randomUUID(),remote=cloud.find(r=>r.file===x.file);if(!remote)throw new Error('Missing verified upload');const data={title:x.title,category:x.category,year:x.year,url:x.url,section:'',notes:x.notes,tags:'แหล่งราชการ, ค้นคว้า 2569, '+x.category,status:'unchecked',highlight:'ตรวจแหล่งเผยแพร่ 14 ก.ย. 2569 — อ่านประกอบฉบับแก้ไขและหนังสือซักซ้อมที่เกี่ยวข้อง',page:1,driveFileId:remote.id,driveHash:createHash('sha256').update(bytes).update(JSON.stringify([x.title,x.category,x.year])).digest('hex')};const at=new Date().toISOString();db.prepare('INSERT INTO legal_library(id,data,file,file_name,updated_at) VALUES(?,?,?,?,?)').run(id,JSON.stringify(data),bytes,x.file,at);db.prepare('INSERT INTO audit(document_id,action,version,at) VALUES(?,?,?,?)').run(id,'legal_research_import',1,at);const target=path.join(local,'คลังกฎหมายและระเบียบ',x.category,x.year);fs.mkdirSync(target,{recursive:true});fs.writeFileSync(path.join(target,id+'-'+createHash('sha256').update(bytes).digest('hex').slice(0,12)+'.pdf'),bytes);console.log(JSON.stringify({id,file:x.file,bytes:bytes.length,driveFileId:remote.id}));}
db.close();
