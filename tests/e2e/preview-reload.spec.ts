import {test,expect} from '@playwright/test';

test('switching drafts and refreshing the preview keeps the correct text',async({page})=>{
 test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Use disposable data only.');
 const marker=Date.now();
 const records=[{type:'หนังสือภายนอก',subject:`ทดสอบตัวอย่าง ก ${marker}`,body:`เนื้อหาเฉพาะฉบับ ก ${marker}`},{type:'หนังสือภายใน',subject:`ทดสอบตัวอย่าง ข ${marker}`,body:`เนื้อหาเฉพาะฉบับ ข ${marker}`}];
 await page.goto('/');
 for(const item of records){
  await page.getByRole('button',{name:item.type,exact:true}).click();
  await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();await page.getByLabel("เลขที่หนังสือ",{exact:true}).fill("");
  await page.getByLabel('เรื่อง / ชื่อร่าง').fill(item.subject);
  await page.locator('#document-body').fill(item.body);
  const save=page.getByRole('button',{name:'บันทึกร่าง',exact:true});await save.scrollIntoViewIfNeeded();await save.click();
  await expect(page.locator('.toast[role=status]')).toContainText('บันทึกร่างเรียบร้อยแล้ว');
  await page.getByRole('button',{name:'กลับรายการ'}).click();
 }
 const preview=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
 for(const item of [records[0],records[1],records[0],records[1]]){
  await page.getByLabel('ค้นหาเอกสารทุกข้อมูล').fill(item.subject);
  await page.getByRole('button',{name:new RegExp('^'+item.subject)}).first().click();
  await expect(preview.locator('.body-text')).toContainText(item.body);
  await page.getByRole('button',{name:'กลับรายการ'}).click();
 }
 await page.getByLabel('ค้นหาเอกสารทุกข้อมูล').fill(records[1].subject);
 await page.getByRole('button',{name:new RegExp('^'+records[1].subject)}).first().click();
 await expect(preview.locator('.body-text')).toContainText(records[1].body);
 const frame=page.locator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await frame.evaluate(element=>element.setAttribute('data-test-frame','before'));
 await page.getByRole('button',{name:'โหลดตัวอย่างใหม่'}).click();
 await expect(frame).not.toHaveAttribute('data-test-frame','before');
 await expect(page.locator('#document-body')).toHaveValue(records[1].body);
 await expect(preview.locator('.body-text')).toContainText(records[1].body);
 await page.getByRole('button',{name:'รีเฟรชระบบ'}).click();
 await expect(page.getByRole('heading',{name:'พื้นที่ทำงาน'})).toBeVisible();
});


test('a failed preview message remounts the preview automatically',async({page})=>{
 await page.goto('/');
 await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายนอก",exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();await page.getByLabel("เลขที่หนังสือ",{exact:true}).fill("");
 const preview=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await expect(preview.locator('.body-text').first()).toHaveText((await page.locator('#document-body').inputValue()).split('\n')[0]);
 const frame=page.locator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await frame.evaluate(element=>element.setAttribute('data-test-frame','failed'));
 await preview.locator('body').evaluate(()=>parent.postMessage({source:'sarabun-preview',error:true},'*'));
 await expect(frame).not.toHaveAttribute('data-test-frame','failed',{timeout:5000});
 await expect(preview.locator('.body-text').first()).toHaveText((await page.locator('#document-body').inputValue()).split('\n')[0]);
});
