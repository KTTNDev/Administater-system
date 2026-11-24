import { ISODateSchema } from './schema';
export const toThaiDigits = (input: string | number) => String(input).replace(/[0-9]/g, d => '๐๑๒๓๔๕๖๗๘๙'[+d]);
export function toThaiOfficialText(input: string, options: {
    preserveModelCodes?: boolean;
} = {}) { return input.replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}|[A-Z]{1,2}\s+\d+[A-Za-z0-9._/-]*|[A-Za-z][A-Za-z0-9._/-]*|\d+[A-Za-z][A-Za-z0-9._/-]*|[0-9]/gi, t => t.includes('@') || options.preserveModelCodes !== false && /[A-Za-z]/.test(t) ? t : toThaiDigits(t)); }
export function toThaiBahtText(value: number) { if (!Number.isFinite(value) || value < 0 || value > 999999999.99)
    throw new RangeError('จำนวนเงินนอกขอบเขต'); const n = Math.round((value + Number.EPSILON) * 100), digits = ['ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'], places = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน']; const read = (v: number, higher = false): string => v >= 1000000 ? read(Math.floor(v / 1000000)) + 'ล้าน' + (v % 1000000 ? read(v % 1000000, true) : '') : [...String(v)].map((c, i, a) => { const d = +c, p = a.length - i - 1; return !d ? '' : p === 1 ? (d === 1 ? '' : d === 2 ? 'ยี่' : digits[d]) + 'สิบ' : p === 0 && d === 1 && (a.length > 1 || higher) ? 'เอ็ด' : digits[d] + places[p]; }).join(''); return (Math.floor(n / 100) ? read(Math.floor(n / 100)) : 'ศูนย์') + 'บาท' + (n % 100 ? read(n % 100) + 'สตางค์' : 'ถ้วน'); }
export function formatThaiDate(iso: string) { ISODateSchema.parse(iso); const [y, m, d] = iso.split('-').map(Number); return toThaiDigits(`${d} ${['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'][m - 1]} ${y + 543}`); }
export function formatThaiSignatureDate(iso: string) { const [day, month, year] = formatThaiDate(iso).split(' '); return `วันที่ ${day} เดือน${month} พ.ศ. ${year}`; }
export const formatThaiOrderDate = formatThaiDate;
