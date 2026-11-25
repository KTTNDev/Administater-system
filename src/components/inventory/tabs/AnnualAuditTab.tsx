'use client';
import {useMemo, useState} from 'react';
import {buildAnnualAudit213Report, buildFiscalYearSummary, getThaiFiscalQuarterRange} from '@/lib/inventory/reports';
import type {InventoryDomainState} from '@/lib/inventory/types';
import {currentThaiFiscalYear, formatBaht} from '../client-api';

interface Props {
  state: InventoryDomainState;
  busy: boolean;
  onExport: (format: 'pdf' | 'docx', payload: Record<string, unknown>, filename: string) => Promise<void>;
  onCarryForward: (fromFiscalYearBE: number, toFiscalYearBE: number) => Promise<void>;
  onArchiveLocalYear: (fiscalYearBE: number, landscapeStockCard: boolean) => Promise<void>;
}

type PresetMode = 'FULL_YEAR' | 'Q1' | 'Q2' | 'Q3' | 'Q4' | 'CUSTOM';

export function AnnualAuditTab({state, busy, onExport, onCarryForward, onArchiveLocalYear}: Props) {
  const defaultFy = useMemo(() => {
    const years = [currentThaiFiscalYear(), ...state.lots.map(l => l.fiscalYearBE), ...state.ledger.map(e => e.fiscalYearBE)];
    return Math.max(...years);
  }, [state.lots, state.ledger]);

  const [fiscalYearBE, setFiscalYearBE] = useState<number>(defaultFy);
  const [preset, setPreset] = useState<PresetMode>('FULL_YEAR');
  const [customAsOf, setCustomAsOf] = useState<string>(`${defaultFy - 543}-09-30`);
  const [landscapeStockCard, setLandscapeStockCard] = useState<boolean>(false);

  const periodSpec = useMemo(() => {
    const sep30 = `${fiscalYearBE - 543}-09-30`;
    if (preset === 'FULL_YEAR') {
      return {asOfDate: sep30, periodLabel: `ประจำปีงบประมาณ พ.ศ. ${fiscalYearBE}`, periodStart: undefined, periodEnd: undefined};
    }
    if (preset === 'CUSTOM') {
      return {
        asOfDate: customAsOf || sep30,
        periodLabel: `ณ วันที่ ${customAsOf || sep30}`,
        periodStart: `${fiscalYearBE - 544}-10-01`,
        periodEnd: customAsOf || sep30,
      };
    }
    const qNum = Number(preset.slice(1)) as 1 | 2 | 3 | 4;
    const range = getThaiFiscalQuarterRange(fiscalYearBE, qNum);
    return {
      asOfDate: range.periodEnd,
      periodLabel: range.periodLabel,
      periodStart: range.periodStart,
      periodEnd: range.periodEnd,
    };
  }, [fiscalYearBE, preset, customAsOf]);

  const summary = useMemo(
    () =>
      buildFiscalYearSummary(state, fiscalYearBE, {
        periodLabel: periodSpec.periodLabel,
        periodStart: periodSpec.periodStart,
        periodEnd: periodSpec.periodEnd,
      }),
    [state, fiscalYearBE, periodSpec],
  );

  const audit213 = useMemo(
    () => buildAnnualAudit213Report(state, fiscalYearBE, `${fiscalYearBE - 543}-09-30`),
    [state, fiscalYearBE],
  );

  const fiscalYears = useMemo(() => {
    const set = new Set<number>([currentThaiFiscalYear(), fiscalYearBE]);
    for (const l of state.lots) set.add(l.fiscalYearBE);
    for (const e of state.ledger) set.add(e.fiscalYearBE);
    return [...set].sort((a, b) => b - a);
  }, [state.lots, state.ledger, fiscalYearBE]);

  const alreadyCarriedForward = useMemo(
    () =>
      state.lots.some(
        l =>
          l.fiscalYearBE === fiscalYearBE + 1 &&
          l.sourceType === 'OPENING_BALANCE' &&
          l.referenceDocNo === `ปี ${fiscalYearBE}`,
      ),
    [state.lots, fiscalYearBE],
  );

  const pendingReqsBlockingClose = useMemo(
    () => state.requisitions.filter(r => r.fiscalYearBE <= fiscalYearBE && r.status === 'PENDING_SIGNATURE').length,
    [state.requisitions, fiscalYearBE],
  );

  const groupedItems = useMemo(() => {
    const map = new Map<string, {code: string; name: string; items: typeof summary.items}>();
    for (const item of summary.items) {
      const bucket = map.get(item.categoryCode) ?? {code: item.categoryCode, name: item.categoryType, items: []};
      bucket.items.push(item);
      map.set(item.categoryCode, bucket);
    }
    return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [summary.items]);

  return (
    <div style={{display: 'grid', gap: 14}}>
      {/* Controls */}
      <div className="inv-card inv-between">
        <div className="inv-row">
          <label className="inv-field" style={{minWidth: 130}}>
            <span>ปีงบประมาณ พ.ศ.</span>
            <select
              value={fiscalYearBE}
              onChange={e => {
                const next = Number(e.target.value);
                setFiscalYearBE(next);
                setCustomAsOf(`${next - 543}-09-30`);
              }}
            >
              {fiscalYears.map(y => (
                <option key={y} value={y}>
                  พ.ศ. {y}
                </option>
              ))}
            </select>
          </label>

          <div className="inv-field">
            <span>งวดตัดพัสดุ (Cut-off Presets)</span>
            <div className="inv-row">
              {(
                [
                  ['FULL_YEAR', 'สิ้นปี (30 ก.ย.)'],
                  ['Q1', 'ไตรมาส 1'],
                  ['Q2', 'ไตรมาส 2'],
                  ['Q3', 'ไตรมาส 3'],
                  ['Q4', 'ไตรมาส 4'],
                  ['CUSTOM', 'กำหนดวันที่เอง'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className="inv-tab-btn"
                  aria-pressed={preset === key}
                  onClick={() => setPreset(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {preset === 'CUSTOM' && (
            <label className="inv-field">
              <span>ณ วันที่</span>
              <input type="date" value={customAsOf} onChange={e => setCustomAsOf(e.target.value)} />
            </label>
          )}
        </div>

        <label className="inv-inline-check">
          <input
            type="checkbox"
            checked={landscapeStockCard}
            onChange={e => setLandscapeStockCard(e.target.checked)}
          />
          พิมพ์บัญชีวัสดุ (INV-02) แนวนอน A4
        </label>
      </div>

      {/* Live Accounting Reconciliation Card */}
      <section
        className={summary.allBalanced ? 'inv-reconcile-ok' : 'inv-reconcile-err'}
        aria-label="ตรวจสอบการกระทบยอดบัญชีวัสดุ"
        data-testid="reconciliation-card"
      >
        <div className="inv-between">
          <div>
            <strong style={{fontSize: 15, color: summary.allBalanced ? '#0a5d47' : '#9c1f24'}}>
              {summary.allBalanced ? 'กระทบยอดถูกต้องตรงกัน ✓' : 'พบส่วนต่างในการกระทบยอด — กรุณาตรวจสอบ!'}
            </strong>
            <div style={{fontSize: 12.5, color: '#39554e', marginTop: 2}}>
              งวดที่แสดง: <b>{summary.periodLabel}</b> (ณ วันที่ {periodSpec.asOfDate})
            </div>
          </div>
          <span className={`inv-pill ${summary.allBalanced ? 'inv-pill-ok' : 'inv-pill-danger'}`}>
            มูลค่าคงเหลือจริง (FIFO): {formatBaht(summary.totals.closingAmount)} บาท
          </span>
        </div>

        <div className="inv-grid-4">
          <div className="inv-stat-card">
            <span>ยอดยกมา</span>
            <strong>{formatBaht(summary.totals.openingAmount)} บ.</strong>
            <small>{summary.totals.openingQty} หน่วย</small>
          </div>
          <div className="inv-stat-card">
            <span>+ รับระหว่างงวด</span>
            <strong>{formatBaht(summary.totals.totalInAmount)} บ.</strong>
            <small>{summary.totals.totalInQty} หน่วย</small>
          </div>
          <div className="inv-stat-card">
            <span>− จ่ายระหว่างงวด</span>
            <strong>{formatBaht(summary.totals.totalOutAmount)} บ.</strong>
            <small>{summary.totals.totalOutQty} หน่วย</small>
          </div>
          <div className="inv-stat-card">
            <span>= คงเหลือจริง (FIFO)</span>
            <strong>{formatBaht(summary.totals.closingAmount)} บ.</strong>
            <small>{summary.totals.closingQty} หน่วย</small>
          </div>
        </div>

        <div className="inv-between" style={{fontSize: 12, color: '#36554d', borderTop: '1px solid #cce7db', paddingTop: 8}}>
          <div>
            ทะเบียนครุภัณฑ์ประกอบรายงาน ข้อ ๒๑๓: <b>{audit213.assets.totalCount}</b> รายการ (มูลค่าทุนรวม{' '}
            <b>{formatBaht(audit213.assets.totalAcquisitionCost)}</b> บาท · ใช้งานได้ {audit213.assets.byCondition.GOOD} · ชำรุด{' '}
            {audit213.assets.byCondition.DAMAGED_REPAIRABLE} · ขอจำหน่าย {audit213.assets.byCondition.UNSERVICEABLE_DISPOSE} · สูญหาย{' '}
            {audit213.assets.byCondition.MISSING})
          </div>
          <div className="inv-row">
            {alreadyCarriedForward ? (
              <>
                <span className="inv-pill inv-pill-ok">ยกยอดไปปี พ.ศ. {fiscalYearBE + 1} แล้ว ✓</span>
                <button
                  type="button"
                  className="inv-btn inv-btn-sm"
                  onClick={() => {
                    const next = fiscalYearBE + 1;
                    setFiscalYearBE(next);
                    setPreset('FULL_YEAR');
                    setCustomAsOf(`${next - 543}-09-30`);
                  }}
                >
                  ดูยอดยกมาปี พ.ศ. {fiscalYearBE + 1} →
                </button>
              </>
            ) : (
              <button
                type="button"
                className="inv-btn inv-btn-warn inv-btn-sm"
                disabled={busy || summary.totals.closingQty <= 0 || pendingReqsBlockingClose > 0}
                title={
                  pendingReqsBlockingClose > 0
                    ? `ยังมีใบเบิกปี ${fiscalYearBE} รอเซ็นรับของจริง ${pendingReqsBlockingClose} ใบ กรุณายืนยันตัดสต๊อกหรือยกเลิกก่อนปิดงบ`
                    : ''
                }
                onClick={async () => {
                  const nextFy = fiscalYearBE + 1;
                  if (
                    !confirm(
                      `ยืนยันปิดงบปีงบประมาณ พ.ศ. ${fiscalYearBE} และยกยอดคงเหลือทุกล็อต FIFO (${summary.totals.closingQty} หน่วย · มูลค่า ${formatBaht(summary.totals.closingAmount)} บาท) ไปตั้งเป็น "ยอดยกมา" วันที่ 1 ต.ค. ของปีงบประมาณ พ.ศ. ${nextFy}?`,
                    )
                  ) {
                    return;
                  }
                  await onCarryForward(fiscalYearBE, nextFy);
                  setFiscalYearBE(nextFy);
                  setPreset('FULL_YEAR');
                  setCustomAsOf(`${nextFy - 543}-09-30`);
                }}
              >
                ปิดงบปี {fiscalYearBE} &amp; ยกยอดไปปี พ.ศ. {fiscalYearBE + 1}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Export Center */}
      <section className="inv-card" aria-label="ศูนย์ส่งออกเอกสารบัญชีวัสดุและรายงานตรวจนับ">
        <div className="inv-between" style={{marginBottom: 8}}>
          <h3 style={{margin: 0}}>ศูนย์ส่งออกเอกสารราชการ (PDF พร้อมพิมพ์ &amp; Word .docx แก้ไขได้ · เลขไทย ๑๐๐%)</h3>
          <button
            type="button"
            className="inv-btn inv-btn-primary inv-btn-sm"
            disabled={busy}
            onClick={() => void onArchiveLocalYear(fiscalYearBE, landscapeStockCard)}
          >
            จัดเก็บแฟ้มพัสดุปีงบ {fiscalYearBE} ลงโฟลเดอร์เครื่อง (Word ครบชุด)
          </button>
        </div>
        <div className="inv-grid-3">
          <div className="inv-card" style={{background: '#f8fbfa', display: 'grid', gap: 8}}>
            <strong>1. บัญชีวัสดุทั้งกอง (INV-02 Binder)</strong>
            <p style={{margin: 0, fontSize: 12, color: '#4c665f'}}>
              พิมพ์บัญชีวัสดุครบทุกรายการเรียงตามลำดับทะเบียน พร้อมหัวตารางซ้ำอัตโนมัติทุกหน้า
            </p>
            <div className="inv-row">
              <button
                type="button"
                className="inv-btn inv-btn-primary inv-btn-sm"
                disabled={busy || state.materials.length === 0}
                onClick={() =>
                  void onExport(
                    'pdf',
                    {kind: 'INV-02', fiscalYearBE, landscape: landscapeStockCard},
                    `บัญชีวัสดุทั้งกอง-${fiscalYearBE}.pdf`,
                  )
                }
              >
                PDF ทั้งกอง
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-sm"
                disabled={busy || state.materials.length === 0}
                onClick={() =>
                  void onExport(
                    'docx',
                    {kind: 'INV-02', fiscalYearBE, landscape: landscapeStockCard},
                    `บัญชีวัสดุทั้งกอง-${fiscalYearBE}.docx`,
                  )
                }
              >
                Word รวมไฟล์
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-sm"
                disabled={busy || state.materials.length === 0}
                onClick={() =>
                  void onExport(
                    'docx',
                    {kind: 'INV-02_ZIP', fiscalYearBE, landscape: landscapeStockCard},
                    `บัญชีวัสดุทั้งกอง-${fiscalYearBE}.zip`,
                  )
                }
              >
                Word ZIP แยกแผ่น
              </button>
            </div>
          </div>

          <div className="inv-card" style={{background: '#f8fbfa', display: 'grid', gap: 8}}>
            <strong>2. รายงานสรุปตัดพัสดุ (INV-04)</strong>
            <p style={{margin: 0, fontSize: 12, color: '#4c665f'}}>
              สรุปยอดยกมา-รับ-จ่าย-คงเหลือ แยกกลุ่มตามหมวดวัสดุราชการ 18 หมวด พร้อมยอดรวม
            </p>
            <div className="inv-row">
              <button
                type="button"
                className="inv-btn inv-btn-primary inv-btn-sm"
                disabled={busy}
                onClick={() =>
                  void onExport(
                    'pdf',
                    {
                      kind: 'INV-04',
                      fiscalYearBE,
                      asOfDate: periodSpec.asOfDate,
                      periodLabel: periodSpec.periodLabel,
                      periodStart: periodSpec.periodStart,
                      periodEnd: periodSpec.periodEnd,
                    },
                    `รายงานสรุปตัดพัสดุ-${fiscalYearBE}.pdf`,
                  )
                }
              >
                ดาวน์โหลด INV-04 (PDF)
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-sm"
                disabled={busy}
                onClick={() =>
                  void onExport(
                    'docx',
                    {
                      kind: 'INV-04',
                      fiscalYearBE,
                      asOfDate: periodSpec.asOfDate,
                      periodLabel: periodSpec.periodLabel,
                      periodStart: periodSpec.periodStart,
                      periodEnd: periodSpec.periodEnd,
                    },
                    `รายงานสรุปตัดพัสดุ-${fiscalYearBE}.docx`,
                  )
                }
              >
                Word (.docx)
              </button>
            </div>
          </div>

          <div className="inv-card" style={{background: '#f8fbfa', display: 'grid', gap: 8}}>
            <strong>3. รายงานตรวจสอบพัสดุ ข้อ ๒๑๓ (INV-05)</strong>
            <p style={{margin: 0, fontSize: 12, color: '#4c665f'}}>
              บันทึกข้อความรายงานผลตรวจสอบพัสดุประจำปี (ตราครุฑ 1.5 ซม.) พร้อมตารางวัสดุ &amp; ครุภัณฑ์
            </p>
            <div className="inv-row">
              <button
                type="button"
                className="inv-btn inv-btn-primary inv-btn-sm"
                disabled={busy}
                onClick={() =>
                  void onExport(
                    'pdf',
                    {kind: 'INV-05', fiscalYearBE, auditDate: `${fiscalYearBE - 543}-09-30`},
                    `รายงานตรวจสอบพัสดุข้อ213-${fiscalYearBE}.pdf`,
                  )
                }
              >
                INV-05 (PDF)
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-sm"
                disabled={busy}
                onClick={() =>
                  void onExport(
                    'docx',
                    {kind: 'INV-05', fiscalYearBE, auditDate: `${fiscalYearBE - 543}-09-30`},
                    `รายงานตรวจสอบพัสดุข้อ213-${fiscalYearBE}.docx`,
                  )
                }
              >
                Word
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-warn inv-btn-sm"
                disabled={busy}
                onClick={() =>
                  void onExport(
                    'pdf',
                    {kind: 'ANNUAL_AUDIT_BINDER', fiscalYearBE, landscape: landscapeStockCard},
                    `ชุดรายงานตรวจนับพัสดุประจำปี-${fiscalYearBE}.pdf`,
                  )
                }
              >
                รวมแฟ้มทั้งชุด PDF
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-sm"
                disabled={busy}
                onClick={() =>
                  void onExport(
                    'docx',
                    {kind: 'ANNUAL_AUDIT_ZIP', fiscalYearBE, landscape: landscapeStockCard},
                    `ชุดรายงานตรวจนับพัสดุประจำปี-${fiscalYearBE}.zip`,
                  )
                }
              >
                ชุด Word ZIP
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Preview Table of INV-04 */}
      <section className="inv-card" aria-label="ตัวอย่างรายงานสรุปตัดพัสดุแยกหมวด">
        <h3>สรุปการรับ-จ่าย-คงเหลือวัสดุ แยกหมวด ({summary.items.length} รายการ)</h3>
        {groupedItems.length === 0 ? (
          <p style={{color: '#5a726c', margin: '10px 0'}}>ยังไม่มีรายการวัสดุในปีงบประมาณ {fiscalYearBE}</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table-ui">
              <thead>
                <tr>
                  <th className="inv-center">ลำดับ</th>
                  <th>รายการวัสดุ</th>
                  <th className="inv-center">หน่วย</th>
                  <th className="inv-num">ยอดยกมา (จำนวน / บ.)</th>
                  <th className="inv-num">รับระหว่างงวด (จำนวน / บ.)</th>
                  <th className="inv-num">จ่ายระหว่างงวด (จำนวน / บ.)</th>
                  <th className="inv-num">คงเหลือสิ้นงวด (จำนวน / บ.)</th>
                  <th className="inv-center">กระทบยอด</th>
                </tr>
              </thead>
              <tbody>
                {groupedItems.map(group => (
                  <GroupRows key={group.code} group={group} />
                ))}
                <tr style={{background: '#edf6f2', fontWeight: 700}}>
                  <td colSpan={3}>รวมทั้งสิ้นทุกหมวด</td>
                  <td className="inv-num">
                    {summary.totals.openingQty} / {formatBaht(summary.totals.openingAmount)}
                  </td>
                  <td className="inv-num">
                    {summary.totals.totalInQty} / {formatBaht(summary.totals.totalInAmount)}
                  </td>
                  <td className="inv-num">
                    {summary.totals.totalOutQty} / {formatBaht(summary.totals.totalOutAmount)}
                  </td>
                  <td className="inv-num">
                    {summary.totals.closingQty} / {formatBaht(summary.totals.closingAmount)}
                  </td>
                  <td className="inv-center">{summary.allBalanced ? '✓' : '✗'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function GroupRows({
  group,
}: {
  group: {code: string; name: string; items: ReturnType<typeof buildFiscalYearSummary>['items']};
}) {
  return (
    <>
      <tr style={{background: '#f5f9f7'}}>
        <td colSpan={8}>
          <b>
            หมวด {group.code} : {group.name}
          </b>
        </td>
      </tr>
      {group.items.map(item => (
        <tr key={item.materialId}>
          <td className="inv-center">#{item.ledgerSeqNo}</td>
          <td>{item.name}</td>
          <td className="inv-center">{item.unit}</td>
          <td className="inv-num">
            {item.openingQty} / {formatBaht(item.openingAmount)}
          </td>
          <td className="inv-num">
            {item.totalInQty} / {formatBaht(item.totalInAmount)}
          </td>
          <td className="inv-num">
            {item.totalOutQty} / {formatBaht(item.totalOutAmount)}
          </td>
          <td className="inv-num">
            <b>
              {item.closingQty} / {formatBaht(item.closingAmount)}
            </b>
          </td>
          <td className="inv-center">
            <span className={`inv-pill ${item.qtyBalanced && item.amountBalanced ? 'inv-pill-ok' : 'inv-pill-danger'}`}>
              {item.qtyBalanced && item.amountBalanced ? 'ตรงกัน' : 'คลาดเคลื่อน'}
            </span>
          </td>
        </tr>
      ))}
    </>
  );
}
