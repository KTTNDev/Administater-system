'use client';
import {useMemo, useState} from 'react';
import {Link2, Search, X} from 'lucide-react';
import type {CaseStage, LinkedModuleTarget} from '@/lib/cases/types';
import type {
  AvailableAssetLoanLink,
  AvailableInventoryReqLink,
  AvailableProcurementLink,
} from '../client-api';

interface Props {
  stages: CaseStage[];
  initialStageId: string;
  availableProcurement: AvailableProcurementLink[];
  availableRequisitions: AvailableInventoryReqLink[];
  availableAssetLoans: AvailableAssetLoanLink[];
  onLink: (selection: {
    stageId: string;
    targetModule: LinkedModuleTarget;
    targetId: string;
    title: string;
    includePdfInBinder: boolean;
  }) => void;
  onClose: () => void;
}

export function LinkModuleModal({
  stages,
  initialStageId,
  availableProcurement,
  availableRequisitions,
  availableAssetLoans,
  onLink,
  onClose,
}: Props) {
  const [tab, setTab] = useState<LinkedModuleTarget>('PROCUREMENT');
  const [stageId, setStageId] = useState(initialStageId || stages[0]?.id || '');
  const [search, setSearch] = useState('');
  const [includePdfInBinder, setIncludePdfInBinder] = useState(true);

  const q = search.trim().toLowerCase();

  const filteredProc = useMemo(
    () =>
      availableProcurement.filter(p =>
        [p.title, p.poNumber, p.vendorName, String(p.fiscalYearBE)].join(' ').toLowerCase().includes(q),
      ),
    [availableProcurement, q],
  );

  const filteredReq = useMemo(
    () =>
      availableRequisitions.filter(r =>
        [r.runningNo, r.requesterName, r.purpose, String(r.fiscalYearBE)].join(' ').toLowerCase().includes(q),
      ),
    [availableRequisitions, q],
  );

  const filteredLoans = useMemo(
    () =>
      availableAssetLoans.filter(l =>
        [l.runningNo, l.borrowerName, l.assetName, String(l.fiscalYearBE)].join(' ').toLowerCase().includes(q),
      ),
    [availableAssetLoans, q],
  );

  return (
    <div className="cf-modal-backdrop" role="dialog" aria-modal="true" aria-label="ผูกงานจัดซื้อจัดจ้างหรือพัสดุ">
      <div className="cf-modal">
        <div className="cf-modal-head">
          <h2>
            <Link2 size={18} style={{display: 'inline', marginRight: 6}} />
            ผูกงานจากระบบจัดซื้อจัดจ้าง / พัสดุเข้าแฟ้ม
          </h2>
          <button type="button" className="cf-btn cf-btn-sm" onClick={onClose} aria-label="ปิดหน้าต่าง">
            <X size={16} />
          </button>
        </div>

        <div className="cf-modal-body">
          <div className="cf-form-grid">
            <div className="cf-field">
              <label htmlFor="cf-link-stage">รอบเสนอเซ็นปลายทาง</label>
              <select id="cf-link-stage" value={stageId} onChange={e => setStageId(e.target.value)}>
                {stages.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="cf-field">
              <label htmlFor="cf-link-search">ค้นหารายการ</label>
              <div style={{position: 'relative'}}>
                <Search size={14} style={{position: 'absolute', left: 10, top: 10, color: '#64748b'}} />
                <input
                  id="cf-link-search"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="พิมพ์ชื่อโครงการ เลขที่ใบสั่ง ร้านค้า..."
                  style={{paddingLeft: 30}}
                />
              </div>
            </div>
          </div>

          <label className="cf-check-row">
            <input
              type="checkbox"
              checked={includePdfInBinder}
              onChange={e => setIncludePdfInBinder(e.target.checked)}
            />
            <span>รวมไฟล์ PDF ของงานที่ผูกไว้เข้าเล่มพิมพ์อัตโนมัติ</span>
          </label>

          <div className="cf-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'PROCUREMENT'}
              className={`cf-tab ${tab === 'PROCUREMENT' ? 'is-active' : ''}`}
              onClick={() => setTab('PROCUREMENT')}
            >
              จัดซื้อจัดจ้าง ({availableProcurement.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'INVENTORY_REQUISITION'}
              className={`cf-tab ${tab === 'INVENTORY_REQUISITION' ? 'is-active' : ''}`}
              onClick={() => setTab('INVENTORY_REQUISITION')}
            >
              ใบเบิกพัสดุ ({availableRequisitions.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'INVENTORY_ASSET_LOAN'}
              className={`cf-tab ${tab === 'INVENTORY_ASSET_LOAN' ? 'is-active' : ''}`}
              onClick={() => setTab('INVENTORY_ASSET_LOAN')}
            >
              ใบยืมครุภัณฑ์ ({availableAssetLoans.length})
            </button>
          </div>

          <div style={{display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 320, overflow: 'auto'}}>
            {tab === 'PROCUREMENT' &&
              (filteredProc.length === 0 ? (
                <div className="cf-empty">ไม่พบงานจัดซื้อจัดจ้างในระบบ</div>
              ) : (
                filteredProc.map(p => (
                  <div
                    key={p.id}
                    style={{
                      border: '1px solid #dbe4f0',
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{fontWeight: 700, fontSize: '0.9rem'}}>{p.title}</div>
                      <div style={{fontSize: '0.8rem', color: '#475569'}}>
                        เลขที่สั่ง: {p.poNumber || 'รอออกเลข'} · ผู้ขาย: {p.vendorName || '-'} ·{' '}
                        <strong>{p.grandTotal.toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท</strong> ({p.methodLabel})
                      </div>
                    </div>
                    <button
                      type="button"
                      className="cf-btn cf-btn-primary cf-btn-sm"
                      onClick={() =>
                        onLink({
                          stageId,
                          targetModule: 'PROCUREMENT',
                          targetId: p.id,
                          title: p.title,
                          includePdfInBinder,
                        })
                      }
                    >
                      ผูกเข้าแฟ้ม
                    </button>
                  </div>
                ))
              ))}

            {tab === 'INVENTORY_REQUISITION' &&
              (filteredReq.length === 0 ? (
                <div className="cf-empty">ไม่พบใบเบิกพัสดุในคลัง FIFO</div>
              ) : (
                filteredReq.map(r => (
                  <div
                    key={r.id}
                    style={{
                      border: '1px solid #dbe4f0',
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{fontWeight: 700, fontSize: '0.9rem'}}>
                        ใบเบิกที่ {r.runningNo}/{r.fiscalYearBE} · {r.purpose}
                      </div>
                      <div style={{fontSize: '0.8rem', color: '#475569'}}>
                        ผู้เบิก: {r.requesterName} · มูลค่า {r.totalValue.toLocaleString('th-TH', {minimumFractionDigits: 2})} บาท · สถานะ: {r.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="cf-btn cf-btn-primary cf-btn-sm"
                      onClick={() =>
                        onLink({
                          stageId,
                          targetModule: 'INVENTORY_REQUISITION',
                          targetId: r.id,
                          title: `ใบเบิกพัสดุ ${r.runningNo}/${r.fiscalYearBE} (${r.purpose})`,
                          includePdfInBinder,
                        })
                      }
                    >
                      ผูกเข้าแฟ้ม
                    </button>
                  </div>
                ))
              ))}

            {tab === 'INVENTORY_ASSET_LOAN' &&
              (filteredLoans.length === 0 ? (
                <div className="cf-empty">ไม่พบใบยืมครุภัณฑ์ในทะเบียน</div>
              ) : (
                filteredLoans.map(l => (
                  <div
                    key={l.id}
                    style={{
                      border: '1px solid #dbe4f0',
                      borderRadius: 10,
                      padding: '10px 12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <div>
                      <div style={{fontWeight: 700, fontSize: '0.9rem'}}>
                        ใบยืมที่ {l.runningNo}/{l.fiscalYearBE} · {l.assetName}
                      </div>
                      <div style={{fontSize: '0.8rem', color: '#475569'}}>
                        ผู้ยืม: {l.borrowerName} · สถานะ: {l.status}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="cf-btn cf-btn-primary cf-btn-sm"
                      onClick={() =>
                        onLink({
                          stageId,
                          targetModule: 'INVENTORY_ASSET_LOAN',
                          targetId: l.id,
                          title: `ใบยืมครุภัณฑ์ ${l.runningNo}/${l.fiscalYearBE} (${l.assetName})`,
                          includePdfInBinder,
                        })
                      }
                    >
                      ผูกเข้าแฟ้ม
                    </button>
                  </div>
                ))
              ))}
          </div>
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
