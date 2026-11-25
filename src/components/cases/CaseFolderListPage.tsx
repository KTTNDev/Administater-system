'use client';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Copy,
  FileText,
  FolderOpen,
  FolderPlus,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import type {SavedDraft} from '@/lib/document';
import type {CaseFolder, CaseFolderStatus, CaseNumberTrack} from '@/lib/cases/types';
import {
  createBlankCaseFolder,
  fetchCaseDomain,
  importPortableArchive,
  postCaseAction,
  type CaseDomainPayload,
} from './client-api';
import {CaseFolderWorkspace} from './CaseFolderWorkspace';
import {NewCaseFromBlueprintModal} from './modals/NewCaseFromBlueprintModal';
import {QuickBlankWordModal} from './modals/QuickBlankWordModal';
import './cases-workspace.css';

const STATUS_LABELS: Record<CaseFolderStatus, string> = {
  DRAFT: 'ร่าง',
  IN_PROGRESS: 'กำลังดำเนินการ',
  COMPLETED: 'เสร็จสิ้น',
  ARCHIVED: 'เก็บเข้าคลัง',
};

interface Props {
  requestedCase?: {folderId: string; itemId?: string} | null;
  onRequestedCaseHandled?: () => void;
  onOpenDocument?: (draft: SavedDraft) => boolean | void;
  onDraftsChanged?: (drafts: SavedDraft[]) => void;
  onDirty?: (dirty: boolean) => void;
  onBusy?: (busy: boolean) => void;
}

