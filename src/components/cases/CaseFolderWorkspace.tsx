'use client';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileEdit,
  Layers,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {CORE_DRAFT_SAVED} from '@/lib/core-draft-events';
import type {SavedDraft} from '@/lib/document';
import {validateCaseFolder} from '@/lib/cases/validator';
import type {
  CaseDocType,
  CaseFolder,
  CaseFolderStatus,
  CaseItem,
  CaseNumberTrack,
  CaseValidationIssue,
  LinkedModuleSummary,
  LinkedModuleTarget,
} from '@/lib/cases/types';
import {
  bindCaseCoreDraftsApi,
  createDefaultGeneratedDocItem,
  createExternalSlotItem,
  createLinkedModuleItem,
  downloadCaseExport,
  fetchCaseCoreDrafts,
  fetchCasePreviewHtml,
  type AvailableAssetLoanLink,
  type AvailableInventoryReqLink,
  type AvailableProcurementLink,
  type LinkedCaseCoreDraft,
} from './client-api';
import {CaseVariablesBar} from './roadmap/CaseVariablesBar';
import {RoadmapSidebar} from './roadmap/RoadmapSidebar';
import {DocumentFormEditor} from './editor/DocumentFormEditor';
import {LinkModuleModal} from './editor/LinkModuleModal';
import {ExportCaseModal} from './modals/ExportCaseModal';

interface Props {
  initialFolder: CaseFolder;
  initialItemId?: string;
  initialLinkedSummaries: Record<string, LinkedModuleSummary>;
  availableProcurement: AvailableProcurementLink[];
  availableRequisitions: AvailableInventoryReqLink[];
  availableAssetLoans: AvailableAssetLoanLink[];
  driveConnected: boolean;
  busy: boolean;
  onBack: () => void;
  onSaveFolder: (folder: CaseFolder) => Promise<void>;
  onSaveBlueprint: (folderId: string, name: string) => Promise<void>;
  onSafeClone: (folderId: string) => Promise<void>;
  onReserveNumber: (
    track: Exclude<CaseNumberTrack, 'NONE'>,
    yearBE: number,
    sourceId?: string,
  ) => Promise<string | undefined>;
  onImportedFolder: (newFolderId: string) => Promise<void>;
  onOpenDocument?: (draft: SavedDraft) => boolean | void;
  onDraftsChanged?: (drafts: SavedDraft[]) => void;
  onDirtyChange?: (dirty: boolean) => void;
}

