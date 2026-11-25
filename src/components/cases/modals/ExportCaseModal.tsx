'use client';
import {useState} from 'react';
import {Cloud, Download, FileArchive, Printer, Upload, X} from 'lucide-react';
import type {CaseFolder} from '@/lib/cases/types';
import {
  backupCaseToDrive,
  downloadCaseExport,
  importPortableArchive,
} from '../client-api';

interface Props {
  folder: CaseFolder;
  driveConnected: boolean;
  onImported?: (newFolderId: string) => void;
  onNotice?: (message: string) => void;
  onClose: () => void;
}

export function ExportCaseModal({
  folder,
  driveConnected,
  onImported,
  onNotice,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'pdf' | 'handoff' | 'portable'>('pdf');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  // Tab 1: PDF Binder
  const [pdfMode, setPdfMode] = useState<'FULL_BINDER' | 'BY_STAGE'>('FULL_BINDER');
  const [stageId, setStageId] = useState(folder.stages[0]?.id ?? '');
  const [duplicateCopies, setDuplicateCopies] = useState(true);
  const [includeLinkedPdfs, setIncludeLinkedPdfs] = useState(true);
  const [includeDividers, setIncludeDividers] = useState(true);
  const [includeCoverChecklist, setIncludeCoverChecklist] = useState(true);

  // Tab 2: Local Word Handoff Kit (.zip)
  const [highlightBlanks, setHighlightBlanks] = useState(true);
  const [includeRoadmapFiles, setIncludeRoadmapFiles] = useState(true);
  const [includeAttachmentsAndLinked, setIncludeAttachmentsAndLinked] = useState(true);

  async function handleExportPdf() {
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await downloadCaseExport(
        '/api/cases/export/pdf-binder',
        {
          folder,
          mode: pdfMode,
          stageId: pdfMode === 'BY_STAGE' ? stageId : undefined,
          duplicateCopies,
          includeLinkedPdfs,
          includeDividers,
          includeCoverChecklist,
          highlightBlanks: false,
        },
        `${folder.name}_แฟ้มพร้อมพิมพ์.pdf`,
      );
      setStatusMsg(`ดาวน์โหลด ${res.fileName} เรียบร้อยแล้ว`);
      onNotice?.(`ส่งออก PDF แฟ้มพร้อมพิมพ์แล้ว (${res.fileName})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งออก PDF แฟ้มพร้อมพิมพ์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function handleExportHandoffZip() {
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await downloadCaseExport(
        '/api/cases/export/local-handoff',
        {
          folder,
          highlightBlanks,
          includeRoadmapFiles,
          includeAttachmentsAndLinked,
        },
        `${folder.name}_ชุดส่งต่อWord.zip`,
      );
      setStatusMsg(`ดาวน์โหลด ${res.fileName} เรียบร้อยแล้ว`);
      onNotice?.(`ส่งออกชุดส่งต่อ Word (.zip) แล้ว (${res.fileName})`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สร้างชุดส่งต่อ Word (.zip) ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function handleExportPortable() {
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await downloadCaseExport(
        '/api/cases/export/portable',
        {folder, includeBlueprints: false},
        `${folder.name}.sarabun-case.json`,
      );
      setStatusMsg(`ดาวน์โหลดไฟล์สำรอง ${res.fileName} เรียบร้อยแล้ว`);
      onNotice?.(`ดาวน์โหลดไฟล์สำรอง ${res.fileName} แล้ว`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งออกไฟล์สำรองไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function handleImportPortableFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const text = await file.text();
      const res = await importPortableArchive(text);
      setStatusMsg(`นำเข้าแฟ้ม "${res.folderName}" เรียบร้อยแล้ว`);
      onNotice?.(`นำเข้าแฟ้ม "${res.folderName}" เรียบร้อยแล้ว`);
      onImported?.(res.importedFolderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'นำเข้าไฟล์สำรองไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function handleDriveBackup() {
    setBusy(true);
    setError('');
    setStatusMsg('');
    try {
      const res = await backupCaseToDrive(folder);
      if (!res.ok) {
        setStatusMsg(res.message || 'ยังไม่ได้เชื่อมต่อ Google Drive');
      } else {
        setStatusMsg(`สำรองแฟ้มขึ้น Google Drive เรียบร้อยแล้ว`);
        onNotice?.('สำรองแฟ้มขึ้น Google Drive แล้ว');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'สำรองขึ้น Google Drive ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="cf-modal-backdrop" role="dialog" aria-modal="true" aria-label="ส่งออกและสำรองแฟ้มงาน">
      <div className="cf-modal">
        <div className="cf-modal-head">
          <h2>ส่งออก &amp; สำรองแฟ้มงาน — {folder.name}</h2>
          <button type="button" className="cf-btn cf-btn-sm" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <X size={16} />
          </button>
        </div>

        <div className="cf-modal-body">
          <div className="cf-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'pdf'}
              className={`cf-tab ${tab === 'pdf' ? 'is-active' : ''}`}
              onClick={() => setTab('pdf')}
            >
              <Printer size={14} style={{display: 'inline', marginRight: 5}} />
              PDF พร้อมพิมพ์เข้าแฟ้ม
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'handoff'}
              className={`cf-tab ${tab === 'handoff' ? 'is-active' : ''}`}
              onClick={() => setTab('handoff')}
            >
              <FileArchive size={14} style={{display: 'inline', marginRight: 5}} />
              ชุดส่งต่อ Word (.zip)
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'portable'}
              className={`cf-tab ${tab === 'portable' ? 'is-active' : ''}`}
              onClick={() => setTab('portable')}
            >
              <Cloud size={14} style={{display: 'inline', marginRight: 5}} />
              สำรองข้อมูล / ย้ายเครื่อง
            </button>
          </div>

          {error && <div className="cf-error">{error}</div>}
          {statusMsg && <div className="cf-notice">{statusMsg}</div>}

          {tab === 'pdf' && (
            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              <div className="cf-form-grid">
                <div className="cf-field">
                  <label htmlFor="cf-pdf-mode">ขอบเขตการรวมเล่ม</label>
                  <select
                    id="cf-pdf-mode"
                    value={pdfMode}
                    onChange={e => setPdfMode(e.target.value as 'FULL_BINDER' | 'BY_STAGE')}
                  >
                    <option value="FULL_BINDER">รวมทั้งแฟ้ม (ทุกขั้นตอน)</option>
                    <option value="BY_STAGE">เฉพาะรอบเสนอเซ็น (Stage)</option>
                  </select>
                </div>

                {pdfMode === 'BY_STAGE' && (
                  <div className="cf-field">
                    <label htmlFor="cf-pdf-stage">เลือกรอบเสนอเซ็น</label>
                    <select
                      id="cf-pdf-stage"
                      value={stageId}
                      onChange={e => setStageId(e.target.value)}
                    >
                      {folder.stages.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <label className="cf-check-row">
                <input
                  type="checkbox"
                  checked={duplicateCopies}
                  onChange={e => setDuplicateCopies(e.target.checked)}
                />
                <span>เบิ้ลจำนวนชุดอัตโนมัติ (1x / 2x / 3x ตามที่ตั้งไว้ในแต่ละเอกสาร)</span>
              </label>

              <label className="cf-check-row">
                <input
                  type="checkbox"
                  checked={includeLinkedPdfs}
                  onChange={e => setIncludeLinkedPdfs(e.target.checked)}
                />
                <span>รวมไฟล์ PDF จากงานจัดซื้อจัดจ้าง / พัสดุที่ผูกไว้เข้าเล่มด้วย</span>
              </label>

              <label className="cf-check-row">
                <input
                  type="checkbox"
                  checked={includeDividers}
                  onChange={e => setIncludeDividers(e.target.checked)}
                />
                <span>แทรกแผ่นคั่นสำหรับไฟล์ที่ยังไม่ได้อัปโหลด</span>
              </label>

              <label className="cf-check-row">
                <input
                  type="checkbox"
                  checked={includeCoverChecklist}
                  onChange={e => setIncludeCoverChecklist(e.target.checked)}
                />
                <span>แนบใบปะหน้าลายแทงประจำแฟ้ม (หน้าแรก)</span>
              </label>

              <div style={{marginTop: 6}}>
                <button
                  type="button"
                  className="cf-btn cf-btn-primary"
                  disabled={busy}
                  onClick={handleExportPdf}
                >
                  <Printer size={15} />
                  {busy ? 'กำลังรวมเล่ม PDF…' : 'ดาวน์โหลด PDF พร้อมพิมพ์เข้าแฟ้ม'}
                </button>
              </div>
            </div>
          )}

          {tab === 'handoff' && (
            <div style={{display: 'flex', flexDirection: 'column', gap: 10}}>
              <p style={{margin: 0, fontSize: '0.86rem', color: '#475569'}}>
                จัดชุดโฟลเดอร์ไฟล์ Word (<code>.docx</code>) เรียงตามรอบเสนอเซ็นพร้อมใบลายแทง เหมาะสำหรับส่งต่อทาง USB, LAN หรือ LINE/อีเมล
              </p>

              <label className="cf-check-row">
                <input
                  type="checkbox"
                  checked={highlightBlanks}
                  onChange={e => setHighlightBlanks(e.target.checked)}
                />
                <span>ไฮไลต์สีเหลืองตรงช่องที่ยังว่าง (ช่วยให้คนนอกระบบเห็นจุดต้องเติม)</span>
              </label>

              <label className="cf-check-row">
                <input
                  type="checkbox"
                  checked={includeRoadmapFiles}
                  onChange={e => setIncludeRoadmapFiles(e.target.checked)}
                />
                <span>แนบไฟล์ 00_ลายแทงและเช็กลิสต์แฟ้มงาน.docx และ .txt</span>
              </label>

              <label className="cf-check-row">
                <input
                  type="checkbox"
                  checked={includeAttachmentsAndLinked}
                  onChange={e => setIncludeAttachmentsAndLinked(e.target.checked)}
                />
                <span>รวมโฟลเดอร์ไฟล์แนบ ฉบับแก้ไขภายนอก และเอกสารจากงานจัดซื้อ/พัสดุที่ผูกไว้</span>
              </label>

              <div style={{marginTop: 6}}>
                <button
                  type="button"
                  className="cf-btn cf-btn-accent"
                  disabled={busy}
                  onClick={handleExportHandoffZip}
                >
                  <Download size={15} />
                  {busy ? 'กำลังสร้างไฟล์ .zip…' : 'ดาวน์โหลดชุดส่งต่อ Word (.zip)'}
                </button>
              </div>
            </div>
          )}

          {tab === 'portable' && (
            <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
              <p style={{margin: 0, fontSize: '0.86rem', color: '#475569'}}>
                ส่งออกแฟ้มงานเป็นไฟล์ <code>.sarabun-case.json</code> เพื่อย้ายไปเปิดบนเครื่องอื่น หรือนำเข้าแฟ้มที่สำรองไว้กลับมาแก้ไขต่อ
              </p>

              <div className="cf-actions">
                <button
                  type="button"
                  className="cf-btn cf-btn-primary"
                  disabled={busy}
                  onClick={handleExportPortable}
                >
                  <Download size={15} />
                  ดาวน์โหลดไฟล์สำรอง (.sarabun-case.json)
                </button>

                <label className="cf-btn" style={{cursor: busy ? 'not-allowed' : 'pointer'}}>
                  <Upload size={15} />
                  นำเข้าไฟล์ .sarabun-case.json
                  <input
                    type="file"
                    accept=".json,application/json"
                    style={{display: 'none'}}
                    disabled={busy}
                    onChange={e => {
                      void handleImportPortableFile(e.target.files?.[0]);
                      e.target.value = '';
                    }}
                  />
                </label>

                <button
                  type="button"
                  className="cf-btn"
                  disabled={busy}
                  onClick={handleDriveBackup}
                  title={driveConnected ? 'อัปโหลดไฟล์สำรองขึ้น Google Drive' : 'ยังไม่ได้เชื่อมต่อ Google Drive'}
                >
                  <Cloud size={15} />
                  {driveConnected ? 'สำรองขึ้น Google Drive' : 'ตรวจสถานะ Google Drive'}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="cf-modal-foot">
          <button type="button" className="cf-btn" onClick={onClose}>
            ปิด
          </button>
        </div>
      </div>
    </div>
  );
}
