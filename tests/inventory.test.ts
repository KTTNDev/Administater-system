import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {db,setSetting} from '../src/lib/db';
import {saveInventoryItem,createMovement,transitionMovement,readInventoryItem,readMovement,inventorySnapshot} from '../src/lib/inventory-db';
import {emptyInventoryItem,inventoryPeriod} from '../src/lib/inventory';
import {addInventoryFile,deleteInventoryFile,readInventoryFile} from '../src/lib/inventory-files';
import {validateInventoryBackup} from '../src/lib/inventory-validation';
import {inventoryCsv} from '../src/lib/inventory-export';
import {exportDatabase} from '../scripts/workspace-backup.mjs';
import {DatabaseSync} from 'node:sqlite';
import sharp from 'sharp';
let root:string;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-inventory-'));vi.stubEnv('DATABASE_PATH',path.join(root,'test.sqlite'));setSetting('storage:local',path.join(root,'storage'));});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
const item=(kind:'supply'|'asset'='supply')=>saveInventoryItem({...emptyInventoryItem(),kind,code:randomUUID(),name:kind==='supply'?'กระดาษ':'กล้อง'},randomUUID(),0);
const input=(id:string,quantity=5,kind:'receive'|'issue'|'loan'='receive')=>({kind,date:'2026-10-22',actor:'ผู้บันทึก',requester:'ผู้เบิก',department:'สำนักปลัด',purpose:'ทดสอบ',reference:'ใบตรวจรับ 1',due:kind==='loan'?'2026-10-25':'',lines:[{itemId:id,quantity,unitCost:100}]});
const post=(id:string,version=1)=>transitionMovement({id,version,action:'post',actor:'เจ้าหน้าที่',approver:'ผู้สั่งจ่าย',approvalPosition:'หัวหน้าหน่วยพัสดุ',reference:'ใบอนุมัติ 1'});
it('saves a draft without changing stock, posts once despite retries, and records audit',()=>{
 const i=item(),command=input(i.id),id=randomUUID(),m=createMovement(command,id);expect(createMovement(command,id).id).toBe(id);expect(readInventoryItem(i.id).balance).toBe(0);
 post(m.id);post(m.id);expect(readInventoryItem(i.id).balance).toBe(5);
 const issue=createMovement(input(i.id,3,'issue'),randomUUID());expect(()=>transitionMovement({id:issue.id,version:1,action:'post',actor:'x'})).toThrow(/ระบุ/);
 post(issue.id);expect(readInventoryItem(i.id).balance).toBe(2);expect(db().prepare('SELECT count(*) n FROM inventory_events').get()?.n).toBe(4);
});
it('rolls back the whole cart when a later item lacks stock',()=>{
 const a=item(),b=item();post(createMovement(input(a.id,2),randomUUID()).id);
 const m=createMovement({...input(a.id,2,'issue'),lines:[{itemId:a.id,quantity:2},{itemId:b.id,quantity:1}]},randomUUID());
 expect(()=>post(m.id)).toThrow(/ไม่พอ/);expect(readInventoryItem(a.id).balance).toBe(2);expect(readMovement(m.id).status).toBe('draft');
});
it('tracks assets individually, prevents duplicate receipt even while borrowed and returns exactly once',()=>{
 const i=item('asset');expect(()=>createMovement(input(i.id,2),randomUUID())).toThrow(/จำนวน 1/);
 post(createMovement(input(i.id,1),randomUUID()).id);const loan=createMovement(input(i.id,1,'loan'),randomUUID());post(loan.id);expect(readInventoryItem(i.id).balance).toBe(0);
 expect(()=>post(createMovement(input(i.id,1),randomUUID()).id)).toThrow(/รับเข้าแล้ว/);
 const command={id:loan.id,version:2,action:'return',actor:'ผู้รับคืน',reason:'สภาพปกติ'};
 transitionMovement(command);transitionMovement(command);expect(readInventoryItem(i.id).balance).toBe(1);
 expect(()=>createMovement(input(i.id,1,'issue'),randomUUID())).toThrow(/ใบยืม/);
});
it('rejects duplicate item codes, stale changes, invalid dates, duplicate cart lines and changed idempotency requests',()=>{
 const i=item();expect(()=>saveInventoryItem({...i},randomUUID(),0)).toThrow(/รหัส/);
 saveInventoryItem({...i,name:'แก้ไข'},i.id,1);expect(()=>saveInventoryItem({...i},i.id,1)).toThrow(/เปลี่ยน/);
 const id=randomUUID();createMovement(input(i.id),id);expect(()=>createMovement(input(i.id,8),id)).toThrow(/ข้อมูลอื่น/);
 expect(()=>createMovement({...input(i.id),date:'2026-02-31'},randomUUID())).toThrow();
 expect(()=>createMovement({...input(i.id),lines:[{itemId:i.id,quantity:1},{itemId:i.id,quantity:1}]},randomUUID())).toThrow();
 expect(inventoryPeriod(2570)).toEqual({start:'2026-10-01',end:'2027-09-30'});
});
it('cancels drafts with a reason while preserving posted evidence',()=>{
 const i=item(),m=createMovement(input(i.id),randomUUID());expect(()=>transitionMovement({id:m.id,version:1,action:'cancel',actor:'x'})).toThrow(/เหตุผล/);
 transitionMovement({id:m.id,version:1,action:'cancel',actor:'x',reason:'พิมพ์ผิด'});expect(readInventoryItem(i.id).balance).toBe(0);expect(()=>post(m.id,2)).toThrow();
 const posted=createMovement(input(i.id),randomUUID());post(posted.id);expect(()=>transitionMovement({id:posted.id,version:2,action:'cancel',actor:'x',reason:'ผิด'})).toThrow(/ยังไม่ลงบัญชี/);
});
it('stores real images locally, rejects disguised files, backs up bytes and deletes safely',async()=>{
 const i=item(),bytes=await sharp({create:{width:20,height:10,channels:4,background:'#446677'}}).png().toBuffer();
 const f=await addInventoryFile(i.id,'item',new File([new Uint8Array(bytes)],'กล้อง.png',{type:'image/png'}));expect(readInventoryFile(f.id).file.equals(bytes)).toBe(true);
 const folder=path.join(root,'storage','พัสดุและครุภัณฑ์','รูปประจำรายการ',i.id);expect(fs.existsSync(path.join(folder,f.id+'.png'))).toBe(true);
 await expect(addInventoryFile(i.id,'item',new File(['<script>bad</script>'],'fake.png',{type:'image/png'}))).rejects.toThrow();
 const backup=exportDatabase(path.join(root,'test.sqlite'),path.join(root,'backup'),process.cwd());const saved=new DatabaseSync(path.join(backup.folder,'sarabun.sqlite'),{readOnly:true});
 try{const tables=['inventory_items','inventory_movements','inventory_files','inventory_events'];const data=Object.fromEntries(tables.map(t=>[t,saved.prepare('SELECT * FROM '+t).all()]));validateInventoryBackup(data);expect((data.inventory_files[0].file as Uint8Array).length).toBe(bytes.length);}finally{saved.close();}
 deleteInventoryFile(f.id);expect(inventorySnapshot().files).toHaveLength(0);expect(fs.existsSync(path.join(folder,f.id+'.png'))).toBe(false);
});
it('validates ledger balance during restore and neutralizes CSV spreadsheet formulas',()=>{
 const i=item();post(createMovement(input(i.id),randomUUID()).id);const tables=['inventory_items','inventory_movements','inventory_files','inventory_events'];const data=Object.fromEntries(tables.map(t=>[t,db().prepare('SELECT * FROM '+t).all()]));validateInventoryBackup(data);data.inventory_items[0].balance=999;expect(()=>validateInventoryBackup(data)).toThrow(/ยอดพัสดุ/);
 const m=inventorySnapshot().movements[0];expect(inventoryCsv([{...m,requester:'=1+1'}])).toContain("'=1+1");
});

