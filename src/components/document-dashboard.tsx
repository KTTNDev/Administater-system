"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownAZ,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Cloud,
  CloudOff,
  Copy,
  ExternalLink,
  FilePenLine,
  FilePlus2,
  Files,
  FolderSearch,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from "lucide-react";
import { documentYear, statusLabels, type SavedDraft } from "@/lib/document";
import { template, templates, type DocumentType } from "@/lib/templates";
import styles from "./document-dashboard.module.css";

type StatusFilter = "all" | "draft" | "reviewed";
type SyncFilter = "all" | "synced" | "pending";
type PeriodFilter = "all" | "7" | "30" | "90";
type SortMode = "updated-desc" | "updated-asc" | "subject" | "number";

type Props = {
  documents: SavedDraft[];
  pending: boolean;
  onOpen: (document: SavedDraft) => void;
  onCreate: (type: DocumentType) => void;
  onOpenTemplates: () => void;
  onRefresh: () => void;
  onDuplicate: (document: SavedDraft) => void;
  onDelete: (document: SavedDraft) => void;
};

const PAGE_SIZE = 10;
const formatter = new Intl.DateTimeFormat("th-TH", {
  day: "numeric",
  month: "short",
  year: "2-digit",
  timeZone: "Asia/Bangkok",
});
const timeFormatter = new Intl.DateTimeFormat("th-TH", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Bangkok",
});

function normalizeSearch(value: string) {
  return value
    .replace(/[๐-๙]/g, (digit) => String("๐๑๒๓๔๕๖๗๘๙".indexOf(digit)))
    .normalize("NFC")
    .toLocaleLowerCase("th-TH")
    .replace(/\s+/g, " ")
    .trim();
}

function searchableText(document: SavedDraft) {
  return normalizeSearch([
    document.subject,
    document.number,
    document.organization,
    document.department,
    document.recipient,
    document.signer,
    document.position,
    document.reference,
    document.attachments,
    document.copies,
    document.body,
    document.minutesIntroduction,
    ...document.meetingAgenda.flatMap(a=>[a.title,a.discussion,a.resolution]),
    document.certificateRecipient,
    document.background,
    document.legalBasis,
    document.consideration,
    document.proposal,
    template(document.type).name,
    template(document.type).group,
    document.date,
    String(documentYear(document.date, document.yearMode)),
  ]
    .join(" "));
}

