import {
  HOLIDAY_COVERAGE,
  isWorkingDay,
  nextWorkingDay,
  THAI_PUBLIC_HOLIDAYS,
  type HolidayCalendar,
} from '../procurement/holidays';
import {
  extractAllItemCrossRefs,
  formatOfficialNumber,
} from './resolver';
import type {
  CaseFolder,
  CaseItem,
  CaseValidationIssue,
  LinkedModuleSummary,
} from './types';

function toArabicDigits(input: string): string {
  return input.replace(/[๐-๙]/g, ch => String('๐๑๒๓๔๕๖๗๘๙'.indexOf(ch)));
}

function parseNumericRunningNo(raw: string): bigint | null {
  const cleaned = toArabicDigits(raw).trim();
  if (!cleaned) return null;
  // Extract primary running number (e.g. "ภก 52906/1510" -> 1510, "1510/2569" -> 1510, "1510" -> 1510)
  const slashParts = cleaned.split('/');
  const candidate =
    slashParts.length === 2
      ? /^\d{4}$/.test(slashParts[1]) && Number(slashParts[1]) >= 2400
        ? slashParts[0]
        : slashParts[1]
      : cleaned;
  const digits = candidate.replace(/\D/g, '');
  return digits ? BigInt(digits) : null;
}

function getItemIsoDate(
  item: CaseItem,
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>,
): string {
  if (item.kind === 'GENERATED_DOC') return item.date || '';
  if (item.kind === 'EXTERNAL_FILE_SLOT') return item.externalDate || '';
  return linkedSummaries?.get(item.id)?.date || '';
}

function getOrderedItems(folder: CaseFolder): CaseItem[] {
  const stageOrder = new Map(folder.stages.map(s => [s.id, s.order]));
  return [...folder.items].sort((a, b) => {
    const sa = stageOrder.get(a.stageId) ?? 9999;
    const sb = stageOrder.get(b.stageId) ?? 9999;
    if (sa !== sb) return sa - sb;
    return a.order - b.order;
  });
}

export interface ValidateCaseFolderOptions {
  calendar?: HolidayCalendar;
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>;
}

/**
 * Validates a CaseFolder across all 5 Phase 7 rules, reusing Phase 1 holiday & 5-track logic.
 */
