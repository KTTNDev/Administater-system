import {
  formatThaiDate,
  toThaiDigits,
  toThaiOfficialText,
} from '../procurement/formatting';
import type {
  CaseDocType,
  CaseFolder,
  CaseItem,
  CrossRefToken,
  GeneratedDocItem,
  LinkedModuleSummary,
  ResolveOptions,
  ResolvedTextResult,
  TextRunSegment,
} from './types';

const TOKEN_REGEX = /\{\{\s*(var\.([A-Za-z_][A-Za-z0-9_]*)|ref:([^:}\s]+)(?::(full|short))?)\s*\}\}/g;
const BLANK_DOTTED = '...........';

export const DOC_TYPE_THAI_NAMES: Record<CaseDocType, string> = {
  INTERNAL_MEMO: 'บันทึกข้อความ',
  EXTERNAL_LETTER: 'หนังสือภายนอก',
  MUNICIPAL_ORDER: 'คำสั่ง',
  ANNOUNCEMENT: 'ประกาศ',
  CERTIFICATE_OR_INVITATION: 'หนังสือรับรอง/เชิญ',
  PROJECT_PROPOSAL_OR_ATTACHMENT: 'เอกสารประกอบ/โครงการ',
  PHOTO_SHEET: 'หน้ารูปภาพประกอบ',
};

export function extractCrossRefTokens(text: string): CrossRefToken[] {
  const results: CrossRefToken[] = [];
  for (const match of text.matchAll(TOKEN_REGEX)) {
    const refId = match[3];
    if (!refId) continue;
    const mode = (match[4] === 'short' ? 'short' : 'full') as 'full' | 'short';
    results.push({raw: match[0], itemId: refId, mode});
  }
  return results;
}

export function extractAllItemCrossRefs(item: CaseItem): CrossRefToken[] {
  if (item.kind !== 'GENERATED_DOC') return [];
  const raw = JSON.stringify(item.payload) + ' ' + item.title;
  return extractCrossRefTokens(raw);
}

export function formatOfficialNumber(
  folder: CaseFolder,
  item: GeneratedDocItem,
): string {
  const raw = item.runningNo?.trim() || '';
  if (item.docType === 'ANNOUNCEMENT') {
    return ''; // Track 3 announcements never print their registry log number on the document
  }
  if (!raw) return '';
  const digits = toThaiDigits(raw);
  switch (item.docType) {
    case 'INTERNAL_MEMO':
      return raw.includes('/')
        ? toThaiOfficialText(raw)
        : toThaiOfficialText(`${folder.agency.codes.internalMemoPrefix}/${digits}`);
    case 'EXTERNAL_LETTER':
      return raw.includes('/')
        ? toThaiOfficialText(raw)
        : toThaiOfficialText(`${folder.agency.codes.externalLetterPrefix}/${digits}`);
    case 'MUNICIPAL_ORDER': {
      const yearBE =
        item.payload.docType === 'MUNICIPAL_ORDER' && item.payload.orderYearBE
          ? item.payload.orderYearBE
          : item.date
            ? Number(item.date.slice(0, 4)) + 543
            : folder.fiscalYearBE;
      return raw.includes('/')
        ? toThaiDigits(raw)
        : toThaiDigits(`${digits}/${yearBE}`);
    }
    case 'CERTIFICATE_OR_INVITATION':
      if (item.payload.docType === 'CERTIFICATE_OR_INVITATION' && item.payload.variant === 'INVITATION') {
        return raw.includes('/')
          ? toThaiOfficialText(raw)
          : toThaiOfficialText(`${folder.agency.codes.externalLetterPrefix}/${digits}`);
      }
      return toThaiOfficialText(raw);
    default:
      return toThaiOfficialText(raw);
  }
}

export function formatVariableValue(
  folder: CaseFolder,
  key: string,
): {found: boolean; resolved: string; isBlank: boolean} {
  const entry = folder.variables.find(v => v.key === key);
  if (!entry) return {found: false, resolved: '', isBlank: true};
  const trimmed = entry.value.trim();
  if (!trimmed) return {found: true, resolved: '', isBlank: true};
  if (entry.kind === 'date' && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return {found: true, resolved: formatThaiDate(trimmed), isBlank: false};
  }
  if (entry.kind === 'money') {
    const num = Number(trimmed.replace(/,/g, ''));
    if (Number.isFinite(num)) {
      return {
        found: true,
        resolved: toThaiDigits(
          num.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}),
        ),
        isBlank: false,
      };
    }
  }
  if (entry.kind === 'number') {
    return {found: true, resolved: toThaiDigits(trimmed), isBlank: false};
  }
  return {found: true, resolved: toThaiOfficialText(trimmed), isBlank: false};
}