export function CaseFolderWorkspace({
  initialFolder,
  initialItemId,
  initialLinkedSummaries,
  availableProcurement,
  availableRequisitions,
  availableAssetLoans,
  driveConnected,
  busy,
  onBack,
  onSaveFolder,
  onSaveBlueprint,
  onSafeClone,
  onReserveNumber,
  onImportedFolder,
  onOpenDocument,
  onDraftsChanged,
  onDirtyChange,
}: Props) {
  const [folder, setFolder] = useState<CaseFolder>(initialFolder);
  const [baseline, setBaseline] = useState<string>(() => JSON.stringify(initialFolder));
  const [selectedItemId, setSelectedItemId] = useState<string | null>(
    initialItemId && initialFolder.items.some(i => i.id === initialItemId)
      ? initialItemId
      : initialFolder.items[0]?.id ?? null,
  );
  const [linkedMapObj, setLinkedMapObj] = useState<Record<string, LinkedModuleSummary>>(
    initialLinkedSummaries,
  );
  const [coreLinks, setCoreLinks] = useState<LinkedCaseCoreDraft[]>([]);
  const [coreBusy, setCoreBusy] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [previewHeight, setPreviewHeight] = useState<number>(1123);
  const [previewPages, setPreviewPages] = useState<number>(0);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(55);
  const [highlightBlanks, setHighlightBlanks] = useState(true);
  const [serverIssues, setServerIssues] = useState<CaseValidationIssue[] | null>(null);
  const [linkModalStageId, setLinkModalStageId] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const previewFrameRef = useRef<HTMLIFrameElement>(null);

  const prevFolderIdRef = useRef(initialFolder.id);
  useEffect(() => {
    if (prevFolderIdRef.current !== initialFolder.id) {
      prevFolderIdRef.current = initialFolder.id;
      setFolder(initialFolder);
      setBaseline(JSON.stringify(initialFolder));
      setSelectedItemId(
        initialItemId && initialFolder.items.some(i => i.id === initialItemId)
          ? initialItemId
          : initialFolder.items[0]?.id ?? null,
      );
    } else if (initialItemId && initialFolder.items.some(i => i.id === initialItemId)) {
      setSelectedItemId(initialItemId);
    }
    setLinkedMapObj(initialLinkedSummaries);
  }, [initialFolder, initialItemId, initialLinkedSummaries]);

  const reloadCoreLinks = useCallback(async () => {
    try {
      const rows = await fetchCaseCoreDrafts(folder.id);
      setCoreLinks(rows);
      onDraftsChanged?.(rows.flatMap(r => (r.draft ? [r.draft] : [])));
    } catch {
      // Non-fatal if folder not persisted yet
    }
  }, [folder.id, onDraftsChanged]);

  useEffect(() => {
    void reloadCoreLinks();
  }, [reloadCoreLinks]);

  // Refresh Core bindings automatically when returning from Core Editor or another tab
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === 'visible') void reloadCoreLinks();
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === CORE_DRAFT_SAVED) refresh();
    };
    window.addEventListener('focus', refresh);
    window.addEventListener(CORE_DRAFT_SAVED, refresh);
    window.addEventListener('storage', onStorage);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      window.removeEventListener(CORE_DRAFT_SAVED, refresh);
      window.removeEventListener('storage', onStorage);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [reloadCoreLinks]);

  // Listen to Core documentHtml's `sarabun-preview` measurement postMessage
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== previewFrameRef.current?.contentWindow) return;
      const data = event.data;
      if (data?.source !== 'sarabun-preview') return;
      if (Number.isFinite(data.height) && data.height > 0) {
        setPreviewHeight(data.height);
      }
      if (Number.isFinite(data.pages) && data.pages > 0) {
        setPreviewPages(data.pages);
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const dirty = useMemo(() => JSON.stringify(folder) !== baseline, [folder, baseline]);
  useEffect(() => {
    onDirtyChange?.(dirty);
    return () => onDirtyChange?.(false);
  }, [dirty, onDirtyChange]);

  const linkedSummaries = useMemo(
    () => new Map<string, LinkedModuleSummary>(Object.entries(linkedMapObj)),
    [linkedMapObj],
  );

  const coreLinksByItem = useMemo(
    () => new Map(coreLinks.map(l => [l.item_id, l])),
    [coreLinks],
  );

  const selectedItem = useMemo(
    () => folder.items.find(i => i.id === selectedItemId) ?? folder.items[0] ?? null,
    [folder.items, selectedItemId],
  );

  const selectedCoreLink = selectedItem ? coreLinksByItem.get(selectedItem.id) ?? null : null;
  const generatedDocs = useMemo(
    () => folder.items.filter(i => i.kind === 'GENERATED_DOC'),
    [folder.items],
  );

  const localIssues = useMemo(
    () => validateCaseFolder(folder, {linkedSummaries}),
    [folder, linkedSummaries],
  );
  const validationIssues = serverIssues ?? localIssues;

  // Core A4 Preview (debounced 200ms) — renders through Core `documentHtml`
  useEffect(() => {
    if (!selectedItem || selectedItem.kind !== 'GENERATED_DOC') {
      setPreviewHtml('');
      setServerIssues(null);
      setPreviewPages(0);
      return;
    }

    let cancelled = false;
    const timer = setTimeout(() => {
      setPreviewLoading(true);
      void fetchCasePreviewHtml({
        folder,
        itemId: selectedItem.id,
        highlightBlanks,
        copyNumber: 1,
        preferBound: true,
      })
        .then(res => {
          if (cancelled) return;
          setPreviewHtml(res.html);
          setServerIssues(res.validationIssues);
          if (res.linkedSummaries) {
            setLinkedMapObj(prev => ({...prev, ...res.linkedSummaries}));
          }
        })
        .catch(() => {
          // Keep previous preview visible
        })
        .finally(() => {
          if (!cancelled) setPreviewLoading(false);
        });
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [folder, selectedItem, highlightBlanks, selectedCoreLink?.draft?.version]);

  const handleSave = useCallback(async () => {
    setError('');
    setNotice('');
    try {
      await onSaveFolder(folder);
      setBaseline(JSON.stringify(folder));
      setNotice('บันทึกแฟ้มงานสารบรรณเรียบร้อยแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกแฟ้มงานไม่สำเร็จ');
    }
  }, [folder, onSaveFolder]);

  const ensureSaved = useCallback(async () => {
    if (dirty) {
      await onSaveFolder(folder);
      setBaseline(JSON.stringify(folder));
    }
  }, [dirty, folder, onSaveFolder]);

  const handleBindAllCore = useCallback(
    async (mode: 'create' | 'sync', itemIds?: string[]) => {
      if (mode === 'sync') {
        const confirmed = confirm(
          'อัปเดตหัวหนังสือ เนื้อหา และชื่อผู้ลงนามจากข้อมูลแฟ้มงานเข้าสู่ร่าง Core หรือไม่?\n(ข้อความที่แก้ใน Core จะถูกซิงก์ใหม่ โดยยังคงลายเซ็น กล่องข้อความอิสระ ภาพแนบ และไฟล์แนบเดิมไว้)',
        );
        if (!confirmed) return;
      }
      setCoreBusy(true);
      setError('');
      setNotice('');
      try {
        await ensureSaved();
        const rows = await bindCaseCoreDraftsApi(folder.id, mode, itemIds);
        setCoreLinks(rows);
        onDraftsChanged?.(rows.flatMap(r => (r.draft ? [r.draft] : [])));
        setNotice(
          mode === 'sync'
            ? 'ซิงก์ข้อมูลแฟ้มงานเข้าสู่ร่าง Core เรียบร้อยแล้ว (คงลายเซ็น/กล่องข้อความอิสระเดิมไว้)'
            : `เชื่อมร่างเอกสารเข้าสู่ระบบ Core แล้ว ${rows.length}/${generatedDocs.length} ฉบับ`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : 'เชื่อมร่างเอกสารเข้าสู่ระบบ Core ไม่สำเร็จ');
      } finally {
        setCoreBusy(false);
      }
    },
    [ensureSaved, folder.id, generatedDocs.length, onDraftsChanged],
  );

  const handleOpenInCoreEditor = useCallback(
    async (itemId: string) => {
      if (!onOpenDocument) return;
      setCoreBusy(true);
      setError('');
      try {
        await ensureSaved();
        let rows = await fetchCaseCoreDrafts(folder.id);
        if (!rows.some(r => r.item_id === itemId)) {
          rows = await bindCaseCoreDraftsApi(folder.id, 'create', [itemId]);
        }
        setCoreLinks(rows);
        onDraftsChanged?.(rows.flatMap(r => (r.draft ? [r.draft] : [])));
        const draft = rows.find(r => r.item_id === itemId)?.draft;
        if (!draft) {
          throw new Error('ร่างเอกสารนี้อยู่ในถังขยะ กรุณากู้คืนร่างเดิมก่อนเปิดแก้ไข');
        }
        onOpenDocument(draft);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'เปิดเอกสารในระบบร่างหนังสือ (Core) ไม่สำเร็จ');
      } finally {
        setCoreBusy(false);
      }
    },
    [ensureSaved, folder.id, onDraftsChanged, onOpenDocument],
  );

  function handleAddDoc(docType: CaseDocType, stageId: string) {
    const stageItems = folder.items.filter(i => i.stageId === stageId);
    const nextOrder = stageItems.reduce((m, i) => Math.max(m, i.order), -1) + 1;
    const created = createDefaultGeneratedDocItem(docType, stageId, nextOrder, folder.agency);
    setFolder(f => ({...f, items: [...f.items, created]}));
    setSelectedItemId(created.id);
  }

  function handleAddExternalSlot(stageId: string) {
    const stageItems = folder.items.filter(i => i.stageId === stageId);
    const nextOrder = stageItems.reduce((m, i) => Math.max(m, i.order), -1) + 1;
    const created = createExternalSlotItem(stageId, nextOrder);
    setFolder(f => ({...f, items: [...f.items, created]}));
    setSelectedItemId(created.id);
  }

  function handleLinkModule(selection: {
    stageId: string;
    targetModule: LinkedModuleTarget;
    targetId: string;
    title: string;
    includePdfInBinder: boolean;
  }) {
    const stageItems = folder.items.filter(i => i.stageId === selection.stageId);
    const nextOrder = stageItems.reduce((m, i) => Math.max(m, i.order), -1) + 1;
    const created = createLinkedModuleItem({
      stageId: selection.stageId,
      order: nextOrder,
      targetModule: selection.targetModule,
      targetId: selection.targetId,
      title: selection.title,
      includePdfInBinder: selection.includePdfInBinder,
    });

    if (selection.targetModule === 'PROCUREMENT') {
      const p = availableProcurement.find(x => x.id === selection.targetId);
      if (p) {
        setLinkedMapObj(prev => ({
          ...prev,
          [created.id]: {
            itemId: created.id,
            targetModule: 'PROCUREMENT',
            targetId: p.id,
            found: true,
            title: p.title,
            referenceNo: p.poNumber,
            date: p.date,
            totalAmount: p.grandTotal,
            status: p.methodLabel,
            isIncomplete: false,
            incompleteReasons: [],
            pdfAvailable: true,
          },
        }));
      }
    } else if (selection.targetModule === 'INVENTORY_REQUISITION') {
      const r = availableRequisitions.find(x => x.id === selection.targetId);
      if (r) {
        setLinkedMapObj(prev => ({
          ...prev,
          [created.id]: {
            itemId: created.id,
            targetModule: 'INVENTORY_REQUISITION',
            targetId: r.id,
            found: true,
            title: r.purpose,
            referenceNo: `${r.runningNo}/${r.fiscalYearBE}`,
            date: r.requestDate,
            totalAmount: r.totalValue,
            status: r.status,
            isIncomplete: false,
            incompleteReasons: [],
            pdfAvailable: true,
          },
        }));
      }
    } else if (selection.targetModule === 'INVENTORY_ASSET_LOAN') {
      const l = availableAssetLoans.find(x => x.id === selection.targetId);
      if (l) {
        setLinkedMapObj(prev => ({
          ...prev,
          [created.id]: {
            itemId: created.id,
            targetModule: 'INVENTORY_ASSET_LOAN',
            targetId: l.id,
            found: true,
            title: l.assetName,
            referenceNo: `${l.runningNo}/${l.fiscalYearBE}`,
            date: l.loanDate,
            status: l.status,
            isIncomplete: false,
            incompleteReasons: [],
            pdfAvailable: true,
          },
        }));
      }
    }

    setFolder(f => ({...f, items: [...f.items, created]}));
    setSelectedItemId(created.id);
    setLinkModalStageId(null);
    setNotice(`ผูก "${selection.title}" เข้าสู่ลายแทงแล้ว`);
  }

  function handleAddStage(name: string) {
    const nextOrder = folder.stages.reduce((m, s) => Math.max(m, s.order), -1) + 1;
    setFolder(f => ({
      ...f,
      stages: [...f.stages, {id: `stage-${crypto.randomUUID().slice(0, 8)}`, name, order: nextOrder}],
    }));
  }

  function handleMoveItem(itemId: string, direction: 'up' | 'down') {
    const target = folder.items.find(i => i.id === itemId);
    if (!target) return;
    const peers = folder.items
      .filter(i => i.stageId === target.stageId)
      .sort((a, b) => a.order - b.order);
    const idx = peers.findIndex(i => i.id === itemId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= peers.length) return;
    const reordered = [...peers];
    const [moved] = reordered.splice(idx, 1);
    reordered.splice(swapIdx, 0, moved);
    const orderById = new Map(reordered.map((it, i) => [it.id, i]));
    setFolder(f => ({
      ...f,
      items: f.items.map(it =>
        orderById.has(it.id) ? {...it, order: orderById.get(it.id)!} : it,
      ),
    }));
  }

  function handleDeleteItem(itemId: string) {
    setFolder(f => ({...f, items: f.items.filter(i => i.id !== itemId)}));
    if (selectedItemId === itemId) {
      const remaining = folder.items.filter(i => i.id !== itemId);
      setSelectedItemId(remaining[0]?.id ?? null);
    }
  }

  function handleUpdateItem(nextItem: CaseItem) {
    setFolder(f => ({
      ...f,
      items: f.items.map(i => (i.id === nextItem.id ? nextItem : i)),
    }));
  }

  async function handleDownloadRoadmap() {
    setError('');
    try {
      const res = await downloadCaseExport(
        '/api/cases/export/blank-word',
        {mode: 'roadmap', folder},
        `00_ลายแทง_${folder.name}.docx`,
      );
      setNotice(`ดาวน์โหลดใบลายแทง (${res.fileName}) แล้ว`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ดาวน์โหลดใบลายแทงไม่สำเร็จ');
    }
  }

  async function handleBlueprintClick() {
    setError('');
    try {
      await onSaveFolder(folder);
      setBaseline(JSON.stringify(folder));
      await onSaveBlueprint(folder.id, `${folder.name} (แม่แบบ)`);
      setNotice('บันทึกแฟ้มงานนี้เป็นแม่แบบ (Blueprint) เรียบร้อยแล้ว');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกแม่แบบไม่สำเร็จ');
    }
  }

  async function handleSafeCloneClick() {
    setError('');
    try {
      await onSaveFolder(folder);
      setBaseline(JSON.stringify(folder));
      await onSafeClone(folder.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ทำ Safe Clone ไม่สำเร็จ');
    }
  }

  const errorCount = validationIssues.filter(i => i.severity === 'ERROR').length;
  const warnCount = validationIssues.filter(i => i.severity === 'WARNING').length;
  const isBusy = busy || coreBusy;

  return (
    <div className="cf-shell" data-case-folder-id={folder.id}>
      <header className="cf-header">
        <div style={{display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap'}}>
          <button
            type="button"
            className="cf-btn cf-btn-sm"
            onClick={() => {
              if (dirty && !confirm('มีการแก้ไขที่ยังไม่บันทึก ต้องการกลับหน้ารายการแฟ้มหรือไม่?')) return;
              onBack();
            }}
          >
            <ArrowLeft size={15} />
            กลับรายการแฟ้ม
          </button>
          <div>
            <h1>{folder.name}</h1>
            <p>
              ปีงบประมาณ พ.ศ. {folder.fiscalYearBE} · หมวด: {folder.category} ·{' '}
              {dirty ? 'มีการแก้ไขที่ยังไม่บันทึก' : 'บันทึกแล้ว'}
            </p>
          </div>
        </div>

        <div className="cf-actions">
          <select
            aria-label="สถานะแฟ้มงาน"
            value={folder.status}
            onChange={e =>
              setFolder(f => ({...f, status: e.target.value as CaseFolderStatus}))
            }
            style={{border: '1px solid #cbd5e1', borderRadius: 8, padding: '7px 10px', fontSize: '0.84rem'}}
          >
            <option value="DRAFT">ร่าง</option>
            <option value="IN_PROGRESS">กำลังดำเนินการ</option>
            <option value="COMPLETED">เสร็จสิ้น</option>
            <option value="ARCHIVED">เก็บเข้าคลัง</option>
          </select>

          <button
            type="button"
            className="cf-btn"
            disabled={isBusy}
            onClick={() => void handleBlueprintClick()}
          >
            <Layers size={15} />
            บันทึกเป็นแม่แบบ
          </button>

          <button
            type="button"
            className="cf-btn"
            disabled={isBusy}
            onClick={() => void handleSafeCloneClick()}
          >
            <Copy size={15} />
            Safe Clone
          </button>

          <button
            type="button"
            className="cf-btn cf-btn-accent"
            disabled={isBusy}
            onClick={() => setExportOpen(true)}
          >
            <Download size={15} />
            ส่งออก PDF / ชุด Word (.zip)
          </button>

          <button
            type="button"
            className="cf-btn cf-btn-primary"
            disabled={isBusy}
            onClick={() => void handleSave()}
          >
            <Save size={15} />
            {busy ? 'กำลังบันทึก…' : 'บันทึกแฟ้มงาน'}
          </button>
        </div>
      </header>

      {/* Core Draft Bridge Bar — links Case Folder docs directly to Core Editor */}
      <section
        className="cf-vars-bar"
        aria-label="ร่างหนังสือในระบบหลัก (Core)"
        style={{background: '#f8fafc', borderColor: '#bfdbfe'}}
      >
        <div className="cf-vars-header" style={{flexWrap: 'wrap'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap'}}>
            <strong>
              <FileEdit size={15} style={{display: 'inline', marginRight: 5, color: '#2563eb'}} />
              ระบบร่างหนังสือหลัก (Core Engine)
            </strong>
            <span className="cf-pill cf-pill-blue">
              เชื่อมร่าง Core {coreLinks.filter(l => l.draft).length}/{generatedDocs.length} ฉบับ
            </span>
            <span style={{fontSize: '0.8rem', color: '#475569'}}>
              ใช้แบบฟอร์ม ตัวจัดหน้า และเครื่องพิมพ์ PDF/Word เดียวกับระบบ Core · แก้ไขละเอียดและวางลายเซ็น/กล่องข้อความใน Core ได้โดยไม่โดนทับ
            </span>
          </div>
          <div className="cf-actions">
            <button
              type="button"
              className="cf-btn cf-btn-sm cf-btn-primary"
              disabled={isBusy || generatedDocs.length === 0}
              onClick={() =>
                void handleBindAllCore(
                  coreLinks.length >= generatedDocs.length && generatedDocs.length > 0
                    ? 'sync'
                    : 'create',
                )
              }
            >
              <RefreshCw size={13} />
              {coreLinks.length >= generatedDocs.length && generatedDocs.length > 0
                ? 'ซิงก์ข้อมูลกลางเข้าชุดร่าง Core'
                : 'สร้างชุดร่างในระบบ Core ทั้งแฟ้ม'}
            </button>
            {selectedItem?.kind === 'GENERATED_DOC' && onOpenDocument && (
              <button
                type="button"
                className="cf-btn cf-btn-sm cf-btn-accent"
                disabled={isBusy}
                onClick={() => void handleOpenInCoreEditor(selectedItem.id)}
              >
                <ExternalLink size={13} />
                เปิดแก้ไขฉบับนี้ในระบบร่างหนังสือ (Core)
              </button>
            )}
          </div>
        </div>
      </section>

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

      {/* Top Strip: Shared Case Variables */}
      <CaseVariablesBar
        variables={folder.variables}
        onChange={nextVars => setFolder(f => ({...f, variables: nextVars}))}
      />

      {/* 3-Column Workspace */}
      <div className="cf-workspace-grid">
        {/* Left: Dynamic Roadmap */}
        <RoadmapSidebar
          folder={folder}
          selectedItemId={selectedItem?.id ?? null}
          linkedSummaries={linkedSummaries}
          onSelectItem={setSelectedItemId}
          onAddDoc={handleAddDoc}
          onAddExternalSlot={handleAddExternalSlot}
          onOpenLinkModule={stageId => setLinkModalStageId(stageId)}
          onAddStage={handleAddStage}
          onMoveItem={handleMoveItem}
          onDeleteItem={handleDeleteItem}
          onDownloadRoadmap={() => void handleDownloadRoadmap()}
          busy={isBusy}
        />

        {/* Center: Adaptive Document Editor */}
        <div>
          {selectedItem ? (
            <DocumentFormEditor
              folder={folder}
              item={selectedItem}
              linkedSummary={linkedSummaries.get(selectedItem.id)}
              onUpdateItem={handleUpdateItem}
              onReserveNumber={track => onReserveNumber(track, folder.fiscalYearBE, folder.id)}
              onNotice={setNotice}
              onError={setError}
            />
          ) : (
            <div className="cf-panel cf-empty">
              <h3>เริ่มสร้างเอกสารแรกในแฟ้มนี้</h3>
              <p>กดปุ่ม &ldquo;+ สร้างเอกสารในระบบ&rdquo;, &ldquo;+ แทรกไฟล์แนบ&rdquo; หรือ &ldquo;+ ผูกงานจัดซื้อจัดจ้าง / พัสดุ&rdquo; ทางซ้ายมือ</p>
            </div>
          )}
        </div>

        {/* Right: Validator + Live Core A4 Preview */}
        <aside className="cf-panel cf-preview-col" aria-label="ตรวจความถูกต้องและพรีวิว A4 สด">
          <div className="cf-panel-head">
            <h2>
              <ShieldCheck size={16} style={{display: 'inline', marginRight: 5}} />
              ตรวจความถูกต้อง &amp; พรีวิว A4 (Core)
            </h2>
            <div style={{display: 'flex', gap: 6, alignItems: 'center'}}>
              <select
                aria-label="ขนาดพรีวิว A4"
                value={previewZoom}
                onChange={e => setPreviewZoom(Number(e.target.value))}
                style={{border: '1px solid #cbd5e1', borderRadius: 6, padding: '3px 6px', fontSize: '0.78rem'}}
              >
                <option value={45}>45%</option>
                <option value={55}>55%</option>
                <option value={70}>70%</option>
                <option value={85}>85%</option>
              </select>
              {previewLoading && <RefreshCw size={14} className="spin" />}
            </div>
          </div>

          {selectedItem?.kind === 'GENERATED_DOC' && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 6,
                fontSize: '0.78rem',
                background: selectedCoreLink?.draft ? '#ecfdf5' : '#f1f5f9',
                border: `1px solid ${selectedCoreLink?.draft ? '#a7f3d0' : '#cbd5e1'}`,
                borderRadius: 8,
                padding: '6px 9px',
              }}
            >
              <span>
                {selectedCoreLink?.draft
                  ? `ร่าง Core รุ่น ${selectedCoreLink.draft.version} (ใช้เป็นต้นฉบับ Preview / PDF / Word)`
                  : 'พรีวิวจากเครื่องยนต์ Core (ยังไม่ผูกเป็นร่างแยกใน Core)'}
              </span>
              <div style={{display: 'flex', gap: 5}}>
                {selectedCoreLink?.draft && (
                  <button
                    type="button"
                    className="cf-btn cf-btn-sm"
                    disabled={isBusy}
                    onClick={() => void handleBindAllCore('sync', [selectedItem.id])}
                  >
                    ซิงก์ฉบับนี้
                  </button>
                )}
                {onOpenDocument && (
                  <button
                    type="button"
                    className="cf-btn cf-btn-sm cf-btn-primary"
                    disabled={isBusy}
                    onClick={() => void handleOpenInCoreEditor(selectedItem.id)}
                  >
                    <FileEdit size={12} />
                    แก้ไขใน Core
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="cf-validation-box" aria-label="ผลการตรวจสอบความถูกต้อง">
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
              <strong>
                {errorCount === 0 && warnCount === 0 ? (
                  <>
                    <CheckCircle2 size={14} style={{display: 'inline', marginRight: 4, color: '#16a34a'}} />
                    ลำดับเลข วันที่ และอ้างอิงถูกต้อง
                  </>
                ) : (
                  <>
                    <AlertTriangle size={14} style={{display: 'inline', marginRight: 4, color: '#d97706'}} />
                    พบข้อควรตรวจสอบ {validationIssues.length} รายการ
                  </>
                )}
              </strong>
              <label style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.76rem'}}>
                <input
                  type="checkbox"
                  checked={highlightBlanks}
                  onChange={e => setHighlightBlanks(e.target.checked)}
                />
                <span>ไฮไลต์ช่องว่าง</span>
              </label>
            </div>

            {validationIssues.map((issue, idx) => (
              <div key={`${issue.code}-${idx}`} className={`cf-issue-row cf-issue-${issue.severity}`}>
                <div>{issue.messageTh}</div>
                {issue.suggestedFix && (
                  <small style={{opacity: 0.85}}>คำแนะนำ: {issue.suggestedFix}</small>
                )}
              </div>
            ))}
          </div>

          {selectedItem?.kind === 'GENERATED_DOC' ? (
            <div className="cf-preview-wrap">
              <div
                className="cf-preview-scale"
                style={{
                  width: Math.round((794 * previewZoom) / 100),
                  height: Math.round((previewHeight * previewZoom) / 100),
                }}
              >
                <iframe
                  ref={previewFrameRef}
                  title="ตัวอย่างเอกสาร A4"
                  className="cf-preview-iframe"
                  sandbox="allow-scripts allow-modals"
                  srcDoc={previewHtml}
                  style={{
                    width: 794,
                    height: previewHeight,
                    transform: `scale(${previewZoom / 100})`,
                  }}
                />
              </div>
              {previewPages > 0 && (
                <div style={{textAlign: 'center', fontSize: '0.75rem', color: '#475569', marginTop: 6}}>
                  Core Engine · TH Sarabun IT๙ · {previewPages} หน้า
                </div>
              )}
            </div>
          ) : (
            <div className="cf-empty">
              {selectedItem?.kind === 'LINKED_MODULE_REF'
                ? 'รายการนี้เชื่อมโยงสดจากระบบจัดซื้อจัดจ้าง/พัสดุ และจะรวม PDF อัตโนมัติเมื่อส่งออกแฟ้ม'
                : 'เลือกเอกสารที่สร้างในระบบเพื่อดูตัวอย่างกระดาษ A4 แบบเรียลไทม์จาก Core Engine'}
            </div>
          )}
        </aside>
      </div>

      {linkModalStageId && (
        <LinkModuleModal
          stages={folder.stages}
          initialStageId={linkModalStageId}
          availableProcurement={availableProcurement}
          availableRequisitions={availableRequisitions}
          availableAssetLoans={availableAssetLoans}
          onLink={handleLinkModule}
          onClose={() => setLinkModalStageId(null)}
        />
      )}

      {exportOpen && (
        <ExportCaseModal
          folder={folder}
          driveConnected={driveConnected}
          onNotice={setNotice}
          onImported={id => {
            setExportOpen(false);
            void onImportedFolder(id);
          }}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
