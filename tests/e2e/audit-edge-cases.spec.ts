import {test,expect,type Page} from "@playwright/test";
import path from "node:path";
import {DatabaseSync} from "node:sqlite";
test.skip(!process.env.SARABUN_E2E_DATA_ROOT,"Requires isolated release data");
async function create(page:Page){await page.goto('/');await page.getByRole('region',{name:'สร้างเอกสารที่ใช้บ่อย'}).getByRole('button',{name:'หนังสือภายใน',exact:true}).click();}
test('saving canonical text clears the unsaved state',async({page})=>{
 await create(page);const title='ตรวจช่องว่าง '+Date.now();await page.getByLabel('เรื่อง / ชื่อร่าง').fill('  '+title+'  ');
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toHaveValue(title);await expect(page.locator('.editor-title .badge')).toHaveText('บันทึกแล้ว');
});
test('navigation cannot replace the draft during a save',async({page})=>{
 await create(page);const title='ตรวจบันทึกค้าง '+Date.now();await page.getByLabel('เรื่อง / ชื่อร่าง').fill(title);
 let release!:()=>void,held!:()=>void;const gate=new Promise<void>(r=>release=r),started=new Promise<void>(r=>held=r);let intercepted=false;
 await page.route('**/*',async route=>{if(!intercepted&&route.request().method()==='POST'&&route.request().postData()?.includes(title)){intercepted=true;held();await gate;}await route.continue();});
 page.on('dialog',dialog=>dialog.accept());
 try{await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await started;
 await expect(page.getByRole('button',{name:'กลับรายการ',exact:true})).toBeDisabled();await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();await expect(page.locator('.editor-main')).toBeVisible();await expect(page.locator('.toast')).toContainText('กรุณารอ');await expect(page.getByRole('button',{name:'รีเฟรชระบบ',exact:true})).toBeDisabled();await expect(page.locator('.paper-scroll')).toHaveAttribute('inert','');
 }finally{release();}
 await expect(page.locator('.toast')).toContainText('บันทึกร่างเรียบร้อยแล้ว');await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toHaveValue(title);
});
test('missing signature page is reported and blocks exports until reassigned',async({page})=>{
 await create(page);const title='ตรวจหน้าลายเซ็น '+Date.now();await page.getByLabel('เรื่อง / ชื่อร่าง').fill(title);
 await page.locator('#document-body').fill(('รายละเอียดประกอบการพิจารณาของเทศบาล เพื่อทดสอบลายเซ็นบนหน้าถัดไป\n\n').repeat(25));
 await page.locator('.signature-editor > summary').click();await page.getByLabel('ไฟล์ภาพลายเซ็น',{exact:true}).setInputFiles('tests/fixtures/signature-synthetic.png');
 await page.getByRole('button',{name:'ยกเลิกการวาง',exact:true}).click();const select=page.getByRole('region',{name:'ลายเซ็นที่ 1'}).getByRole('combobox',{name:'หน้า',exact:true});
 await expect(select.locator('option[value="2"]')).toHaveCount(1);await select.selectOption('2');await page.locator('#document-body').fill('จึงเรียนมาเพื่อโปรดพิจารณา');await page.getByLabel('เรื่อง / ชื่อร่าง').focus();
 await expect(page.locator('.missing-overlay-alert')).toContainText('หน้า 2');await expect(page.getByRole('button',{name:'ดาวน์โหลด PDF',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'ดาวน์โหลด Word',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'พิมพ์เอกสาร',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'บันทึกร่าง',exact:true}).click();await expect(page.locator('.toast')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
 const db=new DatabaseSync(path.join(process.env.SARABUN_E2E_DATA_ROOT!,'data/sarabun.sqlite'),{readOnly:true});const row=db.prepare("SELECT id FROM documents WHERE json_extract(data,'$.subject')=?").get(title) as {id:string};db.close();
 for(const format of ['pdf','word']){const response=await page.request.get('/api/documents/'+row.id+'/'+format);expect(response.status()).toBe(422);expect((await response.json()).error).toContain("หน้า 2");}
 if(!await page.locator('.signature-editor').evaluate(el=>el.hasAttribute('open')))await page.locator('.signature-editor > summary').click();await select.selectOption('1');await expect(page.locator('.missing-overlay-alert')).toHaveCount(0);await expect(page.getByRole('button',{name:'ดาวน์โหลด PDF',exact:true})).toBeEnabled();
 await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').getByLabel('ภาพลายเซ็น',{exact:true})).toHaveCount(1);
});

test('focus writing preserves pagination when returning to the preview',async({page})=>{
 await create(page);await page.getByRole('button',{name:'โฟกัสการเขียน',exact:true}).click();
 await page.locator('#document-body').fill(('รายละเอียดประกอบการพิจารณาของเทศบาล เพื่อตรวจหน้าตัวอย่างขณะโฟกัสการเขียน\n\n').repeat(25));
 await page.getByLabel('เรื่อง / ชื่อร่าง').focus();
 // The completed preview must still have measured A4 pages while it is hidden.
 await expect(page.getByRole('button',{name:'ดาวน์โหลด PDF',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'แสดงตัวอย่างคู่กัน',exact:true}).click();
 const preview=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await expect.poll(()=>preview.locator('.page').count()).toBeGreaterThan(1);
 expect(await preview.locator('.content').evaluateAll(nodes=>nodes.every(node=>node.scrollHeight<=node.clientHeight+1))).toBe(true);
});