function buildCitationSegments(
  folder: CaseFolder,
  item: CaseItem | undefined,
  mode: 'full' | 'short',
  linkedSummaries: ReadonlyMap<string, LinkedModuleSummary> | undefined,
  highlightBlanks: boolean,
  refId: string,
): {segments: TextRunSegment[]; unresolved: boolean} {
  if (!item) {
    return {
      segments: [
        {
          text: highlightBlanks ? `[ไม่พบเอกสารอ้างอิง:${refId}]` : BLANK_DOTTED,
          highlightBlank: highlightBlanks,
          tokenKind: 'ref',
          tokenKey: refId,
        },
      ],
      unresolved: true,
    };
  }

  const pushPlain = (arr: TextRunSegment[], text: string) => {
    if (!text) return;
    const prev = arr.at(-1);
    if (prev && !prev.highlightBlank) prev.text += text;
    else arr.push({text, highlightBlank: false});
  };
  const pushBlank = (arr: TextRunSegment[], label: string) => {
    arr.push({
      text: highlightBlanks ? `[${label}]` : BLANK_DOTTED,
      highlightBlank: highlightBlanks,
      tokenKind: 'ref',
      tokenKey: refId,
    });
  };

  if (item.kind === 'LINKED_MODULE_REF') {
    const summary = linkedSummaries?.get(item.id);
    const title = toThaiOfficialText(summary?.title || item.title);
    const refNo = summary?.referenceNo ? toThaiOfficialText(summary.referenceNo) : '';
    const dateStr = summary?.date && /^\d{4}-\d{2}-\d{2}$/.test(summary.date) ? formatThaiDate(summary.date) : '';
    const segments: TextRunSegment[] = [];
    let unresolved = !summary || !summary.found;

    pushPlain(segments, `${title} เลขที่ `);
    if (refNo) pushPlain(segments, refNo);
    else {
      unresolved = true;
      pushBlank(segments, 'รอเลขที่อ้างอิง');
    }
    pushPlain(segments, ' ลงวันที่ ');
    if (dateStr) pushPlain(segments, dateStr);
    else {
      unresolved = true;
      pushBlank(segments, 'รอวันที่');
    }
    return {segments, unresolved};
  }

  if (item.kind === 'EXTERNAL_FILE_SLOT') {
    const title = toThaiOfficialText(item.title);
    const segments: TextRunSegment[] = [];
    let unresolved = false;
    pushPlain(segments, `${title} เลขที่ `);
    if (item.externalDocNo.trim()) pushPlain(segments, toThaiOfficialText(item.externalDocNo.trim()));
    else {
      unresolved = true;
      pushBlank(segments, 'รอเลขที่เอกสาร');
    }
    pushPlain(segments, ' ลงวันที่ ');
    if (item.externalDate && /^\d{4}-\d{2}-\d{2}$/.test(item.externalDate)) {
      pushPlain(segments, formatThaiDate(item.externalDate));
    } else {
      unresolved = true;
      pushBlank(segments, 'รอวันที่เอกสาร');
    }
    return {segments, unresolved};
  }

  // GENERATED_DOC
  const docTitle = resolveRawString(folder, item.title, {highlightBlanks: false, linkedSummaries}).text;
  const formattedNo = formatOfficialNumber(folder, item);
  const formattedDate =
    item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? formatThaiDate(item.date) : '';
  const segments: TextRunSegment[] = [];
  let unresolved = false;

  const prefixByType = (): string => {
    switch (item.docType) {
      case 'INTERNAL_MEMO':
        return `บันทึกข้อความ ${toThaiOfficialText(folder.agency.divisionName)}`;
      case 'EXTERNAL_LETTER':
        return `หนังสือ${toThaiOfficialText(folder.agency.municipalityName)}`;
      case 'MUNICIPAL_ORDER':
        return `คำสั่ง${toThaiOfficialText(folder.agency.municipalityName)}`;
      case 'ANNOUNCEMENT':
        return `ประกาศ${toThaiOfficialText(folder.agency.municipalityName)}`;
      case 'CERTIFICATE_OR_INVITATION':
        return item.payload.docType === 'CERTIFICATE_OR_INVITATION' && item.payload.variant === 'CERTIFICATE'
          ? 'หนังสือรับรอง'
          : `หนังสือ${toThaiOfficialText(folder.agency.municipalityName)}`;
      default:
        return DOC_TYPE_THAI_NAMES[item.docType];
    }
  };

  pushPlain(segments, prefixByType());

  const usesNumber =
    item.docType === 'INTERNAL_MEMO' ||
    item.docType === 'EXTERNAL_LETTER' ||
    item.docType === 'MUNICIPAL_ORDER' ||
    item.docType === 'CERTIFICATE_OR_INVITATION';

  if (usesNumber) {
    pushPlain(segments, ' ที่ ');
    if (formattedNo) {
      pushPlain(segments, formattedNo);
    } else {
      unresolved = true;
      pushBlank(segments, 'รอเลขที่หนังสือ');
    }
  }

  pushPlain(segments, ' ลงวันที่ ');
  if (formattedDate) {
    pushPlain(segments, formattedDate);
  } else {
    unresolved = true;
    pushBlank(segments, 'รอลงวันที่');
  }

  if (mode === 'full') {
    pushPlain(segments, ` เรื่อง ${docTitle}`);
  }

  return {segments, unresolved};
}

