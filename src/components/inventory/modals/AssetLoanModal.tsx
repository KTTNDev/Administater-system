'use client';
import {useState} from 'react';
import type {AssetItem,AssetLoan} from '@/lib/inventory/types';
import {currentThaiFiscalYear,todayIso} from '../client-api';

interface Props {
  mode: 'create' | 'return';
  assets: readonly AssetItem[];
  activeLoanAssetIds: ReadonlySet<string>;
  loanToReturn?: AssetLoan | null;
  defaultDepartment: string;
  busy: boolean;
  onClose: () => void;
  onCreateLoan: (payload: Record<string, unknown>, printAfter: 'none' | 'pdf' | 'docx') => Promise<void>;
  onReturnLoan: (loanId: string, actualReturnDate: string, conditionAfter: string) => Promise<void>;
}

export function AssetLoanModal({
  mode,
  assets,
  activeLoanAssetIds,
  loanToReturn,
  defaultDepartment,
  busy,
  onClose,
  onCreateLoan,
  onReturnLoan,
}: Props) {
  const loanableAssets = assets.filter(a => a.condition === 'GOOD' && !activeLoanAssetIds.has(a.id));
  const [assetId, setAssetId] = useState(loanableAssets[0]?.id ?? '');
  const [fiscalYearBE, setFiscalYearBE] = useState(String(currentThaiFiscalYear()));
  const [borrowerName, setBorrowerName] = useState('');
  const [borrowerPosition, setBorrowerPosition] = useState('');
  const [borrowerDepartment, setBorrowerDepartment] = useState(defaultDepartment || 'กองสวัสดิการสังคม');
  const [purpose, setPurpose] = useState('');
  const [loanDate, setLoanDate] = useState(todayIso());
  const [dueReturnDate, setDueReturnDate] = useState(todayIso());
  const [conditionBefore, setConditionBefore] = useState('ปกติ ใช้งานได้');
  const [actualReturnDate, setActualReturnDate] = useState(todayIso());
  const [conditionAfter, setConditionAfter] = useState('ปกติ ใช้งานได้ครบถ้วน');
  const [error, setError] = useState('');

  async function submitCreate(printAfter: 'none' | 'pdf' | 'docx') {
    setError('');
    if (!assetId || !borrowerName.trim() || !borrowerPosition.trim() || !purpose.trim()) {
      setError('กรุณากรอกข้อมูลการยืมให้ครบถ้วน');
      return;
    }
    try {
      await onCreateLoan(
        {
          fiscalYearBE: Number(fiscalYearBE),
          assetId,
          borrowerName: borrowerName.trim(),
          borrowerPosition: borrowerPosition.trim(),
          borrowerDepartment: borrowerDepartment.trim() || defaultDepartment,
          purpose: purpose.trim(),
          loanDate,
          dueReturnDate,
          conditionBefore: conditionBefore.trim() || 'ปกติ ใช้งานได้',
          activateImmediately: true,
        },
        printAfter,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'บันทึกใบยืมครุภัณฑ์ไม่สำเร็จ');
    }
  }

  async function submitReturn(e: React.FormEvent) {
    e.preventDefault();
    if (!loanToReturn) return;
    setError('');
    try {
      await onReturnLoan(loanToReturn.id, actualReturnDate, conditionAfter.trim() || 'ปกติ ใช้งานได้');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'รับคืนครุภัณฑ์ไม่สำเร็จ');
    }
  }

  return (
    <div className="inv-modal-backdrop" role="dialog" aria-modal="true" aria-label={mode === 'create' ? 'สร้างใบยืมครุภัณฑ์' : 'รับคืนครุภัณฑ์'}>
      <div className="inv-modal">
        <div className="inv-modal-head">
          <h3>{mode === 'create' ? 'สร้างใบยืมครุภัณฑ์ (INV-03)' : `รับคืนครุภัณฑ์ · ยค. ${loanToReturn?.loanRunningNo}/${loanToReturn?.fiscalYearBE}`}</h3>
          <button type="button" className="inv-btn inv-btn-sm" onClick={onClose} disabled={busy}>ปิด</button>
        </div>

        {error && <div className="inv-banner inv-banner-err" role="alert">{error}</div>}

        {mode === 'create' ? (
          <div style={{display: 'grid', gap: 10}}>
            <label className="inv-field">
              <span>เลือกครุภัณฑ์พร้อมให้ยืม</span>
              <select value={assetId} onChange={e => setAssetId(e.target.value)} required>
                {loanableAssets.length === 0 && <option value="">ไม่มีครุภัณฑ์สถานะพร้อมให้ยืม</option>}
                {loanableAssets.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.assetCode} — {a.name} {a.brandModel ? `(${a.brandModel})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <div className="inv-grid-3">
              <label className="inv-field">
                <span>ปีงบประมาณ พ.ศ.</span>
                <input type="number" value={fiscalYearBE} onChange={e => setFiscalYearBE(e.target.value)} />
              </label>
              <label className="inv-field">
                <span>วันที่ยืม</span>
                <input type="date" value={loanDate} onChange={e => setLoanDate(e.target.value)} />
              </label>
              <label className="inv-field">
                <span>กำหนดส่งคืน</span>
                <input type="date" min={loanDate} value={dueReturnDate} onChange={e => setDueReturnDate(e.target.value)} />
              </label>
              <label className="inv-field">
                <span>ชื่อผู้ยืม</span>
                <input value={borrowerName} onChange={e => setBorrowerName(e.target.value)} placeholder="เช่น นายชัยวัฒน์ สิทธิโชค" />
              </label>
              <label className="inv-field">
                <span>ตำแหน่งผู้ยืม</span>
                <input value={borrowerPosition} onChange={e => setBorrowerPosition(e.target.value)} placeholder="เช่น ผู้ช่วยนักพัฒนาชุมชน" />
              </label>
              <label className="inv-field">
                <span>สังกัด / กอง</span>
                <input value={borrowerDepartment} onChange={e => setBorrowerDepartment(e.target.value)} />
              </label>
              <label className="inv-field inv-wide">
                <span>วัตถุประสงค์การยืม</span>
                <input value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="เช่น ใช้ลงพื้นที่สำรวจข้อมูล" />
              </label>
              <label className="inv-field inv-wide">
                <span>สภาพก่อนยืม</span>
                <input value={conditionBefore} onChange={e => setConditionBefore(e.target.value)} />
              </label>
            </div>
            <div className="inv-row" style={{justifyContent: 'flex-end'}}>
              <button type="button" className="inv-btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
              <button type="button" className="inv-btn" disabled={busy || !loanableAssets.length} onClick={() => void submitCreate('docx')}>
                บันทึก & โหลด INV-03 (Word)
              </button>
              <button type="button" className="inv-btn inv-btn-primary" disabled={busy || !loanableAssets.length} onClick={() => void submitCreate('pdf')}>
                {busy ? 'กำลังบันทึก…' : 'บันทึก & พิมพ์ INV-03 (PDF)'}
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submitReturn} style={{display: 'grid', gap: 10}}>
            <div className="inv-grid-2">
              <label className="inv-field">
                <span>วันที่ส่งคืนจริง</span>
                <input type="date" required value={actualReturnDate} onChange={e => setActualReturnDate(e.target.value)} />
              </label>
              <label className="inv-field">
                <span>สภาพหลังส่งคืน</span>
                <input required value={conditionAfter} onChange={e => setConditionAfter(e.target.value)} />
              </label>
            </div>
            <div className="inv-row" style={{justifyContent: 'flex-end'}}>
              <button type="button" className="inv-btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
              <button type="submit" className="inv-btn inv-btn-primary" disabled={busy}>
                {busy ? 'กำลังบันทึก…' : 'ยืนยันรับคืนครุภัณฑ์'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
