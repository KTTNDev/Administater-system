"use client";
/**
 * แผนที่อ่านโค้ด — src/components/workspace.tsx
 * หน้าที่: ศูนย์ควบคุมหน้าจอและร่างปัจจุบัน เชื่อมช่องกรอก การบันทึก ตัวอย่าง A4 และปุ่มส่งออก
 *
 * ลำดับแนะนำสำหรับเรียนรู้ (ลำดับอ่าน ไม่ใช่ทุกไฟล์ถูกเรียกตามเลขนี้):
 * 1. ../app/page.tsx
 * 2. ./workspace.tsx ← คุณอยู่ที่นี่
 * 3. ../lib/document.ts
 * 4. ../app/actions.ts
 * 5. ../lib/db.ts
 * 6. ../lib/render-document.ts
 * 7. ../app/api/documents/[id]/pdf/route.ts
 * 8. ../lib/pdf.ts
 *
 * ผู้ใช้ไฟล์นี้โดยตรง: ../app/page.tsx
 * อ่านต่อจาก import: ./minutes-details.tsx, ../lib/document.ts, ../lib/templates.ts, ../lib/render-document.ts, ../app/actions.ts, ../app/appendix-actions.ts, ../lib/office.ts, ../lib/booking.ts
 *
 * แนวทางแก้: เพิ่ม/ลบช่องให้ตรงชนิดข้อมูลต้นทาง แล้วตาม onChange ไป parent และ Server Action; แก้ CSS ของจอแยกจาก CSS เอกสาร
 * TypeScript ตรวจชนิดตอนพัฒนา; การรับข้อมูลจริงยังต้องใช้ schema/เงื่อนไข runtime ตามโค้ด ไม่ใช่ใช้ as เพื่อข้ามข้อมูลผิด
 */

/* นำเข้า ./minutes-details.tsx — ตัวเลือกแม่แบบประชุม ตารางกรรมการ รายละเอียด TOR และผู้ลงนามท้ายรายงาน */
import {
  MinutesPresetPicker,
  MinutesMembersEditor,
  MinutesSigningEditor,
} from "./minutes-details";
/* นำเข้า react — React hooks สำหรับ state, ref และการทำงานหลัง render */
import { useEffect, useRef, useState, useTransition } from "react";
/* นำเข้า next/dynamic — API ของ Next.js สำหรับส่วนที่ชื่อ module ระบุ */
import dynamic from "next/dynamic";
/* นำเข้า lucide-react — ไอคอน UI ไม่มีผลกับข้อมูลหรือผลพิมพ์ */
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Cloud,
  FileText,
  Files,
  FolderOpen,
  History,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  Plus,
  Printer,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
/* นำเข้า ../lib/document.ts — สัญญาข้อมูลร่างหนังสือ: กฎตรวจค่าจริง ชนิด TypeScript ค่าเริ่มต้น และลำดับเนื้อหาที่ใช้สร้างเอกสาร */
import {
  documentSchema,
  newDraft,
  reviewIssues,
  statusLabels,
  thaiDate,
  documentYear,
  type Draft,
  type SavedDraft,
} from "@/lib/document";
/* นำเข้า ../lib/templates.ts — ทะเบียนประเภทหนังสือ หมวด ชื่อ คำแนะนำ และข้อมูลหน่วยงานตัวอย่าง */
import {
  groups,
  organizations,
  template,
  templates,
  type DocumentType,
} from "@/lib/templates";
/* นำเข้า ../lib/render-document.ts — แปลง Draft เป็น HTML เอกสาร A4 พร้อม CSS และ JavaScript จัดหน้า ใช้ร่วมกันทั้ง preview และ PDF; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { DocumentAssets } from "@/lib/render-document";
/* นำเข้า ../app/actions.ts — จุดรับคำสั่งจากหน้าจอ: ตรวจสิทธิ์และข้อมูลก่อนบันทึก ลบ ทำสำเนา หรือส่งไป Drive */
import {
  saveDocument,
  deleteDocument,
  duplicateDocument,
  getDocuments,
  getHistory,
  saveOrganization,
  uploadDocument,
  logout,
} from "@/app/actions";

/* นำเข้า ../app/appendix-actions.ts — รับภาพภาคผนวกและส่ง data URL กลับให้หน้าจอหลังตรวจสิทธิ์ */
import { getAppendixImageSources } from "@/app/appendix-actions";
/* นำเข้า ../lib/office.ts — กฎข้อมูลทะเบียนงานธุรการ ชนิดงาน สถานะ และข้อมูลหนังสือที่เชื่อมโยง; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { OfficeItem } from "@/lib/office";
/* นำเข้า ../lib/booking.ts — กฎการจองห้อง ช่วงเวลา ความจุ และตัวช่วยวันที่/ตรวจช่วงเวลาทับกัน; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { Room, Booking } from "@/lib/booking";
/* นำเข้า ../lib/calendar.ts — กฎข้อมูลนัดหมายและตัวช่วยเลือกเหตุการณ์ที่เกิดในแต่ละวัน; import type ใช้ตอนตรวจชนิดเท่านั้น */
import type { CalendarEvent } from "@/lib/calendar";

