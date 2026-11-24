export class LegacyWordRendererDisabledError extends Error {
  readonly status=410;
  constructor(){super('ยกเลิกการจัดหน้าด้วย Word เบื้องหลังแล้ว กรุณาเปิดร่างในระบบหลัก');}
}
