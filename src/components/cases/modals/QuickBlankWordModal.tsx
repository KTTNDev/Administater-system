'use client';
import {useState} from 'react';
import {Download, FileText, X} from 'lucide-react';
import {DOC_TYPE_THAI_NAMES} from '@/lib/cases/resolver';
import type {CaseDocType, MemoApprovalChain} from '@/lib/cases/types';
import {currentFiscalYearBE, downloadCaseExport} from '../client-api';

const DOC_OPTIONS: {value: CaseDocType; label: string; desc: string}[] = [
  {value: 'INTERNAL_MEMO', label: DOC_TYPE_THAI_NAMES.INTERNAL_MEMO, desc: 'ครุฑ 1.5 ซม. พร้อมช่องลงนามตามลำดับขั้น'},
  {value: 'EXTERNAL_LETTER', label: DOC_TYPE_THAI_NAMES.EXTERNAL_LETTER, desc: 'ครุฑ 3 ซม. เลขที่ ภก ๕๒๘๐๖ พร้อมที่อยู่และโทร'},
  {value: 'MUNICIPAL_ORDER', label: DOC_TYPE_THAI_NAMES.MUNICIPAL_ORDER, desc: 'ครุฑ 3 ซม. รายชื่อคณะกรรมการและแถบเสนอเซ็น'},
  {value: 'ANNOUNCEMENT', label: DOC_TYPE_THAI_NAMES.ANNOUNCEMENT, desc: 'ครุฑ 3 ซม. ไม่พิมพ์เลขบนกระดาษตามระเบียบ'},
  {value: 'CERTIFICATE_OR_INVITATION', label: DOC_TYPE_THAI_NAMES.CERTIFICATE_OR_INVITATION, desc: 'หนังสือรับรองหรือหนังสือเชิญวิทยากร/ประชุม'},
  {value: 'PROJECT_PROPOSAL_OR_ATTACHMENT', label: DOC_TYPE_THAI_NAMES.PROJECT_PROPOSAL_OR_ATTACHMENT, desc: 'โครงร่างโครงการและตารางงบประมาณ'},
  {value: 'PHOTO_SHEET', label: DOC_TYPE_THAI_NAMES.PHOTO_SHEET, desc: 'แบบฟอร์มหน้าภาพถ่ายกิจกรรม 2 รูป/หน้า'},
];

interface Props {
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export function QuickBlankWordModal({onClose, onSuccess}: Props) {
  const [docType, setDocType] = useState<CaseDocType>('EXTERNAL_LETTER');
  const [title, setTitle] = useState('');
  const [approvalChain, setApprovalChain] = useState<MemoApprovalChain>('3_TIER');
  const [variant, setVariant] = useState<'INVITATION' | 'CERTIFICATE'>('INVITATION');
  const [highlightBlanks, setHighlightBlanks] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    setBusy(true);
    setError('');
    try {
      const res = await downloadCaseExport(
        '/api/cases/export/blank-word',
        {
          mode: 'blank',
          docType,
          title: title.trim() || undefined,
          approvalChain: docType === 'INTERNAL_MEMO' ? approvalChain : undefined,
          variant: docType === 'CERTIFICATE_OR_INVITATION' ? variant : undefined,
          fiscalYearBE: currentFiscalYearBE(),
          highlightBlanks,
        },
        `ฟอร์มเปล่า_${DOC_TYPE_THAI_NAMES[docType]}.docx`,
      );
      onSuccess?.(`ดาวน์โหลด ${res.fileName} เรียบร้อยแล้ว`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างไฟล์ Word ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="cf-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="สร้างฟอร์ม Word เปล่าสำหรับคนนอกระบบ"
    >
      <div className="cf-modal">
        <div className="cf-modal-head">
          <h2>
            <FileText size={18} style={{display: 'inline', marginRight: 6}} />
            สร้างฟอร์ม Word เปล่า (สำหรับคนนอกระบบ)
          </h2>
          <button type="button" className="cf-btn cf-btn-sm" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <X size={16} />
          </button>
        </div>

        <div className="cf-modal-body">
          <p style={{margin: 0, fontSize: '0.86rem', color: '#475569'}}>
            สร้างไฟล์ <code>.docx</code> มาตรฐานงานสารบรรณ (TH Sarabun IT๙, ครุฑ, ขอบกระดาษ และรายชื่อผู้ลงนามล่าสุด)
            ไม่มีกล่องข้อความลอย พร้อมส่งต่อทาง LINE / อีเมลได้ทันที
          </p>

          {error && <div className="cf-error">{error}</div>}

          <div className="cf-field">
            <label htmlFor="cf-quick-doctype">เลือกประเภทหนังสือราชการ (7 ประเภท)</label>
            <select
              id="cf-quick-doctype"
              value={docType}
              onChange={e => setDocType(e.target.value as CaseDocType)}
            >
              {DOC_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.desc}
                </option>
              ))}
            </select>
          </div>

          <div className="cf-field">
            <label htmlFor="cf-quick-title">ชื่อเรื่องเบื้องต้น (ไม่บังคับ)</label>
            <input
              id="cf-quick-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="เว้นว่างไว้เพื่อใส่ช่องไฮไลต์ให้เพื่อนพิมพ์เอง"
            />
          </div>

          {docType === 'INTERNAL_MEMO' && (
            <div className="cf-field">
              <label htmlFor="cf-quick-chain">รูปแบบกล่องอนุมัติ</label>
              <select
                id="cf-quick-chain"
                value={approvalChain}
                onChange={e => setApprovalChain(e.target.value as MemoApprovalChain)}
              >
                <option value="3_TIER">เสนอครบ 3 ระดับ (ผอ.กอง → ปลัด → นายกฯ)</option>
                <option value="2_TIER">เสนอ 2 ระดับ (ปลัด → นายกฯ)</option>
                <option value="4_TIER_VERTICAL">เสนอความเห็นเรียงแนวตั้ง 4 ระดับ</option>
                <option value="NONE">ไม่มีกล่องความเห็น/อนุมัติ</option>
              </select>
            </div>
          )}

          {docType === 'CERTIFICATE_OR_INVITATION' && (
            <div className="cf-field">
              <label htmlFor="cf-quick-variant">รูปแบบหนังสือ</label>
              <select
                id="cf-quick-variant"
                value={variant}
                onChange={e => setVariant(e.target.value as 'INVITATION' | 'CERTIFICATE')}
              >
                <option value="INVITATION">หนังสือเชิญวิทยากร / เชิญประชุม</option>
                <option value="CERTIFICATE">หนังสือรับรอง</option>
              </select>
            </div>
          )}

          <label className="cf-check-row">
            <input
              type="checkbox"
              checked={highlightBlanks}
              onChange={e => setHighlightBlanks(e.target.checked)}
            />
            <span>ไฮไลต์สีเหลืองตรงจุดที่ต้องกรอกเพิ่ม (ช่วยให้เพื่อนเห็นช่องที่ต้องเติมชัดเจน)</span>
          </label>
        </div>

        <div className="cf-modal-foot">
          <button type="button" className="cf-btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button
            type="button"
            className="cf-btn cf-btn-primary"
            disabled={busy}
            onClick={handleDownload}
          >
            <Download size={15} />
            {busy ? 'กำลังสร้าง .docx…' : 'ดาวน์โหลด .docx ทันที'}
          </button>
        </div>
      </div>
    </div>
  );
}
