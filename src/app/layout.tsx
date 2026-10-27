/**
 * แผนที่อ่านโค้ด — src/app/layout.tsx
 * หน้าที่: กรอบ HTML ที่ครอบทุกหน้า กำหนดภาษา ชื่อแท็บ และนำเข้า CSS กลาง
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./page.tsx
 * 2. ../components/workspace.tsx
 * 3. ../lib/document.ts
 * 4. ./actions.ts
 * 5. ../lib/db.ts
 * 6. ../lib/render-document.ts
 * 7. ./api/documents/[id]/pdf/route.ts
 * 8. ../lib/pdf.ts
 * ไฟล์นี้เป็นส่วนประกอบของเส้นทางข้างต้น ให้เริ่มอ่านชนิดข้อมูล/ผู้เรียกก่อนอ่านรายละเอียดภายใน
 * อ่านต่อจาก import: ./globals.css
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */
import type { Metadata } from "next";
/* นำเข้า ./globals.css — กฎหน้าตาและขนาดของ แอปโดยรวม; ไม่ใช่กฎหน้ากระดาษ PDF ซึ่งอยู่ใน render-document.ts */
import "./globals.css";
import "./workspace-theme.css";
import "./editor-layout.css";
import "./minutes-workspace.css";
export const metadata: Metadata = {
  title: "สารบรรณ — พื้นที่ทำงานเอกสารราชการ",
  description: "จัดทำ ตรวจทาน และจัดเก็บร่างหนังสือราชการ",
};
/* รับ children จาก Next.js แล้วครอบด้วย html/body; เปลี่ยนโครงทุกหน้าที่นี่ แต่รูปแบบกระดาษอยู่ใน render-document.ts */
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        {/* คืนธีมก่อนวาด UI เพื่อไม่ให้แสงขาววาบ; ไม่เข้าถึง iframe เอกสาร */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              'try{document.documentElement.dataset.uiTheme=localStorage.getItem("sarabun-ui-theme")==="dim"?"dim":"light"}catch{}',
          }}
        />
        {children}
      </body>
    </html>
  );
}
