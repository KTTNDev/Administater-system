'use client';
import {useMemo,useState} from 'react';
import {MATERIAL_CATEGORIES,mergeSuggestedUnits,searchStandardCatalog} from '@/lib/inventory/catalog/standard-units';
import type {ProcurementIntakeOption} from '@/lib/inventory/server-context';
import type {CategoryCode,MaterialItem,StockLotSourceType} from '@/lib/inventory/types';
import {currentThaiFiscalYear,formatBaht,todayIso} from '../client-api';

interface Props {
  materials: readonly MaterialItem[];
  procurementCases: readonly ProcurementIntakeOption[];
  defaultLocation: string;
  busy: boolean;
  onClose: () => void;
  onImportProcurement: (caseId: string) => Promise<void>;
  onManualIntake: (payload: Record<string, unknown>) => Promise<void>;
}

export function StockIntakeModal({
  materials,
  procurementCases,
  defaultLocation,
  busy,
  onClose,
  onImportProcurement,
  onManualIntake,
}: Props) {
  const [mode, setMode] = useState<'procurement' | 'manual'>(
    procurementCases.some(c => !c.alreadyImported) ? 'procurement' : 'manual',
  );
  const [targetType, setTargetType] = useState<'existing' | 'new'>(materials.length ? 'existing' : 'new');
  const [materialId, setMaterialId] = useState(materials[0]?.id ?? '');
  const [categoryCode, setCategoryCode] = useState<CategoryCode>('01');
  const [name, setName] = useState('');
  const [specification, setSpecification] = useState('');
  const [code, setCode] = useState('');
  const [unit, setUnit] = useState('รีม');
  const [storageLocation, setStorageLocation] = useState(defaultLocation || 'กองสวัสดิการสังคม');
  const [minStockQty, setMinStockQty] = useState('5');
  const [maxStockQty, setMaxStockQty] = useState('');
  const [sourceType, setSourceType] = useState<StockLotSourceType>('PROCUREMENT_PO');
  const [sourceLabel, setSourceLabel] = useState('รับจาก (ร้านดินสอสี)');
  const [referenceDocNo, setReferenceDocNo] = useState('');
  const [fiscalYearBE, setFiscalYearBE] = useState(String(currentThaiFiscalYear()));
  const [receivedDate, setReceivedDate] = useState(todayIso());
  const [initialQty, setInitialQty] = useState('10');
  const [unitPrice, setUnitPrice] = useState('100');
  const [error, setError] = useState('');

  const catalogSuggestions = useMemo(
    () => searchStandardCatalog(name, name.trim() ? undefined : categoryCode).slice(0, 8),
    [name, categoryCode],
  );

  const unitChoices = useMemo(() => {
    const fromHits = catalogSuggestions.flatMap(h => h.suggestedUnits);
    return mergeSuggestedUnits(fromHits, unit).slice(0, 10);
  }, [catalogSuggestions, unit]);

  async function submitManual(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const qty = Number(initialQty);
    const price = Number(unitPrice);
    const fy = Number(fiscalYearBE);
    if (!Number.isFinite(qty) || qty <= 0) {
      setError('กรุณาระบุจำนวนรับเข้ามากกว่า 0');
      return;
    }
    if (!Number.isFinite(price) || price < 0) {
      setError('กรุณาระบุราคาต่อหน่วยตั้งแต่ 0 ขึ้นไป');
      return;
    }

    const cat = MATERIAL_CATEGORIES.find(c => c.code === categoryCode) ?? MATERIAL_CATEGORIES[0];
    try {
      await onManualIntake({
        materialId: targetType === 'existing' ? materialId : undefined,
        newMaterial:
          targetType === 'new'
            ? {
                code: code.trim(),
                name: name.trim(),
                categoryCode,
                categoryType: cat.categoryName,
                specification: specification.trim(),
                unit: unit.trim(),
                storageLocation: storageLocation.trim() || defaultLocation,
                maxStockQty: maxStockQty.trim() ? Number(maxStockQty) : null,
                minStockQty: Number(minStockQty) || 0,
              }
            : undefined,
        fiscalYearBE: fy,
        receivedDate,
        sourceType,
        sourceLabel: sourceType === 'OPENING_BALANCE' ? 'ยอดยกมา' : sourceLabel.trim() || 'รับเข้าพัสดุ',
        referenceDocNo: referenceDocNo.trim(),
        unitPrice: price,
        initialQty: qty,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'รับวัสดุเข้าคลังไม่สำเร็จ');
    }
  }

  return (
    <div className="inv-modal-backdrop" role="dialog" aria-modal="true" aria-label="รับวัสดุเข้าคลัง">
      <div className="inv-modal">
        <div className="inv-modal-head">
          <h3>รับวัสดุเข้าคลัง (Stock-In / ยอดยกมา)</h3>
          <button type="button" className="inv-btn inv-btn-sm" onClick={onClose} disabled={busy}>
            ปิด
          </button>
        </div>

        <div className="inv-tab-bar" role="tablist">
          <button
            type="button"
            className="inv-tab-btn"
            aria-pressed={mode === 'procurement'}
            onClick={() => setMode('procurement')}
          >
            ดึงจากงานจัดซื้อจัดจ้างที่ตรวจรับแล้ว (Doc 11.1)
          </button>
          <button
            type="button"
            className="inv-tab-btn"
            aria-pressed={mode === 'manual'}
            onClick={() => setMode('manual')}
          >
            รับเข้าด้วยตนเอง / ตั้งยอดยกมา
          </button>
        </div>

        {error && <div className="inv-banner inv-banner-err" role="alert">{error}</div>}

        {mode === 'procurement' ? (
          <div style={{display: 'grid', gap: 10}}>
            {procurementCases.length === 0 ? (
              <p style={{color: '#5a706a', margin: '8px 0'}}>
                ยังไม่มีงานจัดซื้อที่พร้อมดึงเข้าคลัง (สามารถใช้แท็บ “รับเข้าด้วยตนเอง / ตั้งยอดยกมา” ได้ทันที)
              </p>
            ) : (
              procurementCases.map(c => (
                <div key={c.caseId} className="inv-card" style={{display: 'grid', gap: 8}}>
                  <div className="inv-between">
                    <div>
                      <strong>{c.title}</strong>{' '}
                      <span className="inv-pill inv-pill-info">{c.poNumber}</span>{' '}
                      {c.alreadyImported && <span className="inv-pill inv-pill-ok">นำเข้าแล้ว ✓</span>}
                      <div style={{fontSize: 12, color: '#556e67', marginTop: 2}}>
                        ร้านค้า: {c.vendorShopName} · วันตรวจรับ: {c.inspectionDate} · ปีงบ {c.fiscalYearBE} · มูลค่ารวม{' '}
                        <b>{formatBaht(c.grandTotal)}</b> บาท
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inv-btn inv-btn-primary"
                      disabled={busy || c.alreadyImported}
                      onClick={() => {
                        setError('');
                        void onImportProcurement(c.caseId).catch(err =>
                          setError(err instanceof Error ? err.message : 'นำเข้าไม่สำเร็จ'),
                        );
                      }}
                    >
                      {c.alreadyImported ? 'รับเข้าแล้ว' : `รับเข้าคลังทั้งหมด (${c.itemCount} รายการ)`}
                    </button>
                  </div>
                  <div style={{fontSize: 12, color: '#39554e', display: 'grid', gap: 3}}>
                    {c.mapping.drafts.map(d => (
                      <div key={d.itemIndex}>
                        • {d.suggestedName} — <b>{d.initialQty} {d.suggestedUnit}</b> @ {formatBaht(d.unitPrice)} บ.{' '}
                        <span className="inv-pill inv-pill-muted">
                          {d.isNewMaterial ? `สร้างวัสดุใหม่ · หมวด ${d.suggestedCategoryCode}` : 'ผูกวัสดุเดิมอัตโนมัติ'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <form onSubmit={submitManual} style={{display: 'grid', gap: 10}}>
            <div className="inv-row">
              <label className="inv-inline-check">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'existing'}
                  disabled={!materials.length}
                  onChange={() => setTargetType('existing')}
                />
                รับเพิ่มเข้าวัสดุเดิม
              </label>
              <label className="inv-inline-check">
                <input
                  type="radio"
                  name="targetType"
                  checked={targetType === 'new'}
                  onChange={() => setTargetType('new')}
                />
                ขึ้นทะเบียนวัสดุใหม่ (อ้างอิง 18 หมวดมาตรฐาน)
              </label>
            </div>

            {targetType === 'existing' ? (
              <label className="inv-field">
                <span>เลือกวัสดุเดิมในคลัง</span>
                <select value={materialId} onChange={e => setMaterialId(e.target.value)} required>
                  {materials.map(m => (
                    <option key={m.id} value={m.id}>
                      #{m.ledgerSeqNo} {m.name} ({m.unit}) — หมวด {m.categoryCode} {m.categoryType}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="inv-grid-2">
                <label className="inv-field">
                  <span>หมวดวัสดุราชการ (18 หมวด)</span>
                  <select value={categoryCode} onChange={e => setCategoryCode(e.target.value as CategoryCode)}>
                    {MATERIAL_CATEGORIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} · {c.categoryName}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="inv-field">
                  <span>รหัสวัสดุ (ถ้ามี)</span>
                  <input value={code} onChange={e => setCode(e.target.value)} placeholder="เช่น 01-001" />
                </label>
                <label className="inv-field inv-wide">
                  <span>ชื่อหรือชนิดวัสดุ (พิมพ์เพื่อค้นหาจากบัญชี 18 หมวด)</span>
                  <input
                    required
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="เช่น กระดาษถ่ายเอกสาร A4 80 แกรม หรือ กระดาษโพสอิท"
                  />
                  {catalogSuggestions.length > 0 && (
                    <div className="inv-catalog-chips">
                      {catalogSuggestions.map(hit => (
                        <button
                          key={`${hit.categoryCode}-${hit.itemName}`}
                          type="button"
                          className="inv-chip"
                          onClick={() => {
                            setCategoryCode(hit.categoryCode);
                            if (!name.trim()) setName(hit.itemName);
                            setUnit(hit.suggestedUnits[0] || unit);
                          }}
                        >
                          [{hit.categoryCode}] {hit.itemName} ({hit.suggestedUnits.join('/')})
                        </button>
                      ))}
                    </div>
                  )}
                </label>
                <label className="inv-field">
                  <span>ขนาดหรือลักษณะ</span>
                  <input value={specification} onChange={e => setSpecification(e.target.value)} placeholder="เช่น ขนาด 0.5 x 1.7 นิ้ว" />
                </label>
                <label className="inv-field">
                  <span>หน่วยนับ (เลือกมาตรฐานหรือพิมพ์เองได้)</span>
                  <input required value={unit} onChange={e => setUnit(e.target.value)} placeholder="เช่น รีม, แผง, ตลับ" />
                  <div className="inv-catalog-chips">
                    {unitChoices.map(u => (
                      <button key={u} type="button" className="inv-chip" onClick={() => setUnit(u)}>
                        {u}
                      </button>
                    ))}
                  </div>
                </label>
                <label className="inv-field">
                  <span>ที่เก็บ</span>
                  <input value={storageLocation} onChange={e => setStorageLocation(e.target.value)} />
                </label>
                <div className="inv-grid-2">
                  <label className="inv-field">
                    <span>จำนวนอย่างต่ำ</span>
                    <input type="number" min={0} value={minStockQty} onChange={e => setMinStockQty(e.target.value)} />
                  </label>
                  <label className="inv-field">
                    <span>จำนวนอย่างสูง</span>
                    <input type="number" min={0} value={maxStockQty} onChange={e => setMaxStockQty(e.target.value)} placeholder="ไม่กำหนด" />
                  </label>
                </div>
              </div>
            )}

            <hr style={{border: 0, borderTop: '1px solid #e5edea', margin: '4px 0'}} />

            <div className="inv-grid-3">
              <label className="inv-field">
                <span>ประเภทการรับเข้า</span>
                <select
                  value={sourceType}
                  onChange={e => {
                    const next = e.target.value as StockLotSourceType;
                    setSourceType(next);
                    if (next === 'OPENING_BALANCE') setSourceLabel('ยอดยกมา');
                    else if (sourceLabel === 'ยอดยกมา') setSourceLabel('รับจาก (ร้านดินสอสี)');
                  }}
                >
                  <option value="PROCUREMENT_PO">รับจากการจัดซื้อ (ใบสั่งซื้อ)</option>
                  <option value="OPENING_BALANCE">ตั้งยอดยกมาต้นปีงบประมาณ</option>
                  <option value="TRANSFER_IN">รับโอนจากหน่วยงานอื่น</option>
                  <option value="DONATION">รับบริจาค</option>
                </select>
              </label>
              <label className="inv-field">
                <span>ปีงบประมาณ พ.ศ.</span>
                <input type="number" required value={fiscalYearBE} onChange={e => setFiscalYearBE(e.target.value)} />
              </label>
              <label className="inv-field">
                <span>วันที่รับเข้า</span>
                <input type="date" required value={receivedDate} onChange={e => setReceivedDate(e.target.value)} />
              </label>
              <label className="inv-field">
                <span>รับจาก / แหล่งที่มา</span>
                <input
                  value={sourceType === 'OPENING_BALANCE' ? 'ยอดยกมา' : sourceLabel}
                  disabled={sourceType === 'OPENING_BALANCE'}
                  onChange={e => setSourceLabel(e.target.value)}
                  placeholder="รับจาก (ชื่อร้านค้า)"
                />
              </label>
              <label className="inv-field">
                <span>เลขที่เอกสารอ้างอิง / ใบสั่งซื้อ</span>
                <input value={referenceDocNo} onChange={e => setReferenceDocNo(e.target.value)} placeholder="เช่น ปี 2568 หรือ สว 05/2569" />
              </label>
              <div className="inv-grid-2">
                <label className="inv-field">
                  <span>จำนวนรับเข้า</span>
                  <input type="number" min={0.01} step="any" required value={initialQty} onChange={e => setInitialQty(e.target.value)} />
                </label>
                <label className="inv-field">
                  <span>ราคา/หน่วย (บาท)</span>
                  <input type="number" min={0} step="0.01" required value={unitPrice} onChange={e => setUnitPrice(e.target.value)} />
                </label>
              </div>
            </div>

            <div className="inv-between" style={{marginTop: 4}}>
              <span style={{fontSize: 12.5, color: '#3b5851'}}>
                มูลค่ารับเข้าล็อตนี้: <b>{formatBaht((Number(initialQty) || 0) * (Number(unitPrice) || 0))}</b> บาท (บันทึกบัญชีเดบิท)
              </span>
              <div className="inv-row">
                <button type="button" className="inv-btn" onClick={onClose} disabled={busy}>ยกเลิก</button>
                <button type="submit" className="inv-btn inv-btn-primary" disabled={busy}>
                  {busy ? 'กำลังบันทึก…' : 'บันทึกรับวัสดุเข้าคลัง'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
