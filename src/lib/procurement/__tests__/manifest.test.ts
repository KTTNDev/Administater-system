import { it, expect } from 'vitest';
import { buildBinderManifest, BINDER_IDS, computeProcurementCase } from '../index';
import { fixture } from './fixtures';
it('keeps all 21 binder slots in order with vendor and LAAS sources and copy counts', () => {
    const rows = buildBinderManifest(computeProcurementCase(fixture()));
    expect(rows.map(r => r.docId)).toEqual([...BINDER_IDS]);
    expect(rows.filter(r => r.source === 'VENDOR_EXTERNAL').map(r => r.docId)).toEqual(['4.2', '11.4', '11.5']);
    expect(rows.filter(r => r.source === 'LAAS_EXTERNAL').map(r => r.docId)).toEqual(['5.1', '5.2', '14']);
    expect(rows.find(r => r.docId === '13')?.source).toBe('GENERATED');
    expect(rows.find(r => r.docId === '14')?.title).toContain('e-LAAS');
    for (const row of rows)
        expect(row.copies).toBe(['6.2', '8', '9'].includes(row.docId) ? 3 : ['10', '11.2'].includes(row.docId) ? 2 : 1);
});
it('generates seven manual documents including Doc 13 above 5,000 unless individually overridden', () => {
    const input = fixture(22890);
    expect(buildBinderManifest(computeProcurementCase(input)).filter(r => r.source === 'GENERATED').map(r => r.docId)).toEqual(['1', '2', '3', '4.1', '11.1', '11.3', '13']);
    input.manualDocumentOverrides = ['10'];
    const rows = buildBinderManifest(computeProcurementCase(input));
    expect(rows.find(r => r.docId === '10')?.source).toBe('GENERATED');
    expect(rows.find(r => r.docId === '7')?.sourceCategory).toBe('EGP_OR_LAAS_SYSTEM');
    expect(rows.find(r => r.docId === '5.1')?.source).toBe('LAAS_EXTERNAL');
    expect(rows.find(r => r.docId === '14')?.source).toBe('LAAS_EXTERNAL');
});
