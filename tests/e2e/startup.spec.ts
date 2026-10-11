import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

test.beforeEach(async ({ page }) => {
  const root = process.env.SARABUN_TEST_DESKTOP_ROOT;
  if (root) {
    const { token } = JSON.parse(fs.readFileSync(path.join(root, "output/desktop/server.json"), "utf8"));
    await page.goto("/desktop#token=" + token);
    await page.waitForURL("http://127.0.0.1:3000/");
  }
});

test("startup opens the dashboard, document preview, and settings", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));

  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page.locator(".app-shell")).toBeVisible();
  await page.getByRole("button", { name: "สร้างหนังสือใหม่", exact: true }).click();
  await page.locator(".template-card").filter({
    has: page.getByRole("heading", { name: "หนังสือภายนอก", exact: true }),
  }).click();

  const preview = page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
  await expect(preview.locator(".page").first()).toBeVisible();
  await expect(page.locator(".preview-footer")).toContainText("ตัวอย่าง 1 หน้า");
  await page.getByRole("button", { name: "โหลดตัวอย่างใหม่" }).click();
  await expect(preview.locator(".page").first()).toBeVisible();

  await page.getByRole("button", { name: "ตั้งค่าหน่วยงานและ Drive", exact: true }).click();
  await expect(page.locator(".settings-main")).toBeVisible();
  await page.getByRole("button", { name: "รีเฟรชระบบ" }).click();
  await expect(page.getByRole("heading", { name: "พื้นที่ทำงาน" })).toBeVisible();
  expect(errors).toEqual([]);
});

test("desktop internal memo supports a new authored appendix page", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายใน",exact:true})}).click();
  await page.getByRole("button", { name: "ใช้ข้อมูลตัวอย่าง" }).click();
  await page.locator("summary").filter({hasText:"เอกสารแนบท้ายที่สร้างในระบบ"}).click();
  await page.getByRole("button", { name: "เพิ่มเอกสารแนบท้ายอีกฉบับ" }).click();
  const appendix = page.getByRole("region", { name: "เอกสารแนบท้ายฉบับที่ 1" });
  await appendix.getByLabel("หัวเรื่องเอกสารแนบท้ายฉบับที่ 1").fill("รายการแนบท้าย");
  await appendix.getByLabel("เนื้อหาเอกสารแนบท้ายฉบับที่ 1").fill("เนื้อหาสำคัญ");
  await appendix.getByLabel("เนื้อหาเอกสารแนบท้ายฉบับที่ 1").evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, element.value.length));
  await appendix.getByRole("button", { name: "ตัวหนา" }).click();
  await appendix.getByRole("button", { name: "แทรกตาราง" }).click();
  const preview = page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
  await expect(preview.locator(".page .appendix-page-start")).toHaveText("รายการแนบท้าย");
  await expect(preview.locator(".page .appendix-text strong")).toHaveText("เนื้อหาสำคัญ");
  await expect(preview.locator(".page .document-table")).toContainText("หัวข้อ");
  await expect(preview.locator(".page")).toHaveCount(2);
});

test("desktop structured memo sections support bold and tables", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายใน",exact:true})}).click();
  await page.getByRole("button", { name: "ใช้ข้อมูลตัวอย่าง" }).click();
  await page.getByLabel("แยกเนื้อหาตามหน้าที่ของย่อหน้า").check();
  const text = page.getByLabel("เรื่องเดิม", { exact: true });
  await text.fill("ข้อมูลสำคัญ");
  await text.evaluate((element: HTMLTextAreaElement) => element.setSelectionRange(0, element.value.length));
  const section = page.locator(".body-section-input").filter({ has: text });
  await section.getByRole("button", { name: "ตัวหนา" }).click();
  await section.getByRole("button", { name: "แทรกตาราง" }).click();
  const preview = page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
  await expect(preview.locator(".body-text strong")).toHaveText("ข้อมูลสำคัญ");
  await expect(preview.locator(".document-table")).toContainText("หัวข้อ");
});


