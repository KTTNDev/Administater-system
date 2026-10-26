/**
 * แผนที่อ่านโค้ด — next.config.mjs
 * หน้าที่: กำหนดโฟลเดอร์ build ขนาด Server Action แพ็กเกจฝั่ง server และ HTTP headers
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ./scripts/open-local.mjs
 * 2. ./scripts/run-next.mjs
 * 3. ./next.config.mjs ← คุณอยู่ที่นี่
 * 4. ./src/app/api/health/route.ts
 * 5. ./src/app/page.tsx
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ./scripts/check-production.mjs, ./scripts/open-local.mjs, ./tests/production-launcher.test.ts
 *
 * แนวทางแก้: เมื่อเปลี่ยนผลลัพธ์หรือ signature ให้ตรวจผู้เรียกที่ระบุด้านบนและชุดทดสอบที่นำเข้าไฟล์นี้
 * การแก้ไฟล์นี้ต้องคงรูปแบบภาษาของไฟล์ และตรวจผู้เรียกก่อนเปลี่ยนชื่อหรือผลลัพธ์
 */
const config = {
  distDir: ".next-workspace",
  serverExternalPackages: ["playwright"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "same-origin" },
        ],
      },
    ];
  },
};

export default config;
