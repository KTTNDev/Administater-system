'use client';
import {useCallback, useEffect, useState} from 'react';
import type {ArchiveModuleKey, FullArchiveReport} from '@/lib/handover-archive/archive-service';

interface HandoverStatusPayload {
  root: string;
  defaultRoot: string;
  isCustom: boolean;
  exists: boolean;
  fiscalYears: number[];
  lastRun: {
    at: string;
    fiscalYearBE?: number | null;
    created: number;
    updated: number;
    unchanged: number;
    archivedPrevious: number;
    errors: number;
  } | null;
  counts: {
    documents: number;
    procurement: number;
    inventoryMaterials: number;
    inventoryRequisitions: number;
    projects: number;
    budgets: number;
    correspondence: number;
  };
}

const MODULE_OPTIONS: Array<{key: ArchiveModuleKey; label: string; folder: string}> = [
  {key: 'documents', label: 'หนังสือราชการ', folder: '01_หนังสือราชการ'},
  {key: 'procurement', label: 'จัดซื้อจัดจ้าง (Word ครบชุด + ไฟล์แนบ + รูปตรวจรับ)', folder: '02_จัดซื้อจัดจ้าง'},
  {key: 'inventory', label: 'พัสดุและครุภัณฑ์ FIFO (INV-01 ถึง INV-05)', folder: '03_พัสดุและครุภัณฑ์'},
  {key: 'projects', label: 'โครงการและงานประจำปี', folder: '04_โครงการและงานประจำปี'},
  {key: 'budget', label: 'โอนงบประมาณ', folder: '05_โอนงบประมาณ'},
  {key: 'correspondence', label: 'ทะเบียนรับ–ส่งหนังสือ (Word + CSV)', folder: '06_ทะเบียนรับส่งหนังสือ'},
  {key: 'laws', label: 'คลังกฎหมายและระเบียบกลาง', folder: 'คลังกฎหมายและระเบียบกลาง'},
];

async function readApiError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as {error?: string; issues?: Array<{messageTh?: string}>};
    if (data.error) return data.error;
    if (data.issues?.length) return data.issues.map(i => i.messageTh).filter(Boolean).join('; ') || fallback;
  } catch {
    // ignore
  }
  return fallback;
}