test("desktop prepares two separately titled appendix documents in one memo", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายใน",exact:true})}).click();
  await page.getByRole("button", { name: "ใช้ข้อมูลตัวอย่าง" }).click();
  await page.locator("summary").filter({hasText:"เอกสารแนบท้ายที่สร้างในระบบ"}).click();
  const add = page.getByRole("button", { name: "เพิ่มเอกสารแนบท้ายอีกฉบับ" });
  await add.click();
  await page.getByRole("region", { name: "เอกสารแนบท้ายฉบับที่ 1" }).getByLabel("หัวเรื่องเอกสารแนบท้ายฉบับที่ 1").fill("เอกสาร ก");
  await add.click();
  await page.getByRole("region", { name: "เอกสารแนบท้ายฉบับที่ 2" }).getByLabel("หัวเรื่องเอกสารแนบท้ายฉบับที่ 2").fill("เอกสาร ข");
  const preview = page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
  await expect(preview.locator(".appendix-page-start")).toHaveText(["เอกสาร ก", "เอกสาร ข"]);
  await expect(preview.locator(".page")).toHaveCount(3);
  await expect(page.getByText("เอกสารแนบท้ายที่สร้างเอง 2 ฉบับ")).toBeVisible();
  await expect(page.getByLabel(/เพิ่ม PDF หรือรูปภาพ/)).toHaveJSProperty("multiple", true);
});

test("desktop external letter previews authored enclosures and separately sent items", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายนอก",exact:true})}).click();
  await page.locator("summary").filter({hasText:"เอกสารแนบท้ายที่สร้างในระบบ"}).click();
  await page.getByRole("button", { name: "เพิ่มเอกสารแนบท้ายอีกฉบับ" }).click();
  await page.getByLabel("หัวเรื่องเอกสารแนบท้ายฉบับที่ 1").fill("เอกสารประกอบการตรวจสอบ");
  await page.getByLabel("เนื้อหาเอกสารแนบท้ายฉบับที่ 1").fill("รายละเอียดทดสอบ");
  await page.getByLabel("สิ่งที่ส่งมาด้วยเพิ่มเติม (ถ้ามี)").fill("ตัวอย่างวัสดุ จำนวน 1 ชุด (ส่งทางพัสดุไปรษณีย์)");
  const preview = page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
  await expect(preview.locator(".enclosure-row")).toHaveCount(2);
  await expect(preview.locator(".enclosure-row").first()).toContainText("เอกสารประกอบการตรวจสอบ");
  await expect(preview.locator(".enclosure-row").last()).toContainText("ส่งทางพัสดุไปรษณีย์");
  await page.locator("summary").filter({hasText:"ไฟล์ที่ส่งไปพร้อมหนังสือ"}).click();
  await expect(page.getByLabel("เพิ่ม PDF หรือรูปภาพ")).toBeVisible();
  await page.locator("summary").filter({hasText:"เอกสารแนบท้าย · ภาพประกอบ"}).click();
  await expect(page.getByLabel("เพิ่มภาพ PNG หรือ JPEG")).toBeVisible();
});

test("desktop editor previews a movable transparent text box", async ({page})=>{
 await page.goto("/");
 await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายนอก",exact:true})}).click();
 await page.locator(".floating-editor summary").click();
 await page.getByRole("button",{name:"เพิ่มกล่องข้อความ"}).click();
 await page.locator(".floating-card textarea").fill("รหัสอ้างอิงเพิ่มเติม");
 await page.getByLabel("ขนาดตัวอักษร (pt)").fill("22");
 const overlay=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]').locator('.page:first-child .floating-item');
 await expect(overlay).toHaveText("รหัสอ้างอิงเพิ่มเติม");
 await expect(overlay).toHaveCSS("border-top-width","0px");
 await expect(overlay).toHaveCSS("background-color","rgba(0, 0, 0, 0)");
});

