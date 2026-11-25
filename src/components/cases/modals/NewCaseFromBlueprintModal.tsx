'use client';
import {useState} from 'react';
import {Copy, FolderPlus, Layers, X} from 'lucide-react';
import type {CaseBlueprint, CaseFolder} from '@/lib/cases/types';
import {currentFiscalYearBE} from '../client-api';

interface Props {
  blueprints: CaseBlueprint[];
  existingFolders: CaseFolder[];
  busy?: boolean;
  onCreateBlank: (input: {
    name: string;
    fiscalYearBE: number;
    category: string;
    description: string;
  }) => Promise<void>;
  onCreateFromBlueprint: (input: {
    blueprintId: string;
    name: string;
    fiscalYearBE: number;
  }) => Promise<void>;
  onSafeClone: (input: {
    folderId: string;
    name: string;
    fiscalYearBE: number;
  }) => Promise<void>;
  onClose: () => void;
}

export function NewCaseFromBlueprintModal({
  blueprints,
  existingFolders,
  busy,
  onCreateBlank,
  onCreateFromBlueprint,
  onSafeClone,
  onClose,
}: Props) {
  const [mode, setMode] = useState<'blank' | 'blueprint' | 'clone'>('blank');
  const [name, setName] = useState('');
  const [fiscalYearBE, setFiscalYearBE] = useState(currentFiscalYearBE());
  const [category, setCategory] = useState('โครงการฝึกอบรม');
  const [description, setDescription] = useState('');
  const [blueprintId, setBlueprintId] = useState(blueprints[0]?.id ?? '');
  const [cloneFolderId, setCloneFolderId] = useState(existingFolders[0]?.id ?? '');
  const [localError, setLocalError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError('');
    if (!name.trim()) {
      setLocalError('กรุณาระบุชื่อแฟ้มงาน / โครงการ');
      return;
    }
    try {
      if (mode === 'blank') {
        await onCreateBlank({name: name.trim(), fiscalYearBE, category, description});
      } else if (mode === 'blueprint') {
        if (!blueprintId) {
          setLocalError('กรุณาเลือกแม่แบบแฟ้มงาน');
          return;
        }
        await onCreateFromBlueprint({blueprintId, name: name.trim(), fiscalYearBE});
      } else {
        if (!cloneFolderId) {
          setLocalError('กรุณาเลือกแฟ้มงานต้นฉบับ');
          return;
        }
        await onSafeClone({folderId: cloneFolderId, name: name.trim(), fiscalYearBE});
      }
      onClose();
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : 'สร้างแฟ้มงานไม่สำเร็จ');
    }
  }

  return (
    <div className="cf-modal-backdrop" role="dialog" aria-modal="true" aria-label="สร้างแฟ้มงานสารบรรณใหม่">
      <form className="cf-modal" onSubmit={handleSubmit}>
        <div className="cf-modal-head">
          <h2>
            <FolderPlus size={18} style={{display: 'inline', marginRight: 6}} />
            สร้างแฟ้มงานสารบรรณใหม่
          </h2>
          <button type="button" className="cf-btn cf-btn-sm" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <X size={16} />
          </button>
        </div>

        <div className="cf-modal-body">
          <div className="cf-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'blank'}
              className={`cf-tab ${mode === 'blank' ? 'is-active' : ''}`}
              onClick={() => setMode('blank')}
            >
              <FolderPlus size={14} style={{display: 'inline', marginRight: 4}} />
              แฟ้มงานใหม่
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'blueprint'}
              className={`cf-tab ${mode === 'blueprint' ? 'is-active' : ''}`}
              onClick={() => setMode('blueprint')}
            >
              <Layers size={14} style={{display: 'inline', marginRight: 4}} />
              จากแม่แบบ ({blueprints.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'clone'}
              className={`cf-tab ${mode === 'clone' ? 'is-active' : ''}`}
              onClick={() => setMode('clone')}
            >
              <Copy size={14} style={{display: 'inline', marginRight: 4}} />
              Safe Clone แฟ้มเดิม ({existingFolders.length})
            </button>
          </div>

          {localError && <div className="cf-error">{localError}</div>}

          <div className="cf-form-grid">
            <div className="cf-field cf-wide">
              <label htmlFor="cf-new-name">ชื่อแฟ้มงาน / โครงการ</label>
              <input
                id="cf-new-name"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="เช่น โครงการอบรมพัฒนาศักยภาพผู้สูงอายุ ประจำปี ๒๕๗๐"
              />
            </div>

            <div className="cf-field">
              <label htmlFor="cf-new-fy">ปีงบประมาณ (พ.ศ.)</label>
              <input
                id="cf-new-fy"
                type="number"
                min={2560}
                max={2650}
                value={fiscalYearBE}
                onChange={e => setFiscalYearBE(Number(e.target.value) || currentFiscalYearBE())}
              />
            </div>

            {mode === 'blank' && (
              <>
                <div className="cf-field">
                  <label htmlFor="cf-new-category">หมวดหมู่งาน</label>
                  <input
                    id="cf-new-category"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="โครงการฝึกอบรม / สวัสดิการ / คำสั่ง-ประกาศ"
                  />
                </div>
                <div className="cf-field cf-wide">
                  <label htmlFor="cf-new-desc">รายละเอียดเพิ่มเติม</label>
                  <textarea
                    id="cf-new-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="บันทึกสรุปขอบเขตงานหรือหมายเหตุภายใน..."
                  />
                </div>
              </>
            )}

            {mode === 'blueprint' && (
              <div className="cf-field cf-wide">
                <label htmlFor="cf-new-bp">เลือกแม่แบบที่บันทึกไว้</label>
                {blueprints.length === 0 ? (
                  <div className="cf-empty">ยังไม่มีแม่แบบแฟ้มงาน (สามารถกด &ldquo;บันทึกเป็นแม่แบบ&rdquo; จากแฟ้มงานที่มีอยู่ได้)</div>
                ) : (
                  <select
                    id="cf-new-bp"
                    value={blueprintId}
                    onChange={e => setBlueprintId(e.target.value)}
                  >
                    {blueprints.map(bp => (
                      <option key={bp.id} value={bp.id}>
                        {bp.name} ({bp.items.length} เอกสาร)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {mode === 'clone' && (
              <div className="cf-field cf-wide">
                <label htmlFor="cf-new-clone">เลือกแฟ้มงานต้นฉบับ (Safe Clone จะล้างเลขหนังสือ วันที่ และไฟล์ทับอัตโนมัติ)</label>
                {existingFolders.length === 0 ? (
                  <div className="cf-empty">ยังไม่มีแฟ้มงานต้นฉบับ</div>
                ) : (
                  <select
                    id="cf-new-clone"
                    value={cloneFolderId}
                    onChange={e => setCloneFolderId(e.target.value)}
                  >
                    {existingFolders.map(f => (
                      <option key={f.id} value={f.id}>
                        {f.name} (พ.ศ. {f.fiscalYearBE} · {f.items.length} รายการ)
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="cf-modal-foot">
          <button type="button" className="cf-btn" onClick={onClose}>
            ยกเลิก
          </button>
          <button type="submit" className="cf-btn cf-btn-primary" disabled={busy}>
            {busy ? 'กำลังสร้าง…' : 'สร้างแฟ้มงาน'}
          </button>
        </div>
      </form>
    </div>
  );
}
