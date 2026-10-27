/**
 * แผนที่อ่านโค้ด — src/lib/render-document.ts
 * หน้าที่: แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../app/page.tsx
 * 2. ../components/workspace.tsx
 * 3. ./document.ts
 * 4. ../app/actions.ts
 * 5. ./db.ts
 * 6. ./render-document.ts ← คุณอยู่ที่นี่
 * 7. ../app/api/documents/[id]/pdf/route.ts
 * 8. ./pdf.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../components/budget-transfers.tsx, ../components/workspace.tsx, ./assets.ts, ./pdf.ts, ../../tests/additional-templates.test.ts, ../../tests/attachments.test.ts, ../../tests/document-tools.test.ts, ../../tests/document.test.ts (และจุดอื่นที่ค้นชื่อ export ได้ใน IDE)
 * อ่านต่อจาก import: ./document.ts, ./templates.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
/* นำเข้า ./document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import {
  type Draft,
  thaiDate,
  documentYear,
  numerals,
  bodySections,
} from "./document";
/* นำเข้า ./templates.ts — ทะเบียนประเภทหนังสือ หมวด ชื่อ คำแนะนำ และข้อมูลหน่วยงานตัวอย่าง */
import { template } from "./templates";
/* ชนิด DocumentAssets: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
export type DocumentAssets = {
  regular: string;
  bold: string;
  garuda: string;
  routingStamp: string;
  copyMark: string;
};
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const isTableRule = (line: string) =>
  /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
const cells = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((x) => x.trim());
/* สะสม blocks ตามประเภทหนังสือ แล้วห่อเป็น HTML; CSS และ script ใน template literal เป็นส่วนหนึ่งของผลลัพธ์ ห้ามแทรก // ลงในเนื้อสตริง */
/* แผนที่ภายใน renderer: 1) escape/inline ปลอดภัยก่อนใช้ข้อความ 2) formattedLines แปลงตัวหนา/ตาราง 3) switch(d.type) เลือกหัวและท้าย 4) template HTML ฝัง CSS 5) script paginate แบ่งหน้า 6) postMessage แจ้ง Workspace; script นี้รันภายใน iframe/Chromium ไม่ใช่ server */
export function documentHtml(
  d: Draft,
  assets: DocumentAssets,
  appendixImages: Record<string, string> = {},
): string {
  const e = (s: string) => escapeHtml(numerals(s, d.numeralStyle)),
    t = template(d.type),
    date = thaiDate(d.date),
    blocks: string[] = [];
  const inline = (s: string) =>
    e(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  const p = (content: string, cls = "") =>
    blocks.push(`<p class="${cls}">${content || "&nbsp;"}</p>`);
  const field = (label: string, value: string, cls = "") =>
    p(
      `<span class="label">${e(label)}</span> ${cls === "memo-field" ? `<span class="memo-value">${e(value) || "&nbsp;"}</span>` : e(value)}`,
      cls,
    );
  const formattedLines = (text: string, cls = "body-text") => {
    const lines = text.split(/\n/);
    for (let i = 0; i < lines.length; i++) {
      if (
        i + 1 < lines.length &&
        lines[i].includes("|") &&
        isTableRule(lines[i + 1])
      ) {
        const head = cells(lines[i]);
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && lines[i].includes("|"))
          rows.push(cells(lines[i++]));
        i--;
        blocks.push(
          `<table class="document-table"><thead><tr>${head.map((cell) => `<th>${inline(cell)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${head.map((_, n) => `<td>${inline(row[n] || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`,
        );
      } else p(inline(lines[i]), cls);
    }
  };
  /* เนื้อหาใช้ contentBlocks ของงานเฉพาะ หรือ bodySections จาก document.ts; สำหรับประชุม TOR จะเลือกโหมดวาระก่อนบล็อกเดิม เพื่อไม่พิมพ์ข้อมูลค้าง */
  const body = () =>
    d.contentBlocks.length &&
    !(d.type === "minutes" && d.minutesMode === "agenda")
      ? d.contentBlocks.forEach((b) => {
          if (b.kind === "line")
            p(
              `<span class="budget-label">${inline(b.label)}</span><span>${inline(b.text)}</span>`,
              "budget-line",
            );
          else if (b.kind === "budget-money")
            p(
              `<span>${inline(b.label)}</span><span>เป็นเงิน</span><span>${inline(b.text)}</span><span>บาท</span>`,
              "budget-money",
            );
          else
            p(
              inline(b.text),
              b.kind === "heading"
                ? "title budget-heading"
                : b.kind === "budget-detail"
                  ? "budget-detail"
                  : b.kind === "budget-spec"
                    ? "budget-spec"
                    : "body-text",
            );
        })
      : bodySections(d)
          .filter(
            (s) =>
              s.text.trim() ||
              (d.type === "minutes" && d.minutesMode === "agenda" && s.title),
          )
          .forEach((s) => {
            // รายงานประชุม: ชื่อ/บทบาทคอลัมน์ซ้าย บทพูดคอลัมน์ขวา ตามตัวอย่างผู้ใช้
            // ใช้ P เพื่อให้ตัวแบ่งหน้าเดิมแบ่งบทพูดยาวได้ ไม่ใช้ table แถวเดียวที่ล้น A4
            if (s.speaker) {
              const paragraphs = s.text.split(/\n+/);
              paragraphs.forEach((text, index) =>
                p(
                  `${index === 0 ? `<span class="minutes-speaker-person">${e(s.speaker!.name)}${s.speaker!.role ? `<br>${e(s.speaker!.role)}` : ""}</span>` : ""}${inline(text)}`,
                  "body-text minutes-speech",
                ),
              );
              return;
            }
            if (
              s.title &&
              (d.sectionHeadings ||
                (d.type === "minutes" && d.minutesMode === "agenda"))
            )
              p(
                inline(s.title),
                d.bodyMode === "structured" &&
                  !(d.type === "minutes" && d.minutesMode === "agenda")
                  ? "title structured-section-title"
                  : d.type === "minutes"
                    ? "title minutes-section-title"
                    : "title",
              );
            // หัวข้อวาระที่ไม่มีข้อความรวม ไม่เพิ่มย่อหน้าว่างก่อนเริ่มผู้พูด
            if (s.text.trim()) formattedLines(s.text);
          });
  const signatureMarkup = () =>
    `<div class="signature"><div class="sign-space"></div><p>(${e(d.signer)})</p><p>${e(d.position)}</p></div>`;
  const signature = () => blocks.push(signatureMarkup());
  const contact = () => {
    if (d.department) p(e(d.department), "contact");
    if (d.phone) field("โทร.", d.phone);
    if (d.email)
      p(
        `<span class="label">ไปรษณีย์อิเล็กทรอนิกส์</span> ${escapeHtml(d.email)}`,
      );
  };
  // The bundled 2320×1811 scan includes white margins and speckles. The CSS
  // viewport (498,324,1194,1340) measures the emblem, not the scan's outer box.
  const emblem = `<span class="garuda" role="img" aria-label="ตราครุฑ"><img class="garuda-source" src="${assets.garuda}" alt="" /></span>`;
  const attachmentLabel = (file: Draft["attachmentFiles"][number]) =>
    `${file.showNameInDocument === false ? "เอกสารแนบ" : file.description} จำนวน ${file.quantity} ${file.unit}`;
  /* ถ้าแก้เฉพาะแบบหนังสือให้หา case ที่ตรงประเภท อย่าแก้ CSS กลางเพื่อชดเชย case เดียว เพราะอาจกระทบหนังสือทุกชนิด */
  switch (d.type) {
    case "external":
      blocks.push(
        `<div class="letter-head">${emblem}<div class="letter-number">ที่ ${e(d.number)}</div><div class="letter-agency">${e(d.organization)}<br>${e(d.address)}</div></div>`,
      );
      p(e(date), "date");
      field("เรื่อง", d.subject);
      field(d.salutation, d.recipient);
      if (d.reference) field("อ้างถึง", d.reference);
      if (d.attachmentFiles.length)
        field(
          "สิ่งที่ส่งมาด้วย",
          d.attachmentFiles
            .map((a, i) => `${i + 1}. ${attachmentLabel(a)}`)
            .join("\n"),
        );
      body();
      blocks.push(
        `<div class="signoff-group"><p class="closing">${e(d.closing) || "&nbsp;"}</p>${signatureMarkup()}</div>`,
      );
      contact();
      if (d.copies) field("สำเนาส่ง", d.copies);
      break;
    case "internal":
    case "memorandum":
      blocks.push(
        `<div class="memo-head">${d.type === "internal" || d.memoEmblem ? emblem : ""}<strong>บันทึกข้อความ</strong></div>`,
      );
      field(
        "ส่วนราชการ",
        [
          ...(d.layout === "budget-reference"
            ? [d.department, d.organization]
            : [d.organization, d.department]),
          d.phone ? "โทร. " + d.phone : "",
        ]
          .filter(Boolean)
          .join("  "),
        "memo-field",
      );
      blocks.push(
        `<div class="memo-row"><p class="memo-field"><b>ที่</b><span class="memo-value">${e(d.number) || "&nbsp;"}</span></p><p class="memo-field"><b>วันที่</b><span class="memo-value">${e(date) || "&nbsp;"}</span></p></div>`,
      );
      field("เรื่อง", d.subject, "memo-field");
      field(d.salutation, d.recipient, "salutation");
      body();
      if (d.attachmentFiles.length)
        p(
          e(
            d.attachmentPhrase +
              " ได้แก่ " +
              d.attachmentFiles
                .map((a, i) => `${i + 1}. ${attachmentLabel(a)}`)
                .join("; "),
          ),
          "body-text",
        );
      signature();
      break;
    case "stamped":
      blocks.push(
        `<div class="letter-head">${emblem}<div class="letter-number">ที่ ${e(d.number)}</div></div>`,
      );
      field("ถึง", d.recipient);
      body();
      p(e(d.organization), "closing");
      p(e(date), "closing");
      p(
        "[พื้นที่ประทับตราส่วนราชการ และลงชื่อย่อกำกับตรา]",
        "stamp-placeholder",
      );
      contact();
      break;
    case "order":
    case "regulation":
    case "rule":
    case "announcement":
    case "statement":
    case "news":
      if (t.mark) blocks.push(`<div class="center-emblem">${emblem}</div>`);
      p(`${e(t.name)}${e(d.organization)}`, "center title");
      if (d.type === "order") p(`ที่ ${e(d.number)}`, "center");
      p(
        `${d.type === "regulation" || d.type === "rule" ? "ว่าด้วย" : "เรื่อง"} ${e(d.subject)}`,
        "center title",
      );
      if ((d.type === "regulation" || d.type === "rule") && d.number)
        p(`(ฉบับที่ ${e(d.number)})`, "center");
      if ((d.type === "regulation" || d.type === "rule") && d.date)
        p(`พ.ศ. ${e(String(documentYear(d.date, "calendar")))}`, "center");
      if (d.type === "statement" && d.number)
        p(`ฉบับที่ ${e(d.number)}`, "center");
      p("____________________", "center divider");
      body();
      if (d.effectiveDate) p(e(d.effectiveDate), "body-text");
      if (d.type === "news" || d.type === "statement") {
        p(e(d.organization), "closing");
        p(e(date), "closing");
      } else {
        p(
          `${d.type === "order" ? "สั่ง" : "ประกาศ"} ณ วันที่ ${e(date)}`,
          "issued",
        );
        if (d.type === "order" && d.orderReceivedBy)
          p(`รับคำสั่ง${e(d.orderReceivedBy)}`, "received-order");
        signature();
      }
      break;
    case "certificate":
      blocks.push(
        `<div class="letter-head">${emblem}<div class="letter-number">ที่ ${e(d.number)}</div><div class="letter-agency">${e(d.organization)}<br>${e(d.address)}</div></div>`,
      );
      body();
      p(`ให้ไว้ ณ วันที่ ${e(date)}`, "issued");
      signature();
      if (d.certificatePhotoArea)
        blocks.push(
          `<div class="certificate-photo-area"><div class="certificate-photo">รูปถ่าย<br>(ถ้ามี)<br>${e("ขนาด 4 × 6 ซม.")}</div><p>ลงชื่อ ................................................</p><p>(${e(d.certificateRecipient)})</p><p>ผู้ได้รับการรับรอง</p><p class="certificate-seal">(ประทับตราชื่อส่วนราชการ)</p></div>`,
        );
      break;
    case "minutes": {
      if (d.minutesTitle.trim()) {
        p(e(d.minutesTitle), "center title");
        p(e(d.subject), "center title");
      } else p(`รายงานการประชุม${e(d.subject)}`, "center title");
      p(`ครั้งที่ ${e(d.meetingNo)}`, "center");
      p(`เมื่อ ${e(date)}`, "center");
      p(`ณ ${e(d.location)}`, "center");
      p("____________________", "center divider");
      if (d.minutesAttendanceMode === "table") {
        const attendanceTable = (
          status: "present" | "participant",
          label: string,
        ) => {
          const members = d.meetingMembers.filter((m) => m.status === status);
          if (!members.length) return;
          p(e(label), "title minutes-roster-heading");
          blocks.push(
            `<table class="document-table minutes-attendance"><thead><tr><th style="width:10%">ลำดับ</th><th style="width:25%">ชื่อ - สกุล</th><th style="width:30%">ตำแหน่ง / หน้าที่</th><th style="width:20%">ลายมือชื่อ</th><th style="width:15%">หมายเหตุ</th></tr></thead><tbody>${members.map((m, i) => `<tr><td>${e(String(i + 1))}</td><td>${e(m.name)}</td><td>${e(m.position)}${m.role ? "<br>" + e(m.role) : ""}</td><td>&nbsp;</td><td>${e(m.note)}</td></tr>`).join("")}</tbody></table>`,
          );
        };
        attendanceTable("present", "ผู้มาประชุม");
        if (d.attendees.trim()) field("ผู้มาประชุมเพิ่มเติม", d.attendees);
        const absent = d.meetingMembers
          .filter((m) => m.status === "absent")
          .map((m) =>
            [m.name, m.position, m.role, m.note ? "เหตุผล: " + m.note : ""]
              .filter(Boolean)
              .join("  "),
          );
        field(
          "ผู้ไม่มาประชุม",
          [...absent, d.absentees].filter(Boolean).join("\n") || "ไม่มี",
        );
        attendanceTable("participant", "ผู้เข้าร่วมประชุม");
        if (
          d.participants.trim() ||
          !d.meetingMembers.some((m) => m.status === "participant")
        )
          field("ผู้เข้าร่วมประชุม", d.participants || "ไม่มี");
      } else {
        field("ผู้มาประชุม", d.attendees);
        field("ผู้ไม่มาประชุม", d.absentees || "ไม่มี");
        field("ผู้เข้าร่วมประชุม", d.participants || "ไม่มี");
      }
      field("เริ่มประชุมเวลา", d.startTime);
      body();
      const enclosures = d.attachmentFiles.map(attachmentLabel);
      if (enclosures.length) {
        p("เอกสารประกอบการประชุม", "title");
        enclosures.forEach((item, index) => p(e(`${index + 1}. ${item}`)));
      }
      field("เลิกประชุมเวลา", d.endTime);
      if (
        d.minutesAttendanceMode === "table" ||
        d.recorderPosition ||
        d.meetingSigners.length
      ) {
        const people = [
          {
            name: d.recorder,
            position: d.recorderPosition,
            role: d.recorderRole,
          },
          ...d.meetingSigners,
        ];
        for (const person of people)
          blocks.push(
            `<div class="signature minutes-signature"><div class="sign-space"></div><p>ลงชื่อ ................................................</p><p>(${e(person.name)})</p>${person.position ? `<p>${e(person.position)}</p>` : ""}<p>${e(person.role)}</p></div>`,
          );
      } else p(`${e(d.recorder)}\n${e(d.recorderRole)}`, "closing");
      break;
    }
    case "other":
      p(e(d.subject), "center title");
      p(e(d.organization), "center");
      p(e(date), "center");
      body();
      break;
  }
  if (["internal", "memorandum"].includes(d.type)) {
    for (const person of d.proposers)
      blocks.push(
        `<div class="signature"><div class="sign-space"></div><p>(${e(person.name)})</p><p>${e(person.position)}</p></div>`,
      );
    for (const opinion of d.opinions)
      blocks.push(
        `<div class="opinion"><p class="title">${e(opinion.title)}</p>${opinion.comment ? `<p>${e(opinion.comment)}</p>` : Array.from({ length: opinion.lines }, () => '<div class="opinion-line"></div>').join("")}<div class="opinion-sign"><p>ลงชื่อ ................................................</p><p>(${e(opinion.name) || "................................................"})</p><p>${e(opinion.position)}</p>${opinion.showDate !== false ? "<p>วันที่ ................................................</p>" : ""}</div></div>`,
      );
  }
  if (d.productionMark && d.type !== "external")
    blocks.push(
      `<div class="production"><p>........................ ${e(d.drafter)} / ร่าง</p><p>........................ ${e(d.typist)} / พิมพ์</p><p>........................ ${e(d.checker)} / ตรวจ</p></div>`,
    );
  for (let start = 0; start < d.appendixImages.length; start += 2) {
    const pair = d.appendixImages
      .slice(start, start + 2)
      .map((item, index) => ({
        item,
        index: start + index,
        orientation: item.width / item.height >= 1 ? "landscape" : "portrait",
      }));
    const layout =
      d.appendixLayout === "stack"
        ? "landscape-pair"
        : d.appendixLayout === "columns"
          ? "portrait-pair"
          : pair.length === 1
            ? "single-image"
            : pair.every((image) => image.orientation === "landscape")
              ? "landscape-pair"
              : pair.every((image) => image.orientation === "portrait")
                ? "portrait-pair"
                : "mixed-pair";
    if (layout === "mixed-pair")
      pair.sort((a, b) =>
        a.orientation === b.orientation
          ? 0
          : a.orientation === "landscape"
            ? -1
            : 1,
      );
    blocks.push(
      `<section class="appendix-sheet ${layout}"><h1 class="appendix-heading">${e(d.appendixTitle) || "เอกสารแนบท้าย"}</h1><div class="appendix-figures">${pair.map(({ item, index, orientation }) => `<figure class="appendix-figure ${orientation}">${appendixImages[item.id] ? `<img class="appendix-image" src="${escapeHtml(appendixImages[item.id])}" alt="ภาพแนบท้ายที่ ${index + 1}" style="width:${item.widthMm}mm">` : `<div class="appendix-image-missing">กำลังโหลดภาพแนบท้าย</div>`}<figcaption>ภาพที่ ${e(String(index + 1))}${item.caption ? ` ${e(item.caption)}` : ""}</figcaption></figure>`).join("")}</div></section>`,
    );
  }
  const compact = d.type === "internal" || d.type === "memorandum";
  /* สตริงนี้เป็นผลลัพธ์เอกสารจริง: .page คือ A4, .content คือพื้นที่เขียน, paginate ย้าย/แบ่งบล็อกที่ล้นหน้า, TABLE แบ่งเป็นแถวพร้อมหัวตารางซ้ำ, Range.cloneContents เก็บตัวหนาขณะแบ่งย่อหน้า; ห้ามใส่คอมเมนต์ // เปล่า ๆ กลาง HTML เพราะจะกลายเป็นข้อความในเอกสาร */
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${e(d.subject)}</title>
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'">
  <style>
  @font-face{font-family:DocumentThai;src:url('${assets.regular}') format('truetype');font-weight:400;font-display:block}
  @font-face{font-family:DocumentThai;src:url('${assets.bold}') format('truetype');font-weight:700;font-display:block}
  *{box-sizing:border-box}html,body{margin:0;padding:0}body{background:#e8edec;color:#111;font-family:DocumentThai,serif;font-size:16pt;line-height:normal}
  .page{position:relative;width:210mm;height:297mm;background:white;margin:0 auto 7mm;padding:25mm 20mm 20mm 30mm;break-after:page;overflow:hidden}
  .page:first-child{padding-top:${d.firstPageTop === "25" ? 25 : 15}mm}.page:last-child{margin-bottom:0;break-after:auto}
  .content{height:240mm;display:flow-root}.page:first-child .content{height:${d.firstPageTop === "25" ? 240 : 250}mm}
  p{margin:0 0 6pt;white-space:pre-wrap;overflow-wrap:anywhere;orphans:2;widows:2}.body-text{text-indent:25mm;text-align:justify;white-space:pre-wrap}
  .garuda{position:relative;display:inline-block;overflow:hidden;flex-shrink:0;height:30mm;width:calc(30mm * 1194 / 1340)}.garuda-source{position:absolute;max-width:none;width:calc(100% * 2320 / 1194);height:calc(100% * 1811 / 1340);left:calc(-100% * 498 / 1194);top:calc(-100% * 324 / 1340)}.letter-head{position:relative;min-height:38mm;padding-top:23mm;margin-bottom:6pt;display:flex;justify-content:space-between;gap:8mm}
  .letter-head .garuda{position:absolute;top:0;left:calc(50% - 5mm);transform:translateX(-50%)}.letter-number{max-width:50%}.letter-agency{width:65mm;padding-left:10mm;white-space:pre-wrap;overflow-wrap:anywhere}
  .date{margin-left:75mm}.memo-head{position:relative;height:${d.urgency !== "ปกติ" ? 27 : 18}mm;display:flex;align-items:flex-end;justify-content:center;margin-bottom:3pt}
  .memo-head strong{font-size:29pt;line-height:35pt}.memo-head .garuda{position:absolute;height:15mm;width:calc(15mm * 1194 / 1340);left:0;top:0}
  .memo-field{display:flex;align-items:baseline;gap:2mm}.memo-value{flex:1;min-width:0;position:relative;white-space:pre-wrap;overflow-wrap:anywhere}.memo-value:after{content:"";position:absolute;left:0;right:0;bottom:2pt;border-bottom:1px dotted #888;pointer-events:none}.memo-field .label,.memo-field b{font-size:20pt;font-weight:700;white-space:nowrap}.memo-row{display:flex;gap:5mm}.memo-row p:first-child{width:49%}.memo-row p:last-child{flex:1}
  .closing,.signature{white-space:pre-wrap}.closing{margin-top:12pt}.signature{break-inside:avoid;margin-left:70mm;text-align:center}.sign-space{height:3lh}.signature p{margin:0;white-space:pre-wrap}.contact{margin-top:3lh}
  .budget-line{display:flex;gap:4mm;text-indent:0}.budget-label{flex:0 0 53mm;font-weight:bold}.budget-line>span:last-child{flex:1;min-width:0}.center{text-align:center}.title{font-weight:700}.structured-section-title{margin-left:25mm;text-decoration:underline;text-underline-offset:2pt}.center-emblem{text-align:center;margin-left:-10mm;margin-bottom:8pt}.issued{text-indent:25mm;margin-top:12pt}.divider{margin-bottom:12pt}
  .urgency{font-weight:bold;font-size:32pt;color:#f00;position:absolute;left:${compact ? 52 : 30}mm;top:${d.copyMark !== "none" ? 29 : 16}mm;line-height:1}.copy-mark{position:absolute;left:50%;top:1mm;transform:translateX(-50%);width:38mm;height:auto;z-index:21;pointer-events:none}.copy-mark-text{left:0;right:0;width:auto;transform:none;text-align:center;white-space:nowrap;font-size:32pt;font-weight:bold;color:#174890}.routing-stamp{position:absolute;right:5mm;bottom:5mm;width:82mm;height:auto;z-index:21;pointer-events:none}.counterpart-start{display:none}.opinion{margin-top:8mm;break-inside:avoid}.opinion-line{height:8mm;border-bottom:1px dotted #555}.opinion-sign{margin-top:8mm;text-align:center;margin-left:70mm}.opinion-sign p{margin-bottom:0}.production{margin:12mm 0 0 auto;width:85mm;break-inside:avoid}.production p{margin-bottom:2mm}.stamp-placeholder{margin:8mm 0 0 70mm;text-align:center;color:#777;font-size:14pt}
  .continuation-cue{position:absolute;right:20mm;bottom:20mm;max-width:90mm;text-align:right;white-space:nowrap;font-size:16pt;line-height:normal}.page-number{position:absolute;top:14mm;left:0;right:0;text-align:center}.security{position:absolute;top:1mm;left:0;right:0;text-align:center;color:#f00;font-weight:700;font-size:32pt;line-height:1}.security.bottom{top:auto;bottom:2mm}
  .budget-document{line-height:normal}.budget-document p{margin-bottom:0}.budget-document .body-text{text-indent:25mm}
  .budget-document .memo-field{margin-bottom:6pt}.budget-document .memo-row .memo-field{margin-bottom:6pt}.budget-document .memo-head{margin-bottom:6pt}
  .budget-document .budget-heading{margin-top:6pt;text-indent:25.4mm}.budget-document .budget-line{margin-left:25.4mm;gap:0;line-height:18.1pt}.budget-document .budget-label{flex-basis:25.4mm;font-weight:400}
  .budget-money{display:grid;grid-template-columns:50.8mm 15mm minmax(0,1fr) 8mm;column-gap:2mm;margin-left:50.8mm;text-indent:0}.budget-money>span:nth-child(3){text-align:right}.document-table{width:100%;border-collapse:collapse;table-layout:fixed;margin:6pt 0;break-inside:avoid;font-size:15pt}.document-table th,.document-table td{border:1px solid #555;padding:4pt 6pt;vertical-align:top;white-space:pre-wrap;overflow-wrap:anywhere}.document-table th{font-weight:700;text-align:center;background:#f2f2f2}.budget-document .document-table{margin-left:25.4mm;width:calc(100% - 25.4mm)}
  .budget-detail{margin-left:50.8mm;text-indent:0}.budget-spec{margin-left:55mm;text-indent:0}
  .budget-document .opinion{margin-top:5mm}.budget-document .opinion-line{height:6mm}.budget-document .opinion-sign{margin-top:10mm}.budget-document .opinion-sign p:first-child,.budget-document .opinion-sign p:last-child{display:none}
  .correspondence .content>p{margin-bottom:0}.correspondence .content>p:not(:where(.memo-field)){margin-top:6pt}.correspondence .content>.date{margin-top:0}.correspondence .content>.contact{margin-top:3lh}.correspondence .contact~p{margin-top:0}.correspondence .memo-field{margin-bottom:0}.correspondence .memo-head strong{line-height:35pt}.correspondence .body-text{text-indent:25mm;line-height:1}.correspondence .sign-space{height:3lh}.signoff-group{display:flow-root;break-inside:avoid;page-break-inside:avoid}.signoff-group>.closing{margin-left:75mm;text-align:left;margin-top:12pt;width:max-content;max-width:calc(100% - 75mm)}.signoff-group .signature{margin-left:0;width:60mm;text-align:center}.correspondence .content>.signoff-group+.contact{margin-top:6pt}.correspondence .content>.contact~p{margin-top:6pt}.external-document .urgency{top:27mm!important}.external-document .security:not(.bottom){top:1mm;left:115mm;right:20mm;text-align:left}body.compact-signoff.correspondence .page:first-child .content>.body-text,body.compact-signoff.correspondence .counterpart-first-page .content>.body-text{margin-top:2pt;line-height:1}
  .received-order{margin:6pt 0 0 70mm;text-align:center;break-after:avoid}.issued{text-indent:50mm}
  .certificate-photo-area{position:relative;margin-top:18mm;width:100mm;break-inside:avoid}.certificate-photo{width:40mm;height:60mm;border:1px solid #555;display:flex;flex-direction:column;justify-content:center;text-align:center;margin:0 0 6pt 10mm}.certificate-photo-area p{width:60mm;text-align:center;margin-bottom:0}.certificate-photo-area .certificate-seal{position:absolute;left:53mm;top:59mm;width:47mm;font-size:14pt}
  .appendix-sheet{height:100%;min-height:100%;display:flex;flex-direction:column;gap:6mm;break-inside:avoid;overflow:hidden}.appendix-heading{flex:none;margin:0 0 1mm;text-align:center;font-size:20pt;font-weight:700;text-decoration:underline}.appendix-figures{flex:1;min-height:0;display:grid;grid-template-columns:1fr;align-content:center;gap:9mm}.appendix-figure{min-width:0;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5mm;margin:0;text-align:center}.appendix-image{display:block;max-width:100%;height:auto;object-fit:contain}.appendix-figure figcaption{font-size:16pt;line-height:1.1}.appendix-image-missing{width:100%;height:50mm;display:grid;place-items:center;background:#f1f4f2;color:#66766d}.appendix-sheet.landscape-pair .appendix-figure img{max-height:98mm}.appendix-sheet.portrait-pair .appendix-figures{grid-template-columns:repeat(2,minmax(0,1fr));gap:8mm}.appendix-sheet.portrait-pair .appendix-figure img{max-height:145mm}.appendix-sheet.mixed-pair .appendix-figures{grid-template-columns:repeat(2,minmax(0,1fr));gap:5mm 8mm}.appendix-sheet.mixed-pair .appendix-figure.landscape{grid-column:1/-1}.appendix-sheet.mixed-pair .appendix-figure.landscape img{max-height:78mm}.appendix-sheet.mixed-pair .appendix-figure.portrait{grid-column:1/-1;width:80mm;justify-self:center}.appendix-sheet.mixed-pair .appendix-figure.portrait img{max-height:112mm}.appendix-sheet.single-image .appendix-figure img{max-height:190mm}
  #source{display:none}@media print{@page{size:A4;margin:0}body{background:white}.page{margin:0;box-shadow:none}}
  .security-control{position:absolute;bottom:13mm;left:30mm;right:20mm;font-size:12pt;line-height:1;display:flex;justify-content:space-between;gap:5mm}.security-control span:first-child{max-width:100mm;overflow-wrap:anywhere}
    .minutes-attendance td{min-height:12mm;padding:7pt 4pt}.minutes-attendance td:first-child{text-align:center}.minutes-attendance th:first-child{white-space:nowrap}.minutes-roster-heading{text-decoration:underline}.minutes-signature{width:100mm;margin-left:auto;margin-top:6pt}.minutes-signature .sign-space{height:12mm}
    .minutes-speech{display:flow-root;padding-left:40mm;text-indent:0;text-align:justify;white-space:normal}.minutes-speaker-person{float:left;width:36mm;margin-left:-40mm;font-weight:700;text-align:left;overflow-wrap:anywhere}
</style></head><body class="${d.type === "external" ? "external-document correspondence " : ["internal", "memorandum"].includes(d.type) ? "correspondence " : ""}${d.layout === "budget-reference" ? "budget-document" : ""}"><div id="security-owner" hidden>${e(d.organization)}</div><div id="source">${blocks.join("")}</div><main id="pages"></main>
  <script>
  window.addEventListener('message',event=>{if(event.source===parent&&event.data==='sarabun-print')window.print()});
  (async()=>{ await Promise.all([document.fonts.load('16pt DocumentThai'),document.fonts.load('bold 16pt DocumentThai')]); await document.fonts.ready; await Promise.all(Array.from(document.images).map(i=>i.decode().catch(()=>{})));
  const root=document.getElementById('pages');let content;let count=0;let copyPages=0;let overflow=false;let isCopy=false;
  const next=(copy=isCopy)=>{count++;copyPages=copy?(isCopy?copyPages+1:1):1;isCopy=copy;const page=document.createElement('section');page.className='page'+(copy?' counterpart-page':'');if(copy){page.dataset.copyCounterpart='true';if(copyPages===1)page.classList.add('counterpart-first-page')}const localPage=copy?copyPages:count;if(localPage>1){const n=document.createElement('div');n.className='page-number';n.textContent='- '+localPage+' -';page.append(n)}
  ${d.confidentiality !== "ปกติ" ? `for(const cls of ['security','security bottom']){const s=document.createElement('div');s.className=cls;s.textContent=${JSON.stringify(d.confidentiality)};page.append(s)}` : ""}
  ${d.urgency !== "ปกติ" ? `if((!copy&&count===1)||(copy&&copyPages===1)){const s=document.createElement('div');s.className='urgency';s.textContent=${JSON.stringify(d.urgency)};page.append(s)}` : ""}
  ${d.copyMark !== "none" ? `if(${d.copyMark === "สำเนาคู่ฉบับ" ? "copy&&copyPages===1" : "!copy&&count===1"}){const s=document.createElement('${d.copyMark === "สำเนาคู่ฉบับ" ? "img" : "div"}');s.className='copy-mark${d.copyMark === "สำเนาคู่ฉบับ" ? "" : " copy-mark-text"}';${d.copyMark === "สำเนาคู่ฉบับ" ? `s.src=${JSON.stringify(assets.copyMark)};s.alt='สำเนาคู่ฉบับ';` : `s.textContent=${JSON.stringify(d.copyMark)};`}page.append(s)}` : ""}
  ${d.type === "external" ? `if((copy&&copyPages===1)||(!copy&&count===1&&${JSON.stringify(d.productionMark && d.copyMark !== "สำเนาคู่ฉบับ")})){const s=document.createElement('img');s.className='routing-stamp';s.alt='ตราร่างและตรวจทาน';s.src=${JSON.stringify(assets.routingStamp)};page.append(s)}` : ""}
  if(${JSON.stringify(d.numeralStyle)}==='thai'){const n=page.querySelector('.page-number');if(n)n.textContent=n.textContent.replace(/[0-9]/g,c=>'๐๑๒๓๔๕๖๗๘๙'[Number(c)])}
  content=document.createElement('div');content.className='content';page.append(content);root.append(page)};
  const fits=()=>content.scrollHeight<=content.clientHeight+1;
  const sourceNodes=Array.from(document.getElementById('source').children).map(node=>node.cloneNode(true));
  const waitForPaper=async()=>{for(let attempt=0;attempt<120&&(content.clientHeight<1||content.clientWidth<1);attempt++)await new Promise(resolve=>setTimeout(resolve,16));if(content.clientHeight<1||content.clientWidth<1)throw new Error('Paper is not measurable')};
  const paginate=async(nodes,copy=false)=>{next(copy);await waitForPaper();for(let node of nodes){if((node.classList.contains('appendix-sheet')||node.classList.contains('appendix-page-start'))&&content.children.length)next(copy);content.append(node);
    // Meeting headings need room for the next lines, rather than sitting alone at a page foot.
    if(node.classList.contains('minutes-section-title')&&content.children.length>1){const probe=document.createElement('div');probe.style.height=((parseFloat(getComputedStyle(node).lineHeight)||parseFloat(getComputedStyle(node).fontSize)*1.2)*3)+'px';content.append(probe);const room=fits();probe.remove();if(!room){node.remove();next(copy);content.append(node)}}
    if(fits())continue;node.remove();if(!node.classList.contains('body-text')&&!node.classList.contains('appendix-text')&&node.tagName!=='TABLE'){if(content.children.length)next(copy);content.append(node);if(fits())continue;node.remove();}
    if(node.tagName==='TABLE'){
      const tableRows=Array.from(node.querySelectorAll('tbody tr')).map(row=>row.cloneNode(true));
      if(!tableRows.length){content.append(node);overflow=true;continue}
      const createTablePart=()=>{const part=node.cloneNode(false),head=node.querySelector('thead');if(head)part.append(head.cloneNode(true));const body=document.createElement('tbody');part.append(body);content.append(part);return {part,body}};
      let part=createTablePart();
      for(const row of tableRows){part.body.append(row);if(fits())continue;row.remove();if(!part.body.children.length)part.part.remove();next(copy);part=createTablePart();part.body.append(row);if(!fits())overflow=true}
      continue;
    }
    if(node.tagName!=='P'){content.append(node);overflow=true;continue}
    const segmenter=new Intl.Segmenter('th',{granularity:'word'});const words=Array.from(node.textContent.matchAll(/\\S+\\s*|\\s+/g),match=>match[0]).flatMap(token=>token.length>120?Array.from(segmenter.segment(token),part=>part.segment):[token]);node.remove();let offset=0;
    let boundaries=[0];for(const word of words)boundaries.push(boundaries[boundaries.length-1]+word.length);
    const unitCount=boundaries.length-1;
    const textNodes=[],walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);while(walker.nextNode())textNodes.push(walker.currentNode);
    const point=index=>{let remaining=index;for(const textNode of textNodes){if(remaining<=textNode.textContent.length)return [textNode,remaining];remaining-=textNode.textContent.length}const last=textNodes[textNodes.length-1];return [last,last.textContent.length]};
    const fragment=(from,to)=>{const range=document.createRange(),start=point(boundaries[from]),end=point(boundaries[to]);range.setStart(start[0],start[1]);range.setEnd(end[0],end[1]);return range.cloneContents()};
    while(offset<unitCount){const part=node.cloneNode(false);content.append(part);let low=1,high=unitCount-offset,best=0;
      while(low<=high){const mid=Math.floor((low+high)/2);part.replaceChildren(fragment(offset,offset+mid));if(fits()){best=mid;low=mid+1}else high=mid-1}
      if(best===0){part.remove();if(!content.children.length){overflow=true;part.replaceChildren(fragment(offset,offset+1));content.append(part);offset++}next(copy);continue}
      part.replaceChildren(fragment(offset,offset+best));if(offset>0)part.style.textIndent='0';offset+=best;part.classList.toggle('paragraph-continues',offset<unitCount);if(offset<unitCount)next(copy);
    }
  }};
  await paginate(sourceNodes,false);
  ${d.type === "external" ? `if(root.querySelector('.signoff-group')?.closest('.page')!==root.firstElementChild){document.body.classList.add('compact-signoff');const retryNodes=sourceNodes.map(node=>node.cloneNode(true));root.replaceChildren();count=0;copyPages=0;isCopy=false;overflow=false;await paginate(retryNodes,false)}` : ""}
  ${d.copyMark === "สำเนาคู่ฉบับ" ? `await paginate(sourceNodes.map(node=>node.cloneNode(true)),true);` : ""}
  await Promise.all(Array.from(root.querySelectorAll('img')).map(i=>i.decode().catch(()=>{})));
  root.querySelectorAll('.page').forEach(page=>{const stamp=page.querySelector('.copy-mark:not(.copy-mark-text)'),garuda=page.querySelector('.garuda');if(!stamp||!garuda)return;const p=page.getBoundingClientRect(),g=garuda.getBoundingClientRect(),gap=96/25.4;stamp.style.top=Math.round(g.top-p.top-stamp.getBoundingClientRect().height-gap)+'px'});
  root.querySelectorAll('.signoff-group').forEach(group=>{const closing=group.querySelector('.closing'),signature=group.querySelector('.signature'),content=group.closest('.content');if(!closing||!signature||!content)return;const closeBox=closing.getBoundingClientRect(),contentBox=content.getBoundingClientRect(),signatureWidth=signature.getBoundingClientRect().width;signature.style.marginLeft=Math.round(closeBox.left+closeBox.width/2-contentBox.left-signatureWidth/2)+'px'});
  ${d.confidentiality !== "ปกติ" ? `Array.from(root.children).forEach((page,index)=>{const c=document.createElement('div');c.className='security-control';const owner=document.createElement('span');owner.textContent=document.getElementById('security-owner').textContent;const info=document.createElement('span');info.textContent='ชุดที่ ${d.secretSetNumber}/${d.secretSetTotal} · หน้า '+(index+1)+'/'+count;if(${JSON.stringify(d.numeralStyle)}==='thai')info.textContent=info.textContent.replace(/[0-9]/g,c=>'๐๑๒๓๔๕๖๗๘๙'[Number(c)]);c.append(owner,info);page.append(c);if(c.getBoundingClientRect().top<page.querySelector('.content').getBoundingClientRect().bottom)overflow=true})` : ""}
  document.getElementById('security-owner').remove();
  const pageList=Array.from(root.children);
  for(let i=0;i<pageList.length-1;i++){
    if(!pageList[i].dataset.copyCounterpart&&pageList[i+1].dataset.copyCounterpart)continue;
    const following=pageList[i+1].querySelector('.content');
    const first=Array.from(following.querySelectorAll('p,b,strong')).find(n=>n.textContent.trim());
    const text=(first?first.textContent:following.textContent).trim();
    const segments=Array.from(new Intl.Segmenter('th',{granularity:'word'}).segment(text)).filter(s=>s.isWordLike);
    if(text){const end=segments[Math.min(2,segments.length-1)];const cue=document.createElement('div');cue.className='continuation-cue';cue.textContent=text.slice(0,end?end.index+end.segment.length:24).trim()+'...';pageList[i].append(cue);
    while(cue.scrollWidth>cue.clientWidth+1&&cue.textContent.length>4){const chars=Array.from(cue.textContent.slice(0,-3));chars.pop();cue.textContent=chars.join('')+'...';}}
  }
  const production=root.querySelector('.production');if(production){const parentBox=production.parentElement.getBoundingClientRect(),box=production.getBoundingClientRect();const gap=parentBox.bottom-box.bottom;if(gap>0)production.style.marginTop=(parseFloat(getComputedStyle(production).marginTop)+gap)+'px'}
  document.getElementById('source').remove();window.__paginationDone=true;window.__pageCount=count;window.__overflow=overflow;
  parent.postMessage({source:'sarabun-preview',pages:count,height:document.body.scrollHeight,overflow,compactSignoff:document.body.classList.contains('compact-signoff')},'*');
  })().catch(()=>{window.__paginationError=true;parent.postMessage({source:'sarabun-preview',error:true},'*')});
  </script></body></html>`;
}
