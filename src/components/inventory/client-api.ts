import type {InventoryStateRecord} from '@/lib/inventory/repository';
import type {ProcurementIntakeOption} from '@/lib/inventory/server-context';
import type {InventoryFormContext} from '@/lib/inventory/templates/build-forms';

export interface InventoryDomainPayload {
  record: InventoryStateRecord;
  context: InventoryFormContext;
  procurementCases: ProcurementIntakeOption[];
  createdId?: string;
}

export function todayIso(): string {
  return new Date().toLocaleDateString('en-CA', {timeZone: 'Asia/Bangkok'});
}

export function currentThaiFiscalYear(): number {
  const iso = todayIso();
  const [y, m] = iso.split('-').map(Number);
  return y + 543 + (m >= 10 ? 1 : 0);
}

export function formatBaht(value: number): string {
  return value.toLocaleString('th-TH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as {error?: string; issues?: Array<{messageTh?: string}>};
    if (data.error) return data.error;
    if (data.issues?.length) return data.issues.map(i => i.messageTh).filter(Boolean).join('; ') || fallback;
  } catch {
    // ignore
  }
  return fallback;
}

export async function fetchInventoryDomain(): Promise<InventoryDomainPayload> {
  const res = await fetch('/api/inventory/domain', {cache: 'no-store'});
  if (!res.ok) throw new Error(await readError(res, 'โหลดข้อมูลคลังพัสดุไม่สำเร็จ'));
  return (await res.json()) as InventoryDomainPayload;
}

export async function postInventoryAction(body: Record<string, unknown>): Promise<InventoryDomainPayload> {
  const res = await fetch('/api/inventory/domain', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res, 'บันทึกข้อมูลไม่สำเร็จ'));
  return (await res.json()) as InventoryDomainPayload;
}

export async function uploadSignedScan(file: File): Promise<{attachmentId: string; path: string; name: string; pages: number}> {
  const form = new FormData();
  form.set('file', file);
  const res = await fetch('/api/inventory/domain', {method: 'POST', body: form});
  if (!res.ok) throw new Error(await readError(res, 'อัปโหลดหลักฐานลงนามไม่สำเร็จ'));
  return (await res.json()) as {attachmentId: string; path: string; name: string; pages: number};
}

export async function downloadInventoryExport(
  format: 'pdf' | 'docx',
  payload: Record<string, unknown>,
  fallbackFilename: string,
): Promise<void> {
  const res = await fetch(`/api/inventory/export/${format}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await readError(res, `ส่งออก ${format.toUpperCase()} ไม่สำเร็จ`));
  const blob = await res.blob();
  const cd = res.headers.get('content-disposition') || '';
  const utfMatch = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  const filename = utfMatch ? decodeURIComponent(utfMatch[1]) : fallbackFilename;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