it('restores items, ledger and original pictures together and rejects stale edits',async()=>{
 const {prepareBackupRestore,activateBackupRestore}=await import('../src/lib/workspace-restore');
 vi.stubEnv('SARABUN_SOURCE_DIR',root);fs.mkdirSync(path.join(root,'scripts'));fs.copyFileSync(path.resolve('scripts/restore-backup.mjs'),path.join(root,'scripts/restore-backup.mjs'));
 const i=item(),m=createMovement(input(i.id),randomUUID());post(m.id);
 const bytes=await sharp({create:{width:4,height:4,channels:3,background:'#ffffff'}}).png().toBuffer();
 const photo=await addInventoryFile(i.id,'item',new File([new Uint8Array(bytes)],'restore.png',{type:'image/png'}));
 const backup=exportDatabase(path.join(root,'test.sqlite'),path.join(root,'storage'),process.cwd());
 deleteInventoryFile(photo.id);post(createMovement(input(i.id,2,'issue'),randomUUID()).id);const stale=readInventoryItem(i.id);
 const preview=await prepareBackupRestore(path.basename(backup.folder));activateBackupRestore(preview.token,'กู้คืนข้อมูล');
 expect(readInventoryItem(i.id).balance).toBe(5);expect(readInventoryFile(photo.id).file.equals(bytes)).toBe(true);expect(inventorySnapshot().movements).toHaveLength(1);
 expect(()=>saveInventoryItem({...stale,name:'stale'},i.id,stale.version)).toThrow(/เปลี่ยน/);
});

it('orders history by recorded time rather than insertion order after a restore',()=>{
 const i=item(),a=createMovement(input(i.id),randomUUID()),b=createMovement(input(i.id),randomUUID());
 db().prepare("UPDATE inventory_movements SET data=json_set(data,'$.createdAt',?) WHERE id=?").run('2026-10-23T00:00:00.000Z',a.id);
 db().prepare("UPDATE inventory_movements SET data=json_set(data,'$.createdAt',?) WHERE id=?").run('2026-10-22T00:00:00.000Z',b.id);
 expect(inventorySnapshot().movements.map(m=>m.id)).toEqual([a.id,b.id]);
});
