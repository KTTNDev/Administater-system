/** Expected layout errors may be shown to the user; runtime failures stay private. */
export class MissingOverlayPageError extends Error {
  constructor(pages:number[]){
    super(`มีข้อความหรือภาพวางอิสระอยู่บนหน้าที่ไม่มีแล้ว (หน้า ${pages.join(", ")}) กรุณาเลือกหน้าใหม่ก่อนส่งออก`);
    this.name="MissingOverlayPageError";
  }
}
