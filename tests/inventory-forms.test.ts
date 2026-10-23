import {it,expect,beforeEach,afterEach,vi} from 'vitest';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {seedInventoryForm,stockAt,calculatedRows} from '../src/lib/inventory-forms';
import {emptyInventoryItem,type InventorySnapshot,type Movement} from '../src/lib/inventory';
import {inventoryAnalytics} from '../src/lib/inventory-analytics';
import {inventoryFormHtml} from '../src/lib/inventory-form-render';
import {validatedForm,saveInventoryForm,readInventoryForm} from '../src/lib/inventory-form-db';
import {db} from '../src/lib/db';
import {exportDatabase} from '../scripts/workspace-backup.mjs';
const supply={...emptyInventoryItem(),id:randomUUID(),code:'S1',name:'กระดาษ A4',unit:'รีม',minimum:3,version:1,balance:6,updatedAt:'2026-10-01'},asset={...supply,id:randomUUID(),code:'A1',name:'กล้อง',kind:'asset' as const,balance:0};
const movement=(kind:Movement['kind'],item=supply,quantity=10,date='2026-10-01'):Movement=>({id:randomUUID(),number:kind+'-1',version:2,kind,date,actor:'เจ้าหน้าที่',requester:'ผู้ขอเบิก',department:'สำนักปลัด',purpose:'ใช้ทำงาน',reference:'เอกสาร 1',approver:'หัวหน้า',approvalPosition:'หัวหน้าสำนัก',due:'2026-10-15',place:'inside',status:'posted',createdAt:date+'T00:00:00Z',lines:[{itemId:item.id,code:item.code,name:item.name,kind:item.kind,unit:item.unit,quantity,unitCost:100}]});
const receipt=movement('receive'),issue=movement('issue',supply,4,'2026-10-10'),assetReceipt=movement('receive',asset,1),loan=movement('loan',asset,1,'2026-10-11');
const fixture:InventorySnapshot={items:[supply,asset],movements:[receipt,issue,assetReceipt,loan],files:[]};
const options=(id:number)=>({templateId:id,asOf:'2026-10-23',sourceId:id===1?supply.id:id===4?issue.id:asset.id,organization:'เทศบาลทดสอบ',department:'สำนักปลัด'});
let root:string;
beforeEach(()=>{root=fs.mkdtempSync(path.join(os.tmpdir(),'sarabun-form-tests-'));vi.stubEnv('DATABASE_PATH',path.join(root,'test.sqlite'));});
afterEach(()=>{db().close();(globalThis as unknown as {sarabunDb?:unknown}).sarabunDb=undefined;vi.unstubAllEnvs();});
it('seeds all eight semantic forms without inventing inspection, depreciation or stock valuation',()=>{
 for(let i=1;i<=8;i++)expect(()=>validatedForm(seedInventoryForm(fixture,options(i)))).not.toThrow();
 expect(seedInventoryForm(fixture,options(5)).rows[0]).toMatchObject({quantity:'6',unitCost:''});
 expect(seedInventoryForm(fixture,options(6)).rows[0]).toMatchObject({quantity:'1',condition:''});
 expect(seedInventoryForm(fixture,options(2)).rows[0].depreciation).toBeUndefined();
 expect(seedInventoryForm(fixture,options(8)).fields.countFinding).toBeUndefined();
});
it('reconstructs historical balance and counts loaned assets in ownership',()=>{
 expect(stockAt(fixture,supply.id,'2026-10-05')).toBe(10);expect(stockAt(fixture,supply.id,'2026-10-23')).toBe(6);expect(stockAt(fixture,asset.id,'2026-10-23')).toBe(1);
 const d={...fixture,movements:[...fixture.movements,{...movement('receive'),status:'draft' as const},{...movement('receive'),status:'cancelled' as const},movement('receive',supply,30,'2026-11-01')]};
 expect(stockAt(d,supply.id,'2026-10-23')).toBe(6);
});
it('keeps every long-register record and cumulative balance for automatic pagination',()=>{
 const data={...fixture,movements:Array.from({length:60},(_,i)=>({...receipt,id:randomUUID(),number:String(i)}))};
 const d=seedInventoryForm(data,options(1));expect(d.rows).toHaveLength(60);expect(d.rows[59].balance).toBe('600');
});
it('calculates material totals only from entered quantity and unit price, including zero',()=>{
 const d=seedInventoryForm(fixture,options(5));
 expect(calculatedRows(d)[0].total).toBe('');d.rows[0].unitCost='12.5';expect(calculatedRows(d)[0].total).toBe('75');
 d.rows[0].unitCost='0';expect(calculatedRows(d)[0].total).toBe('0');d.rows[0].unitCost='-1';expect(()=>validatedForm(d)).toThrow();
});
it('rejects invalid fields, excessively long reports and non-numeric financial cells',()=>{
 const d=seedInventoryForm(fixture,options(5));
 expect(()=>validatedForm({...d,fields:{unknown:'x'}})).toThrow();
 expect(()=>validatedForm({...d,rows:Array.from({length:501},()=>({}))})).toThrow();
 d.rows[0].unitCost='NaN';expect(()=>validatedForm(d)).toThrow();
});
it('does not mark draft or cancelled requests as issued',()=>{
 const f={...fixture,movements:[{...issue,status:'draft' as const}]};
 expect(seedInventoryForm(f,options(4)).rows[0].issued).toBe('');
 expect(seedInventoryForm(fixture,options(4)).rows[0].issued).toBe('4');
});
it('escapes all editable values while using shared document pagination and Thai fonts',()=>{
 const d=seedInventoryForm(fixture,options(1));d.fields.name='<script>alert(1)</script>';d.rows[0].remark='<img src=x onerror=alert(1)>';
 const html=inventoryFormHtml(d);expect(html).toContain('&lt;script&gt;');expect(html).not.toContain('<script>alert(1)</script>');expect(html).not.toContain('<img src=x');expect(html).toContain('__paginationDone');expect(html).toContain('THSarabunNew');
});
it('saves independently, rejects stale edits and includes form drafts in backup',()=>{
 const d=seedInventoryForm(fixture,options(4)),id=randomUUID();
 const saved=saveInventoryForm(id,0,d);expect(saved.version).toBe(1);expect(saveInventoryForm(id,0,d).id).toBe(id);
 saveInventoryForm(id,1,{...d,title:'แก้แล้ว'});expect(()=>saveInventoryForm(id,1,d)).toThrow(/หน้าต่างอื่น/);expect(readInventoryForm(id).title).toBe('แก้แล้ว');
 const backup=exportDatabase(path.join(root,'test.sqlite'),path.join(root,'backups'),process.cwd());const conn=new DatabaseSync(path.join(backup.folder,'sarabun.sqlite'),{readOnly:true});expect(conn.prepare('SELECT count(*) n FROM inventory_form_drafts').get()?.n).toBe(1);conn.close();
});
it('measures elapsed demand, equal-length comparisons and overdue loans without summing different units',()=>{
 const a=inventoryAnalytics(fixture,'2026-10-01','2027-09-30','2026-10-23');
 expect(a.days).toBe(23);expect(a.issues).toBe(1);expect(a.receiveValue).toBe(1100);expect(a.demand[0].coverage).toBe(34);expect(a.overdue[0].days).toBe(8);expect(a.changePercent).toBeNull();expect(a.months).toHaveLength(1);
 const empty=inventoryAnalytics({items:[],movements:[],files:[]},'2026-10-01','2026-10-23','2026-10-23');expect(empty.receiveValue).toBe(0);expect(empty.demand).toEqual([]);
});