test("structured memo fields and preview follow the supplied example order",async({page})=>{
 await page.goto("/");
 await page.waitForLoadState("networkidle");
 await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายใน",exact:true})}).click();
 await page.getByLabel("แยกเนื้อหาตามหน้าที่ของย่อหน้า").check();
 const labels=["เรื่องเดิม","ข้อเท็จจริง","ข้อระเบียบ/กฎหมาย","ข้อพิจารณา","จึงเรียนมาเพื่อ…"];
 expect(await page.locator('.body-section-input label').allTextContents()).toEqual(labels);
 for(const [index,label] of labels.entries())await page.getByLabel(label,{exact:true}).fill(index===4?"จึงเรียนมาเพื่อโปรดพิจารณา":"เนื้อหาส่วนที่ "+(index+1));
 const preview=page.frameLocator('iframe[title="ตัวอย่างหนังสือ A4"]');
 await expect(preview.locator('.page .structured-section-title')).toHaveText(labels.slice(0,4));
 await expect(preview.locator('.page .structured-section-title').first()).toHaveCSS('text-decoration-line','underline');
 const headingIndent=await preview.locator('.page .structured-section-title').first().evaluate(element=>parseFloat(getComputedStyle(element).marginLeft));
 const bodyIndent=await preview.locator('.page .body-text').first().evaluate(element=>parseFloat(getComputedStyle(element).textIndent));
 expect(Math.abs(headingIndent-bodyIndent)).toBeLessThan(0.5);
 await expect(preview.locator('.content .title').filter({hasText:"ข้อพิจารณา"})).toBeVisible();
 const text=await preview.locator('.content').first().innerText();
 const positions=["เนื้อหาส่วนที่ 1","เนื้อหาส่วนที่ 2","เนื้อหาส่วนที่ 3","เนื้อหาส่วนที่ 4","จึงเรียนมาเพื่อโปรดพิจารณา"].map(value=>text.indexOf(value));
 expect(positions.every(position=>position>=0)).toBe(true);
 expect(positions).toEqual([...positions].sort((a,b)=>a-b));
 expect(text.match(/จึงเรียนมาเพื่อโปรดพิจารณา/g)).toHaveLength(1);
});

test("memo opinion presets match positions and preserve an acting title",async({page})=>{
 await page.goto("/");await page.waitForLoadState("networkidle");
 await page.getByRole("button",{name:"สร้างหนังสือใหม่",exact:true}).click();await page.locator(".template-card").filter({has:page.getByRole("heading",{name:"หนังสือภายใน",exact:true})}).click();
 await page.locator(".review-chain > summary").click();
 await page.getByLabel("เลือกหัวข้อความเห็นและตำแหน่งเริ่มต้น").selectOption("ความเห็นหัวหน้าฝ่ายอำนวยการ");
 await page.getByRole("button",{name:/เพิ่มส่วนความเห็น/}).click();
 const title=page.getByLabel("หัวข้อความเห็น",{exact:true}),position=page.getByLabel("ตำแหน่งผู้ให้ความเห็น",{exact:true});
 await expect(title).toHaveValue("ความเห็นหัวหน้าฝ่ายอำนวยการ");
 await expect(position).toHaveValue("หัวหน้าฝ่ายอำนวยการ");
 await title.fill("ความเห็นผู้อำนวยการกองคลัง");
 await expect(position).toHaveValue("ผู้อำนวยการกองคลัง");
 await position.fill("รักษาราชการแทนผู้อำนวยการกองคลัง");
 await title.fill("ความเห็นรองนายกเทศมนตรี");
 await expect(position).toHaveValue("รักษาราชการแทนผู้อำนวยการกองคลัง");
 expect(await page.locator('#opinion-titles option').count()).toBeGreaterThan(20);
});
test("budget opinion titles use the same presets and keep a manually edited position",async({page})=>{
 await page.goto("/?view=budget");await page.waitForLoadState("networkidle");
 await page.getByRole("button",{name:"เปิดคำขอตัวอย่าง"}).click();
 const section=page.locator('section').filter({has:page.getByRole('heading',{name:'6. ความเห็นผู้เกี่ยวข้อง'})}).first();
 const first=section.locator('details').first();await first.locator('summary').click();
 const title=first.getByLabel('หัวข้อความเห็น'),position=first.getByLabel('ตำแหน่งผู้ให้ความเห็น');
 await title.fill('ความเห็นหัวหน้าฝ่ายอำนวยการ');
 await expect(position).toHaveValue('หัวหน้าฝ่ายอำนวยการ');
 await position.fill('รักษาราชการแทนหัวหน้าฝ่ายอำนวยการ');
 await title.fill('ความเห็นปลัดเทศบาล');
 await expect(position).toHaveValue('รักษาราชการแทนหัวหน้าฝ่ายอำนวยการ');
 expect(await page.locator('#budget-opinion-titles option').count()).toBeGreaterThan(20);
});
