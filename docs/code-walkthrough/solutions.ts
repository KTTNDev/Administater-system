import type { Draft, SaveResult, YearMode, Period } from './lab-types';
// 1. Input is already a valid ISO date. Domain validation belongs before this function.
export function reportYear(date: string, mode: YearMode): number {
  const [year, month] = date.split('-').map(Number);
  return year + 543 + (mode === 'fiscal' && month >= 10 ? 1 : 0);
}
// 2. A new object is returned. The original must remain unchanged.
export function changeSubject(draft: Draft, subject: string): Draft {
  return { ...draft, subject };
}
// 3. The discriminant allows access to data OR error, never both blindly.
export function saveMessage(result: SaveResult): string {
  if (!result.ok) return result.error;
  return `บันทึกฉบับที่ ${result.data.version}`;
}
// 4. Constraint requires version, while T preserves additional fields.
export function nextVersion<T extends { version: number }>(item: T, expected: number): T {
  if (item.version !== expected) throw new Error('stale version');
  return { ...item, version: item.version + 1 };
}
// 5. Blank is unknown, while a typed zero is a real value.
export function lineTotal(quantity: string, unitCost: string): number | null {
  if (!quantity.trim() || !unitCost.trim()) return null;
  const q = Number(quantity), cost = Number(unitCost);
  if (!Number.isFinite(q) || !Number.isFinite(cost) || q < 0 || cost < 0) return null;
  return q * cost;
}
// 6. Minutes since midnight; periods are valid and on the same day.
export function overlaps(a: Period, b: Period): boolean {
  return a.start < b.end + b.buffer && a.end + a.buffer > b.start;
}
