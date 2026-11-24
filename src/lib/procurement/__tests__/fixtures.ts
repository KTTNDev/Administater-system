import { ProcurementCaseInputSchema } from '../schema';
const person = { id: 'p', fullName: 'นายทดสอบ', position: 'เจ้าหน้าที่' };
export const fixture = (total = 1520) => ProcurementCaseInputSchema.parse({
    id: 'test', procurementType: 'BUY',
    budgetLine: { id: 'budget', fiscalYearBE: 2570, planName: 'แผนงาน', workName: 'งาน', categoryGroup: 'วัสดุ', categoryType: 'วัสดุสำนักงาน', allocatedAmount: 300000 },
    budgetSpentBefore: 1000, purposeText: 'เพื่อปฏิบัติงาน',
    items: total === 1520 ? [
        { id: 'a', description: 'กล่อง', quantity: 2, unit: 'ใบ', unitPrice: 590 },
        { id: 'b', description: 'ตลับเมตร', quantity: 1, unit: 'ตลับ', unitPrice: 340 },
    ] : Array.from({ length: 7 }, (_, i) => ({ id: String(i), description: 'สินค้า', quantity: 1, unit: 'ชิ้น', unitPrice: i === 6 ? 1890 : 3500 })),
    vendor: { id: 'v', shopName: 'ร้านทดสอบ', contactPersonName: 'นายร้านค้า', address: 'ที่อยู่', phone: '0800000000', taxId: '1234567890123', isVatRegistered: true },
    inspectors: [{ fullName: 'นายตรวจ', position: 'เจ้าหน้าที่', role: 'INSPECTOR' }],
    inspectionResult: {},
    signatories: { procurementOfficer: person, divisionDirector: person, municipalClerk: person, mayor: person },
    docs: {
        doc1_approvePrinciple: { runningNo: '1439', date: '2026-11-12' },
        doc2_assignSpec: { runningNo: '1446', date: '2026-11-13' },
        doc3_reportSpec: { runningNo: '1447', date: '2026-11-13' },
        doc6_1_purchaseRequest: { runningNo: '1463', date: '2026-11-17' },
        doc7_evalReport: { runningNo: '1465', date: '2026-11-17' },
        doc6_2_inspectorOrder: { runningNo: '2295', yearBE: 2569, date: '2026-11-17' },
        doc8_winnerAnnouncement: { registryLogNo: '12', date: '2026-11-17' },
        doc9_contractNotice: { runningNo: '4511', date: '2026-11-17' },
        doc10_purchaseOrder: { runningNo: '13', fiscalYearBE: 2570, date: total === 1520 ? '2026-11-17' : '2026-11-19' },
        doc11_1_inspectionReport: { runningNo: '1500', date: '2026-11-24' },
        doc12_finalSummary: { runningNo: '1501', date: '2026-11-24' },
        doc13_disbursement: { runningNo: '1502', date: '2026-11-25' },
        laasDate: '2026-11-17',
    },
});
