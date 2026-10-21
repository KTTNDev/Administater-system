import {test,expect} from '@playwright/test';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {newDraft} from '../../src/lib/document';

test('finds a draft among 320, filters, pages, links, reopens and unlinks without changing saved book fields',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Requires isolated release data');
 await page.goto('/?view=register');
 const prefix='ร่างค้นหา '+Date.now(),ids:string[]=[];
 const db=new DatabaseSync(path.join(process.env.SARABUN_E2E_DATA_ROOT!,'data','sarabun.sqlite'));
 try{
  const insert=db.prepare('INSERT INTO documents(id,data,version,created_at,updated_at) VALUES(?,?,1,?,?)');
  for(let i=1;i<=320;i++){
   const id=randomUUID();ids.push(id);
   const draft={...newDraft(i%2?'external':'internal'),subject:prefix+' เรื่องที่ '+i,number:'ภก TEST/'+String(i).padStart(4,'0'),date:i%2?'2025-02-03':'2026-02-03',department:'กองช่าง'};
   if(i===237){draft.subject=prefix+' กล้องวีดิโอสำหรับห้องประชุม';draft.number='ภก VIDEO/๒๓๗';}
   const at=new Date(Date.UTC(2026,0,1,0,i)).toISOString();insert.run(id,JSON.stringify(draft),at,at);
  }
 }finally{db.close();}
 await page.reload();
 await page.getByRole('button',{name:'ลงทะเบียนรับ',exact:true}).click();
 const form=page.getByRole('form',{name:'กรอกทะเบียนหนังสือ'});
 await form.getByText('เอกสารประกอบและเรื่องที่เกี่ยวข้อง',{exact:true}).click();
 const trigger=form.getByRole('button',{name:'ค้นหาและเลือกร่าง',exact:true});
 await trigger.click();
 const panel=form.getByRole('region',{name:'ค้นหาร่างเพื่อเชื่อมทะเบียน'}),search=panel.getByRole('searchbox',{name:'ค้นหาร่าง',exact:true}),results=panel.getByRole('list',{name:'ร่างที่ค้นพบ'});
 await expect(search).toBeFocused();
 await search.fill(prefix);
 await expect(results.getByRole('button')).toHaveCount(8);
 await expect(panel.getByRole('status')).toContainText('320 เรื่อง');
 await expect(results.getByRole('button').first()).toContainText('เรื่องที่ 320');
 await panel.getByRole('button',{name:'ถัดไป',exact:true}).click();
 await expect(results.getByRole('button').first()).toContainText('เรื่องที่ 312');
 await panel.getByRole('combobox',{name:'ประเภทหนังสือ',exact:true}).selectOption('external');
 await panel.getByRole('combobox',{name:'ปีในหนังสือ',exact:true}).selectOption('2025');
 await expect(panel.getByRole('status')).toContainText('160 เรื่อง');
 await search.fill('ไม่พบเรื่องร่างนี้แน่นอน');
 await expect(results.getByRole('button')).toHaveCount(0);
 await expect(panel.getByRole('status')).toContainText('ไม่พบร่าง');
 await search.fill('VIDEO/237');
 await expect(results.getByRole('button')).toHaveCount(1);
 await search.press('Enter');
 await expect(form.getByRole('button',{name:'ประทับชื่อและลงทะเบียน'})).toBeVisible();
 await expect(panel).toBeVisible();
 await search.press('Escape');
 await expect(panel).toHaveCount(0);await expect(trigger).toBeFocused();
 await trigger.click();await search.fill('กล้องวีดิโอ');
 for(const width of [320,375,414,768,1440]){
  await page.setViewportSize({width,height:1000});
  await search.scrollIntoViewIfNeeded();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
  await page.screenshot({path:'output/draft-link-picker-'+width+'.png'});
 }
 await results.getByRole('button').first().focus();await page.keyboard.press('Enter');
 await expect(panel).toHaveCount(0);
 await expect(form.getByLabel('เรื่อง',{exact:true})).toHaveValue(prefix+' กล้องวีดิโอสำหรับห้องประชุม');
 await expect(form.getByLabel('ที่',{exact:true})).toHaveValue('ภก VIDEO/๒๓๗');
 await expect(form.getByRole('button',{name:'เปลี่ยนร่างที่เชื่อม',exact:true})).toBeFocused();
 await form.getByLabel('กอง / หน่วยงานเจ้าของทะเบียน').fill(prefix);
 await form.getByLabel('จาก',{exact:true}).fill('กองช่าง');
 await form.getByLabel('ถึง',{exact:true}).fill('สำนักงานเทศบาล');
 await form.getByLabel('ผู้ลงรับ / ลงส่ง').fill('ทดสอบค้นหาร่าง');
 await form.getByRole('button',{name:'ประทับชื่อและลงทะเบียน'}).click();
 await expect(page.getByRole('status').filter({hasText:'บันทึกทะเบียนรับ'})).toBeVisible();
 await page.reload();await page.getByLabel('ค้นในทะเบียน',{exact:false}).fill(prefix);
 await page.getByRole('table').getByRole('button').first().click();
 await form.getByText('เอกสารประกอบและเรื่องที่เกี่ยวข้อง',{exact:true}).click();
 await expect(form.getByRole('button',{name:'เปลี่ยนร่างที่เชื่อม',exact:true})).toBeVisible();
 await form.getByRole('button',{name:'เปลี่ยนร่างที่เชื่อม',exact:true}).click();
 await search.fill('TEST/0320');await results.getByRole('button').first().click();
 await expect(form.getByLabel('เรื่อง',{exact:true})).toHaveValue(prefix+' กล้องวีดิโอสำหรับห้องประชุม');
 await form.getByRole('button',{name:'ยกเลิกการเชื่อม',exact:true}).click();
 await form.getByLabel('เหตุผล / รายละเอียดการแก้ไข').fill('ยกเลิกการเชื่อมร่าง');
 await form.getByRole('button',{name:'บันทึกการแก้ไข',exact:true}).click();
 await expect(form.getByRole('heading',{name:'ประวัติรายการ (2)'})).toBeVisible();
 const check=new DatabaseSync(path.join(process.env.SARABUN_E2E_DATA_ROOT!,'data','sarabun.sqlite'),{readOnly:true});
 try{
  const row=check.prepare("SELECT data FROM correspondence_entries WHERE json_extract(data,'$.department')=?").get(prefix) as {data:string};
  expect(JSON.parse(row.data).documentId).toBe('');
  expect(JSON.parse(row.data).subject).toBe(prefix+' กล้องวีดิโอสำหรับห้องประชุม');
 }finally{check.close();}
});
