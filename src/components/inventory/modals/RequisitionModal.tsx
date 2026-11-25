'use client';
import {useMemo,useState} from 'react';
import {getMaterialStockTotals,InsufficientStockError,previewFifoAllocation,round2} from '@/lib/inventory/fifo-engine';
import type {MaterialItem,StockLot} from '@/lib/inventory/types';
import {currentThaiFiscalYear,formatBaht,todayIso} from '../client-api';

interface Props {
  materials: readonly MaterialItem[];
  lots: readonly StockLot[];
  defaultDivision: string;
  defaultMunicipality: string;
  busy: boolean;
  onClose: () => void;
  onSubmit: (
    payload: Record<string, unknown>,
    printAfter: 'none' | 'pdf' | 'docx',
  ) => Promise<void>;
}

export function RequisitionModal({
  materials,
  lots,
  defaultDivision,
  defaultMunicipality,
  busy,
  onClose,
  onSubmit,
}: Props) {
  const availableMaterials = useMemo(
    () =>
      materials.map(m => ({
        material: m,
        totals: getMaterialStockTotals(lots, m.id),
      })),
    [materials, lots],
  );

  const firstWithStock = availableMaterials.find(x => x.totals.availableQty > 0)?.material.id ?? materials[0]?.id ?? '';
  const [fiscalYearBE, setFiscalYearBE] = useState(String(currentThaiFiscalYear()));
  const [runningNo, setRunningNo] = useState('');
  const [requestDate, setRequestDate] = useState(todayIso());
  const [requesterName, setRequesterName] = useState('');
  const [requesterPosition, setRequesterPosition] = useState('นักพัฒนาชุมชนปฏิบัติการ');
  const [receiverName, setReceiverName] = useState('');
  const [purpose, setPurpose] = useState(`เพื่อใช้ในการปฏิบัติราชการ งาน${defaultDivision} ${defaultMunicipality}`);
  const [lines, setLines] = useState<Array<{materialId: string; requestedQty: string}>>([
    {materialId: firstWithStock, requestedQty: '1'},
  ]);
  const [error, setError] = useState('');

  // Live sequential FIFO preview across all lines
  const previewState = useMemo(() => {
    const workingLots = structuredClone(lots);
    const results: Array<{
      index: number;
      material?: MaterialItem;
      error?: string;
      allocations?: ReturnType<typeof previewFifoAllocation>['allocations'];
      balanceBefore?: number;
      balanceAfter?: number;
      totalAmount?: number;
    }> = [];
    let grandAmount = 0;
    let hasError = false;

    lines.forEach((line, index) => {
      const mat = materials.find(m => m.id === line.materialId);
      const qty = Number(line.requestedQty);
      if (!mat) {
        hasError = true;
        results.push({index, error: 'กรุณาเลือกรายการวัสดุ'});
        return;
      }
      if (!Number.isFinite(qty) || qty <= 0) {
        hasError = true;
        results.push({index, material: mat, error: 'จำนวนขอเบิกต้องมากกว่า 0'});
        return;
      }
      try {
        const prev = previewFifoAllocation(workingLots, mat.id, qty);
        for (const alloc of prev.allocations) {
          const lot = workingLots.find(l => l.id === alloc.lotId)!;
          lot.reservedQty += alloc.allocatedQty;
        }
        grandAmount = round2(grandAmount + prev.totalAmount);
        results.push({
          index,
          material: mat,
          allocations: prev.allocations,
          balanceBefore: prev.balanceBefore,
          balanceAfter: prev.balanceAfter,
          totalAmount: prev.totalAmount,
        });
      } catch (err) {
        hasError = true;
        results.push({
          index,
          material: mat,
          error: err instanceof InsufficientStockError ? err.message : 'คำนวณ FIFO ไม่สำเร็จ',
        });
      }
    });

    return {results, grandAmount, hasError};
  }, [lines, lots, materials]);

  async function handleAction(printAfter: 'none' | 'pdf' | 'docx') {
    setError('');
    if (!requesterName.trim() || !requesterPosition.trim()) {
      setError('กรุณากรอกชื่อและตำแหน่งผู้เบิก');
      return;
    }
    if (previewState.hasError) {
      setError('กรุณาแก้ไขรายการวัสดุที่ยอดพร้อมเบิกไม่เพียงพอ');
      return;
    }
    try {
      await onSubmit(
        {
          requisitionRunningNo: runningNo.trim() || undefined,
          fiscalYearBE: Number(fiscalYearBE),
          requestDate,
          requesterName: requesterName.trim(),
          requesterPosition: requesterPosition.trim(),
          receiverName: receiverName.trim() || undefined,
          purpose: purpose.trim() || undefined,
          submitImmediately: true,
          lines: lines.map(l => ({
            materialId: l.materialId,
            requestedQty: Number(l.requestedQty),
          })),
        },
        printAfter,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'สร้างใบเบิกไม่สำเร็จ');
    }
  }

  return (
    <div className="inv-modal-backdrop" role="dialog" aria-modal="true" aria-label="สร้างใบเบิกวัสดุ (FIFO)">
      <div className="inv-modal">
        <div className="inv-modal-head">
          <h3>สร้างใบเบิกวัสดุ (INV-01 · ตัดล็อต FIFO อัตโนมัติ)</h3>
          <button type="button" className="inv-btn inv-btn-sm" onClick={onClose} disabled={busy}>ปิด</button>
        </div>

        {error && <div className="inv-banner inv-banner-err" role="alert">{error}</div>}

        <div className="inv-grid-3">
          <label className="inv-field">
            <span>ปีงบประมาณ พ.ศ.</span>
            <input type="number" value={fiscalYearBE} onChange={e => setFiscalYearBE(e.target.value)} />
          </label>
          <label className="inv-field">
            <span>เลขที่ใบเบิก (เว้นว่างรันอัตโนมัติ)</span>
            <input value={runningNo} onChange={e => setRunningNo(e.target.value)} placeholder="เช่น 01" />
          </label>
          <label className="inv-field">
            <span>วันที่เบิก</span>
            <input type="date" value={requestDate} onChange={e => setRequestDate(e.target.value)} />
          </label>
          <label className="inv-field">
            <span>ชื่อผู้เบิก</span>
            <input required value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="เช่น นางสาวณกัญญา ดีเบา" />
          </label>
          <label className="inv-field">
            <span>ตำแหน่งผู้เบิก</span>
            <input required value={requesterPosition} onChange={e => setRequesterPosition(e.target.value)} />
          </label>
          <label className="inv-field">
            <span>ผู้รับของ (ถ้ามี / รับแทน)</span>
            <input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="เว้นว่าง = ใช้ชื่อผู้เบิก" />
          </label>
          <label className="inv-field inv-wide">
            <span>วัตถุประสงค์การเบิก</span>
            <input value={purpose} onChange={e => setPurpose(e.target.value)} />
          </label>
        </div>

        <div style={{display: 'grid', gap: 8}}>
          <div className="inv-between">
            <strong style={{fontSize: 13.5}}>รายการวัสดุที่ขอเบิก (แสดงการแยกล็อต FIFO แบบเรียลไทม์)</strong>
            <button
              type="button"
              className="inv-btn inv-btn-sm"
              onClick={() => setLines(prev => [...prev, {materialId: firstWithStock, requestedQty: '1'}])}
            >
              + เพิ่มรายการ
            </button>
          </div>

          {lines.map((line, idx) => {
            const p = previewState.results[idx];
            return (
              <div key={idx} className="inv-card" style={{padding: 10, display: 'grid', gap: 6}}>
                <div className="inv-grid-3" style={{alignItems: 'end'}}>
                  <label className="inv-field" style={{gridColumn: 'span 2'}}>
                    <span>รายการวัสดุ #{idx + 1}</span>
                    <select
                      value={line.materialId}
                      onChange={e =>
                        setLines(prev => prev.map((v, i) => (i === idx ? {...v, materialId: e.target.value} : v)))
                      }
                    >
                      {availableMaterials.map(({material, totals}) => (
                        <option key={material.id} value={material.id}>
                          #{material.ledgerSeqNo} {material.name} — พร้อมเบิก {totals.availableQty} {material.unit} (คงเหลือจริง {totals.remainingQty})
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="inv-row" style={{alignItems: 'end'}}>
                    <label className="inv-field" style={{flex: 1}}>
                      <span>จำนวนขอเบิก</span>
                      <input
                        type="number"
                        min={0.01}
                        step="any"
                        value={line.requestedQty}
                        onChange={e =>
                          setLines(prev => prev.map((v, i) => (i === idx ? {...v, requestedQty: e.target.value} : v)))
                        }
                      />
                    </label>
                    {lines.length > 1 && (
                      <button
                        type="button"
                        className="inv-btn inv-btn-danger inv-btn-sm"
                        onClick={() => setLines(prev => prev.filter((_, i) => i !== idx))}
                      >
                        ลบ
                      </button>
                    )}
                  </div>
                </div>

                {p?.error ? (
                  <div className="inv-banner inv-banner-err" style={{padding: '6px 10px', fontSize: 12}}>{p.error}</div>
                ) : (
                  p?.allocations && (
                    <div className="inv-preview-split" data-testid={`fifo-preview-${idx}`}>
                      <div>
                        <b>พรีวิวตัดล็อต FIFO ({p.allocations.length} ล็อต)</b> · ยอดพร้อมเบิกก่อนจ่าย {p.balanceBefore} → หลังเบิกเหลือ{' '}
                        <b>{p.balanceAfter} {p.material?.unit}</b> · มูลค่า <b>{formatBaht(p.totalAmount ?? 0)}</b> บาท
                      </div>
                      {p.allocations.map((a, sIdx) => (
                        <div key={sIdx}>
                          • ล็อต {a.referenceDocNo || a.lotId}: จ่าย <b>{a.allocatedQty} {p.material?.unit}</b> @{' '}
                          {formatBaht(a.unitPrice)} บ. = {formatBaht(a.lineAmount)} บ. (คงเหลือหลังแถวนี้:{' '}
                          <b>{a.balanceAfterThisSplit}</b>)
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>

        <div className="inv-between" style={{borderTop: '1px solid #e5edea', paddingTop: 10}}>
          <div style={{fontSize: 13}}>
            มูลค่ารวมใบเบิกนี้: <b>{formatBaht(previewState.grandAmount)}</b> บาท
            <div style={{fontSize: 11.5, color: '#58716a'}}>
              ระบบจะจองยอดในคิว “รอเซ็นรับของจริง” โดยยังไม่ตัดสต็อกจริงจนกว่าจะยืนยันหลังเซ็นครบ 4 ลายเซ็น
            </div>
          </div>
          <div className="inv-row">
            <button type="button" className="inv-btn" disabled={busy} onClick={onClose}>ยกเลิก</button>
            <button
              type="button"
              className="inv-btn"
              disabled={busy || previewState.hasError}
              onClick={() => void handleAction('none')}
            >
              จองยอดรอลงนาม
            </button>
            <button
              type="button"
              className="inv-btn"
              disabled={busy || previewState.hasError}
              onClick={() => void handleAction('docx')}
            >
              จองยอด & โหลด Word
            </button>
            <button
              type="button"
              className="inv-btn inv-btn-primary"
              disabled={busy || previewState.hasError}
              onClick={() => void handleAction('pdf')}
            >
              {busy ? 'กำลังบันทึก…' : 'จองยอด & พิมพ์ใบเบิก (PDF)'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
