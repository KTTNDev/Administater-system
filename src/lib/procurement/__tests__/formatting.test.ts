import { it, expect } from 'vitest';
import { toThaiBahtText, toThaiDigits, toThaiOfficialText, formatThaiDate, formatThaiSignatureDate, formatThaiOrderDate, ISODateSchema, ProcurementCaseInputSchema, MasterDataSchema, defaultAgency } from '../index';
import { fixture } from './fixtures';
it.each([
    [1520, 'หนึ่งพันห้าร้อยยี่สิบบาทถ้วน'], [22890, 'สองหมื่นสองพันแปดร้อยเก้าสิบบาทถ้วน'],
    [30000, 'สามหมื่นบาทถ้วน'], [101.5, 'หนึ่งร้อยเอ็ดบาทห้าสิบสตางค์'],
    [21.25, 'ยี่สิบเอ็ดบาทยี่สิบห้าสตางค์'], [0, 'ศูนย์บาทถ้วน'], [1000001, 'หนึ่งล้านเอ็ดบาทถ้วน'],
])('formats %s baht', (amount, text) => expect(toThaiBahtText(amount as number)).toBe(text));
it('converts mixed digits while preserving product codes and emails by default', () => {
    expect(toThaiDigits('๒๕70 30,๐๐๐')).toBe('๒๕๗๐ ๓๐,๐๐๐');
    expect(toThaiOfficialText('Brother BT-5000 TN-269 D 60 ราคา 1520 โทร 0801234567 jojo_pencil@hotmail.com')).toBe('Brother BT-5000 TN-269 D 60 ราคา ๑๕๒๐ โทร ๐๘๐๑๒๓๔๕๖๗ jojo_pencil@hotmail.com');
    expect(toThaiOfficialText('TN-269 a123@example.com', { preserveModelCodes: false })).toBe('TN-๒๖๙ a123@example.com');
    expect(formatThaiDate('2026-11-18')).toBe('๑๘ พฤศจิกายน ๒๕๖๙');
    expect(formatThaiSignatureDate('2026-11-18')).toBe('วันที่ ๑๘ เดือนพฤศจิกายน พ.ศ. ๒๕๖๙');
    expect(formatThaiOrderDate('2026-11-17')).toBe('๑๗ พฤศจิกายน ๒๕๖๙');
});
it('rejects invalid dates, unknown fields, duplicate item IDs and invalid numeric values', () => {
    for (const date of ['2026-02-29', '2026-13-01', '2026-1-01'])
        expect(ISODateSchema.safeParse(date).success).toBe(false);
    expect(ISODateSchema.safeParse('2028-02-29').success).toBe(true);
    expect(ProcurementCaseInputSchema.safeParse({ ...fixture(), unexpected: true }).success).toBe(false);
    const input = fixture();
    input.items[0].quantity = Infinity;
    expect(ProcurementCaseInputSchema.safeParse(input).success).toBe(false);
    const duplicate = fixture();
    duplicate.items[1].id = duplicate.items[0].id;
    expect(ProcurementCaseInputSchema.safeParse(duplicate).success).toBe(false);
    expect(MasterDataSchema.parse({ agency: defaultAgency, signatories: fixture().signatories, vendors: [], budgetLines: [] }).agency.codes.externalLetterPrefix).toBe('ภก 52806');
    expect(() => toThaiBahtText(-1)).toThrow();
});
