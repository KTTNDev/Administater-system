import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import {templates} from '../../src/lib/templates';

test.beforeEach(async({page})=>{
  page.on('dialog',dialog=>dialog.accept());
  const root=process.env.SARABUN_TEST_DESKTOP_ROOT;
  if(root){
    const {token}=JSON.parse(fs.readFileSync(path.join(root,'output/desktop/server.json'),'utf8'));
    await page.goto('/desktop#token='+token);
    await page.waitForURL('http://127.0.0.1:3000/');
  }
});

async function create(page:Page,title:string){
  await page.goto('/');
  await page.getByRole('button',{name:'สร้างหนังสือใหม่',exact:true}).click();
  await page.locator('.template-card').filter({has:page.getByRole('heading',{name:title,exact:true})}).click();
  await expect(page.locator('#form-body')).toBeVisible();
}

test('all 13 forms keep their required data editable in document order',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const template of templates){
    await test.step(template.name,async()=>{
      await create(page,template.name);
      const form=page.locator('.editor-fields');
      await expect(form.locator('input[type=date]')).toHaveCount(1);
      await expect(form.getByLabel(/ส่วนราชการเจ้าของหนังสือ/)).toHaveCount(1);
      const sections=await form.locator(':scope > [id^="form-"]').evaluateAll(nodes=>nodes.map(node=>node.id));
      expect(sections.indexOf('form-header')).toBeLessThan(sections.indexOf('form-body'));
      expect(sections.indexOf('form-body')).toBeLessThan(sections.indexOf('form-signing'));
      expect(sections.indexOf('form-attachments')<sections.indexOf('form-body')).toBe(template.id==='external');
      await expect(form.getByLabel('ระยะขอบบนหน้าแรก')).toHaveCount(1);
      await expect(form.getByLabel('ชั้นความเร็ว',{exact:true})).toHaveCount(1);
      await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();
      await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.page').first()).toBeVisible();
      if(template.id==='minutes'){
        await expect(page.locator('#form-signing').getByLabel('เลิกประชุมเวลา')).toBeVisible();
        await expect(page.locator('#form-signing').getByLabel('ผู้จดรายงานการประชุม')).toBeVisible();
      }
      if(template.id==='external'){
        await expect(page.locator('#form-signing').getByLabel('โทรศัพท์',{exact:true})).toBeVisible();
        await expect(page.locator('#form-header').getByLabel('วันที่หนังสือ')).toBeVisible();
      }
    });
  }
  expect(errors).toEqual([]);
});

test('section shortcuts allow free editing and folding preserves content',async({page})=>{
  await create(page,'หนังสือภายใน');
  const nav=page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'});
  await nav.getByRole('button',{name:'ส่วนท้าย',exact:true}).click();
  await page.getByLabel('ชื่อ–นามสกุลผู้ลงนาม').fill('ผู้ทดสอบ');
  await nav.getByRole('button',{name:'เนื้อหา',exact:true}).click();
  await page.locator('#document-body').fill('เนื้อหาที่กรอกต้องยังอยู่');
  await page.locator('#form-body > summary').click();
  await nav.getByRole('button',{name:'เนื้อหา',exact:true}).click();
  await expect(page.locator('#document-body')).toHaveValue('เนื้อหาที่กรอกต้องยังอยู่');
  await expect(page.getByLabel('ชื่อ–นามสกุลผู้ลงนาม')).toHaveValue('ผู้ทดสอบ');
  await expect(page.locator('.inline-assistant')).not.toHaveAttribute('open','');
  await page.getByLabel('แยกเนื้อหาตามหน้าที่ของย่อหน้า').check();
  await expect(page.getByLabel('เรื่องเดิม',{exact:true})).toHaveValue('เนื้อหาที่กรอกต้องยังอยู่');
  await page.getByLabel('ข้อเท็จจริง',{exact:true}).fill('ข้อเท็จจริงใหม่');
  const headings=await page.locator('.body-section-input > label').allTextContents();
  expect(headings).toEqual(['เรื่องเดิม','ข้อเท็จจริง','ข้อระเบียบ/กฎหมาย','ข้อพิจารณา','จึงเรียนมาเพื่อ…']);
});

test('desktop and narrow layouts keep the form usable without a wizard',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});
  await create(page,'หนังสือภายนอก');
  await page.getByRole('button',{name:'ใช้ข้อมูลตัวอย่าง'}).click();
  await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.page').first()).toBeVisible();
  await expect(page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.page').first()).toContainText('ขอเชิญ');
  await page.screenshot({path:'output/form-flow-desktop.png'});
  await page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'}).getByRole('button',{name:'เนื้อหา',exact:true}).click();
  await page.locator('#document-body').focus();
  await page.screenshot({path:'output/form-flow-body.png'});
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('navigation',{name:'ไปยังส่วนของแบบฟอร์ม'}).getByRole('button',{name:'ส่วนหัว',exact:true}).click();
  await expect(page.getByLabel('เรื่อง / ชื่อร่าง')).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(391);
  await page.screenshot({path:'output/form-flow-mobile.png',fullPage:true});
});