/* โหลด MinutesEditor แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const MinutesEditor = dynamic(() =>
  import("./minutes-editor").then((module) => module.MinutesEditor),
);
/* โหลด BodyEditor แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const BodyEditor = dynamic(() =>
  import("./body-editor").then((module) => module.BodyEditor),
);
/* โหลด DocumentTools แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const DocumentTools = dynamic(() =>
  import("./document-tools").then((module) => module.DocumentTools),
);
/* โหลด StructuredBody แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const StructuredBody = dynamic(() =>
  import("./document-tools").then((module) => module.StructuredBody),
);
/* โหลด ReviewChain แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const ReviewChain = dynamic(() =>
  import("./document-tools").then((module) => module.ReviewChain),
);
/* โหลด LegalLibrary แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const LegalLibrary = dynamic(() =>
  import("./document-tools").then((module) => module.LegalLibrary),
);
/* โหลด AttachmentEditor แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const AttachmentEditor = dynamic(() =>
  import("./attachment-editor").then((module) => module.AttachmentEditor),
);
/* โหลด AttachmentPreview แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const AttachmentPreview = dynamic(() =>
  import("./attachment-editor").then((module) => module.AttachmentPreview),
);
/* โหลด AppendixEditor แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const AppendixEditor = dynamic(() =>
  import("./appendix-editor").then((module) => module.AppendixEditor),
);
/* โหลด LegalReader แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const LegalReader = dynamic(() =>
  import("./writing-assistants").then((module) => module.LegalReader),
);
/* โหลด DocumentDashboard แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const DocumentDashboard = dynamic(() =>
  import("./document-dashboard").then((module) => module.DocumentDashboard),
);
/* โหลด ActionSearch แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const ActionSearch = dynamic(() =>
  import("./action-search").then((module) => module.ActionSearch),
);
/* โหลด RecoveryPanel แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const RecoveryPanel = dynamic(() =>
  import("./recovery-panel").then((module) => module.RecoveryPanel),
);
/* โหลด BudgetTransfers แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const BudgetTransfers = dynamic(() =>
  import("./budget-transfers").then((module) => module.BudgetTransfers),
);
/* โหลด OfficeWorkspace แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const OfficeWorkspace = dynamic(() =>
  import("./office-workspace").then((module) => module.OfficeWorkspace),
);
/* โหลด MeetingBookings แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const MeetingBookings = dynamic(() =>
  import("./meeting-bookings").then((module) => module.MeetingBookings),
);
/* โหลด WorkCalendar แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const WorkCalendar = dynamic(() =>
  import("./work-calendar").then((module) => module.WorkCalendar),
);
/* โหลด LawLibrary แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const LawLibrary = dynamic(() =>
  import("./law-library").then((module) => module.LawLibrary),
);
/* โหลด TemplateReference แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const TemplateReference = dynamic(() =>
  import("./template-reference").then((module) => module.TemplateReference),
);
/* โหลด SetupReadiness แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const SetupReadiness = dynamic(() =>
  import("./setup-readiness").then((module) => module.SetupReadiness),
);
/* โหลด StorageSettings แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const StorageSettings = dynamic(() =>
  import("./system-center").then((module) => module.StorageSettings),
);
/* โหลด ReportsDashboard แบบแยกส่วนด้วย dynamic import เพื่อลดงานเริ่มต้นของหน้าหลัก */
const ReportsDashboard = dynamic(() =>
  import("./system-center").then((module) => module.ReportsDashboard),
);
/* ชนิด Organization: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type Organization = (typeof organizations)[number];
/* ชนิด View: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type View =
  | "budget"
  | "dashboard"
  | "templates"
  | "editor"
  | "settings"
  | "guide"
  | "office"
  | "bookings"
  | "calendar"
  | "laws"
  | "reports";
/* ชนิด Props: อธิบายรูปข้อมูลให้ TypeScript ตรวจ ไม่ได้สร้างข้อมูลหรือ validate ค่าใน runtime */
type Props = {
  initialCalendar: CalendarEvent[];
  initialBookings: { rooms: Room[]; bookings: Booking[] };
  initialOffice: OfficeItem[];
  initialDocuments: SavedDraft[];
  assets: DocumentAssets;
  drive: { configured: boolean; connected: boolean; email: string };
  local: boolean;
  initialView?: string;
  googleResult?: string;
  savedOrganization: Organization | null;
};
/* รับ props เริ่มต้นจาก page.tsx แล้วเป็นเจ้าของ state ของร่างและหน้าที่แสดง; ฟอร์มลูกส่ง patch กลับมาที่นี่ */
export function Workspace({
  initialCalendar,
  initialBookings,
  initialOffice,
  initialDocuments,
  assets,
  drive,
  local,
  initialView,
  googleResult,
  savedOrganization,
}: Props) {
  /* state [view, setView], [documents, setDocuments]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [view, setView] = useState<View>(
      initialView === "budget"
        ? "budget"
        : initialView === "reports"
          ? "reports"
          : initialView === "laws"
            ? "laws"
            : initialView === "calendar"
              ? "calendar"
              : initialView === "bookings"
                ? "bookings"
                : initialView === "office"
                  ? "office"
                  : initialView === "settings"
                    ? "settings"
                    : "dashboard",
    ),
    [documents, setDocuments] = useState(initialDocuments);
  /* state [draft, setDraft], [saved, setSaved], [baseline, setBaseline]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [draft, setDraft] = useState<Draft>(newDraft()),
    [saved, setSaved] = useState<SavedDraft | null>(null),
    [baseline, setBaseline] = useState(JSON.stringify(newDraft()));
  /* state [toast, setToast], [pending, startTransition], [mobileNav, setMobileNav]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(
      null,
    ),
    [pending, startTransition] = useTransition(),
    [mobileNav, setMobileNav] = useState(false);
  /* state [attachmentBusy, setAttachmentBusy]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [attachmentBusy, setAttachmentBusy] = useState(false);
  /* state [appendixSources, setAppendixSources]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [appendixSources, setAppendixSources] = useState<
    Record<string, string>
  >({});
  /* state [budgetDirty, setBudgetDirty]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [budgetDirty, setBudgetDirty] = useState(false);
  /* state [recoveryKey, setRecoveryKey]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [recoveryKey, setRecoveryKey] = useState(0);
  /* state [zoom, setZoom], [pages, setPages], [previewHeight, setPreviewHeight], [overflow, setOverflow], [ready, setReady], [compactSignoff, setCompactSignoff]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [zoom, setZoom] = useState(65),
    [pages, setPages] = useState(1),
    [previewHeight, setPreviewHeight] = useState(1123),
    [overflow, setOverflow] = useState(false),
    [ready, setReady] = useState(false),
    [compactSignoff, setCompactSignoff] = useState(false);
  /* state [organization, setOrganization]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [organization, setOrganization] = useState<Organization>(
    savedOrganization || {
      name: "",
      department: "",
      address: "",
      phone: "",
      prefix: "",
    },
  );
  /* state [history, setHistory], [sample, setSample]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [history, setHistory] = useState<
      { action: string; version: number; at: string }[] | null
    >(null),
    [sample, setSample] = useState(false);
  /* ref frame: อ้าง DOM/ค่าที่ต้องคงระหว่าง render; เปลี่ยน .current ไม่ทำให้ render ใหม่ */
  const frame = useRef<HTMLIFrameElement>(null);
  /* แปลง dirty เป็น JSON string สำหรับเปรียบเทียบ snapshot หรือจัดเก็บ ตามผู้ใช้ค่าด้านล่าง */
  const dirty = JSON.stringify(draft) !== baseline;
  /* รายการจุดที่ต้องแก้จาก reviewIssues ใช้แสดงคำเตือน ไม่ใช่การแก้ข้อมูลให้ผู้ใช้ */
  const issues = reviewIssues(draft);
  /* state [previewDraft, setPreviewDraft], [html, setHtml]: ค่าที่ใช้วาด UI กับ setter; setter ขอให้ React render ใหม่ ไม่เขียนลงฐานข้อมูลเอง */
  const [previewDraft, setPreviewDraft] = useState(draft),
    [html, setHtml] = useState("");
  /* Effect ทำงานหลัง render เมื่อ dependency ท้าย hook เปลี่ยน; return ภายใน callback เป็น cleanup สำหรับ timer/listener หรืองานเก่า */
  useEffect(() => {
    setReady(false);
    const timer = setTimeout(() => setPreviewDraft(draft), 300);
    return () => clearTimeout(timer);
  }, [draft]);
  /* Effect ทำงานหลัง render เมื่อ dependency ท้าย hook เปลี่ยน; return ภายใน callback เป็น cleanup สำหรับ timer/listener หรืองานเก่า */
  useEffect(() => {
    if (view !== "editor") {
      setHtml("");
      return;
    }
    let active = true;
    import("@/lib/render-document")
      .then(({ documentHtml }) => {
        if (active)
          setHtml(documentHtml(previewDraft, assets, appendixSources));
      })
      .catch(() => {
        if (active)
          setToast({
            text: "สร้างตัวอย่างเอกสารไม่สำเร็จ กรุณาลองเปิดร่างอีกครั้ง",
            error: true,
          });
      });
    return () => {
      active = false;
    };
  }, [view, previewDraft, assets, appendixSources]);
  /* Effect ทำงานหลัง render เมื่อ dependency ท้าย hook เปลี่ยน; return ภายใน callback เป็น cleanup สำหรับ timer/listener หรืองานเก่า */
  useEffect(() => {
    const handle = (event: MessageEvent) => {
      if (
        event.source !== frame.current?.contentWindow ||
        event.data?.source !== "sarabun-preview"
      )
        return;
      setPages(event.data.pages || 1);
      setPreviewHeight(event.data.height || 1123);
      setOverflow(!!event.data.overflow || !!event.data.error);
      setCompactSignoff(!!event.data.compactSignoff);
      setReady(!event.data.error);
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);
  /* Effect ทำงานหลัง render เมื่อ dependency ท้าย hook เปลี่ยน; return ภายใน callback เป็น cleanup สำหรับ timer/listener หรืองานเก่า */
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  /* Effect ทำงานหลัง render เมื่อ dependency ท้าย hook เปลี่ยน; return ภายใน callback เป็น cleanup สำหรับ timer/listener หรืองานเก่า */
  useEffect(() => {
    const prevent = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  /* Effect ทำงานหลัง render เมื่อ dependency ท้าย hook เปลี่ยน; return ภายใน callback เป็น cleanup สำหรับ timer/listener หรืองานเก่า */
  useEffect(() => {
    if (googleResult)
      setToast({
        text:
          googleResult === "connected"
            ? "เชื่อมต่อ Google Drive เรียบร้อยแล้ว"
            : googleResult === "setup"
              ? "กรุณาตั้งค่า Google OAuth และ SESSION_SECRET ตามคู่มือ"
              : "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่และตรวจ Redirect URI",
        error: googleResult !== "connected",
      });
  }, [googleResult]);
  /* เปลี่ยนหน้าภายในแอป โดยกันออกจากร่างที่แก้ยังไม่บันทึกหรือกำลังอัปโหลด */
  function navigate(next: View) {
    if (attachmentBusy) return;
    if (
      view === "budget" &&
      budgetDirty &&
      !confirm("มีคำขอโอนงบที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?")
    )
      return;
    if (
      view === "editor" &&
      dirty &&
      !confirm("มีการแก้ไขที่ยังไม่ได้บันทึก ต้องการออกจากหน้านี้หรือไม่?")
    )
      return;
    setView(next);
    setMobileNav(false);
    setHistory(null);
  }
  /* Generic K extends keyof Draft ผูกชื่อช่องกับชนิดค่าที่ช่องนั้นรับได้; spread เก็บช่องอื่นและเปลี่ยนสถานะกลับเป็นร่าง */
  /* ตัวอย่างเรียน Generic: ถ้า key เป็น "subject" ค่า value ต้องเป็น string; ถ้าเป็น "productionMark" ต้องเป็น boolean เพราะ Draft[K] อ่านชนิดตาม key */
  function update<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...([
        "body",
        "bodyMode",
        "background",
        "facts",
        "legalBasis",
        "consideration",
        "proposal",
      ].includes(key)
        ? { contentBlocks: [] }
        : {}),
      ...(key !== "status" ? { status: "draft" as const } : {}),
    }));
  }
  /* อ่าน data URL ภาพที่อ้างด้วย id เพื่อประกอบ preview; ข้อมูลไฟล์จริงอยู่ใน appendix.ts */
  async function loadAppendixSources(value: Draft) {
    if (!value.appendixImages.length) {
      setAppendixSources({});
      return;
    }
    /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
    try {
      setAppendixSources(
        await getAppendixImageSources(
          value.appendixImages.map((image) => image.id),
        ),
      );
    } catch (error) {
      setAppendixSources({});
      setToast({
        text:
          error instanceof Error ? error.message : "โหลดภาพแนบท้ายไม่สำเร็จ",
        error: true,
      });
    }
  }
  /* parse ร่างเก่าให้มีค่าเริ่มต้นของฟิลด์ใหม่ แล้วตั้งทั้ง draft และ baseline เพื่อให้การตรวจ dirty เริ่มถูกจุด */
  function openDraft(d: SavedDraft) {
    setRecoveryKey((n) => n + 1);
    if (attachmentBusy) return;
    if (
      view === "editor" &&
      dirty &&
      !confirm("ละทิ้งการแก้ไขที่ยังไม่ได้บันทึกหรือไม่?")
    )
      return;
    /* ตรวจ/แปลง value จากข้อมูลต้นทางก่อนใช้ต่อ; schema.parse จะ throw เมื่อค่าไม่ผ่าน */
    const value = documentSchema.parse(d);
    setDraft(value);
    setPreviewDraft(value);
    void loadAppendixSources(value);
    setSaved(d);
    setBaseline(JSON.stringify(value));
    setSample(false);
    setHistory(null);
    setView("editor");
    setReady(false);
  }
  /* สร้าง Draft ใหม่จากประเภทหนังสือและข้อมูลหน่วยงาน; ไม่เขียนลงฐานข้อมูลจนผู้ใช้บันทึก */
  function create(type: DocumentType) {
    setRecoveryKey((n) => n + 1);
    if (attachmentBusy) return;
    if (
      view === "editor" &&
      dirty &&
      !confirm("ละทิ้งการแก้ไขที่ยังไม่ได้บันทึกหรือไม่?")
    )
      return;
    const value = {
      ...newDraft(type),
      organization: organization.name,
      department: organization.department,
      address: organization.address,
      phone: organization.phone,
    };
    setDraft(value);
    setPreviewDraft(value);
    setAppendixSources({});
    setSaved(null);
    setBaseline(JSON.stringify(value));
    setSample(false);
    setView("editor");
    setReady(false);
    setHistory(null);
  }
  /* รอ saveDocument สำเร็จแล้วจึงเปลี่ยน saved/baseline และโหลดรายการใหม่; id/version ใช้กันการเขียนทับจากหลายหน้าต่าง */
  /* เส้นทางบันทึกจริง: ปุ่ม save() → persist() → ../app/actions.ts::saveDocument → ../lib/db.ts::writeDraft → กลับมาตั้ง baseline */
  async function persist() {
    if (attachmentBusy) throw new Error("กรุณารออัปโหลดไฟล์แนบให้เสร็จ");
    /* รอผลของงานก่อนกำหนด result; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
    const result = await saveDocument(draft, saved?.id, saved?.version);
    if (!result.ok) {
      setToast({ text: result.error, error: true });
      return null;
    }
    setSaved(result.data);
    setBaseline(JSON.stringify(documentSchema.parse(result.data)));
    setDocuments(await getDocuments());
    return result.data;
  }
  /* ครอบการบันทึกด้วย transition เพื่อให้ UI แสดงสถานะรอ พร้อมแจ้งผลสำเร็จหรือข้อผิดพลาด */
  function save() {
    startTransition(async () => {
      /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
      try {
        /* รอผลของงานก่อนกำหนด result; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
        const result = await persist();
        if (result) setToast({ text: "บันทึกร่างเรียบร้อยแล้ว" });
      } catch {
        setToast({
          text: "ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาลองบันทึกใหม่",
          error: true,
        });
      }
    });
  }
  /* เติมข้อมูลสมมติลง state ของร่างเพื่อทดลอง ไม่ใช่ข้อมูลที่รับรองหรืออนุมัติจริง */
  function loadSample() {
    const org = organizations[0];
    setDraft((d) => ({
      ...d,
      subject: "ขอเชิญประชุมคณะทำงานจัดทำแผนพัฒนาท้องถิ่น",
      organization: org.name,
      department: org.department,
      address: org.address,
      phone: org.phone,
      number: d.type === "order" ? "1/2569" : "ทส 0000/001",
      recipient: "หัวหน้าส่วนราชการที่เกี่ยวข้อง",
      body: "ด้วยสำนักงานเทศบาล (ตัวอย่าง) กำหนดจัดประชุมคณะทำงานจัดทำแผนพัฒนาท้องถิ่น เพื่อร่วมพิจารณาแนวทางพัฒนาการให้บริการประชาชนและรับฟังข้อเสนอจากส่วนราชการที่เกี่ยวข้อง\nในการนี้ จึงขอเชิญท่านเข้าร่วมประชุมตามวัน เวลา และสถานที่ที่หน่วยงานกำหนด พร้อมจัดเตรียมข้อมูลปัญหาและข้อเสนอแนะในภารกิจที่รับผิดชอบ เพื่อประกอบการพิจารณาร่วมกัน\nจึงเรียนมาเพื่อโปรดพิจารณาเข้าร่วมประชุม",
      signer: "ชื่อ นามสกุล (ตัวอย่าง)",
      position: "นายกเทศมนตรี (ตัวอย่าง)",
      status: "draft",
    }));
    setSample(true);
  }
  /* บันทึกการแก้ไขก่อน ดาวน์โหลด /api/documents/[id]/pdf เป็น Blob แล้วคืนหน่วยความจำของ object URL */
  async function exportPdf() {
    /* รอผลของงานก่อนกำหนด result; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
    const result = dirty || !saved ? await persist() : saved;
    if (!result) return;
    /* รอผลของงานก่อนกำหนด response; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
    const response = await fetch(`/api/documents/${result.id}/pdf`);
    if (!response.ok) {
      /* รอผลของงานก่อนกำหนด body; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
      const body = await response.json();
      throw new Error(body.error || "ส่งออกไม่สำเร็จ");
    }
    /* รอผลของงานก่อนกำหนด blob, url, a; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
    const blob = await response.blob(),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = result.subject + ".pdf";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 15000);
    setToast({ text: "ดาวน์โหลด PDF เรียบร้อยแล้ว" });
  }
  /* ตัวครอบงาน async ของปุ่ม แปลงข้อผิดพลาดเป็นข้อความให้ผู้ใช้ โดยไม่ปล่อย Promise rejection หลุดออกไป */
  function asyncJob(job: () => Promise<void>) {
    startTransition(async () => {
      /* try รวมงานที่อาจล้มเหลว; อ่าน catch ว่าแจ้งผู้ใช้อย่างไร และ finally ว่าคืนทรัพยากรอะไร */
      try {
        await job();
      } catch (e) {
        setToast({
          text: e instanceof Error ? e.message : "ดำเนินการไม่สำเร็จ",
          error: true,
        });
      }
    });
  }
  /* สร้าง input/textarea จากชื่อช่อง Draft; ถ้าเพิ่มฟิลด์จริงต้องเพิ่ม schema และตำแหน่งแสดงใน render-document.ts ด้วย */
  function field(
    key: keyof Draft,
    label: string,
    options?: {
      textarea?: boolean;
      placeholder?: string;
      required?: boolean;
      type?: string;
      wide?: boolean;
    },
  ) {
    return (
      <label className={options?.wide ? "wide" : ""} key={key}>
        {label}
        {options?.required && <span className="required"> *</span>}
        {options?.textarea ? (
          key === "body" ? (
            <BodyEditor
              value={String(draft[key])}
              required={options?.required}
              onChange={(value) => update(key, value as never)}
            />
          ) : (
            <textarea
              required={options?.required}
              value={String(draft[key])}
              rows={3}
              onChange={(e) => update(key, e.target.value as never)}
              placeholder={options.placeholder}
            />
          )
        ) : (
          <input
            required={options?.required}
            value={String(draft[key])}
            onChange={(e) => update(key, e.target.value as never)}
            type={options?.type || "text"}
            placeholder={options?.placeholder}
            maxLength={key === "subject" ? 300 : 2000}
          />
        )}
      </label>
    );
  }
  const correspondence = ["external", "internal", "memorandum"].includes(
      draft.type,
    ),
    directed = correspondence || draft.type === "stamped";
  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("dashboard");
          }}
        >
          <span className="brand-icon">
            <Files size={24} />
          </span>
          <span>
            <strong>
              สารบรรณ<span className="brand-dot">.</span>
            </strong>
            <small>DOCUMENT WORKSPACE</small>
          </span>
        </a>
        {/* ปุ่มเรียก () => navigate("templates") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
        <button
          className="primary new-document"
          onClick={() => navigate("templates")}
        >
          <Plus size={19} />
          สร้างหนังสือใหม่
        </button>
        <div className="nav-caption">พื้นที่ทำงาน</div>
        <nav>
          {/* ปุ่มเรียก () => navigate("budget") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "budget" ? "active" : ""}
            onClick={() => navigate("budget")}
          >
            <Files size={19} />
            โอนงบประมาณ
          </button>
          {/* ปุ่มเรียก () => navigate("reports") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "reports" ? "active" : ""}
            onClick={() => navigate("reports")}
          >
            <LayoutDashboard size={19} />
            ภาพรวมและรายงาน
          </button>
          {/* ปุ่มเรียก () => navigate("laws") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "laws" ? "active" : ""}
            onClick={() => navigate("laws")}
          >
            <BookOpen size={19} />
            คลังกฎหมายและระเบียบ
          </button>
          {/* ปุ่มเรียก () => navigate("calendar") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "calendar" ? "active" : ""}
            onClick={() => navigate("calendar")}
          >
            <LayoutDashboard size={19} />
            ปฏิทินงาน
          </button>
          {/* ปุ่มเรียก () => navigate("bookings") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "bookings" ? "active" : ""}
            onClick={() => navigate("bookings")}
          >
            <History size={19} />
            จองห้องประชุม
          </button>
          {/* ปุ่มเรียก () => navigate("office") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "office" ? "active" : ""}
            onClick={() => navigate("office")}
          >
            <FolderOpen size={19} />
            งานธุรการเทศบาล
          </button>
          {/* ปุ่มเรียก () => navigate("dashboard") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "dashboard" ? "active" : ""}
            onClick={() => navigate("dashboard")}
          >
            <LayoutDashboard size={19} />
            แดชบอร์ดเอกสาร<span className="nav-count">{documents.length}</span>
          </button>
          {/* ปุ่มเรียก () => navigate("templates") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "templates" ? "active" : ""}
            onClick={() => navigate("templates")}
          >
            <Files size={19} />
            แบบหนังสือราชการ
          </button>
          {/* ปุ่มเรียก () => navigate("guide") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "guide" ? "active" : ""}
            onClick={() => navigate("guide")}
          >
            <BookOpen size={19} />
            คู่มือและแหล่งอ้างอิง
          </button>
        </nav>
        <div className="nav-caption">จัดการระบบ</div>
        <nav>
          {/* ปุ่มเรียก () => navigate("settings") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button
            className={view === "settings" ? "active" : ""}
            onClick={() => navigate("settings")}
          >
            <Settings2 size={19} />
            ตั้งค่าหน่วยงานและ Drive
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="drive-summary">
            <span className="drive-symbol">
              <Cloud size={22} />
            </span>
            <div>
              <strong>Google Drive</strong>
              <small>
                <i className={drive.connected ? "dot green" : "dot"} />
                {drive.connected ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ"}
              </small>
            </div>
            {/* ปุ่มเรียก () => navigate("settings") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
            <button
              aria-label="ตั้งค่า Google Drive"
              onClick={() => navigate("settings")}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="account">
            <div className="avatar">ส</div>
            <div>
              <strong>ผู้ปฏิบัติงานสารบรรณ</strong>
              <small>
                {local ? "พื้นที่ทำงานบนเครื่องนี้" : "หน่วยงานของคุณ"}
              </small>
            </div>
            {!local && (
              <button
                aria-label="ออกจากระบบ"
                onClick={() =>
                  asyncJob(async () => {
                    await logout();
                  })
                }
              >
                <LogOut size={17} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumbs">
            {/* ปุ่มเรียก () => setMobileNav(!mobileNav) เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
            <button
              className="mobile-menu"
              aria-label="เปิดเมนู"
              onClick={() => setMobileNav(!mobileNav)}
            >
              <Menu size={20} />
            </button>
            <span>พื้นที่ทำงาน</span>
            <ChevronRight size={14} />
            <strong>
              {
                {
                  budget: "โอนงบประมาณ",
                  reports: "ภาพรวมและรายงานระบบ",
                  laws: "คลังกฎหมายและระเบียบ",
                  calendar: "ปฏิทินงาน",
                  bookings: "จองห้องประชุม",
                  office: "งานธุรการเทศบาล",
                  dashboard: "แดชบอร์ดเอกสาร",
                  templates: "แบบหนังสือราชการ",
                  editor: "จัดทำร่างหนังสือ",
                  settings: "ตั้งค่าระบบ",
                  guide: "คู่มือและแหล่งอ้างอิง",
                }[view]
              }
            </strong>
          </div>
          <ActionSearch
            onChoose={(action) => {
              if (action.documentType) {
                if (
                  view === "budget" &&
                  budgetDirty &&
                  !confirm(
                    "มีคำขอโอนงบที่ยังไม่บันทึก ต้องการออกจากหน้านี้หรือไม่?",
                  )
                )
                  return;
                create(action.documentType);
              } else navigate(action.view);
            }}
          />
          <div className="topbar-right">
            <span className="workspace-mode">
              <span className="dot green" />
              {local ? "โหมดใช้งานในเครื่อง" : "ระบบจัดทำร่าง"}
            </span>
            <span className="top-date">{thaiDate(newDraft().date)}</span>
          </div>
        </header>
        {(view === "editor" || view === "dashboard") && (
          <RecoveryPanel
            scope="document"
            value={draft}
            enabled={view === "editor" && dirty && !attachmentBusy}
            contextKey={(saved?.id || "new-" + draft.type) + "-" + recoveryKey}
            onRestore={(value) => {
              setRecoveryKey((n) => n + 1);
              /* ตรวจ/แปลง recovered จากข้อมูลต้นทางก่อนใช้ต่อ; schema.parse จะ throw เมื่อค่าไม่ผ่าน */
              const recovered = {
                ...documentSchema.parse(value),
                status: "draft" as const,
              };
              setDraft(recovered);
              void loadAppendixSources(recovered);
              setSaved(null);
              setBaseline("");
              setPreviewDraft(recovered);
              setView("editor");
              setSample(false);
            }}
          />
        )}
        {view === "budget" && (
          <BudgetTransfers
            assets={assets}
            onDirtyChange={setBudgetDirty}
            onOpenDocument={(d) => {
              setDocuments((list) => [d, ...list.filter((x) => x.id !== d.id)]);
              openDraft(d);
            }}
          />
        )}
        {view === "reports" && <ReportsDashboard />}
        {view === "laws" && <LawLibrary connected={drive.connected} />}
        {view === "calendar" && (
          <WorkCalendar
            initial={initialCalendar}
            office={initialOffice}
            documents={documents}
            bookings={initialBookings.bookings}
            onOpenDocument={openDraft}
          />
        )}
        {view === "bookings" && (
          <MeetingBookings
            initial={initialBookings}
            documents={documents}
            onOpenDocument={openDraft}
          />
        )}
        {view === "office" && (
          <OfficeWorkspace
            initialItems={initialOffice}
            documents={documents}
            onOpenDocument={openDraft}
          />
        )}
        {view === "dashboard" && (
          <DocumentDashboard
            documents={documents}
            pending={pending}
            onOpen={openDraft}
            onCreate={create}
            onOpenTemplates={() => navigate("templates")}
            onRefresh={() =>
              asyncJob(async () => {
                setDocuments(await getDocuments());
                setToast({ text: "อัปเดตรายการแล้ว" });
              })
            }
            onDuplicate={(d) =>
              asyncJob(async () => {
                /* รอผลของงานก่อนกำหนด copy; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
                const copy = await duplicateDocument(d.id);
                setDocuments(await getDocuments());
                openDraft(copy);
                setToast({ text: "สร้างสำเนาร่างแล้ว" });
              })
            }
            onDelete={(d) => {
              if (
                confirm(
                  `ลบร่าง “${d.subject}” หรือไม่? ไฟล์ที่เคยอัปโหลดบน Drive จะยังคงอยู่`,
                )
              )
                asyncJob(async () => {
                  /* รอผลของงานก่อนกำหนด result; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
                  const result = await deleteDocument(d.id, d.version);
                  if (!result.ok) throw new Error(result.error);
                  setDocuments(await getDocuments());
                  setToast({ text: "ลบร่างเรียบร้อยแล้ว" });
                });
            }}
          />
        )}
        {view === "templates" && (
          <main className="page-main">
            <div className="page-heading">
              <div>
                <div className="eyebrow">START WITH THE RIGHT FORMAT</div>
                <h1>เลือกแบบหนังสือราชการ</h1>
                <p>6 หมวดหนังสือ · 13 แบบย่อย พร้อมฟอร์มที่เหมาะกับแต่ละงาน</p>
              </div>
              <span className="outline-badge">
                <Files size={16} />
                คลังแบบหนังสือ
              </span>
            </div>
            <div className="info-banner">
              <BookOpen size={20} />
              <p>
                ภายนอก ภายใน และประทับตราอ้างอิงไฟล์ สถ.
                ส่วนแบบย่อยอื่นใช้โครงสร้างตามระเบียบและต้องตรวจรับรูปแบบเฉพาะหน่วยงาน
              </p>
            </div>
            <TemplateReference />
            {groups.map((group) => (
              <section className="template-group" key={group}>
                <h2>{group}</h2>
                <div className="template-grid">
                  {templates
                    .filter((t) => t.group === group)
                    .map((t) => (
                      <button
                        key={t.id}
                        className="template-card"
                        onClick={() => create(t.id)}
                      >
                        <div className="template-paper">
                          <FileText size={34} />
                          <span>A4</span>
                        </div>
                        <div>
                          <h3>{t.name}</h3>
                          <p>{t.description}</p>
                          <small>
                            {t.source === "DLA"
                              ? "อ้างอิงแผ่นแบบ สถ."
                              : t.source === "CUSTOM"
                                ? "ต้องปรับรูปแบบเฉพาะงาน"
                                : "โครงสร้างตามหมวดระเบียบ"}
                          </small>
                        </div>
                        <ArrowRight size={18} />
                      </button>
                    ))}
                </div>
              </section>
            ))}
          </main>
        )}
        {view === "editor" && (
          <main className="editor-main">
            <div className="editor-header">
              <div className="editor-title">
                {/* ปุ่มเรียก () => navigate("dashboard") เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
                <button
                  className="icon-button"
                  aria-label="กลับรายการ"
                  onClick={() => navigate("dashboard")}
                >
                  <ArrowLeft size={19} />
                </button>
                <div>
                  <div className="eyebrow">{template(draft.type).name}</div>
                  <h1>{saved ? "แก้ไขร่างหนังสือ" : "จัดทำร่างหนังสือใหม่"}</h1>
                </div>
                <span className="badge draft">
                  {dirty
                    ? "ยังไม่ได้บันทึก"
                    : saved
                      ? "บันทึกแล้ว"
                      : "ฉบับร่าง"}
                </span>
              </div>
              <div className="editor-actions">
                {/* ปุ่มเรียก () => asyncJob(exportPdf) เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข pending || overflow || !ready || attachmentBusy; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
                <button
                  className="secondary"
                  disabled={pending || overflow || !ready || attachmentBusy}
                  onClick={() => asyncJob(exportPdf)}
                >
                  <ArrowDownToLine size={17} />
                  <span>ดาวน์โหลด PDF</span>
                </button>
                {/* ปุ่มเรียก save เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข pending || attachmentBusy; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
                <button
                  className="primary"
                  disabled={pending || attachmentBusy}
                  onClick={save}
                >
                  {pending ? (
                    <LoaderCircle className="spin" size={17} />
                  ) : (
                    <Save size={17} />
                  )}
                  บันทึกร่าง
                </button>
              </div>
            </div>
            <div className="editor-layout">
              <div className="form-pane">
                <div className="form-intro">
                  <div>
                    <h2>ข้อมูลหนังสือ</h2>
                    <p>กรอกข้อมูล แล้วตรวจดูตัวอย่างทางด้านขวา</p>
                  </div>
                  {/* ปุ่มเรียก loadSample เมื่อคลิก; disabled ปิดปุ่มตามเงื่อนไข pending || attachmentBusy; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
                  <button
                    className="text-button"
                    onClick={loadSample}
                    disabled={pending || attachmentBusy}
                  >
                    <Sparkles size={15} />
                    ใช้ข้อมูลตัวอย่าง
                  </button>
                </div>
                {sample && (
                  <div className="sample-notice">
                    ข้อมูลสาธิต กรุณาเปลี่ยนเป็นข้อมูลจริงก่อนนำไปใช้งาน
                  </div>
                )}
                <fieldset
                  disabled={pending || attachmentBusy}
                  className="editor-fields"
                >
                  <details className="form-section" open>
                    <summary>
                      <span className="step-number">01</span>
                      <strong>ส่วนหัวหนังสือ</strong>
                      <ChevronDown size={16} />
                    </summary>
                    <div className="field-grid">
                      {draft.type === "minutes" && (
                        <MinutesPresetPicker
                          draft={draft}
                          onChange={(patch) =>
                            setDraft((d) => ({
                              ...d,
                              ...patch,
                              status: "draft",
                            }))
                          }
                        />
                      )}
                      {field(
                        "subject",
                        draft.type === "minutes"
                          ? "ชื่อการประชุม"
                          : "เรื่อง / ชื่อร่าง",
                        {
                          required: true,
                          wide: true,
                          placeholder: "ระบุชื่อเรื่องอย่างสั้นและชัดเจน",
                        },
                      )}
                      <label className="wide">
                        เลือกส่วนราชการเพื่อกรอกอัตโนมัติ
                        {/* value อ่านจาก ""; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
                        <select
                          value=""
                          onChange={(e) => {
                            const o =
                              e.target.value === "saved"
                                ? organization
                                : organizations[Number(e.target.value)];
                            if (o)
                              setDraft((d) => ({
                                ...d,
                                organization: o.name,
                                department: o.department,
                                address: o.address,
                                phone: o.phone,
                                status: "draft",
                              }));
                          }}
                        >
                          <option value="">
                            เลือกส่วนราชการ หรือกรอกเองด้านล่าง
                          </option>
                          {organization.name && (
                            <option value="saved">{organization.name}</option>
                          )}
                          {organizations.map((o, i) => (
                            <option key={i} value={i}>
                              {o.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      {field("organization", "ส่วนราชการเจ้าของหนังสือ", {
                        required: true,
                        wide: true,
                      })}
                      {field("department", "หน่วยงานเจ้าของเรื่อง")}
                      {field("phone", "โทรศัพท์")}
                      {!["news", "minutes", "other"].includes(draft.type) &&
                        field(
                          "number",
                          ["regulation", "rule", "statement"].includes(
                            draft.type,
                          )
                            ? "ฉบับที่ (ถ้ามี)"
                            : "เลขที่หนังสือ",
                          {
                            placeholder:
                              draft.type === "order"
                                ? "เช่น 12/2569"
                                : "เช่น มท 0000/123",
                          },
                        )}
                      {field("date", "วันที่หนังสือ", { type: "date" })}
                      {["external", "certificate"].includes(draft.type) &&
                        field("address", "ที่อยู่ส่วนราชการ", {
                          textarea: true,
                          wide: true,
                        })}
                      <label>
                        ชั้นความเร็ว
                        {/* value อ่านจาก draft.urgency; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
                        <select
                          value={draft.urgency}
                          onChange={(e) =>
                            update(
                              "urgency",
                              e.target.value as Draft["urgency"],
                            )
                          }
                        >
                          {["ปกติ", "ด่วน", "ด่วนมาก", "ด่วนที่สุด"].map(
                            (v) => (
                              <option key={v}>{v}</option>
                            ),
                          )}
                        </select>
                      </label>
                      <label>
                        ชั้นความลับ
                        {/* value อ่านจาก draft.confidentiality; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
                        <select
                          value={draft.confidentiality}
                          onChange={(e) =>
                            update(
                              "confidentiality",
                              e.target.value as Draft["confidentiality"],
                            )
                          }
                        >
                          {["ปกติ", "ลับ", "ลับมาก", "ลับที่สุด"].map((v) => (
                            <option key={v}>{v}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  </details>
                  {directed && (
                    <details className="form-section" open>
                      <summary>
                        <span className="step-number">02</span>
                        <strong>ผู้รับและเอกสารประกอบ</strong>
                        <ChevronDown size={16} />
                      </summary>
                      <div className="field-grid">
                        {correspondence && (
                          <label>
                            คำขึ้นต้น
                            {/* value อ่านจาก draft.salutation; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
                            <select
                              value={draft.salutation}
                              onChange={(e) =>
                                update("salutation", e.target.value)
                              }
                            >
                              <option>เรียน</option>
                              <option>กราบเรียน</option>
                              <option>นมัสการ</option>
                            </select>
                          </label>
                        )}
                        {field(
                          "recipient",
                          draft.type === "stamped" ? "ถึง" : "ผู้รับหนังสือ",
                          { required: true, wide: !correspondence },
                        )}
                        {draft.type === "external" && (
                          <>
                            {field("reference", "อ้างถึง (ถ้ามี)", {
                              textarea: true,
                              wide: true,
                              placeholder: "ชื่อหนังสือ เลขที่ และวันที่",
                            })}
                          </>
                        )}
                        <p className="field-note wide">
                          ตรวจคำขึ้นต้นและฐานะผู้รับตามภาคผนวก 2 ของระเบียบ
                        </p>
                      </div>
                    </details>
                  )}
                  {(correspondence || draft.type === "minutes") && (
                    <AttachmentEditor
                      key={saved?.id || draft.type}
                      draft={draft}
                      onChange={(files) => update("attachmentFiles", files)}
                      onBusy={setAttachmentBusy}
                      onPhrase={(value) => update("attachmentPhrase", value)}
                    />
                  )}
                  <AppendixEditor
                    key={`appendix-${saved?.id || draft.type}`}
                    title={draft.appendixTitle}
                    layout={draft.appendixLayout}
                    images={draft.appendixImages}
                    sources={appendixSources}
                    onTitle={(value) => update("appendixTitle", value)}
                    onLayout={(value) => update("appendixLayout", value)}
                    onImages={(value) => update("appendixImages", value)}
                    onSources={setAppendixSources}
                    onBusy={setAttachmentBusy}
                  />
                  {draft.type === "minutes" && (
                    <details className="form-section" open>
                      <summary>
                        <span className="step-number">02</span>
                        <strong>รายละเอียดการประชุม</strong>
                        <ChevronDown size={16} />
                      </summary>
                      <div className="field-grid">
                        {field("meetingNo", "ครั้งที่", { required: true })}
                        {field("location", "สถานที่", { required: true })}
                        {/* จุดเชื่อม component MinutesMembersEditor: props ส่งข้อมูลลง ส่วน onChange ส่งค่ากลับ; อ่านต่อที่ ./minutes-details.tsx ใน export ชื่อนี้ */}
                        <MinutesMembersEditor
                          draft={draft}
                          onChange={(patch) =>
                            setDraft((d) => ({
                              ...d,
                              ...patch,
                              status: "draft",
                            }))
                          }
                        />
                        {field(
                          "attendees",
                          draft.minutesAttendanceMode === "table"
                            ? "รายชื่อเพิ่มเติม (ข้อความ)"
                            : "ผู้มาประชุม",
                          {
                            textarea: true,
                            wide: true,
                            required: draft.minutesAttendanceMode !== "table",
                          },
                        )}
                        {field("absentees", "ผู้ไม่มาประชุม พร้อมเหตุผล", {
                          textarea: true,
                          wide: true,
                        })}
                        {field("participants", "ผู้เข้าร่วมประชุม", {
                          textarea: true,
                          wide: true,
                        })}
                        {field("startTime", "เริ่มประชุมเวลา", {
                          type: "time",
                          required: true,
                        })}
                      </div>
                    </details>
                  )}
                  <DocumentTools
                    draft={draft}
                    onChange={(patch) =>
                      setDraft((d) => ({ ...d, ...patch, status: "draft" }))
                    }
                  />
                  <details className="form-section" open>
                    <summary>
                      <span className="step-number">03</span>
                      <strong>เนื้อหาหนังสือ</strong>
                      <ChevronDown size={16} />
                    </summary>
                    <div className="field-grid">
                      <>
                        {draft.type === "minutes" && (
                          <MinutesEditor
                            draft={draft}
                            onChange={(patch) =>
                              setDraft((d) => ({
                                ...d,
                                ...patch,
                                contentBlocks: [],
                                status: "draft",
                              }))
                            }
                          />
                        )}
                      </>
                      {!(
                        draft.type === "minutes" &&
                        draft.minutesMode === "agenda"
                      ) && (
                        <StructuredBody
                          draft={draft}
                          onChange={(patch) =>
                            setDraft((d) => ({
                              ...d,
                              ...patch,
                              contentBlocks: [],
                              status: "draft",
                            }))
                          }
                        />
                      )}{" "}
                      {!(
                        draft.type === "minutes" &&
                        draft.minutesMode === "agenda"
                      ) &&
                        draft.bodyMode === "free" &&
                        field(
                          "body",
                          draft.type === "minutes"
                            ? "ระเบียบวาระ ความคิดเห็น และมติที่ประชุม"
                            : "ข้อความ",
                          {
                            textarea: true,
                            wide: true,
                            required: true,
                            placeholder:
                              draft.type === "certificate"
                                ? "หนังสือฉบับนี้ให้ไว้เพื่อรับรองว่า…"
                                : "ภาคเหตุ: ความเป็นมาและเหตุผล\nภาคความประสงค์: รายละเอียดที่ต้องการแจ้ง\nภาคสรุป: สิ่งที่ต้องการให้ผู้รับดำเนินการ",
                          },
                        )}
                      <p className="field-note wide">
                        ขึ้นบรรทัดใหม่เพื่อเริ่มย่อหน้า ระบบจัดย่อหน้า 2.5 ซม.
                        ให้โดยอัตโนมัติ
                      </p>
                      {["order", "regulation", "rule"].includes(draft.type) &&
                        field("effectiveDate", "ข้อกำหนดวันมีผลใช้บังคับ", {
                          wide: true,
                          textarea: true,
                          placeholder:
                            "เช่น ทั้งนี้ ตั้งแต่วันที่ … เป็นต้นไป (ตรวจฐานอำนาจประกอบ)",
                        })}
                    </div>
                  </details>
                  {draft.type === "minutes" && (
                    <details className="form-section" open>
                      <summary>
                        <span className="step-number">04</span>
                        <strong>ปิดประชุมและผู้ลงนาม</strong>
                        <ChevronDown size={16} />
                      </summary>
                      <div className="field-grid">
                        {field("endTime", "เลิกประชุมเวลา", {
                          type: "time",
                          required: true,
                        })}
                        {field("recorder", "ผู้จดรายงานการประชุม", {
                          required: true,
                          wide: true,
                        })}
                        {/* จุดเชื่อม component MinutesSigningEditor: props ส่งข้อมูลลง ส่วน onChange ส่งค่ากลับ; อ่านต่อที่ ./minutes-details.tsx ใน export ชื่อนี้ */}
                        <MinutesSigningEditor
                          draft={draft}
                          onChange={(patch) =>
                            setDraft((d) => ({
                              ...d,
                              ...patch,
                              status: "draft",
                            }))
                          }
                        />
                      </div>
                    </details>
                  )}
                  {![
                    "minutes",
                    "stamped",
                    "other",
                    "news",
                    "statement",
                  ].includes(draft.type) && (
                    <details className="form-section" open>
                      <summary>
                        <span className="step-number">04</span>
                        <strong>ส่วนท้ายและผู้ลงนาม</strong>
                        <ChevronDown size={16} />
                      </summary>
                      <div className="field-grid">
                        {draft.type === "external" &&
                          field("closing", "คำลงท้าย", {
                            wide: true,
                            required: true,
                          })}
                        {field("signer", "ชื่อ–นามสกุลผู้ลงนาม", {
                          required: true,
                        })}
                        {field("position", "ตำแหน่ง", {
                          textarea: true,
                          required: true,
                        })}
                        {draft.type === "external" && (
                          <>
                            {field("email", "อีเมลติดต่อ", { wide: true })}
                            {field("copies", "สำเนาส่ง (ถ้ามี)", {
                              wide: true,
                              textarea: true,
                            })}
                          </>
                        )}
                        <p className="field-note wide">
                          การกรอกชื่อยังไม่ใช่การลงลายมือชื่อ
                          ต้องตรวจอำนาจผู้ลงนามก่อนออกหนังสือ
                        </p>
                      </div>
                    </details>
                  )}
                  {draft.type === "certificate" && (
                    <details className="form-section" open>
                      <summary>
                        <strong>รูปถ่ายและผู้ได้รับการรับรอง</strong>
                        <ChevronDown size={16} />
                      </summary>
                      <div className="field-grid">
                        <label className="check-label wide">
                          {/* checked ผูกสถานะช่องเลือกกับ draft.certificatePhotoArea; อ่าน e.target.checked เป็น boolean ใน onChange */}
                          <input
                            type="checkbox"
                            checked={draft.certificatePhotoArea}
                            onChange={(e) =>
                              update("certificatePhotoArea", e.target.checked)
                            }
                          />
                          <span>
                            เพิ่มช่องรูปถ่ายและลายมือชื่อผู้ได้รับการรับรอง
                          </span>
                        </label>
                        <p className="field-note wide">
                          ตามแบบหน้า 27 ใช้สำหรับเรื่องสำคัญเมื่อจำเป็น
                          ช่องรูปถ่าย 4 × 6 ซม.
                          พร้อมพื้นที่ประทับตราชื่อส่วนราชการ
                          การกรอกชื่อไม่ใช่การลงลายมือชื่อ
                        </p>
                        {draft.certificatePhotoArea &&
                          field(
                            "certificateRecipient",
                            "ชื่อผู้ได้รับการรับรอง",
                            { wide: true, required: true },
                          )}
                      </div>
                    </details>
                  )}
                  {draft.type === "stamped" && (
                    <div className="info-banner">
                      <ShieldCheck size={18} />
                      <p>
                        ใช้เฉพาะเรื่องที่เข้าเงื่อนไขหนังสือประทับตรา
                        และต้องประทับตราชื่อส่วนราชการด้วยหมึกแดง
                        พร้อมผู้รับผิดชอบลงชื่อย่อกำกับ
                      </p>
                    </div>
                  )}
                  <ReviewChain
                    draft={draft}
                    onChange={(patch) =>
                      setDraft((d) => ({ ...d, ...patch, status: "draft" }))
                    }
                  />
                  <LegalLibrary
                    draft={draft}
                    onChange={(patch) =>
                      setDraft((d) => ({ ...d, ...patch, status: "draft" }))
                    }
                  />
                  <div className="review-card">
                    <div className="section-title">
                      <h3>
                        <ShieldCheck size={19} />
                        ตรวจทานก่อนส่งออก
                      </h3>
                      <span
                        className={`badge ${issues.length ? "draft" : "success"}`}
                      >
                        {issues.length
                          ? `${issues.length} จุดที่ต้องเติม`
                          : "ข้อมูลหลักครบ"}
                      </span>
                    </div>
                    {issues.length ? (
                      <ul>
                        {issues.map((issue) => (
                          <li key={issue}>{issue}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="review-pass">
                        <CheckCircle2 size={16} />
                        กรอกข้อมูลหลักครบแล้ว โปรดตรวจเนื้อหาและอำนาจผู้ลงนาม
                      </p>
                    )}
                    {draft.type === "other" && (
                      <p className="error-text">
                        หนังสืออื่นไม่มีแบบตายตัว
                        ต้องปรับให้ตรงกับหลักฐานเฉพาะงาน
                      </p>
                    )}
                    {draft.confidentiality !== "ปกติ" && (
                      <p className="error-text">
                        รุ่นนี้ไม่รองรับการอัปโหลดหนังสือลับขึ้น Drive
                      </p>
                    )}
                    <label className="check-label">
                      {/* checked ผูกสถานะช่องเลือกกับ draft.status === "reviewed"; อ่าน e.target.checked เป็น boolean ใน onChange */}
                      <input
                        type="checkbox"
                        checked={draft.status === "reviewed"}
                        disabled={issues.length > 0}
                        onChange={(e) =>
                          update(
                            "status",
                            e.target.checked ? "reviewed" : "draft",
                          )
                        }
                      />
                      <span>
                        ฉันได้ตรวจเนื้อหา รูปแบบ ผู้รับ และอำนาจผู้ลงนามแล้ว
                      </span>
                    </label>
                    <p className="field-note">
                      รายการนี้ช่วยตรวจข้อมูลเบื้องต้น
                      ไม่ใช่การรับรองความถูกต้องตามระเบียบทุกกรณี
                    </p>
                  </div>
                  <div className="storage-card">
                    <div className="section-title">
                      <h3>
                        <Cloud size={19} />
                        จัดเก็บ Google Drive
                      </h3>
                      <span
                        className={`badge ${drive.connected ? "success" : "neutral"}`}
                      >
                        {drive.connected ? "เชื่อมต่อแล้ว" : "รอเชื่อมต่อ"}
                      </span>
                    </div>
                    <label>
                      จัดกลุ่มปีตาม
                      {/* value อ่านจาก draft.yearMode; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
                      <select
                        value={draft.yearMode}
                        onChange={(e) =>
                          update(
                            "yearMode",
                            e.target.value as Draft["yearMode"],
                          )
                        }
                      >
                        <option value="fiscal">
                          ปีงบประมาณ (1 ต.ค. – 30 ก.ย.)
                        </option>
                        <option value="calendar">
                          ปีปฏิทิน (1 ม.ค. – 31 ธ.ค.)
                        </option>
                      </select>
                    </label>
                    <div className="folder-path">
                      <FolderOpen size={15} />
                      สารบรรณ / {template(draft.type).name} /{" "}
                      {draft.date
                        ? `${draft.yearMode === "fiscal" ? "ปีงบประมาณ" : "ปีปฏิทิน"} ${documentYear(draft.date, draft.yearMode)}`
                        : "ยังไม่ระบุปี"}
                    </div>
                    <button
                      className="secondary full-width"
                      disabled={
                        attachmentBusy ||
                        pending ||
                        !drive.connected ||
                        draft.status !== "reviewed" ||
                        overflow ||
                        !ready ||
                        draft.confidentiality !== "ปกติ"
                      }
                      onClick={() =>
                        asyncJob(async () => {
                          /* รอผลของงานก่อนกำหนด current; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
                          const current =
                            dirty || !saved ? await persist() : saved;
                          if (!current) return;
                          /* รอผลของงานก่อนกำหนด result; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
                          const result = await uploadDocument(
                            current.id,
                            current.version,
                          );
                          if (!result.ok) throw new Error(result.error);
                          /* รอผลของงานก่อนกำหนด list; await หยุดเฉพาะ async function นี้ ไม่ได้แปลว่าข้อมูลสำเร็จเสมอ ต้องอ่านการตรวจ error ต่อ */
                          const list = await getDocuments();
                          setDocuments(list);
                          setSaved(
                            list.find((d) => d.id === current.id) || current,
                          );
                          setToast({
                            text: "จัดเก็บ PDF บน Google Drive แล้ว",
                          });
                        })
                      }
                    >
                      <Cloud size={17} />
                      บันทึก PDF ไปยัง Drive
                    </button>
                    {saved?.driveFileId && (
                      <a
                        className="text-link"
                        target="_blank"
                        rel="noreferrer"
                        href={`https://drive.google.com/file/d/${saved.driveFileId}/view`}
                      >
                        เปิดไฟล์บน Drive
                        {saved.syncedVersion !== saved.version
                          ? " (มีการแก้ไขใหม่ที่ยังไม่ได้ซิงก์)"
                          : ""}
                        <ArrowRight size={14} />
                      </a>
                    )}
                  </div>
                </fieldset>
                {saved && (
                  <button
                    className="history-button"
                    onClick={() =>
                      asyncJob(async () =>
                        setHistory(await getHistory(saved.id)),
                      )
                    }
                  >
                    <History size={16} />
                    ดูประวัติการดำเนินการ
                  </button>
                )}
                {history && (
                  <div className="history-panel">
                    <h3>ประวัติร่างหนังสือ</h3>
                    {history.map((h, i) => (
                      <p key={i}>
                        <span>
                          {{
                            create: "สร้างร่าง",
                            update: "แก้ไขร่าง",
                            drive_upload: "อัปโหลด Drive",
                            delete: "ลบร่าง",
                          }[h.action] || h.action}{" "}
                          · ฉบับ {h.version}
                        </span>
                        <small>{new Date(h.at).toLocaleString("th-TH")}</small>
                      </p>
                    ))}
                  </div>
                )}
              </div>
              <div className="preview-pane">
                <LegalReader />
                <div className="preview-toolbar">
                  <div>
                    <span className="live-dot" />
                    <strong>ตัวอย่างหนังสือ</strong>
                    <span className="preview-live">LIVE</span>
                  </div>
                  <div>
                    {/* value อ่านจาก zoom; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
                    <select
                      aria-label="ขนาดตัวอย่าง"
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                    >
                      {[50, 65, 75, 100].map((n) => (
                        <option key={n} value={n}>
                          {n}%
                        </option>
                      ))}
                    </select>
                    <button
                      aria-label="พิมพ์เอกสาร"
                      title="พิมพ์เอกสาร"
                      disabled={!ready || overflow || pending || attachmentBusy}
                      onClick={() => {
                        if (
                          dirty &&
                          !confirm("พิมพ์ตัวอย่างที่ยังไม่ได้บันทึกหรือไม่?")
                        )
                          return;
                        if (draft.attachmentFiles.length) {
                          asyncJob(exportPdf);
                          return;
                        }
                        frame.current?.contentWindow?.postMessage(
                          "sarabun-print",
                          "*",
                        );
                      }}
                    >
                      <Printer size={18} />
                    </button>
                  </div>
                </div>
                <div className="preview-info">
                  <span>A4 · 210 × 297 มม.</span>
                  <span>TH Sarabun New · 16 pt</span>
                </div>
                {overflow && (
                  <div className="overflow-alert" role="alert">
                    ส่วนหัวหรือองค์ประกอบยาวเกินหน้า
                    กรุณาลดหรือแบ่งข้อความก่อนส่งออก
                  </div>
                )}
                <div className="paper-scroll">
                  <div
                    className="paper-scale"
                    style={{
                      width: (794 * zoom) / 100,
                      height: (previewHeight * zoom) / 100,
                    }}
                  >
                    <iframe
                      ref={frame}
                      title="ตัวอย่างหนังสือ A4"
                      sandbox="allow-scripts allow-modals"
                      srcDoc={html}
                      style={{
                        width: 794,
                        height: previewHeight,
                        transform: `scale(${zoom / 100})`,
                      }}
                    />
                  </div>
                  <AttachmentPreview files={draft.attachmentFiles} />
                </div>
                <div className="preview-footer">
                  <ShieldCheck size={14} />
                  <span>
                    {ready
                      ? `${compactSignoff ? "จัดช่องไฟกระชับเพื่อพยายามคงส่วนลงนามไว้หน้าแรก · " : ""}ตัวอย่าง ${pages} หน้า${draft.appendixImages.length ? ` · ภาคผนวกภาพ ${Math.ceil(draft.appendixImages.length / 2)} หน้า` : ""}${draft.attachmentFiles.length ? ` · เอกสารแนบ ${draft.attachmentFiles.reduce((n, a) => n + a.pages, 0)} หน้า` : ""} · ตรวจรูปแบบก่อนพิมพ์`
                      : "กำลังจัดหน้า…"}
                  </span>
                </div>
              </div>
            </div>
          </main>
        )}
        {view === "settings" && (
          <main className="page-main settings-main">
            <div className="page-heading">
              <div>
                <div className="eyebrow">MAKE IT YOUR WORKSPACE</div>
                <h1>ตั้งค่าหน่วยงานและ Drive</h1>
                <p>กรอกครั้งเดียว เพื่อนำข้อมูลไปใช้กับหนังสือฉบับถัดไป</p>
              </div>
            </div>
            <SetupReadiness />
            <StorageSettings />
            <div className="settings-grid">
              <section className="panel settings-card">
                <div className="section-title">
                  <h2>
                    <Settings2 size={21} />
                    ข้อมูลหน่วยงาน
                  </h2>
                </div>
                <div className="field-grid">
                  {(
                    [
                      ["name", "ชื่อส่วนราชการ"],
                      ["department", "หน่วยงานเจ้าของเรื่อง"],
                      ["address", "ที่อยู่"],
                      ["phone", "โทรศัพท์"],
                      ["prefix", "รหัสหน่วยงานสำหรับอ้างอิงเลขที่"],
                    ] as const
                  ).map(([key, label]) => (
                    <label
                      className={
                        key === "address" || key === "name" ? "wide" : ""
                      }
                      key={key}
                    >
                      {label}
                      {/* value อ่านจาก organization[key]; onChange ส่งค่าที่กรอกกลับไปอัปเดต state ของ parent */}
                      <input
                        value={organization[key]}
                        onChange={(e) =>
                          setOrganization((o) => ({
                            ...o,
                            [key]: e.target.value,
                          }))
                        }
                      />
                    </label>
                  ))}
                </div>
                <button
                  className="primary"
                  disabled={pending || !organization.name.trim()}
                  onClick={() =>
                    asyncJob(async () => {
                      await saveOrganization(organization);
                      setToast({ text: "บันทึกข้อมูลหน่วยงานแล้ว" });
                    })
                  }
                >
                  <Save size={16} />
                  บันทึกข้อมูลหน่วยงาน
                </button>
                <p className="field-note">
                  เลขที่หนังสือต้องนำมาจากทะเบียนจริง
                  ระบบไม่จองหรือออกเลขแทนหน่วยงาน
                </p>
              </section>
              <section className="panel settings-card">
                <div className="section-title">
                  <h2>
                    <Cloud size={22} />
                    Google Drive
                  </h2>
                  <span
                    className={`badge ${drive.connected ? "success" : "neutral"}`}
                  >
                    {drive.connected ? "เชื่อมต่อแล้ว" : "ยังไม่ได้เชื่อมต่อ"}
                  </span>
                </div>
                <p>
                  {drive.connected
                    ? drive.email
                    : "เชื่อมต่อบัญชีหน่วยงานเพื่อจัดเก็บ PDF เป็นหมวดหมู่"}
                </p>
                <div className="drive-folder-demo">
                  <FolderOpen size={18} />
                  สารบรรณ
                  <div>
                    <FolderOpen size={17} />
                    หนังสือภายนอก
                    <div>
                      <FolderOpen size={16} />
                      ปีงบประมาณ 2569
                      <div>
                        <FileText size={15} />
                        เลขที่_ชื่อเรื่อง.pdf
                      </div>
                    </div>
                  </div>
                </div>
                <div className="connection-notes">
                  <p>
                    <CheckCircle2 size={16} />
                    ขอสิทธิ์เฉพาะไฟล์ที่แอปสร้างหรือเปิดใช้งาน
                  </p>
                  <p>
                    <CheckCircle2 size={16} />
                    จัดเก็บตามวันที่หนังสือและรูปแบบปีที่เลือก
                  </p>
                  <p>
                    <CheckCircle2 size={16} />
                    อัปโหลดฉบับแก้ไขโดยใช้ไฟล์เดิม
                  </p>
                </div>
                {drive.configured ? (
                  <a className="primary" href="/api/google/connect">
                    <Cloud size={17} />
                    {drive.connected
                      ? "เชื่อมต่อบัญชีอีกครั้ง"
                      : "เชื่อมต่อ Google Drive"}
                    <ArrowRight size={17} />
                  </a>
                ) : (
                  <div className="setup-note">
                    <strong>ตั้งค่า OAuth ก่อนเชื่อมต่อ</strong>
                    <p>
                      เพิ่ม GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL และ
                      SESSION_SECRET ใน .env.local แล้วเริ่มเซิร์ฟเวอร์ใหม่
                    </p>
                    <code>Redirect URI: /api/google/callback</code>
                    <p>ขั้นตอนทั้งหมดอยู่ใน README.md ของโปรเจกต์</p>
                  </div>
                )}
                <small>
                  ระบบไม่เพิ่มสิทธิ์แชร์ แต่ไฟล์สืบทอดสิทธิ์โฟลเดอร์ปลายทาง
                  กรุณาตรวจสิทธิ์ก่อนจัดเก็บ
                </small>
              </section>
            </div>
          </main>
        )}
        {view === "guide" && (
          <main className="page-main guide-main">
            <div className="page-heading">
              <div>
                <div className="eyebrow">REFERENCE & GUIDANCE</div>
                <h1>คู่มือและแหล่งอ้างอิง</h1>
                <p>เข้าใจที่มาของแบบหนังสือ และสิ่งที่ต้องตรวจทานก่อนใช้จริง</p>
              </div>
            </div>
            <section className="panel guide-card">
              <h2>เริ่มใช้งานใน 4 ขั้นตอน</h2>
              <ol>
                <li>เลือกแบบหนังสือให้ตรงกับลักษณะงาน</li>
                <li>กรอกข้อมูลหน่วยงาน ผู้รับ เนื้อหา และผู้ลงนาม</li>
                <li>ตรวจตัวอย่าง A4 ทุกหน้า แล้วบันทึกและดาวน์โหลด PDF</li>
                <li>ตรวจทานเนื้อหาและรูปแบบ ก่อนจัดเก็บบน Google Drive</li>
              </ol>
            </section>
            <section className="panel guide-card">
              <h2>ที่มาของแบบหนังสือ</h2>
              <p>
                แผ่นแบบ สถ. ที่ดาวน์โหลดได้มีหนังสือภายนอก ภายใน และประทับตรา
                ผลตรวจต้นฉบับแสดงขอบซ้าย 3 ซม. ขวา 2 ซม. ล่าง 2 ซม. เนื้อหา TH
                SarabunPSK 16 pt โดยส่วนหัวของแต่ละแบบต่างกัน
              </p>
              <p>
                ระบบนี้ใช้ TH Sarabun New ที่ฝังในเอกสาร ใช้ตราครุฑจากแผ่นแบบ
                สถ. และสร้างตัวจัดหน้า HTML ขึ้นใหม่
                จึงต้องตรวจเทียบผลพิมพ์กับแบบที่หน่วยงานรับรองก่อนใช้จริง
              </p>
              <a
                href="https://www.dla.go.th/land/govloadfon.do"
                target="_blank"
                rel="noreferrer"
              >
                แผ่นแบบราชการ กรมส่งเสริมการปกครองท้องถิ่น{" "}
                <ArrowRight size={15} />
              </a>
              <a
                href="https://www.etda.or.th/th/Useful-Resource/knowledge-sharing/articles/Digital-Law/ETDA-Live-Ep-7-e-Saraban.aspx"
                target="_blank"
                rel="noreferrer"
              >
                แนวทางสารบรรณอิเล็กทรอนิกส์ ETDA <ArrowRight size={15} />
              </a>
            </section>
            <section className="panel guide-card">
              <h2>ขอบเขตของรุ่นนี้</h2>
              <p>
                มีแบบย่อย 13 แบบภายใต้หนังสือ 6 หมวด
                แบบหนังสืออื่นเป็นโครงสร้างเริ่มต้น
                เพราะเอกสารหลักฐานเฉพาะงานไม่มีรูปแบบเดียวครอบคลุมทุกกรณี
              </p>
              <p>
                คำสั่ง ระเบียบ ข้อบังคับ และเอกสารที่มีผลทางกฎหมาย
                ต้องให้ผู้มีหน้าที่ตรวจฐานอำนาจ เนื้อหา และการลงนาม
                ระบบยังไม่มีลายมือชื่ออิเล็กทรอนิกส์ การออกเลขทะเบียน
                หรือกระบวนการเสนออนุมัติหลายระดับ
              </p>
              <p>
                “ตรวจทานแล้ว” หมายถึงผู้ใช้ทำเครื่องหมายตรวจทาน
                ไม่ใช่การอนุมัติหรือรับรองตามกฎหมาย
                การลงชื่อในฟอร์มยังไม่ถือว่าได้ลงลายมือชื่อ
              </p>
              <p>
                การพิมพ์: ใช้กระดาษ A4 ขนาดจริง 100%
                และปิดหัว/ท้ายกระดาษของเบราว์เซอร์ แนะนำดาวน์โหลด PDF
                แล้วตรวจทุกหน้าก่อนพิมพ์
              </p>
            </section>
          </main>
        )}
      </div>
      {toast && (
        <div
          role={toast.error ? "alert" : "status"}
          className={`toast ${toast.error ? "toast-error" : ""}`}
        >
          {toast.error ? <X size={19} /> : <CheckCircle2 size={19} />}
          <span>{toast.text}</span>
          {/* ปุ่มเรียก () => setToast(null) เมื่อคลิก; type="button" ใช้กับปุ่มทั่วไปเพื่อไม่ส่ง form โดยไม่ตั้งใจ */}
          <button aria-label="ปิดข้อความ" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
