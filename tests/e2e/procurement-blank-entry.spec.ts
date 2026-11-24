import {test,expect} from '@playwright/test';
test.skip(!process.env.SARABUN_E2E_DATA_ROOT,'Use isolated procurement test data');
test('a new bill can be entered through all five sections and the final action creates fifteen Core drafts',async({page})=>{
 test.setTimeout(180000);await page.goto('/?view=procurement');await page.getByRole('button',{name:'+ เริ่มงานจัดซื้อ',exact:true}).click();
 await expect(page.getByRole('button',{name:'ก่อนหน้า',exact:true})).toBeDisabled();
 const title='[ตัวอย่าง] กรอกบิลใหม่ครบขั้นตอน '+Date.now();
 for(const [label,value] of [['ชื่อเรื่องย่อ',title],['แผนงาน','แผนงานทดสอบ'],['งาน','งานบริหารทั่วไป'],['หมวดรายจ่าย','ค่าวัสดุ'],['ประเภทรายจ่าย','วัสดุสำนักงาน'],['งบตั้งไว้ (บาท)','50000'],['เหตุผล / ความจำเป็น','เพื่อทดสอบกรอกบิลจากหน้าจัดซื้อจัดจ้างตั้งแต่ฟอร์มว่าง']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'ถัดไป',exact:true}).click();await expect(page.getByRole('heading',{name:'2 · รายการและร้านค้า',exact:true})).toBeVisible();
 for(const [label,value] of [['ชื่อร้าน','ร้านจำลอง'],['ผู้เสนอราคา / ผู้ติดต่อ','นายจำลอง ทดสอบ'],['ที่อยู่ร้าน','99 ถนนทดสอบ ภูเก็ต'],['โทรศัพท์','0800000000'],['เลขประจำตัวผู้เสียภาษี (13 หลัก)','1234567890123'],['รายการ 1','ตลับเมตร'],['จำนวน 1','2'],['หน่วย 1','อัน'],['ราคาต่อหน่วย 1','580']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'+ เพิ่มรายการสินค้า',exact:true}).click();
 for(const [label,value] of [['รายการ 2','แฟ้มเอกสาร'],['จำนวน 2','2'],['หน่วย 2','แฟ้ม'],['ราคาต่อหน่วย 2','180']])await page.getByLabel(label,{exact:true}).fill(value);
 await expect(page.getByTestId('totals')).toContainText('๑,๕๒๐.๐๐');await page.getByRole('button',{name:'ถัดไป',exact:true}).click();
 await page.getByLabel('ชื่อผู้ตรวจรับ 1',{exact:true}).fill('นายผู้ตรวจรับ จำลอง');await page.getByLabel('ตำแหน่งผู้ตรวจรับ 1',{exact:true}).fill('นักพัฒนาชุมชน');
 for(const role of ['ผู้เสนอ','ผู้อำนวยการกอง','ปลัด / ผู้ปฏิบัติราชการแทน','นายก / ผู้ปฏิบัติราชการแทน']){
  const group=page.getByRole('group',{name:role,exact:true});await group.getByLabel('ชื่อผู้ลงนาม',{exact:true}).fill('นาย'+role+' จำลอง');await group.getByLabel('ตำแหน่ง',{exact:true}).fill(role);
 }
 await page.getByRole('button',{name:'ถัดไป',exact:true}).click();await page.getByLabel('1 วันที่',{exact:true}).fill('2026-11-17');await page.getByRole('button',{name:'จัดวันที่อัตโนมัติตามวันทำการ',exact:true}).click();await page.getByRole('button',{name:'รันเลขถัดไปอัตโนมัติ',exact:true}).click();
 await expect(page.getByLabel('11.1 วันที่',{exact:true})).toHaveValue('2026-11-20');await expect(page.getByLabel('1 เลขบันทึก',{exact:true})).not.toHaveValue('');
 await page.getByRole('button',{name:'ถัดไป',exact:true}).click();await expect(page.getByRole('heading',{name:'5 · สัญญา ผลตรวจรับ และรูปภาพ',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'ถัดไป',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'ตรวจและสร้างชุดร่าง',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'ตรวจและสร้างชุดร่าง',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'เชื่อมร่างครบ 15 ฉบับแล้ว'})).toBeVisible({timeout:60000});
 const cases=await (await page.request.get('/api/procurement/workspace?action=list')).json(),record=cases.find((r:{caseInput:{projectTitleShort:string}})=>r.caseInput.projectTitleShort===title);
 const links=await (await page.request.get('/api/procurement/core-drafts?caseId='+record.caseInput.id)).json();expect(links).toHaveLength(15);expect(links.find((r:{doc_id:string})=>r.doc_id==='10').draft.body).toContain('๑,๕๒๐.๐๐');
 await page.screenshot({path:'output/visible-workflow/blank-entry-tested.png',fullPage:true});
});
test('a failed save keeps entered data, releases navigation and can be retried',async({page})=>{
 await page.goto('/?view=procurement');await page.getByRole('button',{name:'+ เริ่มงานจัดซื้อ',exact:true}).click();
 let fail=true;await page.route('**/api/procurement/workspace',async route=>{if(fail&&route.request().method()==='POST'&&route.request().postDataJSON().action==='save'){fail=false;await route.abort('failed');}else await route.continue();});
 const title='[ตัวอย่าง] ทดสอบบันทึกเมื่อเครือข่ายกลับมา '+Date.now();await page.getByLabel('ชื่อเรื่องย่อ',{exact:true}).fill(title);
 await expect(page.getByRole('alert').filter({hasText:'ติดต่อระบบสารบรรณไม่ได้'})).toBeVisible({timeout:15000});
 await expect(page.getByLabel('ชื่อเรื่องย่อ',{exact:true})).toHaveValue(title);await expect(page.getByRole('button',{name:'ถัดไป',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'ลองบันทึกอีกครั้ง',exact:true}).click();await expect(page.getByRole('status').filter({hasText:'บันทึกแล้ว'})).toBeVisible();
 await page.getByRole('button',{name:'ถัดไป',exact:true}).click();await expect(page.getByRole('heading',{name:'2 · รายการและร้านค้า',exact:true})).toBeVisible();
 const records=await (await page.request.get('/api/procurement/workspace?action=list')).json();expect(records.filter((r:{caseInput:{projectTitleShort:string}})=>r.caseInput.projectTitleShort===title)).toHaveLength(1);
});
