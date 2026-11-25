'use client';
import {useState} from 'react';
import {effectiveReceiverName} from '@/lib/inventory/fifo-engine';
import type {MaterialItem,Requisition} from '@/lib/inventory/types';
import {formatBaht,todayIso,uploadSignedScan} from '../client-api';

interface Props {
  requisition: Requisition;
  materials: readonly MaterialItem[];
  busy: boolean;
  onClose: () => void;
  onConfirmCommit: (committedDate: string, signedScanAttachmentPath?: string) => Promise<void>;
}

export function CommitSignatureModal({requisition, materials, busy, onClose, onConfirmCommit}: Props) {
  const [committedDate, setCommittedDate] = useState(requisition.requestDate || todayIso());
  const [uploading, setUploading] = useState(false);
  const [scanPath, setScanPath] = useState(requisition.signedScanAttachmentPath ?? '');
  const [scanName, setScanName] = useState('');
  const [error, setError] = useState('');

  const byId = new Map(materials.map(m => [m.id, m]));

  async function handleFile(file?: File) {
    if (!file) return;
    setUploading(true);
    setError('');
    try {
      const res = await uploadSignedScan(file);
      setScanPath(res.path);
      setScanName(`${res.name} (${res.pages} หน้า)`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'อัปโหลดไฟล์ไม่สำเร็จ');
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await onConfirmCommit(committedDate, scanPath || undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ยืนยันตัดสต๊อกไม่สำเร็จ');
    }
  }

  return (
    <div className="inv-modal-backdrop" role="dialog" aria-modal="true" aria-label="ยืนยันตัดสต๊อกหลังลงนาม">
      <form className="inv-modal" onSubmit={submit}>
        <div className="inv-modal-head">
          <h3>ยืนยันตัดสต๊อก — ใบเบิก {requisition.requisitionRunningNo}/{requisition.fiscalYearBE}</h3>
          <button type="button" className="inv-btn inv-btn-sm" onClick={onClose} disabled={busy || uploading}>ปิด</button>
        </div>

        {error && <div className="inv-banner inv-banner-err" role="alert">{error}</div>}

        <div className="inv-card" style={{background: '#f8fbf9', display: 'grid', gap: 4, fontSize: 13}}>
          <div><b>ผู้เบิก:</b> {requisition.requesterName} ({requisition.requesterPosition})</div>
          <div><b>ผู้รับของ:</b> {effectiveReceiverName(requisition)}</div>
          <div><b>รายการที่จะตัดจ่ายลงบัญชีวัสดุถาวร (ค่าวัสดุใช้ไป):</b></div>
          {requisition.lines.map(line => {
            const mat = byId.get(line.materialId);
            return (
              <div key={line.id} style={{paddingLeft: 10}}>
                • {mat?.name ?? line.materialId} — รวม <b>{line.approvedQty} {mat?.unit ?? ''}</b>
                {line.allocations.map((a, idx) => (
                  <div key={idx} style={{paddingLeft: 14, fontSize: 12, color: '#47635c'}}>
                    ล็อต {a.referenceDocNo || a.lotId}: {a.allocatedQty} @ {formatBaht(a.unitPrice)} บ. = {formatBaht(a.lineAmount)} บ.
                  </div>
                ))}
              </div>
            );
          })}
        </div>

        <div className="inv-grid-2">
          <label className="inv-field">
            <span>วันที่เซ็นรับของ / ลงบัญชีวัสดุ</span>
            <input type="date" required value={committedDate} onChange={e => setCommittedDate(e.target.value)} />
          </label>
          <label className="inv-field">
            <span>แนบภาพ/PDF ใบเบิกที่เซ็นครบแล้ว (ไม่บังคับ)</span>
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              disabled={uploading || busy}
              onChange={e => {
                void handleFile(e.currentTarget.files?.[0]);
                e.currentTarget.value = '';
              }}
            />
            {scanName && <small style={{color: '#0b664b'}}>แนบแล้ว: {scanName}</small>}
          </label>
        </div>

        <div className="inv-between">
          <small style={{color: '#8c4f04'}}>
            เมื่อกดยืนยันแล้ว รายการจะถูกบันทึกลงบัญชีวัสดุ (INV-02) อย่างถาวรและไม่สามารถแก้ไขย้อนหลังได้
          </small>
          <div className="inv-row">
            <button type="button" className="inv-btn" onClick={onClose} disabled={busy || uploading}>ยกเลิก</button>
            <button type="submit" className="inv-btn inv-btn-primary" disabled={busy || uploading}>
              {busy ? 'กำลังตัดสต๊อก…' : 'ยืนยันตัดสต๊อกและลงบัญชีวัสดุ'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