export function CaseFolderListPage({
  requestedCase,
  onRequestedCaseHandled,
  onOpenDocument,
  onDraftsChanged,
  onDirty,
  onBusy,
}: Props) {
  const [payload, setPayload] = useState<CaseDomainPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeItemId, setActiveItemId] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [yearFilter, setYearFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [showNewModal, setShowNewModal] = useState(false);
  const [showQuickWord, setShowQuickWord] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const versionRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);

  const reload = useCallback(async () => {
    setError('');
    try {
      const next = await fetchCaseDomain();
      versionRef.current = next.record.version;
      setPayload(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'โหลดข้อมูลแฟ้มงานสารบรรณไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!requestedCase) return;
    setActiveFolderId(requestedCase.folderId);
    setActiveItemId(requestedCase.itemId);
    onRequestedCaseHandled?.();
  }, [requestedCase, onRequestedCaseHandled]);

  const runAction = useCallback(
    async (actionBody: Record<string, unknown>, successMsg?: string): Promise<CaseDomainPayload> => {
      setBusy(true);
      setError('');
      try {
        const next = await postCaseAction({
          ...actionBody,
          expectedVersion: versionRef.current,
        });
        versionRef.current = next.record.version;
        setPayload(next);
        if (successMsg) setNotice(successMsg);
        return next;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'ดำเนินการไม่สำเร็จ';
        setError(msg);
        if (msg.includes('ถูกแก้ไขจากหน้าต่างอื่น')) {
          void reload();
        }
        throw e;
      } finally {
        setBusy(false);
      }
    },
    [reload],
  );

  const folders = payload?.record.data.folders ?? [];
  const blueprints = payload?.record.data.blueprints ?? [];

  const availableYears = useMemo(
    () => Array.from(new Set(folders.map(f => f.fiscalYearBE))).sort((a, b) => b - a),
    [folders],
  );

  const filteredFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...folders]
      .filter(f => (yearFilter === 'ALL' ? true : String(f.fiscalYearBE) === yearFilter))
      .filter(f => (statusFilter === 'ALL' ? true : f.status === statusFilter))
      .filter(f =>
        !q
          ? true
          : [f.name, f.category, f.description, String(f.fiscalYearBE)]
              .join(' ')
              .toLowerCase()
              .includes(q),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [folders, yearFilter, statusFilter, search]);

  const activeFolder = useMemo(
    () => (activeFolderId ? folders.find(f => f.id === activeFolderId) ?? null : null),
    [activeFolderId, folders],
  );

  async function handleCreateBlank(input: {
    name: string;
    fiscalYearBE: number;
    category: string;
    description: string;
  }) {
    if (!payload) return;
    const created = createBlankCaseFolder({
      ...input,
      agency: payload.defaults.agency,
      signatories: payload.defaults.signatories,
    });
    const next = await runAction({action: 'upsertFolder', folder: created}, `สร้างแฟ้ม "${created.name}" แล้ว`);
    setActiveFolderId(next.createdId ?? created.id);
  }

  async function handleCreateFromBlueprint(input: {
    blueprintId: string;
    name: string;
    fiscalYearBE: number;
  }) {
    const next = await runAction(
      {action: 'instantiateBlueprint', ...input},
      `สร้างแฟ้ม "${input.name}" จากแม่แบบแล้ว`,
    );
    if (next.createdId) setActiveFolderId(next.createdId);
  }

  async function handleSafeClone(input: {folderId: string; name?: string; fiscalYearBE?: number}) {
    const next = await runAction(
      {action: 'safeClone', ...input},
      'ทำ Safe Clone สำเร็จ (ล้างเลขที่หนังสือ วันที่ และไฟล์แก้ไขภายนอกเรียบร้อย)',
    );
    if (next.createdId) setActiveFolderId(next.createdId);
  }

  async function handleImportPortable(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const text = await file.text();
      const res = await importPortableArchive(text);
      await reload();
      setNotice(`นำเข้าแฟ้ม "${res.folderName}" เรียบร้อยแล้ว`);
      setActiveFolderId(res.importedFolderId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'นำเข้าไฟล์สำรองแฟ้มงานไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  if (activeFolder && payload) {
    return (
      <CaseFolderWorkspace
        initialFolder={activeFolder}
        initialItemId={activeItemId}
        initialLinkedSummaries={payload.linkedSummariesByFolder[activeFolder.id] ?? {}}
        availableProcurement={payload.availableProcurement}
        availableRequisitions={payload.availableRequisitions}
        availableAssetLoans={payload.availableAssetLoans}
        driveConnected={payload.drive.connected}
        busy={busy}
        onBack={() => {
          setActiveFolderId(null);
          setActiveItemId(undefined);
          void reload();
        }}
        onSaveFolder={async updated => {
          await runAction({action: 'upsertFolder', folder: updated});
        }}
        onSaveBlueprint={async (folderId, name) => {
          await runAction({action: 'saveBlueprint', folderId, name, clearVariableValues: true});
        }}
        onSafeClone={async folderId => {
          await handleSafeClone({folderId});
        }}
        onReserveNumber={async (track: Exclude<CaseNumberTrack, 'NONE'>, yearBE: number, sourceId?: string) => {
          const res = await runAction({action: 'reserveNumber', track, yearBE, sourceId});
          return res.reservedRunningNo;
        }}
        onImportedFolder={async newId => {
          await reload();
          setActiveFolderId(newId);
        }}
        onOpenDocument={onOpenDocument}
        onDraftsChanged={onDraftsChanged}
        onDirtyChange={onDirty}
      />
    );
  }

  return (
    <section className="cf-shell" aria-label="แฟ้มงานสารบรรณ">
      <header className="cf-header">
        <div>
          <h1>แฟ้มงานสารบรรณ (Case Folders)</h1>
          <p>
            บริหารแฟ้มงานหลายเอกสารพร้อมลายแทง ตัวแปรกลาง อ้างอิงข้ามฉบับอัตโนมัติ ผูกงานจัดซื้อจัดจ้าง/พัสดุ และสร้างไฟล์ Word แจกคนนอกระบบ
          </p>
        </div>

        <div className="cf-actions">
          <button
            type="button"
            className="cf-btn cf-btn-accent"
            onClick={() => setShowQuickWord(true)}
          >
            <FileText size={15} />
            สร้างฟอร์ม Word เปล่า (สำหรับคนนอกระบบ)
          </button>

          <label className="cf-btn" style={{cursor: 'pointer'}}>
            <Upload size={15} />
            นำเข้า .sarabun-case.json
            <input
              type="file"
              accept=".json,application/json"
              style={{display: 'none'}}
              onChange={e => {
                void handleImportPortable(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>

          <button
            type="button"
            className="cf-btn"
            disabled={busy}
            onClick={() => void reload()}
            title="โหลดข้อมูลล่าสุด"
          >
            <RefreshCw size={15} />
          </button>

          <button
            type="button"
            className="cf-btn cf-btn-primary"
            disabled={loading || busy}
            onClick={() => setShowNewModal(true)}
          >
            <FolderPlus size={15} />
            + สร้างแฟ้มงานใหม่
          </button>
        </div>
      </header>

      {notice && (
        <div className="cf-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="cf-btn cf-btn-sm" onClick={() => setNotice('')}>
            ปิด
          </button>
        </div>
      )}
      {error && (
        <div className="cf-error" role="alert">
          <span>{error}</span>
          <button type="button" className="cf-btn cf-btn-sm" onClick={() => setError('')}>
            ปิด
          </button>
        </div>
      )}

      <div className="cf-filter-bar">
        <input
          type="search"
          aria-label="ค้นหาแฟ้มงาน"
          placeholder="ค้นหาชื่อโครงการ หมวดหมู่ หรือรายละเอียด..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{flex: 1, minWidth: 220}}
        />
        <select
          aria-label="กรองตามปีงบประมาณ"
          value={yearFilter}
          onChange={e => setYearFilter(e.target.value)}
        >
          <option value="ALL">ทุกปีงบประมาณ</option>
          {availableYears.map(y => (
            <option key={y} value={String(y)}>
              ปีงบประมาณ {y}
            </option>
          ))}
        </select>
        <select
          aria-label="กรองตามสถานะ"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">ทุกสถานะ</option>
          {(Object.keys(STATUS_LABELS) as CaseFolderStatus[]).map(st => (
            <option key={st} value={st}>
              {STATUS_LABELS[st]}
            </option>
          ))}
        </select>
        <span className="cf-pill cf-pill-slate">
          ทั้งหมด {filteredFolders.length} แฟ้ม · แม่แบบ {blueprints.length} รายการ
        </span>
      </div>

      {loading ? (
        <div className="cf-empty">กำลังโหลดแฟ้มงานสารบรรณ…</div>
      ) : filteredFolders.length === 0 ? (
        <div className="cf-empty">
          <FolderOpen size={36} style={{marginBottom: 8, color: '#64748b'}} />
          <h3>ยังไม่มีแฟ้มงานสารบรรณ</h3>
          <p>กดปุ่ม &ldquo;+ สร้างแฟ้มงานใหม่&rdquo; เพื่อเริ่มจัดทำโครงการ หรือกด &ldquo;สร้างฟอร์ม Word เปล่า&rdquo; เพื่อโหลดเอกสารให้เพื่อนร่วมงาน</p>
        </div>
      ) : (
        <div className="cf-folder-grid">
          {filteredFolders.map(folder => {
            const linkedCount = folder.items.filter(i => i.kind === 'LINKED_MODULE_REF').length;
            const docCount = folder.items.filter(i => i.kind === 'GENERATED_DOC').length;
            return (
              <article key={folder.id} className="cf-folder-card" data-folder-card-id={folder.id}>
                <div className="cf-folder-card-top">
                  <h3>{folder.name}</h3>
                  <span className="cf-pill cf-pill-blue">{STATUS_LABELS[folder.status]}</span>
                </div>
                <div className="cf-folder-meta">
                  <span>ปีงบประมาณ {folder.fiscalYearBE}</span>
                  <span>· {folder.category}</span>
                  <span>· เอกสารในระบบ {docCount} ฉบับ</span>
                  {linkedCount > 0 && <span>· ผูกงานระบบอื่น {linkedCount} รายการ</span>}
                </div>
                {folder.description && (
                  <p style={{margin: 0, fontSize: '0.84rem', color: '#475569'}}>
                    {folder.description}
                  </p>
                )}
                <div className="cf-folder-card-actions">
                  <button
                    type="button"
                    className="cf-btn cf-btn-primary cf-btn-sm"
                    onClick={() => setActiveFolderId(folder.id)}
                  >
                    <FolderOpen size={14} />
                    เปิดแฟ้มงาน
                  </button>
                  <button
                    type="button"
                    className="cf-btn cf-btn-sm"
                    disabled={busy}
                    onClick={() => void handleSafeClone({folderId: folder.id})}
                  >
                    <Copy size={14} />
                    Safe Clone
                  </button>
                  <button
                    type="button"
                    className="cf-btn cf-btn-sm cf-btn-danger"
                    disabled={busy}
                    onClick={() => {
                      if (confirm(`ลบแฟ้มงาน "${folder.name}" หรือไม่?`)) {
                        void runAction({action: 'deleteFolder', folderId: folder.id}, 'ลบแฟ้มงานแล้ว');
                      }
                    }}
                  >
                    <Trash2 size={14} />
                    ลบ
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {showNewModal && (
        <NewCaseFromBlueprintModal
          blueprints={blueprints}
          existingFolders={folders}
          busy={busy}
          onCreateBlank={handleCreateBlank}
          onCreateFromBlueprint={handleCreateFromBlueprint}
          onSafeClone={handleSafeClone}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {showQuickWord && (
        <QuickBlankWordModal
          onSuccess={msg => setNotice(msg)}
          onClose={() => setShowQuickWord(false)}
        />
      )}
    </section>
  );
}
