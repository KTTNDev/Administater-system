'use client';
import {useState} from 'react';
import {
  ArrowDown,
  ArrowUp,
  FilePlus2,
  FileText,
  Link2,
  Paperclip,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import {DOC_TYPE_THAI_NAMES} from '@/lib/cases/resolver';
import type {CaseDocType, CaseFolder, LinkedModuleSummary} from '@/lib/cases/types';
import {buildClientRoadmap} from '../client-api';

const ALL_DOC_TYPES: CaseDocType[] = [
  'INTERNAL_MEMO',
  'EXTERNAL_LETTER',
  'MUNICIPAL_ORDER',
  'ANNOUNCEMENT',
  'CERTIFICATE_OR_INVITATION',
  'PROJECT_PROPOSAL_OR_ATTACHMENT',
  'PHOTO_SHEET',
];

interface Props {
  folder: CaseFolder;
  selectedItemId: string | null;
  linkedSummaries: ReadonlyMap<string, LinkedModuleSummary>;
  onSelectItem: (itemId: string) => void;
  onAddDoc: (docType: CaseDocType, stageId: string) => void;
  onAddExternalSlot: (stageId: string) => void;
  onOpenLinkModule: (stageId: string) => void;
  onAddStage: (name: string) => void;
  onMoveItem: (itemId: string, direction: 'up' | 'down') => void;
  onDeleteItem: (itemId: string) => void;
  onDownloadRoadmap: () => void;
  busy?: boolean;
}

export function RoadmapSidebar({
  folder,
  selectedItemId,
  linkedSummaries,
  onSelectItem,
  onAddDoc,
  onAddExternalSlot,
  onOpenLinkModule,
  onAddStage,
  onMoveItem,
  onDeleteItem,
  onDownloadRoadmap,
  busy,
}: Props) {
  const [targetStageId, setTargetStageId] = useState<string>(folder.stages[0]?.id ?? '');
  const [showDocPicker, setShowDocPicker] = useState(false);
  const [addingStage, setAddingStage] = useState(false);
  const [newStageName, setNewStageName] = useState('');

  const activeStageId = folder.stages.some(s => s.id === targetStageId)
    ? targetStageId
    : folder.stages[0]?.id ?? '';

  const roadmapRows = buildClientRoadmap(folder, linkedSummaries);
  const stages = [...folder.stages].sort((a, b) => a.order - b.order);

  function handleCreateStage() {
    if (!newStageName.trim()) return;
    onAddStage(newStageName.trim());
    setNewStageName('');
    setAddingStage(false);
  }

  return (
    <aside className="cf-panel" aria-label="ลายแทงประจำแฟ้ม">
      <div className="cf-panel-head">
        <h2>ลายแทงประจำแฟ้ม ({roadmapRows.length})</h2>
        <button
          type="button"
          className="cf-btn cf-btn-sm"
          disabled={busy}
          onClick={onDownloadRoadmap}
          title="ดาวน์โหลดลายแทง (.docx)"
        >
          <Printer size={14} />
          พิมพ์/โหลดลายแทง
        </button>
      </div>

      {stages.map(stage => {
        const rows = roadmapRows.filter(r => r.stageId === stage.id);
        return (
          <div key={stage.id} className="cf-stage-block" data-stage-id={stage.id}>
            <div className="cf-stage-title">
              <span>{stage.name}</span>
              <span className="cf-pill cf-pill-slate">{rows.length} รายการ</span>
            </div>

            {rows.length === 0 ? (
              <div style={{fontSize: '0.78rem', color: '#64748b', padding: '4px 2px'}}>
                ยังไม่มีเอกสารในรอบนี้
              </div>
            ) : (
              rows.map((row, idx) => {
                const isSelected = row.itemId === selectedItemId;
                const badgeClass =
                  row.kind === 'LINKED_MODULE_REF'
                    ? 'cf-pill-purple'
                    : row.isExternalOverride
                      ? 'cf-pill-amber'
                      : row.kind === 'EXTERNAL_FILE_SLOT'
                        ? 'cf-pill-slate'
                        : 'cf-pill-green';

                return (
                  <div
                    key={row.itemId}
                    className={`cf-roadmap-item ${isSelected ? 'is-active' : ''}`}
                    data-roadmap-item-id={row.itemId}
                    onClick={() => onSelectItem(row.itemId)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onSelectItem(row.itemId);
                      }
                    }}
                  >
                    <div className="cf-roadmap-row-top">
                      <span style={{display: 'inline-flex', alignItems: 'center', gap: 5}}>
                        <span className="cf-roadmap-seq">{row.sequence}</span>
                        <span>{row.docTypeLabel}</span>
                      </span>
                      <span className={`cf-pill ${badgeClass}`}>{row.statusBadge}</span>
                    </div>

                    <div className="cf-roadmap-title">{row.title}</div>

                    <div className="cf-roadmap-meta">
                      <span>เลขที่: {row.referenceNo}</span>
                      <span>· {row.dateThai}</span>
                      <span className="cf-pill cf-pill-blue">{row.copies} ชุด</span>
                      {row.totalAmount !== undefined && row.totalAmount > 0 && (
                        <span className="cf-pill cf-pill-purple">
                          {row.totalAmount.toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท
                        </span>
                      )}
                    </div>

                    <div
                      className="cf-roadmap-item-controls"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="cf-btn cf-btn-sm"
                        disabled={idx === 0}
                        aria-label={`เลื่อนขึ้น ${row.title}`}
                        onClick={() => onMoveItem(row.itemId, 'up')}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="cf-btn cf-btn-sm"
                        disabled={idx === rows.length - 1}
                        aria-label={`เลื่อนลง ${row.title}`}
                        onClick={() => onMoveItem(row.itemId, 'down')}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        className="cf-btn cf-btn-sm cf-btn-danger"
                        aria-label={`ลบ ${row.title}`}
                        onClick={() => onDeleteItem(row.itemId)}
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        );
      })}

      <div className="cf-add-menu">
        <div className="cf-field">
          <label htmlFor="cf-target-stage">เพิ่มลงในรอบเสนอเซ็น</label>
          <select
            id="cf-target-stage"
            value={activeStageId}
            onChange={e => setTargetStageId(e.target.value)}
          >
            {stages.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="cf-btn cf-btn-primary"
          onClick={() => setShowDocPicker(v => !v)}
        >
          <FilePlus2 size={15} />
          + สร้างเอกสารในระบบ
        </button>

        {showDocPicker && (
          <div className="cf-doc-type-picker" role="menu" aria-label="เลือกประเภทเอกสาร">
            {ALL_DOC_TYPES.map(docType => (
              <button
                key={docType}
                type="button"
                className="cf-btn cf-btn-sm"
                style={{justifyContent: 'flex-start'}}
                onClick={() => {
                  onAddDoc(docType, activeStageId);
                  setShowDocPicker(false);
                }}
              >
                <FileText size={13} />
                {DOC_TYPE_THAI_NAMES[docType]}
              </button>
            ))}
          </div>
        )}

        <button
          type="button"
          className="cf-btn"
          onClick={() => onAddExternalSlot(activeStageId)}
        >
          <Paperclip size={15} />
          + แทรกไฟล์แนบ / แผ่นคั่น
        </button>

        <button
          type="button"
          className="cf-btn cf-btn-accent"
          onClick={() => onOpenLinkModule(activeStageId)}
        >
          <Link2 size={15} />
          + ผูกงานจัดซื้อจัดจ้าง / พัสดุ
        </button>

        {addingStage ? (
          <div style={{display: 'flex', gap: 6}}>
            <input
              placeholder="ชื่อรอบ เช่น รอบที่ 3 เบิกจ่าย"
              value={newStageName}
              onChange={e => setNewStageName(e.target.value)}
              style={{flex: 1, border: '1px solid #cbd5e1', borderRadius: 7, padding: '5px 8px', fontSize: '0.82rem'}}
            />
            <button type="button" className="cf-btn cf-btn-primary cf-btn-sm" onClick={handleCreateStage}>
              เพิ่ม
            </button>
          </div>
        ) : (
          <button type="button" className="cf-btn cf-btn-sm" onClick={() => setAddingStage(true)}>
            <Plus size={13} />
            เพิ่มรอบเสนอเซ็นใหม่
          </button>
        )}
      </div>
    </aside>
  );
}
