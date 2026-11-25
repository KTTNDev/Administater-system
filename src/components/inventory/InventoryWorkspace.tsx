'use client';
import {useCallback, useEffect, useMemo, useState} from 'react';
import type {AssetLoan, Requisition} from '@/lib/inventory/types';
import {
  downloadInventoryExport,
  fetchInventoryDomain,
  postInventoryAction,
  type InventoryDomainPayload,
} from './client-api';
import {AssetLoanModal} from './modals/AssetLoanModal';
import {CommitSignatureModal} from './modals/CommitSignatureModal';
import {RequisitionModal} from './modals/RequisitionModal';
import {StockIntakeModal} from './modals/StockIntakeModal';
import {AnnualAuditTab} from './tabs/AnnualAuditTab';
import {AssetRegistryTab} from './tabs/AssetRegistryTab';
import {MaterialFifoTab} from './tabs/MaterialFifoTab';
import './inventory-fifo.css';

export type FifoWorkspaceTab = 'materials' | 'assets' | 'audit';

interface Props {
  organization?: string;
  department?: string;
  onBusy?: (busy: boolean) => void;
}

export function InventoryWorkspace({organization, department, onBusy}: Props) {
  const [payload, setPayload] = useState<InventoryDomainPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<FifoWorkspaceTab>('materials');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Modal state
  const [showIntake, setShowIntake] = useState(false);
  const [showRequisition, setShowRequisition] = useState(false);
  const [commitTarget, setCommitTarget] = useState<Requisition | null>(null);
  const [loanModal, setLoanModal] = useState<{mode: 'create' | 'return'; loan?: AssetLoan} | null>(null);

  useEffect(() => {
    onBusy?.(busy);
    return () => onBusy?.(false);
  }, [busy, onBusy]);

  const reload = useCallback(async () => {
    setError('');
    try {
      const next = await fetchInventoryDomain();
      setPayload(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดข้อมูลคลังพัสดุไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const runAction = useCallback(
    async (actionBody: Record<string, unknown>, successMessage: string): Promise<InventoryDomainPayload> => {
      if (!payload) throw new Error('ยังโหลดข้อมูลไม่เสร็จ');
      setBusy(true);
      setError('');
      setNotice('');
      try {
        const next = await postInventoryAction({
          ...actionBody,
          expectedVersion: payload.record.version,
        });
        setPayload(next);
        setNotice(successMessage);
        return next;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'บันทึกข้อมูลไม่สำเร็จ';
        setError(msg);
        // Refresh version if another tab/user updated it
        if (msg.includes('มีการบันทึกข้อมูลใหม่กว่า')) {
          void reload();
        }
        throw err;
      } finally {
        setBusy(false);
      }
    },
    [payload, reload],
  );

  const handleExport = useCallback(
    async (format: 'pdf' | 'docx', body: Record<string, unknown>, filename: string) => {
      setBusy(true);
      setError('');
      setNotice('');
      try {
        await downloadInventoryExport(format, body, filename);
        setNotice(`ส่งออกไฟล์ ${filename} เรียบร้อยแล้ว`);
      } catch (err) {
        setError(err instanceof Error ? err.message : `ส่งออก ${format.toUpperCase()} ไม่สำเร็จ`);
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const activeLoanAssetIds = useMemo(
    () =>
      new Set(
        (payload?.record.data.assetLoans ?? [])
          .filter(l => l.status === 'ACTIVE_LOAN' || l.status === 'PENDING_SIGNATURE')
          .map(l => l.assetId),
      ),
    [payload],
  );

  const division = department || payload?.context.agency?.divisionName || 'กองสวัสดิการสังคม';
  const municipality = organization || payload?.context.agency?.municipalityName || 'เทศบาลตำบลฉลอง';

  if (loading && !payload) {
    return (
      <div className="inv-shell">
        <div className="inv-card">กำลังโหลดระบบบริหารคลังวัสดุ FIFO และทะเบียนครุภัณฑ์…</div>
      </div>
    );
  }

  const state = payload?.record.data ?? {materials: [], lots: [], requisitions: [], ledger: [], assets: [], assetLoans: []};

  return (
    <div className="inv-shell" data-testid="inventory-fifo-workspace">
      <div className="inv-head-bar">
        <div>
          <h2>ระบบบริหารคลังวัสดุ (FIFO) &amp; ทะเบียนครุภัณฑ์มาตรฐานราชการ</h2>
          <p>
            {division} {municipality} · รองรับ ใบเบิกวัสดุ 5 คอลัมน์ (INV-01), บัญชีวัสดุ (INV-02), ยืม-คืนครุภัณฑ์ (INV-03), รายงานตัดพัสดุ (INV-04), ตรวจนับข้อ ๒๑๓ (INV-05)
          </p>
        </div>
        <div className="inv-tab-bar" role="tablist" aria-label="แท็บงานคลังวัสดุ FIFO และครุภัณฑ์">
          <button
            type="button"
            className="inv-tab-btn"
            aria-pressed={activeTab === 'materials'}
            onClick={() => setActiveTab('materials')}
          >
            คลังวัสดุ &amp; เบิก-จ่าย (FIFO)
          </button>
          <button
            type="button"
            className="inv-tab-btn"
            aria-pressed={activeTab === 'assets'}
            onClick={() => setActiveTab('assets')}
          >
            ทะเบียนครุภัณฑ์ &amp; ยืม-คืน
          </button>
          <button
            type="button"
            className="inv-tab-btn"
            aria-pressed={activeTab === 'audit'}
            onClick={() => setActiveTab('audit')}
          >
            รายงานตัดพัสดุ &amp; ตรวจนับประจำปี
          </button>
        </div>
      </div>

      {notice && (
        <div className="inv-banner inv-banner-ok" role="status">
          {notice}
        </div>
      )}
      {error && (
        <div className="inv-banner inv-banner-err" role="alert">
          {error}
        </div>
      )}

      {activeTab === 'materials' && (
        <MaterialFifoTab
          state={state}
          busy={busy}
          onOpenIntake={() => setShowIntake(true)}
          onOpenRequisition={() => setShowRequisition(true)}
          onOpenCommit={req => setCommitTarget(req)}
          onCancelRequisition={async req => {
            if (!confirm(`ยืนยันยกเลิกใบเบิก ${req.requisitionRunningNo}/${req.fiscalYearBE} และคืนยอดจองกลับคลัง?`)) {
              return;
            }
            await runAction(
              {action: 'transitionRequisition', requisitionId: req.id, transition: 'CANCEL'},
              `ยกเลิกใบเบิก ${req.requisitionRunningNo}/${req.fiscalYearBE} และคืนยอดจองแล้ว`,
            );
          }}
          onExport={handleExport}
        />
      )}

      {activeTab === 'assets' && (
        <AssetRegistryTab
          state={state}
          defaultLocation={division}
          busy={busy}
          onSaveAsset={async asset => {
            await runAction({action: 'saveAsset', asset}, 'บันทึกทะเบียนครุภัณฑ์เรียบร้อยแล้ว');
          }}
          onDeleteAsset={async assetId => {
            await runAction({action: 'deleteAsset', assetId}, 'ลบครุภัณฑ์ออกจากทะเบียนแล้ว');
          }}
          onOpenCreateLoan={() => setLoanModal({mode: 'create'})}
          onOpenReturnLoan={loan => setLoanModal({mode: 'return', loan})}
          onExport={handleExport}
        />
      )}

      {activeTab === 'audit' && (
        <AnnualAuditTab
          state={state}
          busy={busy}
          onExport={handleExport}
          onCarryForward={async (fromFiscalYearBE, toFiscalYearBE) => {
            await runAction(
              {action: 'carryForward', fromFiscalYearBE, toFiscalYearBE},
              `ปิดงบปีงบประมาณ พ.ศ. ${fromFiscalYearBE} และยกยอดทุกล็อต FIFO ไปตั้งยอดยกมาต้นปี พ.ศ. ${toFiscalYearBE} (1 ต.ค.) เรียบร้อยแล้ว`,
            );
          }}
          onArchiveLocalYear={async (fy, landscapeStockCard) => {
            setBusy(true);
            setError('');
            setNotice('');
            try {
              const res = await fetch('/api/handover-archive', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                  action: 'archiveInventoryYear',
                  fiscalYearBE: fy,
                  includePdf: false,
                  landscapeStockCard,
                }),
              });
              const data = (await res.json()) as {
                folder?: string;
                created?: number;
                updated?: number;
                unchanged?: number;
                archivedPrevious?: number;
                error?: string;
                issues?: Array<{messageTh?: string}>;
              };
              if (!res.ok) {
                throw new Error(
                  data.error || data.issues?.map(i => i.messageTh).filter(Boolean).join('; ') || 'จัดเก็บแฟ้มลงเครื่องไม่สำเร็จ',
                );
              }
              setNotice(
                `จัดเก็บแฟ้มพัสดุปีงบ ${fy} ลงโฟลเดอร์แล้ว: ${data.folder} (สร้างใหม่ ${data.created ?? 0} · อัปเดต ${data.updated ?? 0} · เหมือนเดิม ${data.unchanged ?? 0})`,
              );
            } catch (err) {
              setError(err instanceof Error ? err.message : 'จัดเก็บแฟ้มพัสดุลงเครื่องไม่สำเร็จ');
            } finally {
              setBusy(false);
            }
          }}
        />
      )}

      {showIntake && (
        <StockIntakeModal
          materials={state.materials}
          procurementCases={payload?.procurementCases ?? []}
          defaultLocation={division}
          busy={busy}
          onClose={() => setShowIntake(false)}
          onImportProcurement={async caseId => {
            await runAction({action: 'importProcurement', caseId}, 'นำเข้าวัสดุจากงานจัดซื้อจัดจ้างเข้าคลังเรียบร้อยแล้ว');
            setShowIntake(false);
          }}
          onManualIntake={async body => {
            await runAction({action: 'intake', ...body}, 'บันทึกรับวัสดุเข้าคลังและลงบัญชีเดบิทเรียบร้อยแล้ว');
            setShowIntake(false);
          }}
        />
      )}

      {showRequisition && (
        <RequisitionModal
          materials={state.materials}
          lots={state.lots}
          defaultDivision={division}
          defaultMunicipality={municipality}
          busy={busy}
          onClose={() => setShowRequisition(false)}
          onSubmit={async (body, printAfter) => {
            const res = await runAction(
              {action: 'createRequisition', ...body},
              'สร้างใบเบิกและจองยอดรอเซ็นรับของจริงเรียบร้อยแล้ว',
            );
            setShowRequisition(false);
            if (printAfter !== 'none' && res.createdId) {
              const req = res.record.data.requisitions.find(r => r.id === res.createdId);
              const label = req ? `${req.requisitionRunningNo}-${req.fiscalYearBE}` : 'requisition';
              await handleExport(
                printAfter,
                {kind: 'INV-01', requisitionId: res.createdId},
                `ใบเบิกวัสดุ-${label}.${printAfter}`,
              );
            }
          }}
        />
      )}

      {commitTarget && (
        <CommitSignatureModal
          requisition={commitTarget}
          materials={state.materials}
          busy={busy}
          onClose={() => setCommitTarget(null)}
          onConfirmCommit={async (committedDate, signedScanAttachmentPath) => {
            await runAction(
              {
                action: 'transitionRequisition',
                requisitionId: commitTarget.id,
                transition: 'COMMIT_AFTER_SIGNATURE',
                committedDate,
                signedScanAttachmentPath,
              },
              `ยืนยันตัดสต๊อกใบเบิก ${commitTarget.requisitionRunningNo}/${commitTarget.fiscalYearBE} และบันทึกบัญชีวัสดุ (INV-02) เรียบร้อยแล้ว`,
            );
            setCommitTarget(null);
          }}
        />
      )}

      {loanModal && (
        <AssetLoanModal
          mode={loanModal.mode}
          assets={state.assets}
          activeLoanAssetIds={activeLoanAssetIds}
          loanToReturn={loanModal.loan}
          defaultDepartment={division}
          busy={busy}
          onClose={() => setLoanModal(null)}
          onCreateLoan={async (body, printAfter) => {
            const res = await runAction({action: 'createAssetLoan', ...body}, 'บันทึกใบยืมครุภัณฑ์เรียบร้อยแล้ว');
            setLoanModal(null);
            if (printAfter !== 'none' && res.createdId) {
              const loan = res.record.data.assetLoans.find(l => l.id === res.createdId);
              const label = loan ? `${loan.loanRunningNo}-${loan.fiscalYearBE}` : 'loan';
              await handleExport(printAfter, {kind: 'INV-03', loanId: res.createdId}, `ใบยืมครุภัณฑ์-${label}.${printAfter}`);
            }
          }}
          onReturnLoan={async (loanId, actualReturnDate, conditionAfter) => {
            await runAction(
              {
                action: 'transitionAssetLoan',
                loanId,
                transition: 'RETURN',
                actualReturnDate,
                conditionAfter,
              },
              'บันทึกรับคืนครุภัณฑ์เรียบร้อยแล้ว',
            );
            setLoanModal(null);
          }}
        />
      )}
    </div>
  );
}
