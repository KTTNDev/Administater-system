'use client';
import {useRef, useState} from 'react';
import {
  AtSign,
  Download,
  ExternalLink,
  FileUp,
  Hash,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {DOC_TYPE_THAI_NAMES, formatOfficialNumber} from '@/lib/cases/resolver';
import type {
  CaseFolder,
  CaseItem,
  CaseNumberTrack,
  ExternalFileSlotItem,
  GeneratedDocItem,
  LinkedModuleRefItem,
  LinkedModuleSummary,
  MemoApprovalChain,
  RoutingStripVisibility,
} from '@/lib/cases/types';
import {downloadCaseExport, uploadCaseExternalFile} from '../client-api';

interface Props {
  folder: CaseFolder;
  item: CaseItem;
  linkedSummary?: LinkedModuleSummary;
  onUpdateItem: (next: CaseItem) => void;
  onReserveNumber: (track: Exclude<CaseNumberTrack, 'NONE'>) => Promise<string | undefined>;
  onNotice?: (message: string) => void;
  onError?: (message: string) => void;
}

export function DocumentFormEditor({
  folder,
  item,
  linkedSummary,
  onUpdateItem,
  onReserveNumber,
  onNotice,
  onError,
}: Props) {
  const [busyFile, setBusyFile] = useState(false);
  const [showVarPicker, setShowVarPicker] = useState(false);
  const [showRefPicker, setShowRefPicker] = useState(false);
  const activeFieldRef = useRef<{
    getValue: () => string;
    setValue: (next: string) => void;
  } | null>(null);

  const otherDocs = folder.items.filter(i => i.id !== item.id);

  function insertAtActiveField(token: string) {
    if (activeFieldRef.current) {
      const cur = activeFieldRef.current.getValue();
      const sep = cur && !cur.endsWith(' ') && !cur.endsWith('\n') ? ' ' : '';
      activeFieldRef.current.setValue(`${cur}${sep}${token}`);
    } else if (item.kind === 'GENERATED_DOC') {
      // Fallback: insert into primary body field of this doc type
      if (item.payload.docType === 'INTERNAL_MEMO') {
        const cur = item.payload.sections.background;
        onUpdateItem({
          ...item,
          payload: {
            ...item.payload,
            sections: {...item.payload.sections, background: cur ? `${cur} ${token}` : token},
          },
        });
      } else if (item.payload.docType === 'MUNICIPAL_ORDER') {
        const first = item.payload.preambleParagraphs[0] ?? '';
        const nextArr = [...item.payload.preambleParagraphs];
        nextArr[0] = first ? `${first} ${token}` : token;
        onUpdateItem({...item, payload: {...item.payload, preambleParagraphs: nextArr}});
      } else if (
        item.payload.docType === 'EXTERNAL_LETTER' ||
        item.payload.docType === 'ANNOUNCEMENT' ||
        item.payload.docType === 'CERTIFICATE_OR_INVITATION'
      ) {
        const first = item.payload.bodyParagraphs[0] ?? '';
        const nextArr = [...item.payload.bodyParagraphs];
        nextArr[0] = first ? `${first} ${token}` : token;
        onUpdateItem({...item, payload: {...item.payload, bodyParagraphs: nextArr}});
      } else if (item.payload.docType === 'PROJECT_PROPOSAL_OR_ATTACHMENT') {
        const cur = item.payload.rationale;
        onUpdateItem({
          ...item,
          payload: {...item.payload, rationale: cur ? `${cur} ${token}` : token},
        });
      }
    }
    setShowVarPicker(false);
    setShowRefPicker(false);
  }

  function bindFocus(getValue: () => string, setValue: (next: string) => void) {
    return {
      onFocus: () => {
        activeFieldRef.current = {getValue, setValue};
      },
    };
  }

  // -------------------------------------------------------------------------
  // EXTERNAL_FILE_SLOT editor
  // -------------------------------------------------------------------------
  if (item.kind === 'EXTERNAL_FILE_SLOT') {
    const slot: ExternalFileSlotItem = item;
    async function handleSlotUpload(file: File | undefined) {
      if (!file) return;
      setBusyFile(true);
      try {
        const uploaded = await uploadCaseExternalFile(file);
        onUpdateItem({
          ...slot,
          uploadedFilePath: uploaded.path,
          uploadedFileName: uploaded.originalName,
          uploadedFileType:
            uploaded.fileType === 'PDF'
              ? 'pdf'
              : uploaded.fileType === 'IMAGE'
                ? 'image'
                : undefined,
          exportBehavior: uploaded.fileType === 'DOCX' ? 'PRINT_DIVIDER_CHECKLIST' : 'EMBED_UPLOADED_FILE',
        });
        onNotice?.(`แนบไฟล์ "${uploaded.originalName}" เรียบร้อยแล้ว`);
      } catch (e) {
        onError?.(e instanceof Error ? e.message : 'อัปโหลดไฟล์แนบไม่สำเร็จ');
      } finally {
        setBusyFile(false);
      }
    }

    return (
      <section className="cf-panel" aria-label="แก้ไขช่องไฟล์แนบภายนอก">
        <div className="cf-panel-head">
          <h2>เอกสารแนบ / แผ่นคั่นภายนอก</h2>
          <span className="cf-pill cf-pill-slate">External Slot</span>
        </div>

        <div className="cf-form-grid">
          <div className="cf-field cf-wide">
            <label htmlFor="cf-slot-title">ชื่อรายการเอกสารแนบ</label>
            <input
              id="cf-slot-title"
              value={slot.title}
              onChange={e => onUpdateItem({...slot, title: e.target.value})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-slot-stage">รอบเสนอเซ็น</label>
            <select
              id="cf-slot-stage"
              value={slot.stageId}
              onChange={e => onUpdateItem({...slot, stageId: e.target.value})}
            >
              {folder.stages.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="cf-field">
            <label htmlFor="cf-slot-copies">จำนวนชุด</label>
            <input
              id="cf-slot-copies"
              type="number"
              min={1}
              max={10}
              value={slot.copies}
              onChange={e => onUpdateItem({...slot, copies: Math.max(1, Number(e.target.value) || 1)})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-slot-no">เลขที่เอกสารภายนอก (ถ้ามี)</label>
            <input
              id="cf-slot-no"
              value={slot.externalDocNo}
              onChange={e => onUpdateItem({...slot, externalDocNo: e.target.value})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-slot-date">วันที่เอกสารภายนอก</label>
            <input
              id="cf-slot-date"
              type="date"
              value={slot.externalDate}
              onChange={e => onUpdateItem({...slot, externalDate: e.target.value})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-slot-behavior">ลักษณะเมื่อรวมเล่ม PDF</label>
            <select
              id="cf-slot-behavior"
              value={slot.exportBehavior}
              onChange={e =>
                onUpdateItem({
                  ...slot,
                  exportBehavior: e.target.value as ExternalFileSlotItem['exportBehavior'],
                })
              }
            >
              <option value="EMBED_UPLOADED_FILE">แทรกไฟล์ PDF/รูปภาพเข้าเล่มจริง</option>
              <option value="PRINT_DIVIDER_CHECKLIST">พิมพ์แผ่นคั่นเพื่อแทรกต้นฉบับเอง</option>
            </select>
          </div>
          <div className="cf-field">
            <label htmlFor="cf-slot-stamp">บันทึกช่วยจำ (เช่น ตราประทับ/รับรองสำเนา)</label>
            <input
              id="cf-slot-stamp"
              value={slot.stampReminderNote ?? ''}
              onChange={e => onUpdateItem({...slot, stampReminderNote: e.target.value})}
            />
          </div>
        </div>

        <div className="cf-override-box">
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8}}>
            <strong>ไฟล์แนบ: {slot.uploadedFileName || 'ยังไม่ได้อัปโหลดไฟล์'}</strong>
            <div className="cf-actions">
              <label className="cf-btn cf-btn-sm cf-btn-primary" style={{cursor: 'pointer'}}>
                <FileUp size={14} />
                {busyFile ? 'กำลังอัปโหลด…' : 'อัปโหลด PDF / รูปภาพ / Word'}
                <input
                  type="file"
                  accept=".pdf,.docx,image/png,image/jpeg,image/webp"
                  style={{display: 'none'}}
                  disabled={busyFile}
                  onChange={e => {
                    void handleSlotUpload(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
              </label>
              {slot.uploadedFilePath && (
                <>
                  <a
                    href={slot.uploadedFilePath}
                    target="_blank"
                    rel="noreferrer"
                    className="cf-btn cf-btn-sm"
                  >
                    <ExternalLink size={14} />
                    เปิดไฟล์
                  </a>
                  <button
                    type="button"
                    className="cf-btn cf-btn-sm cf-btn-danger"
                    onClick={() =>
                      onUpdateItem({
                        ...slot,
                        uploadedFilePath: undefined,
                        uploadedFileName: undefined,
                        uploadedFileType: undefined,
                        exportBehavior: 'PRINT_DIVIDER_CHECKLIST',
                      })
                    }
                  >
                    ล้างไฟล์
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // LINKED_MODULE_REF editor
  // -------------------------------------------------------------------------
  if (item.kind === 'LINKED_MODULE_REF') {
    const linked: LinkedModuleRefItem = item;
    return (
      <section className="cf-panel" aria-label="รายละเอียดงานที่เชื่อมโยง">
        <div className="cf-panel-head">
          <h2>งานที่เชื่อมโยงจากระบบอื่น</h2>
          <span className="cf-pill cf-pill-purple">{linked.targetModule}</span>
        </div>

        <div className="cf-form-grid">
          <div className="cf-field cf-wide">
            <label htmlFor="cf-linked-title">ชื่อแสดงในลายแทง</label>
            <input
              id="cf-linked-title"
              value={linked.title}
              onChange={e => onUpdateItem({...linked, title: e.target.value})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-linked-stage">รอบเสนอเซ็น</label>
            <select
              id="cf-linked-stage"
              value={linked.stageId}
              onChange={e => onUpdateItem({...linked, stageId: e.target.value})}
            >
              {folder.stages.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div className="cf-field">
            <label className="cf-check-row" style={{marginTop: 22}}>
              <input
                type="checkbox"
                checked={linked.includePdfInBinder}
                onChange={e => onUpdateItem({...linked, includePdfInBinder: e.target.checked})}
              />
              <span>รวมไฟล์ PDF ของงานนี้เข้าเล่มพิมพ์ด้วย</span>
            </label>
          </div>
        </div>

        <div className="cf-validation-box">
          <strong>สถานะข้อมูลสดจากโมดูลต้นทาง:</strong>
          {linkedSummary && linkedSummary.found ? (
            <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
              <div>ชื่อเรื่อง: <strong>{linkedSummary.title}</strong></div>
              <div>เลขที่อ้างอิง: <strong>{linkedSummary.referenceNo || '-'}</strong></div>
              <div>วันที่: <strong>{linkedSummary.date || '-'}</strong></div>
              {linkedSummary.totalAmount !== undefined && (
                <div>
                  ยอดเงินรวม:{' '}
                  <strong>
                    {linkedSummary.totalAmount.toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท
                  </strong>
                </div>
              )}
              <div>สถานะ: <span className="cf-pill cf-pill-green">{linkedSummary.status}</span></div>
            </div>
          ) : (
            <div className="cf-issue-row cf-issue-WARNING">
              ยังไม่พบข้อมูลต้นทาง (หรือรหัสเชื่อมโยงเป็น PENDING_LINK หลัง Safe Clone)
            </div>
          )}
        </div>
      </section>
    );
  }

  // -------------------------------------------------------------------------
  // GENERATED_DOC editor (all 7 official doc types)
  // -------------------------------------------------------------------------
  const doc: GeneratedDocItem = item;
  const payload = doc.payload;

  async function handleDownloadSingleWord() {
    setBusyFile(true);
    try {
      const res = await downloadCaseExport(
        '/api/cases/export/blank-word',
        {mode: 'single_doc', folder, itemId: doc.id, highlightBlanks: true},
        `${doc.title || doc.docType}.docx`,
      );
      onNotice?.(`ดาวน์โหลด ${res.fileName} เรียบร้อยแล้ว`);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'ดาวน์โหลดไฟล์ Word ไม่สำเร็จ');
    } finally {
      setBusyFile(false);
    }
  }

  async function handleUploadOverride(file: File | undefined) {
    if (!file) return;
    setBusyFile(true);
    try {
      const uploaded = await uploadCaseExternalFile(file);
      onUpdateItem({
        ...doc,
        externalOverride: {
          fileName: uploaded.originalName,
          fileType: uploaded.fileType === 'PDF' ? 'pdf' : 'docx',
          storedPath: uploaded.path,
          uploadedAt: uploaded.uploadedAt,
          note: 'ฉบับแก้ไขภายนอก',
        },
      });
      onNotice?.(`แนบฉบับแก้ไขภายนอก "${uploaded.originalName}" เรียบร้อยแล้ว`);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'อัปโหลดฉบับแก้ไขภายนอกไม่สำเร็จ');
    } finally {
      setBusyFile(false);
    }
  }

  async function handleReserve() {
    if (doc.track === 'NONE') return;
    const nextNo = await onReserveNumber(doc.track);
    if (nextNo) {
      onUpdateItem({...doc, runningNo: nextNo});
    }
  }

  return (
    <section className="cf-panel" aria-label="ตัวแก้ไขเอกสารในแฟ้ม">
      <div className="cf-panel-head">
        <h2>{DOC_TYPE_THAI_NAMES[doc.docType]}</h2>
        <span className="cf-pill cf-pill-blue">
          {formatOfficialNumber(folder, doc) || 'รอเลขที่'}
        </span>
      </div>

      {/* Common metadata */}
      <div className="cf-form-grid">
        <div className="cf-field cf-wide">
          <label htmlFor="cf-doc-title">ชื่อเรื่อง (รองรับ {'{{var.xxx}}'} และ {'{{ref:id:full}}'})</label>
          <input
            id="cf-doc-title"
            value={doc.title}
            onChange={e => onUpdateItem({...doc, title: e.target.value})}
            {...bindFocus(
              () => doc.title,
              v => onUpdateItem({...doc, title: v}),
            )}
          />
        </div>

        <div className="cf-field">
          <label htmlFor="cf-doc-running-no">เลขที่หนังสือ / ลำดับทะเบียน</label>
          <div style={{display: 'flex', gap: 6}}>
            <input
              id="cf-doc-running-no"
              value={doc.runningNo}
              placeholder={doc.docType === 'ANNOUNCEMENT' ? 'ไม่ต้องกรอก (ประกาศไม่พิมพ์เลข)' : 'เช่น 1510'}
              onChange={e => onUpdateItem({...doc, runningNo: e.target.value})}
            />
            {doc.track !== 'NONE' && (
              <button
                type="button"
                className="cf-btn cf-btn-sm"
                title="จองเลขถัดไปจากทะเบียนกลาง"
                onClick={() => void handleReserve()}
              >
                <Hash size={13} />
                จองเลข
              </button>
            )}
          </div>
        </div>

        <div className="cf-field">
          <label htmlFor="cf-doc-date">วันที่หนังสือ</label>
          <input
            id="cf-doc-date"
            type="date"
            value={doc.date}
            onChange={e => onUpdateItem({...doc, date: e.target.value})}
          />
        </div>

        <div className="cf-field">
          <label htmlFor="cf-doc-stage">รอบเสนอเซ็น</label>
          <select
            id="cf-doc-stage"
            value={doc.stageId}
            onChange={e => onUpdateItem({...doc, stageId: e.target.value})}
          >
            {folder.stages.map(s => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="cf-field">
          <label htmlFor="cf-doc-copies">จำนวนชุดเมื่อพิมพ์ (Copies)</label>
          <input
            id="cf-doc-copies"
            type="number"
            min={1}
            max={10}
            value={doc.copies}
            onChange={e => onUpdateItem({...doc, copies: Math.max(1, Number(e.target.value) || 1)})}
          />
        </div>
      </div>

      {/* Insertion Helper Toolbar */}
      <div className="cf-insert-toolbar" aria-label="แถบแทรกตัวแปรและอ้างอิงเอกสาร">
        <button
          type="button"
          className="cf-btn cf-btn-sm"
          onClick={() => {
            setShowVarPicker(v => !v);
            setShowRefPicker(false);
          }}
        >
          <Sparkles size={13} />
          + แทรกตัวแปรแฟ้ม
        </button>

        <button
          type="button"
          className="cf-btn cf-btn-sm"
          onClick={() => {
            setShowRefPicker(v => !v);
            setShowVarPicker(false);
          }}
        >
          <AtSign size={13} />
          @ อ้างอิงเอกสารก่อนหน้า
        </button>

        {showVarPicker && (
          <div style={{display: 'flex', flexWrap: 'wrap', gap: 5, width: '100%', paddingTop: 4}}>
            {folder.variables.map(v => (
              <button
                key={v.key}
                type="button"
                className="cf-btn cf-btn-sm"
                onClick={() => insertAtActiveField(`{{var.${v.key}}}`)}
              >
                {v.label} ({`{{var.${v.key}}}`})
              </button>
            ))}
          </div>
        )}

        {showRefPicker && (
          <div style={{display: 'flex', flexDirection: 'column', gap: 4, width: '100%', paddingTop: 4}}>
            {otherDocs.length === 0 ? (
              <span style={{color: '#64748b'}}>ยังไม่มีเอกสารอื่นในแฟ้มให้อ้างอิง</span>
            ) : (
              otherDocs.map(other => (
                <div key={other.id} style={{display: 'flex', gap: 5, alignItems: 'center', flexWrap: 'wrap'}}>
                  <span style={{fontWeight: 600}}>{other.title}</span>
                  <button
                    type="button"
                    className="cf-btn cf-btn-sm cf-btn-primary"
                    onClick={() => insertAtActiveField(`{{ref:${other.id}:full}}`)}
                  >
                    แทรกอ้างอิงเต็ม (ที่ ... ลงวันที่ ...)
                  </button>
                  <button
                    type="button"
                    className="cf-btn cf-btn-sm"
                    onClick={() => insertAtActiveField(`{{ref:${other.id}:short}}`)}
                  >
                    เฉพาะเลขที่
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Type-specific fields */}
      {payload.docType === 'INTERNAL_MEMO' && (
        <div className="cf-form-grid">
          <div className="cf-field">
            <label htmlFor="cf-memo-recipient">เรียน</label>
            <input
              id="cf-memo-recipient"
              value={payload.recipient}
              onChange={e => onUpdateItem({...doc, payload: {...payload, recipient: e.target.value}})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-memo-chain">สายการเสนอเซ็น / อนุมัติ</label>
            <select
              id="cf-memo-chain"
              value={payload.approvalChain}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, approvalChain: e.target.value as MemoApprovalChain},
                })
              }
            >
              <option value="3_TIER">3 ระดับ (ผอ.กอง → ปลัด → นายกฯ)</option>
              <option value="2_TIER">2 ระดับ (ปลัด → นายกฯ)</option>
              <option value="4_TIER_VERTICAL">แนวตั้ง 4 ระดับ</option>
              <option value="NONE">ไม่แสดงกล่องอนุมัติ</option>
            </select>
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-memo-bg">เรื่องเดิม</label>
            <textarea
              id="cf-memo-bg"
              value={payload.sections.background}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, sections: {...payload.sections, background: e.target.value}},
                })
              }
              {...bindFocus(
                () => payload.sections.background,
                v =>
                  onUpdateItem({
                    ...doc,
                    payload: {...payload, sections: {...payload.sections, background: v}},
                  }),
              )}
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-memo-facts">ข้อเท็จจริง</label>
            <textarea
              id="cf-memo-facts"
              value={payload.sections.facts}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, sections: {...payload.sections, facts: e.target.value}},
                })
              }
              {...bindFocus(
                () => payload.sections.facts,
                v =>
                  onUpdateItem({
                    ...doc,
                    payload: {...payload, sections: {...payload.sections, facts: v}},
                  }),
              )}
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-memo-legal">ข้อระเบียบ / กฎหมาย</label>
            <textarea
              id="cf-memo-legal"
              value={payload.sections.legalBasis}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, sections: {...payload.sections, legalBasis: e.target.value}},
                })
              }
              {...bindFocus(
                () => payload.sections.legalBasis,
                v =>
                  onUpdateItem({
                    ...doc,
                    payload: {...payload, sections: {...payload.sections, legalBasis: v}},
                  }),
              )}
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-memo-proposal">ข้อพิจารณาและข้อเสนอ</label>
            <textarea
              id="cf-memo-proposal"
              value={payload.sections.proposal}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, sections: {...payload.sections, proposal: e.target.value}},
                })
              }
              {...bindFocus(
                () => payload.sections.proposal,
                v =>
                  onUpdateItem({
                    ...doc,
                    payload: {...payload, sections: {...payload.sections, proposal: v}},
                  }),
              )}
            />
          </div>
        </div>
      )}

      {payload.docType === 'EXTERNAL_LETTER' && (
        <div className="cf-form-grid">
          <div className="cf-field cf-wide">
            <label htmlFor="cf-ext-recipient">เรียน</label>
            <input
              id="cf-ext-recipient"
              value={payload.recipient}
              onChange={e => onUpdateItem({...doc, payload: {...payload, recipient: e.target.value}})}
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-ext-refs">อ้างถึง (บรรทัดละ 1 รายการ)</label>
            <textarea
              id="cf-ext-refs"
              value={payload.references.join('\n')}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {
                    ...payload,
                    references: e.target.value.split('\n').filter(line => line.trim().length > 0),
                  },
                })
              }
              {...bindFocus(
                () => payload.references.join('\n'),
                v =>
                  onUpdateItem({
                    ...doc,
                    payload: {
                      ...payload,
                      references: v.split('\n').filter(line => line.trim().length > 0),
                    },
                  }),
              )}
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-ext-encs">สิ่งที่ส่งมาด้วย (บรรทัดละ 1 รายการ)</label>
            <textarea
              id="cf-ext-encs"
              value={payload.enclosures.join('\n')}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {
                    ...payload,
                    enclosures: e.target.value.split('\n').filter(line => line.trim().length > 0),
                  },
                })
              }
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-ext-body">เนื้อหาหนังสือภายนอก (ย่อหน้าละ 1 บรรทัด)</label>
            <textarea
              id="cf-ext-body"
              value={payload.bodyParagraphs.join('\n')}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, bodyParagraphs: e.target.value.split('\n')},
                })
              }
              {...bindFocus(
                () => payload.bodyParagraphs.join('\n'),
                v => onUpdateItem({...doc, payload: {...payload, bodyParagraphs: v.split('\n')}}),
              )}
            />
          </div>
        </div>
      )}

      {payload.docType === 'MUNICIPAL_ORDER' && (
        <div className="cf-form-grid">
          <div className="cf-field cf-wide">
            <label htmlFor="cf-order-preamble">อารัมภบท / เหตุผลในการออกคำสั่ง (ย่อหน้าละ 1 บรรทัด)</label>
            <textarea
              id="cf-order-preamble"
              value={payload.preambleParagraphs.join('\n')}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, preambleParagraphs: e.target.value.split('\n')},
                })
              }
              {...bindFocus(
                () => payload.preambleParagraphs.join('\n'),
                v => onUpdateItem({...doc, payload: {...payload, preambleParagraphs: v.split('\n')}}),
              )}
            />
          </div>
          <div className="cf-field cf-wide">
            <label>รายชื่อผู้ได้รับแต่งตั้ง</label>
            <div style={{display: 'flex', flexDirection: 'column', gap: 6}}>
              {payload.appointees.map((ap, idx) => (
                <div key={idx} style={{display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: 6}}>
                  <input
                    placeholder="ชื่อ-สกุล"
                    value={ap.fullName}
                    onChange={e => {
                      const next = payload.appointees.map((a, i) =>
                        i === idx ? {...a, fullName: e.target.value} : a,
                      );
                      onUpdateItem({...doc, payload: {...payload, appointees: next}});
                    }}
                  />
                  <input
                    placeholder="ตำแหน่ง"
                    value={ap.position}
                    onChange={e => {
                      const next = payload.appointees.map((a, i) =>
                        i === idx ? {...a, position: e.target.value} : a,
                      );
                      onUpdateItem({...doc, payload: {...payload, appointees: next}});
                    }}
                  />
                  <input
                    placeholder="บทบาท/หน้าที่"
                    value={ap.role}
                    onChange={e => {
                      const next = payload.appointees.map((a, i) =>
                        i === idx ? {...a, role: e.target.value} : a,
                      );
                      onUpdateItem({...doc, payload: {...payload, appointees: next}});
                    }}
                  />
                  <button
                    type="button"
                    className="cf-btn cf-btn-sm cf-btn-danger"
                    onClick={() => {
                      const next = payload.appointees.filter((_, i) => i !== idx);
                      onUpdateItem({...doc, payload: {...payload, appointees: next}});
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="cf-btn cf-btn-sm"
                style={{alignSelf: 'flex-start'}}
                onClick={() =>
                  onUpdateItem({
                    ...doc,
                    payload: {
                      ...payload,
                      appointees: [...payload.appointees, {fullName: '', position: '', role: 'กรรมการ'}],
                    },
                  })
                }
              >
                <Plus size={13} />
                เพิ่มรายชื่อ
              </button>
            </div>
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-order-duties">อำนาจหน้าที่ (ย่อหน้าละ 1 บรรทัด)</label>
            <textarea
              id="cf-order-duties"
              value={payload.dutiesParagraphs.join('\n')}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, dutiesParagraphs: e.target.value.split('\n')},
                })
              }
              {...bindFocus(
                () => payload.dutiesParagraphs.join('\n'),
                v => onUpdateItem({...doc, payload: {...payload, dutiesParagraphs: v.split('\n')}}),
              )}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-order-routing">แถบเสนอเซ็น (Routing Strip)</label>
            <select
              id="cf-order-routing"
              value={payload.routingStripMode}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, routingStripMode: e.target.value as RoutingStripVisibility},
                })
              }
            >
              <option value="FIRST_COPY_ONLY">พิมพ์เฉพาะชุดที่ 1 (ต้นฉบับเก็บเรื่อง)</option>
              <option value="ALL_COPIES">พิมพ์ทุกชุด</option>
              <option value="NONE">ไม่พิมพ์แถบเสนอเซ็น</option>
            </select>
          </div>
          <div className="cf-field">
            <label htmlFor="cf-order-effective">ข้อความบังคับใช้</label>
            <input
              id="cf-order-effective"
              value={payload.effectiveNote}
              onChange={e => onUpdateItem({...doc, payload: {...payload, effectiveNote: e.target.value}})}
            />
          </div>
        </div>
      )}

      {payload.docType === 'ANNOUNCEMENT' && (
        <div className="cf-form-grid">
          <div className="cf-field">
            <label htmlFor="cf-ann-log">เลขทะเบียนประกาศ (เก็บในระบบ ไม่พิมพ์บนกระดาษ)</label>
            <input
              id="cf-ann-log"
              value={payload.registryLogNo}
              onChange={e => onUpdateItem({...doc, payload: {...payload, registryLogNo: e.target.value}})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-ann-closing">ข้อความลงท้ายประกาศ</label>
            <input
              id="cf-ann-closing"
              value={payload.closingNote}
              onChange={e => onUpdateItem({...doc, payload: {...payload, closingNote: e.target.value}})}
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-ann-body">เนื้อหาประกาศ (ย่อหน้าละ 1 บรรทัด)</label>
            <textarea
              id="cf-ann-body"
              value={payload.bodyParagraphs.join('\n')}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, bodyParagraphs: e.target.value.split('\n')},
                })
              }
              {...bindFocus(
                () => payload.bodyParagraphs.join('\n'),
                v => onUpdateItem({...doc, payload: {...payload, bodyParagraphs: v.split('\n')}}),
              )}
            />
          </div>
        </div>
      )}

      {payload.docType === 'CERTIFICATE_OR_INVITATION' && (
        <div className="cf-form-grid">
          <div className="cf-field">
            <label htmlFor="cf-cert-variant">รูปแบบ</label>
            <select
              id="cf-cert-variant"
              value={payload.variant}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, variant: e.target.value as 'INVITATION' | 'CERTIFICATE'},
                })
              }
            >
              <option value="INVITATION">หนังสือเชิญวิทยากร / เชิญประชุม</option>
              <option value="CERTIFICATE">หนังสือรับรอง</option>
            </select>
          </div>
          <div className="cf-field">
            <label htmlFor="cf-cert-recip">เรียน / ผู้รับ</label>
            <input
              id="cf-cert-recip"
              value={payload.recipient}
              onChange={e => onUpdateItem({...doc, payload: {...payload, recipient: e.target.value}})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-cert-date">วัน/วันที่จัดงาน</label>
            <input
              id="cf-cert-date"
              value={payload.eventDate}
              onChange={e => onUpdateItem({...doc, payload: {...payload, eventDate: e.target.value}})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-cert-loc">สถานที่จัดงาน</label>
            <input
              id="cf-cert-loc"
              value={payload.eventLocation}
              onChange={e => onUpdateItem({...doc, payload: {...payload, eventLocation: e.target.value}})}
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-cert-body">เนื้อหา (ย่อหน้าละ 1 บรรทัด)</label>
            <textarea
              id="cf-cert-body"
              value={payload.bodyParagraphs.join('\n')}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, bodyParagraphs: e.target.value.split('\n')},
                })
              }
              {...bindFocus(
                () => payload.bodyParagraphs.join('\n'),
                v => onUpdateItem({...doc, payload: {...payload, bodyParagraphs: v.split('\n')}}),
              )}
            />
          </div>
        </div>
      )}

      {payload.docType === 'PROJECT_PROPOSAL_OR_ATTACHMENT' && (
        <div className="cf-form-grid">
          <div className="cf-field cf-wide">
            <label htmlFor="cf-prop-name">ชื่อโครงการ</label>
            <input
              id="cf-prop-name"
              value={payload.projectName}
              onChange={e => onUpdateItem({...doc, payload: {...payload, projectName: e.target.value}})}
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-prop-rat">หลักการและเหตุผล</label>
            <textarea
              id="cf-prop-rat"
              value={payload.rationale}
              onChange={e => onUpdateItem({...doc, payload: {...payload, rationale: e.target.value}})}
              {...bindFocus(
                () => payload.rationale,
                v => onUpdateItem({...doc, payload: {...payload, rationale: v}}),
              )}
            />
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-prop-obj">วัตถุประสงค์ (ข้อละ 1 บรรทัด)</label>
            <textarea
              id="cf-prop-obj"
              value={payload.objectives.join('\n')}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {...payload, objectives: e.target.value.split('\n').filter(Boolean)},
                })
              }
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-prop-sched">ระยะเวลาและสถานที่</label>
            <input
              id="cf-prop-sched"
              value={payload.scheduleAndLocation}
              onChange={e =>
                onUpdateItem({...doc, payload: {...payload, scheduleAndLocation: e.target.value}})
              }
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-prop-budget">งบประมาณ</label>
            <input
              id="cf-prop-budget"
              value={payload.budgetSummary}
              onChange={e =>
                onUpdateItem({...doc, payload: {...payload, budgetSummary: e.target.value}})
              }
            />
          </div>
        </div>
      )}

      {payload.docType === 'PHOTO_SHEET' && (
        <div className="cf-form-grid">
          <div className="cf-field">
            <label htmlFor="cf-photo-sub">คำบรรยายหัวเรื่อง</label>
            <input
              id="cf-photo-sub"
              value={payload.subtitle}
              onChange={e => onUpdateItem({...doc, payload: {...payload, subtitle: e.target.value}})}
            />
          </div>
          <div className="cf-field">
            <label htmlFor="cf-photo-layout">การจัดวางภาพ</label>
            <select
              id="cf-photo-layout"
              value={payload.layout}
              onChange={e =>
                onUpdateItem({
                  ...doc,
                  payload: {
                    ...payload,
                    layout: e.target.value as '1_PER_PAGE' | '2_PER_PAGE' | 'GRID_2X2',
                  },
                })
              }
            >
              <option value="1_PER_PAGE">1 ภาพต่อหน้า</option>
              <option value="2_PER_PAGE">2 ภาพต่อหน้า</option>
              <option value="GRID_2X2">4 ภาพต่อหน้า (2x2)</option>
            </select>
          </div>
          <div className="cf-field cf-wide">
            <label htmlFor="cf-photo-cert">ข้อความรับรองท้ายหน้า</label>
            <input
              id="cf-photo-cert"
              value={payload.certificationText}
              onChange={e =>
                onUpdateItem({...doc, payload: {...payload, certificationText: e.target.value}})
              }
            />
          </div>
        </div>
      )}

      {/* Local Word Handoff & External Override box */}
      <div className="cf-override-box">
        <div style={{fontWeight: 700, fontSize: '0.86rem'}}>
          ส่งไฟล์นี้ให้เพื่อนแก้ข้างนอก / อัปโหลดฉบับที่แก้แล้ว
        </div>
        <div className="cf-actions">
          <button
            type="button"
            className="cf-btn cf-btn-sm"
            disabled={busyFile}
            onClick={() => void handleDownloadSingleWord()}
          >
            <Download size={14} />
            โหลดเป็น Word (.docx)
          </button>

          <label className="cf-btn cf-btn-sm cf-btn-accent" style={{cursor: 'pointer'}}>
            <FileUp size={14} />
            แนบฉบับแก้ไขภายนอก (Override)
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              style={{display: 'none'}}
              disabled={busyFile}
              onChange={e => {
                void handleUploadOverride(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>

          {doc.externalOverride && (
            <>
              <span className="cf-pill cf-pill-amber">
                ใช้ฉบับภายนอก: {doc.externalOverride.fileName}
              </span>
              <button
                type="button"
                className="cf-btn cf-btn-sm cf-btn-danger"
                onClick={() => onUpdateItem({...doc, externalOverride: undefined})}
              >
                ยกเลิก Override
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
