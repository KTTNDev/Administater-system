import { test, expect } from "@playwright/test";
import fs from "node:fs";
import { documentHtml } from "../../src/lib/render-document";
import { newDraft } from "../../src/lib/document";

test("agenda shortcuts and progress stay with the correct speakers after adding and deleting", async ({
  page,
}) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/");
  await page
    .getByRole("button", { name: "แบบหนังสือราชการ", exact: true })
    .click();
  await page
    .locator(".template-card")
    .filter({
      has: page.getByRole("heading", { name: "รายงานการประชุม", exact: true }),
    })
    .click();
  await page
    .getByLabel("รูปแบบเนื้อหารายงาน")
    .selectOption("agenda");
  const cards = page.locator(".agenda-workspace");
  if (!(await cards.count()))
    await page
      .getByRole("button", { name: "เพิ่มวาระการประชุม", exact: true })
      .click();
  const initial = await cards.count();
  const nav = page.getByRole("navigation", { name: "เลือกวาระการประชุม" });
  await expect(nav.getByRole("button")).toHaveCount(initial);
  await page
    .getByRole("button", { name: "เพิ่มวาระการประชุม", exact: true })
    .click();
  await expect(nav.getByRole("button")).toHaveCount(initial + 1);
  const added = cards.last();
  await added
    .getByLabel("หัวข้อวาระ", { exact: true })
    .fill("วาระทดสอบแยกผู้พูด");
  await added
    .getByRole("button", { name: "เพิ่มผู้พูด / ข้อซักถาม", exact: true })
    .click();
  await expect(added.locator(".agenda-progress")).toContainText("ชื่อผู้พูด 1");
  await added.getByLabel("ชื่อผู้พูด", { exact: true }).fill("เลขานุการทดสอบ");
  await added
    .getByLabel("คำอภิปราย / ข้อซักถาม", { exact: true })
    .fill("ความคิดเห็นเฉพาะวาระนี้");
  await expect(added.locator(".agenda-progress")).toContainText(
    "กรอกช่องหลักครบ",
  );
  await expect(nav.getByRole("button").last()).toContainText("ผู้พูด 1 รายการ");
  await page.getByLabel("ไปยังวาระ", { exact: true }).selectOption("0");
  await expect(nav.getByRole("button").first()).toHaveAttribute(
    "aria-current",
    "location",
  );
  await expect(
    cards.first().getByLabel("ชื่อผู้พูด", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByLabel("ไปยังวาระ", { exact: true })
    .selectOption(String(initial));
  await expect(added.getByLabel("ชื่อผู้พูด", { exact: true })).toHaveValue(
    "เลขานุการทดสอบ",
  );
  await expect.poll(async () => {
    const heading = await added.locator(".agenda-sticky-heading").boundingBox();
    const context = await page.locator(".agenda-context-bar").boundingBox();
    const shortcuts = await page.locator(".editor-section-links").boundingBox();
    return !!heading && !!context && !!shortcuts
      && context.y >= shortcuts.y + shortcuts.height - 1
      && heading.y >= context.y + context.height - 1;
  }).toBe(true);
  await page.getByRole("button", { name: "มืดนุ่ม", exact: true }).click();
  await expect(page.locator(".preview-footer")).toContainText("ตรวจรูปแบบก่อนพิมพ์", { timeout: 30000 });
  fs.mkdirSync("output/appearance-check", { recursive: true });
  await page.screenshot({ path: "output/appearance-check/minutes-workspace-dim.png", animations: "disabled" });
  await added
    .getByRole("button", { name: `ลบวาระ ${initial + 1}`, exact: true })
    .click();
  await expect(nav.getByRole("button")).toHaveCount(initial);
  await expect(
    page.getByLabel("ไปยังวาระ", { exact: true }).locator("option"),
  ).toHaveCount(initial);
});

test("speaker columns wrap long Thai paragraphs across pages without lost text", async ({
  page,
}) => {
  const draft = newDraft("minutes");
  draft.minutesMode = "agenda";
  draft.meetingAgenda = [
    {
      title: "เรื่องเพื่อพิจารณา",
      discussion: "",
      resolution: "รับทราบ",
      resolutionLabel: "มติที่ประชุม",
      speeches: [
        {
          speaker: "นายสมชาย ตัวอย่าง",
          role: "กรรมการ ฯ",
          text:
            "โครงการดังกล่าว ทางกระผมได้ดำเนินการจัดทำร่างขอบเขตของงาน และการกำหนดราคากลางมาเสนอให้ที่ประชุมพิจารณา ".repeat(
              90,
            ) + "จบบทพูดทดสอบ",
        },
        {
          speaker: "เลขานุการ",
          role: "ผู้จดรายงาน",
          text: "บทพูดถัดไปต้องไม่รวมกับผู้พูดก่อนหน้า",
        },
      ],
    },
  ];
  const font = (name: string) =>
    "data:font/ttf;base64," +
    fs.readFileSync("public/fonts/" + name).toString("base64");
  await page.setContent(
    documentHtml(draft, {
      regular: font("THSarabunNew.ttf"),
      bold: font("THSarabunNew-Bold.ttf"),
      garuda: "",
      routingStamp: "",
      copyMark: "",
    }),
  );
  await page.waitForFunction(
    () => (window as unknown as { __paginationDone: boolean }).__paginationDone,
  );
  expect(
    await page.evaluate(
      () => (window as unknown as { __overflow: boolean }).__overflow,
    ),
  ).toBe(false);
  const text = await page.locator("#pages").innerText();
  expect(text).toContain("จบบทพูดทดสอบ");
  expect(text).toContain("บทพูดถัดไปต้องไม่รวมกับผู้พูดก่อนหน้า");
  const actualSpeech = await page.locator(".minutes-speech").evaluateAll((paragraphs) => paragraphs.map((p) => {
    const copy = p.cloneNode(true) as HTMLElement;
    copy.querySelectorAll(".minutes-speaker-person").forEach((label) => label.remove());
    return copy.textContent || "";
  }).join(""));
  const normalize = (value: string) => value.replace(/[\s\u200b\u2060]/g, "");
  expect(normalize(actualSpeech)).toBe(normalize(draft.meetingAgenda[0].speeches!.map((s) => s.text).join("")));
  await expect(page.locator(".minutes-speaker-person")).toHaveCount(2);
  expect(await page.locator(".page").count()).toBeGreaterThan(1);
  const geometry = await page
    .locator(".minutes-speech")
    .first()
    .evaluate((p) => {
      const person = p.querySelector(".minutes-speaker-person")!;
      const textNode = Array.from(p.childNodes).find(
        (n) => n.nodeType === Node.TEXT_NODE && n.textContent?.trim(),
      )!;
      const range = document.createRange();
      range.setStart(textNode, 0);
      range.setEnd(textNode, 1);
      return {
        label: person.getBoundingClientRect().right,
        text: range.getBoundingClientRect().left,
        padding: getComputedStyle(p).paddingLeft,
      };
    });
  expect(geometry.text).toBeGreaterThan(geometry.label);
  expect(parseFloat(geometry.padding)).toBeCloseTo((40 * 96) / 25.4, 0);
  fs.mkdirSync("output/appearance-check", { recursive: true });
  await page
    .locator(".page")
    .first()
    .screenshot({ path: "output/appearance-check/speaker-layout.png" });
});