export function DocumentDashboard({
  documents,
  pending,
  onOpen,
  onCreate,
  onOpenTemplates,
  onRefresh,
  onDuplicate,
  onDelete,
}: Props) {
  const searchRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<DocumentType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [syncFilter, setSyncFilter] = useState<SyncFilter>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sortMode, setSortMode] = useState<SortMode>("updated-desc");
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const reviewed = documents.filter((document) => document.status === "reviewed").length;
  const synced = documents.filter((document) => document.syncedVersion === document.version).length;
  const years = useMemo(
    () =>
      [...new Set(documents.map((document) => documentYear(document.date, document.yearMode)))]
        .sort((a, b) => b - a),
    [documents],
  );

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (event.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => setPage(1), [query, typeFilter, statusFilter, syncFilter, periodFilter, yearFilter, sortMode]);

  const filtered = useMemo(() => {
    const terms = normalizeSearch(query).split(" ").filter(Boolean);
    const now = Date.now();
    return documents
      .filter((document) => {
        const content = searchableText(document);
        if (terms.some((term) => !content.includes(term))) return false;
        if (typeFilter !== "all" && document.type !== typeFilter) return false;
        if (statusFilter !== "all" && document.status !== statusFilter) return false;
        const isSynced = document.syncedVersion === document.version;
        if (syncFilter === "synced" && !isSynced) return false;
        if (syncFilter === "pending" && isSynced) return false;
        if (yearFilter !== "all" && String(documentYear(document.date, document.yearMode)) !== yearFilter) return false;
        if (periodFilter !== "all") {
          const days = Number(periodFilter);
          if (now - new Date(document.updatedAt).getTime() > days * 86_400_000) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortMode === "updated-asc") return +new Date(a.updatedAt) - +new Date(b.updatedAt);
        if (sortMode === "subject") return a.subject.localeCompare(b.subject, "th");
        if (sortMode === "number") return (a.number || "~").localeCompare(b.number || "~", "th", { numeric: true });
        return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      });
  }, [documents, periodFilter, query, sortMode, statusFilter, syncFilter, typeFilter, yearFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visible = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const activeFilterCount = [typeFilter, statusFilter, syncFilter, periodFilter, yearFilter].filter((value) => value !== "all").length;
  const hasSearch = Boolean(query.trim()) || activeFilterCount > 0;

  useEffect(() => setPage((current) => Math.min(current, pageCount)), [pageCount]);

  function clearFilters() {
    setQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
    setSyncFilter("all");
    setPeriodFilter("all");
    setYearFilter("all");
  }

  function chooseStatus(status: StatusFilter | SyncFilter) {
    setStatusFilter(status === "draft" || status === "reviewed" ? status : "all");
    setSyncFilter(status === "synced" ? "synced" : "all");
  }

  return (
    <main className={`page-main ${styles.dashboard}`}>
      <section className={styles.hero}>
        <div className={styles.heroTop}>
          <div>
            <span className={styles.kicker}>ศูนย์งานเอกสาร</span>
            <h1>ค้นหา จัดการ และสร้างหนังสือ</h1>
          </div>
          <button className="primary" onClick={onOpenTemplates}>
            <Plus size={18} /> สร้างหนังสือ
          </button>
        </div>
        <div className={styles.heroSearch}>
          <Search size={21} />
          <input
            ref={searchRef}
            aria-label="ค้นหาเอกสารทุกข้อมูล"
            placeholder="ค้นหาเรื่อง เลขที่ ผู้รับ หน่วยงาน ผู้ลงนาม หรือข้อความในเอกสาร…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button aria-label="ล้างคำค้น" onClick={() => setQuery("")}>
              <X size={17} />
            </button>
          )}
          <kbd>/</kbd>
        </div>
      </section>

      <section className={styles.metrics} aria-label="สรุปสถานะเอกสาร">
        {[
          { label: "ทั้งหมด", value: documents.length, icon: Files, tone: "green", filter: "all" as const },
          { label: "กำลังร่าง", value: documents.length - reviewed, icon: FilePenLine, tone: "amber", filter: "draft" as const },
          { label: "ตรวจทานแล้ว", value: reviewed, icon: CheckCircle2, tone: "blue", filter: "reviewed" as const },
          { label: "อยู่บน Drive", value: synced, icon: Cloud, tone: "violet", filter: "synced" as const },
        ].map((metric) => (
          <button key={metric.label} className={styles.metric} onClick={() => chooseStatus(metric.filter)}>
            <span className={`${styles.metricIcon} ${styles[metric.tone]}`}><metric.icon size={18} /></span>
            <span><strong>{metric.value.toLocaleString("th-TH")}</strong><small>{metric.label}</small></span>
          </button>
        ))}
      </section>

      <section className={styles.quickCreate} aria-label="สร้างเอกสารที่ใช้บ่อย">
        <span>สร้างด่วน</span>
        {templates.filter((item) => ["external", "internal", "order", "announcement"].includes(item.id)).map((item) => (
          <button key={item.id} onClick={() => onCreate(item.id)}><FilePlus2 size={15} />{item.name}</button>
        ))}
        <button onClick={onOpenTemplates}>แบบทั้งหมด <ChevronRight size={15} /></button>
      </section>

      <section className={styles.workspace}>
        <div className={styles.listHeader}>
          <div>
            <h2>เอกสารในระบบ</h2>
            <p>พบ {filtered.length.toLocaleString("th-TH")} จาก {documents.length.toLocaleString("th-TH")} รายการ</p>
          </div>
          <div className={styles.headerActions}>
            <button className={showFilters ? styles.filterActive : ""} onClick={() => setShowFilters((value) => !value)}>
              <SlidersHorizontal size={16} /> ตัวกรอง
              {activeFilterCount > 0 && <span>{activeFilterCount}</span>}
            </button>
            <button aria-label="รีเฟรชรายการ" title="รีเฟรชรายการ" disabled={pending} onClick={onRefresh}><RefreshCw size={17} /></button>
          </div>
        </div>

        <div className={`${styles.filters} ${showFilters ? styles.filtersOpen : ""}`}>
          <label>ประเภท<select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as DocumentType | "all")}><option value="all">ทุกประเภท</option>{templates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
          <label>สถานะ<select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">ทุกสถานะ</option><option value="draft">ฉบับร่าง</option><option value="reviewed">ตรวจทานแล้ว</option></select></label>
          <label>Google Drive<select value={syncFilter} onChange={(event) => setSyncFilter(event.target.value as SyncFilter)}><option value="all">ทุกสถานะ</option><option value="synced">จัดเก็บล่าสุดแล้ว</option><option value="pending">ยังไม่จัดเก็บ/มีการแก้ไข</option></select></label>
          <label>ปีเอกสาร<select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}><option value="all">ทุกปี</option>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label>แก้ไขเมื่อ<select value={periodFilter} onChange={(event) => setPeriodFilter(event.target.value as PeriodFilter)}><option value="all">ทุกช่วงเวลา</option><option value="7">7 วันที่ผ่านมา</option><option value="30">30 วันที่ผ่านมา</option><option value="90">90 วันที่ผ่านมา</option></select></label>
          {hasSearch && <button className={styles.clearFilters} onClick={clearFilters}><X size={15} />ล้างตัวกรอง</button>}
        </div>

        <div className={styles.resultBar}>
          <div className={styles.activeSummary}>
            <FolderSearch size={16} />
            <span>{hasSearch ? `ผลการค้นหา ${filtered.length.toLocaleString("th-TH")} รายการ` : "เอกสารล่าสุดทั้งหมด"}</span>
            {query && <span className={styles.queryChip}>“{query}”</span>}
          </div>
          <label className={styles.sort}><ArrowDownAZ size={15} /><span>เรียงตาม</span><select aria-label="เรียงเอกสาร" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}><option value="updated-desc">แก้ไขล่าสุด</option><option value="updated-asc">เก่าสุด</option><option value="subject">ชื่อเรื่อง ก–ฮ</option><option value="number">เลขที่หนังสือ</option></select></label>
        </div>

        {visible.length ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead><tr><th>เอกสาร</th><th>ประเภท / ปี</th><th>ผู้รับ / หน่วยงาน</th><th>แก้ไขล่าสุด</th><th>สถานะ</th><th><span className={styles.srOnly}>จัดการ</span></th></tr></thead>
              <tbody>{visible.map((document) => {
                const isSynced = document.syncedVersion === document.version;
                return <tr key={document.id}>
                  <td><button className={styles.documentTitle} onClick={() => onOpen(document)}><span className={styles.fileIcon}><Files size={18} /></span><span><strong>{document.subject}</strong><small>{document.number || "ยังไม่ระบุเลขที่"} · ฉบับที่ {document.version}</small></span></button></td>
                  <td><span className={styles.typeBadge}>{template(document.type).name}</span><small className={styles.cellSub}>{document.yearMode === "fiscal" ? "ปีงบประมาณ" : "ปีปฏิทิน"} {documentYear(document.date, document.yearMode)}</small></td>
                  <td><strong className={styles.cellMain}>{document.recipient || "—"}</strong><small className={styles.cellSub}>{document.department || document.organization || "ยังไม่ระบุหน่วยงาน"}</small></td>
                  <td><strong className={styles.cellMain}>{formatter.format(new Date(document.updatedAt))}</strong><small className={styles.cellSub}>{timeFormatter.format(new Date(document.updatedAt))} น.</small></td>
                  <td><span className={`${styles.status} ${document.status === "reviewed" ? styles.reviewed : styles.draft}`}>{document.status === "reviewed" ? <CheckCircle2 size={13} /> : <FilePenLine size={13} />}{statusLabels[document.status]}</span><span className={`${styles.sync} ${isSynced ? styles.synced : ""}`}>{isSynced ? <Cloud size={12} /> : <CloudOff size={12} />}{isSynced ? "จัดเก็บแล้ว" : "รอจัดเก็บ"}</span></td>
                  <td><div className={styles.rowActions}>{document.driveFileId && <a href={`https://drive.google.com/file/d/${document.driveFileId}/view`} target="_blank" rel="noreferrer" title="เปิดไฟล์บน Drive" aria-label={`เปิด ${document.subject} บน Drive`}><ExternalLink size={16} /></a>}<button title="ทำสำเนา" aria-label={`ทำสำเนา ${document.subject}`} disabled={pending} onClick={() => onDuplicate(document)}><Copy size={16} /></button><button className={styles.delete} title="ลบร่าง" aria-label={`ลบ ${document.subject}`} disabled={pending} onClick={() => onDelete(document)}><Trash2 size={16} /></button></div></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        ) : (
          <div className={styles.empty}>
            <span><FolderSearch size={28} /></span>
            <h3>ไม่พบเอกสารที่ค้นหา</h3>
            <p>ลองใช้คำค้นที่สั้นลง หรือปรับตัวกรองประเภทและช่วงเวลา</p>
            <button onClick={clearFilters}>ล้างการค้นหา</button>
          </div>
        )}

        <div className={styles.footer}>
          <span><CalendarDays size={15} />แสดง {visible.length.toLocaleString("th-TH")} รายการในหน้านี้</span>
          {pageCount > 1 && <div className={styles.pagination}><button aria-label="หน้าก่อน" disabled={page === 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft size={16} /></button><span>หน้า {page.toLocaleString("th-TH")} / {pageCount.toLocaleString("th-TH")}</span><button aria-label="หน้าถัดไป" disabled={page === pageCount} onClick={() => setPage((value) => value + 1)}><ChevronRight size={16} /></button></div>}
        </div>
      </section>
    </main>
  );
}
