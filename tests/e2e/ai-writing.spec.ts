import {test,expect,type Page} from '@playwright/test';

async function openEditor(page:Page){
 await page.goto('/?view=templates');await page.locator('.template-feature').first().click();
 await page.locator('#document-body').fill('ข้อความเดิม');
 const editor=page.locator('.body-editor').filter({has:page.locator('#document-body')});
 await editor.getByRole('button',{name:'ช่วยเขียนด้วย AI',exact:true}).click();
 return page.getByRole('dialog',{name:'ช่วยเขียนด้วย AI',exact:true});
}
test('AIThaiPass prepares a prompt locally; replacement is confirmed and reversible',async({page})=>{
 let calls=0;await page.route('**/api/ai-writing',route=>{calls++;return route.fulfill({json:{error:'unexpected'}});});
 const dialog=await openEditor(page);await dialog.getByLabel('บริการ',{exact:true}).selectOption('aipass');
 await expect(dialog.getByLabel('ข้อมูลประกอบ (เลือกส่งเฉพาะที่จำเป็น)',{exact:true})).toHaveValue('');
 await dialog.getByLabel('คำขอและข้อเท็จจริงที่ต้องใช้',{exact:true}).fill('เรียบเรียงคำเชิญประชุม');
 await dialog.getByRole('button',{name:'ใช้ข้อความจากช่องนี้',exact:true}).click();
 await dialog.getByText('ดูคำสั่ง',{exact:true}).click();
 await expect(dialog.getByLabel('คำสั่งสำหรับ AIThaiPass')).toHaveValue(/ข้อความเดิม/);
 await dialog.getByLabel('คำตอบ · แก้ไขก่อนนำเข้าเอกสาร',{exact:true}).fill('ข้อความใหม่ที่ตรวจแล้ว');
 await dialog.getByRole('button',{name:'แทนที่ข้อความช่องนี้',exact:true}).click();await expect(page.locator('#document-body')).toHaveValue('ข้อความเดิม');
 await dialog.getByRole('button',{name:'ยืนยันแทนที่ข้อความเดิม',exact:true}).click();await expect(page.locator('#document-body')).toHaveValue('ข้อความใหม่ที่ตรวจแล้ว');
 await dialog.getByRole('button',{name:'ย้อนกลับการนำเข้า',exact:true}).click();await expect(page.locator('#document-body')).toHaveValue('ข้อความเดิม');expect(calls).toBe(0);
 await dialog.getByRole('button',{name:'ปิดผู้ช่วย AI'}).click();await expect(dialog).not.toBeVisible();
 const editor=page.locator('.body-editor').filter({has:page.locator('#document-body')});await editor.getByRole('button',{name:'โหมดจัดข้อความแบบ Word',exact:true}).click();await editor.getByRole('button',{name:'ช่วยเขียนด้วย AI',exact:true}).click();await expect(dialog).toBeVisible();
 await dialog.getByRole('button',{name:'ปิดผู้ช่วย AI'}).click();await expect(page.locator('#document-body')).toHaveText('ข้อความเดิม');
});
test('Gemini only sends reviewed context, previews editable text, and forgets the key on close',async({page})=>{
 const bodies:Record<string,unknown>[]=[];
 await page.route('**/api/ai-writing',async route=>{const body=route.request().postDataJSON();bodies.push(body);await route.fulfill({json:body.action==='models'?{models:[{name:'models/test-flash',displayName:'Test Flash'}]}:{text:'คำตอบร่างจาก AI',truncated:false}});});
 const dialog=await openEditor(page);
 await dialog.getByLabel('Gemini API key',{exact:true}).fill('fake-session-only-key');await dialog.getByRole('button',{name:'โหลดรายชื่อโมเดล',exact:true}).click();await expect(dialog.getByLabel('โมเดล',{exact:true})).toHaveValue('models/test-flash');
 await dialog.getByLabel('คำขอและข้อเท็จจริงที่ต้องใช้',{exact:true}).fill('ช่วยร่างวัตถุประสงค์');
 await dialog.getByRole('button',{name:'ให้ Gemini ช่วยเขียน',exact:true}).click();
 await expect(dialog.getByLabel('คำตอบ · แก้ไขก่อนนำเข้าเอกสาร',{exact:true})).toHaveValue('คำตอบร่างจาก AI');
 await expect(page.locator('#document-body')).toHaveValue('ข้อความเดิม');expect(bodies[1].context).toBe('');expect(JSON.stringify(bodies[1])).not.toContain('ข้อความเดิม');
 await dialog.getByLabel('คำตอบ · แก้ไขก่อนนำเข้าเอกสาร',{exact:true}).fill('คำตอบที่ตรวจแล้ว');await dialog.getByRole('button',{name:'เพิ่มต่อท้าย',exact:true}).click();
 await expect(page.locator('#document-body')).toHaveValue('ข้อความเดิม\nคำตอบที่ตรวจแล้ว');
 await page.screenshot({path:'output/ai-writing-dialog.png'});
 expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('fake-session-only-key');
 await dialog.getByRole('button',{name:'ปิดผู้ช่วย AI'}).click();
 const paper=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');await expect(paper.locator('.body-text').filter({hasText:'คำตอบที่ตรวจแล้ว'})).toBeVisible();
 await page.getByRole('button',{name:'ช่วยเขียนด้วย AI',exact:true}).first().click();await expect(dialog.getByLabel('Gemini API key',{exact:true})).toHaveValue('');await expect(dialog.getByLabel('คำตอบ · แก้ไขก่อนนำเข้าเอกสาร',{exact:true})).toHaveValue('');await dialog.getByRole('button',{name:'ปิดผู้ช่วย AI'}).click();
});
test('a pending request can be cancelled and cannot fill a reopened assistant',async({page})=>{
 let release:()=>void=()=>{};const held=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/ai-writing',async route=>{if(route.request().postDataJSON().action==='models'){await route.fulfill({json:{models:[{name:'models/test-flash',displayName:'Test Flash'}]}});return;}await held;await route.fulfill({json:{text:'คำตอบเก่าที่ไม่ควรแสดง'}}).catch(()=>{});});
 const dialog=await openEditor(page);await dialog.getByLabel('Gemini API key',{exact:true}).fill('fake-key');await dialog.getByRole('button',{name:'โหลดรายชื่อโมเดล',exact:true}).click();await expect(dialog.getByLabel('โมเดล',{exact:true})).toBeVisible();await dialog.getByLabel('คำขอและข้อเท็จจริงที่ต้องใช้',{exact:true}).fill('เรียบเรียง');
 await dialog.getByRole('button',{name:'ให้ Gemini ช่วยเขียน',exact:true}).click();await expect(dialog.getByRole('button',{name:'หยุดรอ',exact:true})).toBeVisible();await dialog.getByRole('button',{name:'ปิดผู้ช่วย AI'}).click();release();
 await page.getByRole('button',{name:'ช่วยเขียนด้วย AI',exact:true}).first().click();await expect(dialog.getByLabel('คำตอบ · แก้ไขก่อนนำเข้าเอกสาร',{exact:true})).toHaveValue('');await expect(page.locator('#document-body')).toHaveValue('ข้อความเดิม');
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
});
test('reports quota errors, allows retry, and prevents applying oversized answers',async({page})=>{
 let count=0;await page.route('**/api/ai-writing',route=>{count++;return route.fulfill(count===1?{status:429,json:{error:'โควตา Gemini ไม่พอ'}}:{json:{models:[{name:'models/test-flash',displayName:'Test Flash'}]}});});
 const dialog=await openEditor(page);await dialog.getByLabel('Gemini API key',{exact:true}).fill('fake-key');await dialog.getByRole('button',{name:'โหลดรายชื่อโมเดล',exact:true}).click();await expect(dialog.getByRole('alert')).toHaveText('โควตา Gemini ไม่พอ');await dialog.getByRole('button',{name:'โหลดรายชื่อโมเดล',exact:true}).click();await expect(dialog.getByLabel('โมเดล',{exact:true})).toBeVisible();
 await dialog.getByLabel('บริการ',{exact:true}).selectOption('aipass');await dialog.getByLabel('คำตอบ · แก้ไขก่อนนำเข้าเอกสาร',{exact:true}).fill('ก'.repeat(10001));await dialog.getByRole('button',{name:'เพิ่มต่อท้าย',exact:true}).click();await expect(dialog.getByRole('alert')).toContainText('ข้อความรวมยาวเกิน');await expect(page.locator('#document-body')).toHaveValue('ข้อความเดิม');await dialog.getByRole('button',{name:'ปิดผู้ช่วย AI'}).click();
});