export function validateCaseFolder(
  folder: CaseFolder,
  options: ValidateCaseFolderOptions = {},
): CaseValidationIssue[] {
  const calendar = options.calendar ?? THAI_PUBLIC_HOLIDAYS;
  const linkedSummaries = options.linkedSummaries;
  const issues: CaseValidationIssue[] = [];
  const itemById = new Map(folder.items.map(it => [it.id, it]));
  const ordered = getOrderedItems(folder);

  // 1. Cross-reference chronology & unresolved references
  for (const item of ordered) {
    if (item.kind !== 'GENERATED_DOC') continue;
    const refs = extractAllItemCrossRefs(item);
    const seenRefIds = new Set<string>();

    for (const ref of refs) {
      if (seenRefIds.has(ref.itemId)) continue;
      seenRefIds.add(ref.itemId);

      const target = itemById.get(ref.itemId);
      if (!target) {
        issues.push({
          code: 'UNRESOLVED_REFERENCE',
          severity: 'WARNING',
          itemIds: [item.id],
          messageTh: `เอกสาร "${item.title}" อ้างอิงถึงรายการ "${ref.itemId}" ซึ่งไม่พบในแฟ้ม (อาจถูกลบไปแล้ว)`,
        });
        continue;
      }

      const sourceDate = getItemIsoDate(item, linkedSummaries);
      const targetDate = getItemIsoDate(target, linkedSummaries);

      if (sourceDate && targetDate && sourceDate < targetDate) {
        issues.push({
          code: 'REF_CHRONOLOGY_ERROR',
          severity: 'ERROR',
          itemIds: [target.id, item.id],
          messageTh: `วันที่ย้อนลำดับการอ้างอิง: "${item.title}" (${sourceDate}) อ้างถึง "${target.title}" (${targetDate}) แต่ลงวันที่ก่อนเอกสารที่อ้างถึง`,
          suggestedFix: targetDate,
        });
      }

      // Check if referenced target still lacks a running number or date
      if (target.kind === 'GENERATED_DOC') {
        const needsNumber =
          target.docType === 'INTERNAL_MEMO' ||
          target.docType === 'EXTERNAL_LETTER' ||
          target.docType === 'MUNICIPAL_ORDER' ||
          target.docType === 'CERTIFICATE_OR_INVITATION';
        const formattedNo = formatOfficialNumber(folder, target);
        if ((needsNumber && !formattedNo) || !target.date) {
          issues.push({
            code: 'UNRESOLVED_REFERENCE',
            severity: 'WARNING',
            itemIds: [item.id, target.id],
            messageTh: `เอกสาร "${item.title}" อ้างถึง "${target.title}" ที่ยังไม่มี${needsNumber && !formattedNo ? 'เลขที่หนังสือ' : 'วันที่'}ครบถ้วนก่อนส่งออก`,
          });
        }
      } else if (target.kind === 'EXTERNAL_FILE_SLOT') {
        if (!target.externalDocNo.trim() || !target.externalDate) {
          issues.push({
            code: 'UNRESOLVED_REFERENCE',
            severity: 'WARNING',
            itemIds: [item.id, target.id],
            messageTh: `เอกสาร "${item.title}" อ้างถึงเอกสารภายนอก "${target.title}" ที่ยังกรอกเลขที่หรือวันที่ไม่ครบ`,
          });
        }
      } else if (target.kind === 'LINKED_MODULE_REF') {
        const summary = linkedSummaries?.get(target.id);
        if (!summary || !summary.found || !summary.referenceNo) {
          issues.push({
            code: 'UNRESOLVED_REFERENCE',
            severity: 'WARNING',
            itemIds: [item.id, target.id],
            messageTh: `เอกสาร "${item.title}" อ้างถึงงานที่เชื่อมโยง "${target.title}" ซึ่งยังไม่มีเลขที่อ้างอิง`,
          });
        }
      }
    }
  }

  // 2. Same-track running number monotonicity (within same track + yearBE)
  const lastByTrackYear = new Map<string, {itemId: string; title: string; num: bigint}>();
  for (const item of ordered) {
    if (item.kind !== 'GENERATED_DOC' || item.track === 'NONE') continue;
    const rawNo =
      item.docType === 'ANNOUNCEMENT' && item.payload.docType === 'ANNOUNCEMENT'
        ? item.payload.registryLogNo || item.runningNo
        : item.runningNo;
    const num = parseNumericRunningNo(rawNo || '');
    if (num === null) continue;
    const yearBE = item.date ? Number(item.date.slice(0, 4)) + 543 : folder.fiscalYearBE;
    const bucket = `${item.track}::${yearBE}`;
    const prev = lastByTrackYear.get(bucket);
    if (prev && num <= prev.num) {
      issues.push({
        code: 'SAME_TRACK_NUMBER_ORDER',
        severity: 'ERROR',
        itemIds: [prev.itemId, item.id],
        messageTh: `เลขทะเบียนในสายงานเดียวกันซ้ำหรือย้อนลำดับ: "${item.title}" (${num.toString()}) ไม่มากกว่า "${prev.title}" (${prev.num.toString()})`,
      });
    }
    lastByTrackYear.set(bucket, {itemId: item.id, title: item.title, num});
  }

  // 3. Holiday / weekend check (reusing Phase 1 Thai public holiday calendar)
  for (const item of ordered) {
    const isoDate = getItemIsoDate(item, linkedSummaries);
    if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) continue;
    if (isoDate < HOLIDAY_COVERAGE.from || isoDate > HOLIDAY_COVERAGE.to) continue;
    if (!isWorkingDay(isoDate, calendar)) {
      const holidayName =
        calendar[isoDate] ||
        THAI_PUBLIC_HOLIDAYS[isoDate] ||
        ([0, 6].includes(new Date(`${isoDate}T00:00:00Z`).getUTCDay())
          ? 'วันเสาร์/อาทิตย์'
          : 'วันหยุดราชการ');
      const suggested = nextWorkingDay(isoDate, calendar);
      issues.push({
        code: 'DATE_ON_HOLIDAY',
        severity: 'WARNING',
        itemIds: [item.id],
        messageTh: `เอกสาร "${item.title}" ลงวันที่ ${isoDate} ซึ่งตรงกับ${holidayName}`,
        suggestedFix: suggested,
      });
    }
  }

  // 4. Linked module incomplete alerts
  for (const item of ordered) {
    if (item.kind !== 'LINKED_MODULE_REF') continue;
    const summary = linkedSummaries?.get(item.id);
    if (!summary) continue;
    if (!summary.found || summary.isIncomplete) {
      issues.push({
        code: 'LINKED_MODULE_INCOMPLETE',
        severity: !summary.found ? 'WARNING' : 'INFO',
        itemIds: [item.id],
        messageTh:
          summary.incompleteReasons.join(' · ') ||
          `งานที่เชื่อมโยง "${item.title}" ยังดำเนินการไม่เสร็จสมบูรณ์`,
      });
    }
  }

  return issues;
}