export function HandoverArchivePanel() {
  const [status, setStatus] = useState<HandoverStatusPayload | null>(null);
  const [rootInput, setRootInput] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>('ALL');
  const [selectedModules, setSelectedModules] = useState<Set<ArchiveModuleKey>>(
    () => new Set(MODULE_OPTIONS.map(m => m.key)),
  );
  const [includePdf, setIncludePdf] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState<FullArchiveReport | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/handover-archive', {cache: 'no-store'});
      if (!res.ok) return;
      const data = (await res.json()) as HandoverStatusPayload;
      setStatus(data);
      setRootInput(data.root);
    } catch {
      // ignore initial load error
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function postAction(body: Record<string, unknown>) {
    const res = await fetch('/api/handover-archive', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(await readApiError(res, 'ดำเนินการไม่สำเร็จ'));
    return res.json();
  }

  async function saveRoot(nextPath: string) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const res = (await postAction({action: 'setRoot', rootPath: nextPath})) as {
        root: string;
        status: HandoverStatusPayload;
      };
      setStatus(res.status);
      setRootInput(res.root);
      setMessage(`บันทึกโฟลเดอร์แฟ้มงานพร้อมใช้แล้ว: ${res.root}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'บันทึกโฟลเดอร์ไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  async function openFolder() {
    setError('');
    try {
      const res = (await postAction({action: 'openFolder'})) as {folder: string};
      setMessage(`เปิดโฟลเดอร์แล้ว: ${res.folder}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ไม่สามารถเปิดโฟลเดอร์อัตโนมัติได้ กรุณาคัดลอกพาธไปวางใน File Explorer');
    }
  }

  async function runArchiveAll() {
    if (selectedModules.size === 0) {
      setError('กรุณาเลือกอย่างน้อย 1 หมวดงานที่ต้องการจัดเก็บ');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('กำลังจัดเรียงและสร้างไฟล์ Word (.docx) แยกตามปีงบประมาณและหมวดงาน โปรดรอสักครู่…');
    try {
      const res = (await postAction({
        action: 'archiveAll',
        fiscalYearBE: selectedYear === 'ALL' ? null : Number(selectedYear),
        modules: [...selectedModules],
        includePdf,
      })) as {report: FullArchiveReport; status: HandoverStatusPayload};
      setReport(res.report);
      setStatus(res.status);
      const t = res.report.totals;
      setMessage(
        `จัดเก็บแฟ้มงานลงเครื่องเสร็จแล้ว — สร้างใหม่ ${t.created} ไฟล์ · อัปเดต ${t.updated} ไฟล์ (เก็บฉบับเดิมไว้ใน ประวัติรุ่นเก่า ${t.archivedPrevious} ไฟล์) · เหมือนเดิม ${t.unchanged} ไฟล์`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'จัดเก็บแฟ้มงานลงเครื่องไม่สำเร็จ');
    } finally {
      setBusy(false);
    }
  }

  function toggleModule(key: ArchiveModuleKey) {
    setSelectedModules(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <section
      aria-label="แฟ้มงานพร้อมใช้ในเครื่อง (Word & PDF สำหรับส่งต่อ)"
      style={{
        marginTop: 20,
        padding: 16,
        borderRadius: 10,
        border: '1px solid #cdded7',
        background: '#f7fbf9',
        display: 'grid',
        gap: 12,
      }}
    >
      <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap'}}>
        <div>
          <h3 style={{margin: 0, fontSize: 16, color: '#114539'}}>
            แฟ้มงานพร้อมใช้ในเครื่อง (Local Word &amp; PDF Archive)
          </h3>
          <p style={{margin: '4px 0 0', fontSize: 13, color: '#45615a'}}>
            จัดเก็บไฟล์ Word (<code>.docx</code>), PDF, ไฟล์แนบ และรูปภาพ แยกโฟลเดอร์สะอาดแบบ{' '}
            <b>ปีงบประมาณ → ประเภทงาน → ชื่องาน</b> (เก็บไฟล์ล่าสุดชื่อสะอาดไว้หน้าแฟ้ม และย้ายฉบับเก่าเข้า{' '}
            <code>ประวัติรุ่นเก่า\</code> อัตโนมัติ) เพื่อให้เพื่อนร่วมงานหรือผู้รับมอบงานเปิดใช้งานต่อได้ทันทีโดยไม่ต้องเปิดโปรแกรมนี้
          </p>
        </div>
      </div>

      {message && (
        <div
          role="status"
          style={{padding: '9px 12px', borderRadius: 8, background: '#e5f6ee', border: '1px solid #96d1b6', color: '#0b5a44', fontSize: 13}}
        >
          {message}
        </div>
      )}
      {error && (
        <div
          role="alert"
          style={{padding: '9px 12px', borderRadius: 8, background: '#fff0f0', border: '1px solid #e7b5b8', color: '#9c1f24', fontSize: 13}}
        >
          {error}
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault();
          void saveRoot(rootInput);
        }}
        style={{display: 'grid', gap: 8}}
      >
        <label style={{display: 'grid', gap: 4, fontSize: 13}}>
          <strong>โฟลเดอร์ปลายทางในเครื่อง (กำหนดเองได้)</strong>
          <input
            type="text"
            value={rootInput}
            onChange={e => setRootInput(e.target.value)}
            placeholder={status?.defaultRoot || 'F:\\ข้อมูลสารบรรณ\\แฟ้มงานพร้อมใช้'}
            disabled={busy}
            style={{width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid #c6d8d1', background: '#fff', fontSize: 13}}
          />
          <small style={{color: '#557069'}}>
            ค่าเริ่มต้น: <code>{status?.defaultRoot || '…'}</code> · ระบบจะบันทึกสำเนาลงโฟลเดอร์นี้อัตโนมัติทุกครั้งที่กดส่งออก Word/PDF ในทุกโมดูล
          </small>
        </label>

        <div style={{display: 'flex', gap: 8, flexWrap: 'wrap'}}>
          <button type="submit" disabled={busy} className="primary">
            บันทึกโฟลเดอร์ปลายทาง
          </button>
          {status?.isCustom && (
            <button type="button" disabled={busy} onClick={() => void saveRoot('')}>
              กลับใช้ค่าเริ่มต้น
            </button>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              navigator.clipboard
                .writeText(status?.root || rootInput)
                .then(() => setMessage('คัดลอกพาธโฟลเดอร์แล้ว'))
                .catch(() => setMessage('คัดลอกไม่ได้ กรุณาคัดลอกพาธจากช่องด้านบน'))
            }
          >
            คัดลอกพาธ
          </button>
          <button type="button" disabled={busy} onClick={() => void openFolder()}>
            เปิดโฟลเดอร์ในเครื่อง
          </button>
        </div>
      </form>

      <div style={{borderTop: '1px solid #d5e4de', paddingTop: 12, display: 'grid', gap: 10}}>
        <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
          <label style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13}}>
            <strong>เลือกปีงบประมาณ:</strong>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(e.target.value)}
              disabled={busy}
              style={{padding: '6px 9px', borderRadius: 6, border: '1px solid #c6d8d1', background: '#fff'}}
            >
              <option value="ALL">ทุกปีงบประมาณที่มีข้อมูล</option>
              {(status?.fiscalYears ?? []).map(y => (
                <option key={y} value={String(y)}>
                  ปีงบประมาณ พ.ศ. {y}
                </option>
              ))}
            </select>
          </label>

          <label style={{display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer'}}>
            <input
              type="checkbox"
              checked={includePdf}
              disabled={busy}
              onChange={e => setIncludePdf(e.target.checked)}
              style={{width: 'auto', minHeight: 'auto'}}
            />
            สร้างไฟล์ PDF พร้อมพิมพ์ควบคู่กับ Word (ใช้เวลามากขึ้น)
          </label>
        </div>

        <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 6}}>
          {MODULE_OPTIONS.map(mod => (
            <label
              key={mod.key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12.5,
                padding: '6px 9px',
                borderRadius: 7,
                background: '#fff',
                border: '1px solid #dce7e2',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={selectedModules.has(mod.key)}
                disabled={busy}
                onChange={() => toggleModule(mod.key)}
                style={{width: 'auto', minHeight: 'auto'}}
              />
              <span>
                <b>{mod.label}</b>
              </span>
            </label>
          ))}
        </div>

        <div style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap'}}>
          <button type="button" className="primary" disabled={busy} onClick={() => void runArchiveAll()}>
            {busy
              ? 'กำลังสร้างและจัดเรียงแฟ้มลงเครื่อง…'
              : `จัดเก็บแฟ้มงาน Word ลงเครื่องทั้งหมด${selectedYear === 'ALL' ? '' : ` (ปีงบ ${selectedYear})`}`}
          </button>
          {status?.lastRun && (
            <small style={{color: '#4e6a62'}}>
              จัดเก็บล่าสุด: {new Date(status.lastRun.at).toLocaleString('th-TH')} (สร้างใหม่ {status.lastRun.created} · อัปเดต{' '}
              {status.lastRun.updated} · เหมือนเดิม {status.lastRun.unchanged})
            </small>
          )}
        </div>
      </div>

      {report && (
        <div style={{background: '#fff', border: '1px solid #d5e4de', borderRadius: 8, padding: 10, fontSize: 12.5}}>
          <div style={{marginBottom: 6}}>
            <strong>ผลการจัดเก็บลงโฟลเดอร์:</strong> <code>{report.root}</code>
          </div>
          <ul style={{margin: 0, paddingLeft: 18, display: 'grid', gap: 3}}>
            {report.modules.map(m => (
              <li key={m.module}>
                <b>{m.label}</b> ({m.itemsProcessed} รายการ): สร้างใหม่ {m.created} · อัปเดต {m.updated}
                {m.archivedPrevious > 0 ? ` (เก็บของเดิมเข้าประวัติรุ่นเก่า ${m.archivedPrevious})` : ''} · เหมือนเดิม {m.unchanged}
                {m.errors.length > 0 && <span style={{color: '#a02026'}}> · ขัดข้อง {m.errors.length} ({m.errors[0]})</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
