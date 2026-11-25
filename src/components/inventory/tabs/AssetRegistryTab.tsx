'use client';
import {useMemo, useState} from 'react';
import type {AssetCondition, AssetItem, AssetLoan, InventoryDomainState} from '@/lib/inventory/types';
import {formatBaht, todayIso} from '../client-api';

interface Props {
  state: InventoryDomainState;
  defaultLocation: string;
  busy: boolean;
  onSaveAsset: (asset: Record<string, unknown>) => Promise<void>;
  onDeleteAsset: (assetId: string) => Promise<void>;
  onOpenCreateLoan: () => void;
  onOpenReturnLoan: (loan: AssetLoan) => void;
  onExport: (format: 'pdf' | 'docx', payload: Record<string, unknown>, filename: string) => Promise<void>;
}

const CONDITION_LABEL: Record<AssetCondition, string> = {
  GOOD: 'ใช้งานได้',
  DAMAGED_REPAIRABLE: 'ชำรุดรอซ่อม',
  UNSERVICEABLE_DISPOSE: 'เสื่อมสภาพขอจำหน่าย',
  MISSING: 'สูญหาย',
};

const CONDITION_PILL: Record<AssetCondition, string> = {
  GOOD: 'inv-pill-ok',
  DAMAGED_REPAIRABLE: 'inv-pill-warn',
  UNSERVICEABLE_DISPOSE: 'inv-pill-danger',
  MISSING: 'inv-pill-danger',
};

function blankForm(defaultLocation: string) {
  return {
    id: '',
    assetCode: '',
    name: '',
    brandModel: '',
    acquiredDate: todayIso(),
    acquisitionCost: '0',
    assignedLocation: defaultLocation || 'กองสวัสดิการสังคม',
    custodianName: '',
    condition: 'GOOD' as AssetCondition,
    note: '',
  };
}

