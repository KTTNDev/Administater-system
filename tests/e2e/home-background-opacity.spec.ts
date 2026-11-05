import {test,expect,type Page} from '@playwright/test';
async function range(page:Page,name:string,value:string){
 await page.getByRole('slider',{name,exact:true}).evaluate((el:HTMLInputElement,value)=>{
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(el,value);
  el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
 },value);
}
async function settings(page:Page){
 await page.goto('/?view=settings');
 const panel=page.getByRole('region',{name:'ปรับแต่งหน้าหลัก',exact:true});
 await expect(panel.getByLabel('ชื่อปุ่มเมนู',{exact:true})).toBeEnabled();
 await panel.getByText('ส่วนหัวและองค์ประกอบหน้าหลัก',{exact:true}).click();
 return panel;
}
test('background opacity previews, persists for coast and custom photos, and keeps clock sizes independent',async({page})=>{
 let panel=await settings(page);
 await panel.getByRole('combobox',{name:'พื้นหลังส่วนหัว',exact:true}).selectOption('coast');
 await range(page,'ความชัดภาพพื้นหลังหน้าหลัก','0');
 await expect(panel.locator('.home-background-preview img')).toHaveCSS('opacity','0');
 await panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');
 await page.goto('/home');await expect(page.locator('.home-hero-media')).toHaveCSS('opacity','0');
 await expect(page.locator('#wd-home-title')).toHaveCSS('opacity','1');
 panel=await settings(page);
 await panel.getByRole('combobox',{name:'พื้นหลังส่วนหัว',exact:true}).selectOption('image');
 await expect(panel.locator('.home-background-preview img')).toHaveCount(0);
 await panel.getByLabel('รูปพื้นหลังส่วนหัว',{exact:true}).setInputFiles('public/media/home-coast-poster.png');
 await expect(panel.getByRole('status')).toContainText('เตรียมรูปแล้ว');
 await range(page,'ความชัดภาพพื้นหลังหน้าหลัก','45');
 await expect(panel.locator('.home-background-preview img')).toHaveCSS('opacity','0.45');
 await expect(panel.getByRole('region',{name:'ตำแหน่งภาพส่วนหัวหน้าหลัก',exact:true}).locator('img')).toHaveCSS('opacity','0.45');
 await expect(panel.locator('.home-clock-settings')).toHaveAttribute('open','');
 await range(page,'ขนาดนาฬิกา','80');await range(page,'ขนาดวันที่','24');
 await page.screenshot({path:'output/home-opacity-settings.png',fullPage:true});
 await panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');
 await page.goto('/home');
 await expect(page.locator('.home-custom-hero-image')).toHaveCSS('opacity','0.45');
 await expect(page.locator('.home-clock time')).toHaveCSS('font-size','80px');
 await expect(page.locator('.home-clock>span')).toHaveCSS('font-size','24px');
 await expect(page.locator('.home-clock')).toHaveCSS('opacity','1');
 await page.reload();await expect(page.locator('.home-custom-hero-image')).toHaveCSS('opacity','0.45');
 panel=await settings(page);await range(page,'ความชัดภาพพื้นหลังหน้าหลัก','100');
 await expect(panel.locator('.home-background-preview img')).toHaveCSS('opacity','1');
 await panel.getByRole('combobox',{name:'พื้นหลังส่วนหัว',exact:true}).selectOption('plain');
 await expect(page.getByRole('slider',{name:'ความชัดภาพพื้นหลังหน้าหลัก',exact:true})).toHaveCount(0);
 await expect(panel.locator('.home-background-preview img')).toHaveCount(0);
 await panel.getByRole('button',{name:'คืนค่าเริ่มต้น',exact:true}).click();
 await panel.getByRole('button',{name:'บันทึกหน้าหลัก',exact:true}).click();
 await expect(panel.getByRole('status')).toContainText('บันทึกหน้าหลักแล้ว');
});
