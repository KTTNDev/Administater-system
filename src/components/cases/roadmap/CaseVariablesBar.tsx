'use client';
import {useState} from 'react';
import {Plus, Sparkles, Trash2} from 'lucide-react';
import type {CaseVariable} from '@/lib/cases/types';

interface Props {
  variables: CaseVariable[];
  onChange: (next: CaseVariable[]) => void;
  onInsertToken?: (token: string) => void;
}

export function CaseVariablesBar({variables, onChange, onInsertToken}: Props) {
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [newKind, setNewKind] = useState<CaseVariable['kind']>('text');

  function updateValue(key: string, value: string) {
    onChange(variables.map(v => (v.key === key ? {...v, value} : v)));
  }

  function removeVariable(key: string) {
    onChange(variables.filter(v => v.key !== key));
  }

  function handleAdd() {
    const cleanKey = newKey.trim().replace(/[^a-zA-Z0-9_]/g, '');
    if (!cleanKey || !newLabel.trim()) return;
    if (variables.some(v => v.key === cleanKey)) return;
    onChange([
      ...variables,
      {key: cleanKey, label: newLabel.trim(), value: '', kind: newKind},
    ]);
    setNewKey('');
    setNewLabel('');
    setAdding(false);
  }

  return (
    <section className="cf-vars-bar" aria-label="ตัวแปรกลางของแฟ้ม">
      <div className="cf-vars-header">
        <strong>
          <Sparkles size={14} style={{display: 'inline', marginRight: 5}} />
          ตัวแปรกลางของแฟ้ม (แก้ครั้งเดียว อัปเดตทุกเอกสารอัตโนมัติ)
        </strong>
        <button
          type="button"
          className="cf-btn cf-btn-sm"
          onClick={() => setAdding(v => !v)}
        >
          <Plus size={14} />
          เพิ่มตัวแปร
        </button>
      </div>

      <div className="cf-vars-chips">
        {variables.map(v => (
          <div key={v.key} className="cf-var-chip" data-var-key={v.key}>
            <label htmlFor={`cf-var-${v.key}`}>{v.label}</label>
            <input
              id={`cf-var-${v.key}`}
              aria-label={`ตัวแปร ${v.label}`}
              type={v.kind === 'date' ? 'date' : 'text'}
              value={v.value}
              placeholder={v.kind === 'date' ? '' : `กรอก${v.label}`}
              onChange={e => updateValue(v.key, e.target.value)}
            />
            {onInsertToken && (
              <button
                type="button"
                className="cf-btn cf-btn-sm"
                title={`แทรก {{var.${v.key}}}`}
                onClick={() => onInsertToken(`{{var.${v.key}}}`)}
              >
                แทรก
              </button>
            )}
            <button
              type="button"
              className="cf-btn cf-btn-sm"
              aria-label={`ลบตัวแปร ${v.label}`}
              onClick={() => removeVariable(v.key)}
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {adding && (
        <div className="cf-vars-chips" style={{paddingTop: 6, borderTop: '1px solid #e2e8f0'}}>
          <input
            placeholder="รหัสภาษาอังกฤษ เช่น targetGroup"
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            style={{border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 8px', fontSize: '0.82rem'}}
          />
          <input
            placeholder="ชื่อแสดง เช่น กลุ่มเป้าหมาย"
            value={newLabel}
            onChange={e => setNewLabel(e.target.value)}
            style={{border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 8px', fontSize: '0.82rem'}}
          />
          <select
            value={newKind}
            onChange={e => setNewKind(e.target.value as CaseVariable['kind'])}
            style={{border: '1px solid #cbd5e1', borderRadius: 6, padding: '4px 8px', fontSize: '0.82rem'}}
          >
            <option value="text">ข้อความ</option>
            <option value="date">วันที่</option>
            <option value="money">จำนวนเงิน</option>
            <option value="number">ตัวเลข</option>
          </select>
          <button type="button" className="cf-btn cf-btn-primary cf-btn-sm" onClick={handleAdd}>
            บันทึกตัวแปร
          </button>
        </div>
      )}
    </section>
  );
}
