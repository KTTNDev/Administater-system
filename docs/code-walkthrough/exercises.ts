import type { Draft, SaveResult, YearMode, Period } from './lab-types';
// TODO 1: วันที่ ISO ที่ตรวจแล้ว -> ปี พ.ศ.; fiscal เริ่มเดือนตุลาคม
export function reportYear(date: string, mode: YearMode): number {
  throw new Error('TODO 1');
}
// TODO 2: เปลี่ยนหัวเรื่องโดยไม่แก้ object เดิม
export function changeSubject(draft: Draft, subject: string): Draft {
  throw new Error('TODO 2');
}
// TODO 3: success -> "บันทึกฉบับที่ N"; failure -> error
export function saveMessage(result: SaveResult): string {
  throw new Error('TODO 3');
}
// TODO 4: version ไม่ตรง expected ให้ throw; ตรงให้คืน object ใหม่ version+1
export function nextVersion<T extends { version: number }>(item: T, expected: number): T {
  throw new Error('TODO 4');
}
// TODO 5: ว่าง, ไม่เป็นเลข, ติดลบ -> null; นอกนั้นคูณรวม
export function lineTotal(quantity: string, unitCost: string): number | null {
  throw new Error('TODO 5');
}
// TODO 6: เวลาเป็นนาทีของวันเดียวกัน; ช่วงแตะขอบไม่ชนถ้า buffer=0
export function overlaps(a: Period, b: Period): boolean {
  throw new Error('TODO 6');
}