function resolveRawString(
  folder: CaseFolder,
  input: string,
  options: ResolveOptions = {},
): ResolvedTextResult {
  const highlightBlanks = options.highlightBlanks === true;
  const segments: TextRunSegment[] = [];
  const unresolvedVars: string[] = [];
  const unresolvedRefs: string[] = [];

  const pushPlain = (raw: string) => {
    if (!raw) return;
    const formatted = toThaiOfficialText(raw);
    const prev = segments.at(-1);
    if (prev && !prev.highlightBlank) prev.text += formatted;
    else segments.push({text: formatted, highlightBlank: false});
  };

  let cursor = 0;
  for (const match of input.matchAll(TOKEN_REGEX)) {
    const start = match.index ?? 0;
    if (start > cursor) {
      pushPlain(input.slice(cursor, start));
    }

    const varKey = match[2];
    const refId = match[3];
    const refMode = (match[4] === 'short' ? 'short' : 'full') as 'full' | 'short';

    if (varKey) {
      const resolved = formatVariableValue(folder, varKey);
      if (!resolved.found || resolved.isBlank) {
        unresolvedVars.push(varKey);
        const label = folder.variables.find(v => v.key === varKey)?.label || varKey;
        segments.push({
          text: highlightBlanks ? `[กรอก:${label}]` : BLANK_DOTTED,
          highlightBlank: highlightBlanks,
          tokenKind: 'var',
          tokenKey: varKey,
        });
      } else {
        pushPlain(resolved.resolved);
      }
    } else if (refId) {
      const target = folder.items.find(it => it.id === refId);
      const citation = buildCitationSegments(
        folder,
        target,
        refMode,
        options.linkedSummaries,
        highlightBlanks,
        refId,
      );
      if (citation.unresolved) unresolvedRefs.push(refId);
      for (const seg of citation.segments) {
        const prev = segments.at(-1);
        if (!seg.highlightBlank && prev && !prev.highlightBlank) prev.text += seg.text;
        else segments.push(seg);
      }
    }

    cursor = start + match[0].length;
  }

  if (cursor < input.length) {
    pushPlain(input.slice(cursor));
  }

  return {
    text: segments.map(s => s.text).join(''),
    segments,
    unresolvedVars: [...new Set(unresolvedVars)],
    unresolvedRefs: [...new Set(unresolvedRefs)],
  };
}

/**
 * Resolves `{{var.key}}` shared case variables and live `{{ref:<itemId>:full|short}}` citations,
 * applying 100% Thai official numeral formatting and optional `highlightBlanks` segmentation.
 */
export function resolveCaseText(
  folder: CaseFolder,
  input: string,
  options: ResolveOptions = {},
): ResolvedTextResult {
  return resolveRawString(folder, input, options);
}

/**
 * Helper to segment an already-rendered string containing `[...]` placeholder prompts
 * into normal vs yellow-highlighted runs when `highlightBlanks: true`.
 */
export function splitHighlightPrompts(
  text: string,
  highlightBlanks: boolean,
): TextRunSegment[] {
  if (!highlightBlanks) return [{text, highlightBlank: false}];
  const parts: TextRunSegment[] = [];
  const regex = /(\[[^\[\]\n]{1,120}\])/g;
  let last = 0;
  for (const m of text.matchAll(regex)) {
    const idx = m.index ?? 0;
    if (idx > last) parts.push({text: text.slice(last, idx), highlightBlank: false});
    parts.push({text: m[1], highlightBlank: true, tokenKind: 'blank'});
    last = idx + m[0].length;
  }
  if (last < text.length) parts.push({text: text.slice(last), highlightBlank: false});
  return parts.length ? parts : [{text, highlightBlank: false}];
}