export function AssetRegistryTab({
  state,
  defaultLocation,
  busy,
  onSaveAsset,
  onDeleteAsset,
  onOpenCreateLoan,
  onOpenReturnLoan,
  onExport,
}: Props) {
  const [condFilter, setCondFilter] = useState<'ALL' | AssetCondition>('ALL');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ReturnType<typeof blankForm> | null>(null);
  const [formError, setFormError] = useState('');
  const today = todayIso();

  const assetById = useMemo(() => new Map(state.assets.map(a => [a.id, a])), [state.assets]);
  const activeLoans = useMemo(
    () => state.assetLoans.filter(l => l.status === 'ACTIVE_LOAN' || l.status === 'PENDING_SIGNATURE'),
    [state.assetLoans],
  );
  const activeLoanByAssetId = useMemo(() => new Map(activeLoans.map(l => [l.assetId, l])), [activeLoans]);
  const overdueLoans = useMemo(
    () => activeLoans.filter(l => l.status === 'ACTIVE_LOAN' && l.dueReturnDate < today),
    [activeLoans, today],
  );
  const returnedLoans = useMemo(
    () => state.assetLoans.filter(l => l.status === 'RETURNED' || l.status === 'CANCELLED'),
    [state.assetLoans],
  );

  const filteredAssets = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();
    return [...state.assets]
      .sort((a, b) => a.assetCode.localeCompare(b.assetCode))
      .filter(a => {
        if (condFilter !== 'ALL' && a.condition !== condFilter) return false;
        if (!q) return true;
        return [a.assetCode, a.name, a.brandModel, a.assignedLocation, a.custodianName, a.note]
          .join(' ')
          .toLocaleLowerCase()
          .includes(q);
      });
  }, [state.assets, condFilter, search]);

  async function submitAsset(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    setFormError('');
    const cost = Number(editing.acquisitionCost);
    if (!Number.isFinite(cost) || cost < 0) {
      setFormError('ราคาทุนต้องเป็นตัวเลขตั้งแต่ 0 ขึ้นไป');
      return;
    }
    try {
      await onSaveAsset({
        id: editing.id || undefined,
        assetCode: editing.assetCode.trim(),
        name: editing.name.trim(),
        brandModel: editing.brandModel.trim(),
        acquiredDate: editing.acquiredDate,
        acquisitionCost: cost,
        assignedLocation: editing.assignedLocation.trim() || defaultLocation,
        custodianName: editing.custodianName.trim(),
        condition: editing.condition,
        note: editing.note.trim(),
      });
      setEditing(null);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'บันทึกทะเบียนครุภัณฑ์ไม่สำเร็จ');
    }
  }

  function startEdit(asset?: AssetItem) {
    setFormError('');
    if (!asset) {
      setEditing(blankForm(defaultLocation));
      return;
    }
    setEditing({
      id: asset.id,
      assetCode: asset.assetCode,
      name: asset.name,
      brandModel: asset.brandModel,
      acquiredDate: asset.acquiredDate,
      acquisitionCost: String(asset.acquisitionCost),
      assignedLocation: asset.assignedLocation,
      custodianName: asset.custodianName,
      condition: asset.condition,
      note: asset.note,
    });
  }

  return (
    <div style={{display: 'grid', gap: 14}}>
      <div className="inv-grid-4">
        <div className="inv-stat-card">
          <span>ทะเบียนครุภัณฑ์ทั้งหมด</span>
          <strong>{state.assets.length} รายการ</strong>
        </div>
        <div className="inv-stat-card">
          <span>ใช้งานได้ปกติ</span>
          <strong>{state.assets.filter(a => a.condition === 'GOOD').length} รายการ</strong>
        </div>
        <div className="inv-stat-card">
          <span>อยู่ระหว่างการยืม</span>
          <strong>{activeLoans.length} ใบ</strong>
        </div>
        <div className="inv-stat-card">
          <span>เกินกำหนดคืน</span>
          <strong style={{color: overdueLoans.length > 0 ? '#a02026' : '#11463a'}}>{overdueLoans.length} ใบ</strong>
        </div>
      </div>

      {/* Action Bar */}
      <div className="inv-card inv-between">
        <div className="inv-row">
          <button type="button" className="inv-btn inv-btn-primary" disabled={busy} onClick={() => startEdit()}>
            + เพิ่มครุภัณฑ์
          </button>
          <button
            type="button"
            className="inv-btn inv-btn-primary"
            disabled={busy || state.assets.length === 0}
            onClick={onOpenCreateLoan}
          >
            + สร้างใบยืมครุภัณฑ์ (INV-03)
          </button>
        </div>
        <div className="inv-row">
          <select
            aria-label="กรองตามสภาพครุภัณฑ์"
            value={condFilter}
            onChange={e => setCondFilter(e.target.value as 'ALL' | AssetCondition)}
            style={{border: '1px solid #d3dfdb', borderRadius: 6, padding: '6px 9px', fontSize: 12.5, minHeight: 34}}
          >
            <option value="ALL">ทุกสภาพครุภัณฑ์</option>
            <option value="GOOD">ใช้งานได้</option>
            <option value="DAMAGED_REPAIRABLE">ชำรุดรอซ่อม</option>
            <option value="UNSERVICEABLE_DISPOSE">เสื่อมสภาพขอจำหน่าย</option>
            <option value="MISSING">สูญหาย</option>
          </select>
          <input
            type="search"
            aria-label="ค้นหาทะเบียนครุภัณฑ์"
            placeholder="ค้นเลขครุภัณฑ์ ชื่อ ยี่ห้อ หรือผู้รับผิดชอบ"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{border: '1px solid #d3dfdb', borderRadius: 6, padding: '6px 10px', fontSize: 12.5, minHeight: 34, width: 'min(240px, 100%)'}}
          />
        </div>
      </div>

      {/* Asset Add/Edit Form */}
      {editing && (
        <form className="inv-card" onSubmit={submitAsset} style={{display: 'grid', gap: 10}}>
          <div className="inv-between">
            <h3 style={{margin: 0}}>{editing.id ? 'แก้ไขข้อมูลครุภัณฑ์' : 'ขึ้นทะเบียนครุภัณฑ์ใหม่'}</h3>
            <button type="button" className="inv-btn inv-btn-sm" onClick={() => setEditing(null)}>
              ปิดฟอร์ม
            </button>
          </div>
          {formError && <div className="inv-banner inv-banner-err" role="alert">{formError}</div>}
          <div className="inv-grid-3">
            <label className="inv-field">
              <span>เลขครุภัณฑ์</span>
              <input
                required
                value={editing.assetCode}
                onChange={e => setEditing(v => v && {...v, assetCode: e.target.value})}
                placeholder="เช่น 7440-001-0001/68"
              />
            </label>
            <label className="inv-field">
              <span>ชื่อรายการครุภัณฑ์</span>
              <input
                required
                value={editing.name}
                onChange={e => setEditing(v => v && {...v, name: e.target.value})}
                placeholder="เช่น เครื่องคอมพิวเตอร์โน้ตบุ๊ก"
              />
            </label>
            <label className="inv-field">
              <span>ยี่ห้อ / รุ่น / หมายเลขเครื่อง</span>
              <input
                value={editing.brandModel}
                onChange={e => setEditing(v => v && {...v, brandModel: e.target.value})}
                placeholder="เช่น Lenovo ThinkPad"
              />
            </label>
            <label className="inv-field">
              <span>วันที่ได้มา</span>
              <input
                type="date"
                required
                value={editing.acquiredDate}
                onChange={e => setEditing(v => v && {...v, acquiredDate: e.target.value})}
              />
            </label>
            <label className="inv-field">
              <span>ราคาทุน (บาท)</span>
              <input
                type="number"
                min={0}
                step="0.01"
                required
                value={editing.acquisitionCost}
                onChange={e => setEditing(v => v && {...v, acquisitionCost: e.target.value})}
              />
            </label>
            <label className="inv-field">
              <span>สภาพครุภัณฑ์</span>
              <select
                value={editing.condition}
                onChange={e => setEditing(v => v && {...v, condition: e.target.value as AssetCondition})}
              >
                <option value="GOOD">ใช้งานได้</option>
                <option value="DAMAGED_REPAIRABLE">ชำรุดรอซ่อม</option>
                <option value="UNSERVICEABLE_DISPOSE">เสื่อมสภาพขอจำหน่าย</option>
                <option value="MISSING">สูญหาย</option>
              </select>
            </label>
            <label className="inv-field">
              <span>สถานที่ตั้ง / ใช้งาน</span>
              <input
                value={editing.assignedLocation}
                onChange={e => setEditing(v => v && {...v, assignedLocation: e.target.value})}
              />
            </label>
            <label className="inv-field">
              <span>ผู้รับผิดชอบดูแล</span>
              <input
                required
                value={editing.custodianName}
                onChange={e => setEditing(v => v && {...v, custodianName: e.target.value})}
                placeholder="เช่น นางสาวสมหญิง ใจดี"
              />
            </label>
            <label className="inv-field">
              <span>หมายเหตุ</span>
              <input value={editing.note} onChange={e => setEditing(v => v && {...v, note: e.target.value})} />
            </label>
          </div>
          <div className="inv-row" style={{justifyContent: 'flex-end'}}>
            <button type="button" className="inv-btn" onClick={() => setEditing(null)}>
              ยกเลิก
            </button>
            <button type="submit" className="inv-btn inv-btn-primary" disabled={busy}>
              {busy ? 'กำลังบันทึก…' : 'บันทึกทะเบียนครุภัณฑ์'}
            </button>
          </div>
        </form>
      )}

      {/* Active Loans & Overdue Alerts */}
      {activeLoans.length > 0 && (
        <section className={overdueLoans.length > 0 ? 'inv-pending-box' : 'inv-card'} aria-label="ใบยืมครุภัณฑ์ที่ยังไม่คืน">
          <div className="inv-between" style={{marginBottom: 6}}>
            <strong style={{fontSize: 14}}>รายการยืมครุภัณฑ์ที่อยู่ระหว่างใช้งาน ({activeLoans.length} ใบ)</strong>
            {overdueLoans.length > 0 && (
              <span className="inv-pill inv-pill-danger">เกินกำหนดคืน {overdueLoans.length} รายการ!</span>
            )}
          </div>
          <div style={{display: 'grid', gap: 8}}>
            {activeLoans.map(loan => {
              const asset = assetById.get(loan.assetId);
              const isOverdue = loan.status === 'ACTIVE_LOAN' && loan.dueReturnDate < today;
              return (
                <div key={loan.id} className="inv-pending-item" style={isOverdue ? {borderColor: '#df8589'} : undefined}>
                  <div className="inv-pending-meta">
                    <div className="inv-row">
                      <strong>
                        ยค. {loan.loanRunningNo}/{loan.fiscalYearBE}
                      </strong>
                      <span>
                        {asset?.assetCode ?? loan.assetId} — {asset?.name ?? ''}
                      </span>
                      {isOverdue ? (
                        <span className="inv-pill inv-pill-danger">เกินกำหนดคืน ({loan.dueReturnDate})</span>
                      ) : (
                        <span className="inv-pill inv-pill-info">กำหนดคืน {loan.dueReturnDate}</span>
                      )}
                    </div>
                    <div style={{fontSize: 12, color: '#456059'}}>
                      ผู้ยืม: <b>{loan.borrowerName}</b> ({loan.borrowerPosition} · {loan.borrowerDepartment}) · เหตุผล: {loan.purpose}
                    </div>
                  </div>
                  <div className="inv-row">
                    <button
                      type="button"
                      className="inv-btn inv-btn-sm"
                      disabled={busy}
                      onClick={() =>
                        void onExport('pdf', {kind: 'INV-03', loanId: loan.id}, `ใบยืมครุภัณฑ์-${loan.loanRunningNo}-${loan.fiscalYearBE}.pdf`)
                      }
                    >
                      พิมพ์ INV-03 (PDF)
                    </button>
                    <button
                      type="button"
                      className="inv-btn inv-btn-sm"
                      disabled={busy}
                      onClick={() =>
                        void onExport('docx', {kind: 'INV-03', loanId: loan.id}, `ใบยืมครุภัณฑ์-${loan.loanRunningNo}-${loan.fiscalYearBE}.docx`)
                      }
                    >
                      Word
                    </button>
                    <button
                      type="button"
                      className="inv-btn inv-btn-primary inv-btn-sm"
                      disabled={busy}
                      onClick={() => onOpenReturnLoan(loan)}
                    >
                      รับคืนครุภัณฑ์
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Asset Registry Table */}
      <section className="inv-card" aria-label="ตารางทะเบียนครุภัณฑ์ประจำกอง">
        <h3>ทะเบียนครุภัณฑ์ประจำกอง ({filteredAssets.length} รายการ)</h3>
        {filteredAssets.length === 0 ? (
          <p style={{color: '#5c736d', margin: '10px 0'}}>ยังไม่มีครุภัณฑ์ในทะเบียน กด “+ เพิ่มครุภัณฑ์” เพื่อลงทะเบียน</p>
        ) : (
          <div className="inv-table-wrap">
            <table className="inv-table-ui">
              <thead>
                <tr>
                  <th>เลขครุภัณฑ์</th>
                  <th>รายการ / ยี่ห้อ-รุ่น</th>
                  <th>วันที่ได้มา</th>
                  <th className="inv-num">ราคาทุน (บาท)</th>
                  <th>ผู้รับผิดชอบ / สถานที่</th>
                  <th className="inv-center">สภาพ</th>
                  <th className="inv-center">สถานะยืม</th>
                  <th className="inv-center">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssets.map(asset => {
                  const loan = activeLoanByAssetId.get(asset.id);
                  return (
                    <tr key={asset.id}>
                      <td>
                        <b>{asset.assetCode}</b>
                      </td>
                      <td>
                        <div>
                          <strong>{asset.name}</strong>
                        </div>
                        {asset.brandModel && <div style={{fontSize: 11.5, color: '#5c736d'}}>{asset.brandModel}</div>}
                      </td>
                      <td>{asset.acquiredDate}</td>
                      <td className="inv-num">{formatBaht(asset.acquisitionCost)}</td>
                      <td>
                        <div>{asset.custodianName}</div>
                        <div style={{fontSize: 11.5, color: '#5c736d'}}>{asset.assignedLocation}</div>
                      </td>
                      <td className="inv-center">
                        <span className={`inv-pill ${CONDITION_PILL[asset.condition]}`}>{CONDITION_LABEL[asset.condition]}</span>
                      </td>
                      <td className="inv-center">
                        {loan ? (
                          <span className={`inv-pill ${loan.dueReturnDate < today ? 'inv-pill-danger' : 'inv-pill-warn'}`}>
                            กำลังยืม ({loan.borrowerName})
                          </span>
                        ) : (
                          <span className="inv-pill inv-pill-muted">อยู่ในกอง</span>
                        )}
                      </td>
                      <td className="inv-center">
                        <div className="inv-row" style={{justifyContent: 'center'}}>
                          <button type="button" className="inv-btn inv-btn-sm" disabled={busy} onClick={() => startEdit(asset)}>
                            แก้ไข
                          </button>
                          <button
                            type="button"
                            className="inv-btn inv-btn-danger inv-btn-sm"
                            disabled={busy || Boolean(loan)}
                            onClick={() => {
                              if (confirm(`ยืนยันลบครุภัณฑ์ ${asset.assetCode} — ${asset.name}?`)) {
                                void onDeleteAsset(asset.id);
                              }
                            }}
                          >
                            ลบ
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {returnedLoans.length > 0 && (
        <details className="inv-card">
          <summary style={{cursor: 'pointer', fontWeight: 700, fontSize: 13.5, color: '#1a423a'}}>
            ประวัติการยืม-คืนครุภัณฑ์ที่ส่งคืนแล้ว ({returnedLoans.length} ใบ)
          </summary>
          <div className="inv-table-wrap" style={{marginTop: 10}}>
            <table className="inv-table-ui">
              <thead>
                <tr>
                  <th>เลขที่</th>
                  <th>ครุภัณฑ์</th>
                  <th>ผู้ยืม</th>
                  <th>วันที่ยืม → คืนจริง</th>
                  <th>สภาพหลังคืน</th>
                  <th className="inv-center">พิมพ์ซ้ำ</th>
                </tr>
              </thead>
              <tbody>
                {returnedLoans.map(loan => {
                  const asset = assetById.get(loan.assetId);
                  return (
                    <tr key={loan.id}>
                      <td>ยค. {loan.loanRunningNo}/{loan.fiscalYearBE}</td>
                      <td>{asset?.assetCode} {asset?.name}</td>
                      <td>{loan.borrowerName}</td>
                      <td>{loan.loanDate} → {loan.actualReturnDate ?? '-'}</td>
                      <td>{loan.conditionAfter ?? '-'}</td>
                      <td className="inv-center">
                        <div className="inv-row" style={{justifyContent: 'center'}}>
                          <button
                            type="button"
                            className="inv-btn inv-btn-sm"
                            disabled={busy}
                            onClick={() =>
                              void onExport('pdf', {kind: 'INV-03', loanId: loan.id}, `ใบยืมครุภัณฑ์-${loan.loanRunningNo}-${loan.fiscalYearBE}.pdf`)
                            }
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            className="inv-btn inv-btn-sm"
                            disabled={busy}
                            onClick={() =>
                              void onExport('docx', {kind: 'INV-03', loanId: loan.id}, `ใบยืมครุภัณฑ์-${loan.loanRunningNo}-${loan.fiscalYearBE}.docx`)
                            }
                          >
                            Word
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </div>
  );
}
