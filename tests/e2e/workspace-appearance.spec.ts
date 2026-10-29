import {test,expect} from '@playwright/test';
import {templates} from '../../src/lib/templates';
for(const template of templates)test('light workspace and progress: '+template.id,async({page})=>{
 await page.addInitScript(()=>localStorage.setItem('sarabun-ui-theme','dim'));
 await page.emulateMedia({colorScheme:'dark'});await page.goto('/');
 await expect(page.getByRole('button',{name:'มืดนุ่ม',exact:true})).toHaveCount(0);
 await expect(page.locator('html')).toHaveCSS('color-scheme','light');
 await page.getByRole('button',{name:'แบบหนังสือราชการ',exact:true}).click();
 await page.locator('.template-card').filter({has:page.getByRole('heading',{name:template.name,exact:true})}).click();
 await expect(page.getByRole('progressbar',{name:'ข้อมูลสำคัญและการตรวจทาน'})).toBeVisible();
 const paper=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.page').first();await expect(paper).toBeVisible({timeout:30000});await expect(paper).toHaveCSS('background-color','rgb(255, 255, 255)');
 await page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'}).getByRole('button',{name:'เนื้อหา',exact:true}).click();await expect(page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'}).getByRole('button',{name:'เนื้อหา',exact:true})).toHaveAttribute('aria-current','step');
});
test('completion reaches 100 only after review and allows an unnumbered draft option',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();await page.locator('.template-card').filter({has:page.getByRole('heading',{name:'หนังสือภายใน',exact:true})}).click();
 await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง',exact:true}).click();
 const meter=page.getByRole('progressbar',{name:'ข้อมูลสำคัญและการตรวจทาน'});
 await page.getByLabel('เลขที่หนังสือ',{exact:true}).fill('ทดสอบ 123');
 await page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'}).getByRole('button',{name:'ตรวจทาน',exact:true}).click();
 await page.getByLabel('ฉันได้ตรวจเนื้อหา รูปแบบ ผู้รับ และอำนาจผู้ลงนามแล้ว').check();await expect(meter).toHaveAttribute('value','100');
 await page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'}).getByRole('button',{name:'ส่วนหัว',exact:true}).click();await page.getByLabel('เลขที่หนังสือ',{exact:true}).fill('');
 await expect(meter).not.toHaveAttribute('value','100');
 await page.locator('.storage-card > summary').click();
 const option=page.getByRole('checkbox',{name:'ฉันตรวจเนื้อหาแล้ว ขอจัดเก็บฉบับร่างที่ยังไม่มีเลขทะเบียน (ยังไม่ใช่ฉบับออกหนังสือ)',exact:true});await expect(option).toBeVisible();await option.check();
 await expect(page.getByRole('button',{name:'จัดเก็บฉบับร่างรอเลขทะเบียนบน Drive',exact:true})).toBeVisible();
});
