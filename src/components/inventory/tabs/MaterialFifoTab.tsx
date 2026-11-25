'use client';
import {useMemo, useState} from 'react';
import {MATERIAL_CATEGORIES} from '@/lib/inventory/catalog/standard-units';
import {availableQty, effectiveReceiverName, getMaterialStockTotals, round2, sortLotsFifo} from '@/lib/inventory/fifo-engine';
import {buildStockCard} from '@/lib/inventory/reports';
import type {InventoryDomainState, Requisition} from '@/lib/inventory/types';
import {currentThaiFiscalYear, formatBaht} from '../client-api';

interface Props {
  state: InventoryDomainState;
  busy: boolean;
  onOpenIntake: () => void;
  onOpenRequisition: () => void;
  onOpenCommit: (req: Requisition) => void;
  onCancelRequisition: (req: Requisition) => Promise<void>;
  onExport: (format: 'pdf' | 'docx', payload: Record<string, unknown>, filename: string) => Promise<void>;
}

export function MaterialFifoTab({
  state,
  busy,
  onOpenIntake,
  onOpenRequisition,
  onOpenCommit,
  onCancelRequisition,
  onExport,
}: Props) {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  const [stockCardFy, setStockCardFy] = useState<number>(currentThaiFiscalYear());

  const materialById = useMemo(() => new Map(state.materials.map(m => [m.id, m])), [state.materials]);

  const pendingRequisitions = useMemo(
    () =>
      state.requisitions
        .filter(r => r.status === 'PENDING_SIGNATURE')
        .sort((a, b) => b.requestDate.localeCompare(a.requestDate) || b.requisitionRunningNo.localeCompare(a.requisitionRunningNo)),
    [state.requisitions],
  );

  const historyRequisitions = useMemo(
    () =>
      state.requisitions
        .filter(r => r.status === 'COMMITTED' || r.status === 'CANCELLED')
        .sort((a, b) => (b.committedDate ?? b.requestDate).localeCompare(a.committedDate ?? a.requestDate)),
    [state.requisitions],
  );

  const enrichedMaterials = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return [...state.materials]
      .sort((a, b) => a.ledgerSeqNo - b.ledgerSeqNo)
      .map(material => {
        const totals = getMaterialStockTotals(state.lots, material.id);
        const activeLots = sortLotsFifo(
          state.lots.filter(l => l.materialId === material.id && l.remainingQty > 0),
        );
        const currentLot = activeLots.find(l => availableQty(l) > 0) ?? activeLots[0] ?? null;
        const status: 'OUT' | 'LOW' | 'OK' =
          totals.availableQty <= 0 ? 'OUT' : totals.remainingQty <= material.minStockQty ? 'LOW' : 'OK';
        return {material, totals, activeLots, currentLot, status};
      })
      .filter(row => {
        if (categoryFilter !== 'ALL' && row.material.categoryCode !== categoryFilter) return false;
        if (!q) return true;
        return [
          String(row.material.ledgerSeqNo),
          row.material.code,
          row.material.name,
          row.material.specification,
          row.material.categoryCode,
          row.material.categoryType,
          row.material.storageLocation,
        ]
          .join(' ')
          .toLocaleLowerCase()
          .includes(q);
      });
  }, [state.materials, state.lots, categoryFilter, search]);

  const kpis = useMemo(() => {
    let totalValue = 0;
    let lowCount = 0;
    for (const m of state.materials) {
      const t = getMaterialStockTotals(state.lots, m.id);
      totalValue = round2(totalValue + t.totalValue);
      if (t.remainingQty <= m.minStockQty) lowCount += 1;
    }
    return {
      totalMaterials: state.materials.length,
      totalValue,
      pendingCount: pendingRequisitions.length,
      lowCount,
    };
  }, [state.materials, state.lots, pendingRequisitions.length]);

  const selectedCard = useMemo(() => {
    if (!selectedMaterialId || !materialById.has(selectedMaterialId)) return null;
    return buildStockCard(state, selectedMaterialId, stockCardFy);
  }, [state, selectedMaterialId, stockCardFy, materialById]);

  const availableFiscalYears = useMemo(() => {
    const set = new Set<number>([currentThaiFiscalYear()]);
    for (const l of state.lots) set.add(l.fiscalYearBE);
    for (const e of state.ledger) set.add(e.fiscalYearBE);
    return [...set].sort((a, b) => b - a);
  }, [state.lots, state.ledger]);

  return (
    <div style={{display: 'grid', gap: 14}}>
      {/* KPI strip */}
      <div className="inv-grid-4">
        <div className="inv-stat-card">
          <span>รายการวัสดุในคลัง</span>
          <strong>{kpis.totalMaterials} รายการ</strong>
        </div>
        <div className="inv-stat-card">
          <span>มูลค่าคงเหลือจริง (FIFO)</span>
          <strong>{formatBaht(kpis.totalValue)} บ.</strong>
        </div>
        <div className="inv-stat-card">
          <span>รอเซ็นรับของจริง (INV-01)</span>
          <strong style={{color: kpis.pendingCount > 0 ? '#925406' : '#11463a'}}>{kpis.pendingCount} ใบ</strong>
        </div>
        <div className="inv-stat-card">
          <span>ต่ำกว่าอย่างต่ำ / หมด</span>
          <strong style={{color: kpis.lowCount > 0 ? '#a02026' : '#11463a'}}>{kpis.lowCount} รายการ</strong>
        </div>
      </div>

      {/* Action Bar */}
      <div className="inv-card inv-between">
        <div className="inv-row">
          <button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={onOpenIntake}>
            + รับวัสดุเข้าคลัง
          </button>
          <button
            type="button"
            className="inv-btn inv-btn-primary"
            disabled={busy || state.materials.length === 0}
            title={state.materials.length === 0 ? 'กรุณารับวัสดุเข้าคลังก่อนสร้างใบเบิก' : ''}
            onClick={onOpenRequisition}
          >
            + สร้างใบเบิกวัสดุ (FIFO)
          </button>
        </div>
        <div className="inv-row">
          <select
            aria-label="กรองตามหมวดวัสดุ 18 หมวด"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            style={{border: '1px solid #d3dfdb', borderRadius: 6, padding: '6px 9px', fontSize: 12.5, minHeight: 34}}
          >
            <option value="ALL">ทุกหมวดวัสดุ (18 หมวด)</option>
            {MATERIAL_CATEGORIES.map(c => (
              <option key={c.code} value={c.code}>
                {c.code} · {c.categoryName}
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="ค้นหาวัสดุในคลัง FIFO"
            placeholder="ค้นชื่อวัสดุ รหัส ขนาด หรือลำดับทะเบียน"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{border: '1px solid #d3dfdb', borderRadius: 6, padding: '6px 10px', fontSize: 12.5, minHeight: 34, width: 'min(240px, 100%)'}}
          />
        </div>
      </div>

      {/* Pending Physical Signatures Queue */}
      {pendingRequisitions.length > 0 && (
        <section className="inv-pending-box" aria-label="คิวใบเบิกรอเซ็นรับของจริง">
          <div className="inv-between">
            <div className="inv-row">
              <strong style={{color: '#7a4503', fontSize: 14.5}}>
                คิวใบเบิกวัสดุรอเซ็นรับของจริง (Pending Physical Signatures)
              </strong>
              <span className="inv-pill inv-pill-warn">รอเซ็นรับของจริง ({pendingRequisitions.length})</span>
            </div>
            <small style={{color: '#7e551f'}}>
              ยอดถูกจองกันเบิกซ้ำไว้แล้ว — สต๊อกจริงและบัญชีวัสดุ (INV-02) จะตัดเมื่อกด “ยืนยันตัดสต๊อก (เซ็นรับแล้ว)”
            </small>
          </div>

          {pendingRequisitions.map(req => {
            const receiver = effectiveReceiverName(req);
            const totalValue = round2(
              req.lines.reduce((sum, line) => sum + line.allocations.reduce((s, a) => s + a.lineAmount, 0), 0),
            );
            return (
              <div key={req.id} className="inv-pending-item" data-testid={`pending-req-${req.id}`}>
                <div className="inv-pending-meta">
                  <div className="inv-row">
                    <strong>
                      ใบเบิกเลขที่ {req.requisitionRunningNo}/{req.fiscalYearBE}
                    </strong>
                    <span className="inv-pill inv-pill-warn">รอเซ็นรับของจริง</span>
                    <span style={{color: '#556e67'}}>วันที่เบิก {req.requestDate}</span>
                    <span style={{color: '#134e41'}}>มูลค่า <b>{formatBaht(totalValue)}</b> บ.</span>
                  </div>
                  <div style={{color: '#34524b'}}>
                    ผู้เบิก: <b>{req.requesterName}</b> ({req.requesterPosition})
                    {receiver !== req.requesterName && (
                      <>
                        {' '}· ผู้รับของแทน: <b>{receiver}</b>
                      </>
                    )}
                  </div>
                  <div style={{fontSize: 12, color: '#4d6861'}}>
                    {req.lines.map(line => {
                      const mat = materialById.get(line.materialId);
                      return (
                        <div key={line.id}>
                          • {mat?.name ?? line.materialId}: <b>{line.approvedQty} {mat?.unit ?? ''}</b>{' '}
                          ({line.allocations.map(a => `${a.allocatedQty}@${formatBaht(a.unitPrice)}`).join(' + ')})
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="inv-row">
                  <button
                    type="button"
                    className="inv-btn inv-btn-sm"
                    disabled={busy}
                    onClick={() =>
                      void onExport(
                        'pdf',
                        {kind: 'INV-01', requisitionId: req.id},
                        `ใบเบิกวัสดุ-${req.requisitionRunningNo}-${req.fiscalYearBE}.pdf`,
                      )
                    }
                  >
                    พิมพ์ใบเบิก (PDF)
                  </button>
                  <button
                    type="button"
                    className="inv-btn inv-btn-sm"
                    disabled={busy}
                    onClick={() =>
                      void onExport(
                        'docx',
                        {kind: 'INV-01', requisitionId: req.id},
                        `ใบเบิกวัสดุ-${req.requisitionRunningNo}-${req.fiscalYearBE}.docx`,
                      )
                    }
                  >
                    Word (.docx)
                  </button>
                  <button
                    type="button"
                    className="inv-btn inv-btn-primary inv-btn-sm"
                    disabled={busy}
                    onClick={() => onOpenCommit(req)}
                  >
                    ยืนยันตัดสต๊อก (เซ็นรับแล้ว)
                  </button>
                  <button
                    type="button"
                    className="inv-btn inv-btn-danger inv-btn-sm"
                    disabled={busy}
                    onClick={() => void onCancelRequisition(req)}
                  >
                    ยกเลิกและคืนยอดจอง
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      {/* Live Material Inventory Table */}
      <section className="inv-card" aria-label="ตารางคงเหลือวัสดุ FIFO">
        <div className="inv-between" style={{marginBottom: 8}}>
          <h3 style={{margin: 0}}>ทะเบียนคงเหลือวัสดุแบบแยก Lot ราคา (FIFO)</h3>
          <small style={{color: '#5a726c'}}>
            แสดง {enrichedMaterials.length} จาก {state.materials.length} รายการ (เรียงตามลำดับทะเบียนบัญชีวัสดุ)
          </small>
        </div>

        {enrichedMaterials.length === 0 ? (
          <div style={{padding: '24px 12px', textAlign: 'center', color: '#58716b'}}>
            {state.materials.length === 0 ? (
              <>
                <p style={{margin: '0 0 10px'}}>ยังไม่มีรายการวัสดุในคลัง FIFO เริ่มต้นโดยดึงจากงานจัดซื้อที่ตรวจรับแล้ว หรือตั้งยอดยกมา</p>
                <button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={onOpenIntake}>
                  + รับวัสดุเข้าคลังรายการแรก
                </button>
              </>
            ) : (
              <p style={{margin: 0}}>ไม่พบรายการวัสดุที่ตรงกับคำค้นหาหรือหมวดหมู่ที่เลือก</p>
            )}
          </div>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table-ui">
              <thead>
                <tr>
                  <th className="inv-center">ลำดับทะเบียน</th>
                  <th>ชื่อวัสดุ &amp; ขนาด</th>
                  <th>หมวด</th>
                  <th className="inv-num">คงเหลือจริง</th>
                  <th className="inv-num">จองรอเซ็น</th>
                  <th className="inv-num">พร้อมเบิก</th>
                  <th>Lot ปัจจุบัน (ราคา)</th>
                  <th className="inv-center">สถานะ</th>
                  <th className="inv-center">บัญชีวัสดุ</th>
                </tr>
              </thead>
              <tbody>
                {enrichedMaterials.map(({material, totals, activeLots, currentLot, status}) => (
                  <tr key={material.id} data-testid={`material-row-${material.id}`}>
                    <td className="inv-center">
                      <b>#{material.ledgerSeqNo}</b>
                    </td>
                    <td>
                      <div>
                        <strong>{material.name}</strong>
                        {material.code && <span style={{color: '#5c746d', marginLeft: 6}}>({material.code})</span>}
                      </div>
                      {(material.specification || material.storageLocation) && (
                        <div style={{fontSize: 11.5, color: '#5b726c'}}>
                          {material.specification ? `${material.specification} · ` : ''}
                          ที่เก็บ: {material.storageLocation}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="inv-pill inv-pill-muted">
                        {material.categoryCode} · {material.categoryType}
                      </span>
                    </td>
                    <td className="inv-num" data-testid={`mat-remaining-${material.id}`}>
                      <b>{totals.remainingQty}</b> {material.unit}
                    </td>
                    <td
                      className="inv-num"
                      data-testid={`mat-reserved-${material.id}`}
                      style={{color: totals.reservedQty > 0 ? '#925406' : '#6b807a', fontWeight: totals.reservedQty > 0 ? 700 : 400}}
                    >
                      {totals.reservedQty} {material.unit}
                    </td>
                    <td className="inv-num" data-testid={`mat-available-${material.id}`}>
                      <b style={{color: totals.availableQty > 0 ? '#0b664b' : '#a02026'}}>{totals.availableQty}</b> {material.unit}
                    </td>
                    <td>
                      {currentLot ? (
                        <div style={{fontSize: 12}}>
                          <b>{formatBaht(currentLot.unitPrice)} บ.</b>{' '}
                          <span style={{color: '#576f68'}}>
                            (เหลือ {currentLot.remainingQty} {material.unit})
                          </span>
                          {activeLots.length > 1 && (
                            <div style={{fontSize: 11, color: '#1d4f82'}}>
                              +{activeLots.length - 1} ล็อตถัดไป ({activeLots.map(l => `${l.remainingQty}@${formatBaht(l.unitPrice)}`).join(', ')})
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{color: '#7a8c87'}}>—</span>
                      )}
                    </td>
                    <td className="inv-center">
                      {status === 'OUT' ? (
                        <span className="inv-pill inv-pill-danger">หมด</span>
                      ) : status === 'LOW' ? (
                        <span className="inv-pill inv-pill-warn">ต่ำกว่าอย่างต่ำ</span>
                      ) : (
                        <span className="inv-pill inv-pill-ok">ปกติ</span>
                      )}
                    </td>
                    <td className="inv-center">
                      <button
                        type="button"
                        className="inv-btn inv-btn-sm"
                        aria-pressed={selectedMaterialId === material.id}
                        onClick={() => {
                          setSelectedMaterialId(prev => (prev === material.id ? null : material.id));
                          const latestFy = state.ledger
                            .filter(e => e.materialId === material.id)
                            .reduce((max, e) => Math.max(max, e.fiscalYearBE), currentThaiFiscalYear());
                          setStockCardFy(latestFy);
                        }}
                      >
                        ดูบัญชีวัสดุ (INV-02)
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Inline Stock Card Viewer (INV-02) */}
      {selectedCard && (
        <section className="inv-card" aria-label="บัญชีวัสดุ (INV-02)">
          <div className="inv-between" style={{marginBottom: 10}}>
            <div>
              <h3 style={{margin: 0}}>
                บัญชีวัสดุ (INV-02) — ลำดับที่ {selectedCard.material.ledgerSeqNo}: {selectedCard.material.name}
              </h3>
              <div style={{fontSize: 12, color: '#516a63', marginTop: 2}}>
                ประเภท: {selectedCard.material.categoryType} · รหัส: {selectedCard.material.code || '-'} · ขนาด/ลักษณะ:{' '}
                {selectedCard.material.specification || '-'} · หน่วย: {selectedCard.material.unit} · ที่เก็บ:{' '}
                {selectedCard.material.storageLocation} · อย่างต่ำ: {selectedCard.material.minStockQty} · อย่างสูง:{' '}
                {selectedCard.material.maxStockQty ?? '-'}
              </div>
            </div>
            <div className="inv-row">
              <select
                aria-label="ปีงบประมาณบัญชีวัสดุ"
                value={stockCardFy}
                onChange={e => setStockCardFy(Number(e.target.value))}
                style={{border: '1px solid #d3dfdb', borderRadius: 6, padding: '5px 8px', fontSize: 12.5}}
              >
                {availableFiscalYears.map(y => (
                  <option key={y} value={y}>
                    ปีงบ {y}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="inv-btn inv-btn-primary inv-btn-sm"
                disabled={busy}
                onClick={() =>
                  void onExport(
                    'pdf',
                    {kind: 'INV-02', fiscalYearBE: stockCardFy, materialId: selectedCard.material.id},
                    `บัญชีวัสดุ-${selectedCard.material.ledgerSeqNo}-${stockCardFy}.pdf`,
                  )
                }
              >
                ดาวน์โหลด INV-02 (PDF)
              </button>
              <button
                type="button"
                className="inv-btn inv-btn-sm"
                disabled={busy}
                onClick={() =>
                  void onExport(
                    'docx',
                    {kind: 'INV-02', fiscalYearBE: stockCardFy, materialId: selectedCard.material.id},
                    `บัญชีวัสดุ-${selectedCard.material.ledgerSeqNo}-${stockCardFy}.docx`,
                  )
                }
              >
                Word (.docx)
              </button>
              <button type="button" className="inv-btn inv-btn-sm" onClick={() => setSelectedMaterialId(null)}>
                ปิด
              </button>
            </div>
          </div>

          <div className="inv-table-wrap">
            <table className="inv-table-ui">
              <thead>
                <tr>
                  <th>วัน เดือน ปี</th>
                  <th>รับจาก/จ่ายให้</th>
                  <th>เลขที่เอกสาร</th>
                  <th className="inv-num">ราคาต่อหน่วย</th>
                  <th className="inv-num">รับ</th>
                  <th className="inv-num">จ่าย</th>
                  <th className="inv-num">คงเหลือ</th>
                  <th>หมายเหตุ</th>
                </tr>
              </thead>
              <tbody>
                {selectedCard.entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="inv-center" style={{color: '#6b807a', padding: 16}}>
                      ยังไม่มีรายการเคลื่อนไหวในปีงบประมาณ {stockCardFy}
                    </td>
                  </tr>
                ) : (
                  selectedCard.entries.map(entry => (
                    <tr key={entry.id}>
                      <td>{entry.entryDate}</td>
                      <td>{entry.partyDescription}</td>
                      <td>{entry.docNo || '-'}</td>
                      <td className="inv-num">{formatBaht(entry.unitPrice)}</td>
                      <td className="inv-num" style={{color: entry.inQty > 0 ? '#0b664b' : '#8aa09a'}}>
                        {entry.inQty > 0 ? entry.inQty : ''}
                      </td>
                      <td className="inv-num" style={{color: entry.outQty > 0 ? '#9b2328' : '#8aa09a'}}>
                        {entry.outQty > 0 ? entry.outQty : ''}
                      </td>
                      <td className="inv-num">
                        <b>{entry.balanceQty}</b>
                      </td>
                      <td>
                        <span className={`inv-pill ${entry.inQty > 0 ? 'inv-pill-info' : 'inv-pill-muted'}`}>
                          {entry.accountingNote}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div style={{marginTop: 8, fontSize: 12.5, color: '#39564f'}} className="inv-between">
            <span>
              ยอดยกมา: <b>{selectedCard.openingQty}</b> ({formatBaht(selectedCard.openingAmount)} บ.) · รับระหว่างปี:{' '}
              <b>{selectedCard.totalInQty}</b> ({formatBaht(selectedCard.totalInAmount)} บ.) · จ่ายระหว่างปี:{' '}
              <b>{selectedCard.totalOutQty}</b> ({formatBaht(selectedCard.totalOutAmount)} บ.)
            </span>
            <span>
              คงเหลือสิ้นงวด: <b>{selectedCard.closingQty} {selectedCard.material.unit}</b> (
              <b>{formatBaht(selectedCard.closingAmount)}</b> บาท)
            </span>
          </div>
        </section>
      )}

      {/* Historical Requisitions */}
      {historyRequisitions.length > 0 && (
        <details className="inv-card">
          <summary style={{cursor: 'pointer', fontWeight: 700, fontSize: 13.5, color: '#1a423a'}}>
            ประวัติใบเบิกวัสดุที่ดำเนินการแล้ว ({historyRequisitions.length} ใบ)
          </summary>
          <div className="inv-table-wrap" style={{marginTop: 10}}>
            <table className="inv-table-ui">
              <thead>
                <tr>
                  <th>เลขที่ใบเบิก</th>
                  <th>วันที่เบิก / ตัดสต๊อก</th>
                  <th>ผู้เบิก / ผู้รับของ</th>
                  <th>สถานะ</th>
                  <th>เอกสารแนบ</th>
                  <th className="inv-center">พิมพ์ซ้ำ</th>
                </tr>
              </thead>
              <tbody>
                {historyRequisitions.map(req => (
                  <tr key={req.id}>
                    <td>
                      <b>
                        {req.requisitionRunningNo}/{req.fiscalYearBE}
                      </b>
                    </td>
                    <td>
                      {req.requestDate}
                      {req.committedDate ? ` → ${req.committedDate}` : ''}
                    </td>
                    <td>
                      {req.requesterName}
                      {effectiveReceiverName(req) !== req.requesterName && ` (รับแทน: ${effectiveReceiverName(req)})`}
                    </td>
                    <td>
                      <span className={`inv-pill ${req.status === 'COMMITTED' ? 'inv-pill-ok' : 'inv-pill-muted'}`}>
                        {req.status === 'COMMITTED' ? 'ตัดสต๊อกแล้ว ✓' : 'ยกเลิก'}
                      </span>
                    </td>
                    <td>
                      {req.signedScanAttachmentPath ? (
                        <a href={req.signedScanAttachmentPath} target="_blank" rel="noreferrer">
                          เปิดใบลงนาม
                        </a>
                      ) : (
                        <span style={{color: '#7a8e88'}}>—</span>
                      )}
                    </td>
                    <td className="inv-center">
                      <div className="inv-row" style={{justifyContent: 'center'}}>
                        <button
                          type="button"
                          className="inv-btn inv-btn-sm"
                          disabled={busy}
                          onClick={() =>
                            void onExport(
                              'pdf',
                              {kind: 'INV-01', requisitionId: req.id},
                              `ใบเบิกวัสดุ-${req.requisitionRunningNo}-${req.fiscalYearBE}.pdf`,
                            )
                          }
                        >
                          PDF
                        </button>
                        <button
                          type="button"
                          className="inv-btn inv-btn-sm"
                          disabled={busy}
                          onClick={() =>
                            void onExport(
                              'docx',
                              {kind: 'INV-01', requisitionId: req.id},
                              `ใบเบิกวัสดุ-${req.requisitionRunningNo}-${req.fiscalYearBE}.docx`,
                            )
                          }
                        >
                          Word
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
