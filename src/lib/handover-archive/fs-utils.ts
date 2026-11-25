import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const ARCHIVE_META_DIR = '.sarabun-archive-meta';
export const ARCHIVE_INDEX_FILE = 'index.json';
export const PREVIOUS_VERSIONS_DIR = 'ประวัติรุ่นเก่า';

const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(?:\.|$)/i;

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/**
 * Produces a clean, human-readable, Windows-safe Thai/English folder or filename segment
 * with zero trailing dots/spaces and safe handling of reserved Windows device names.
 */
export function safeArchivePart(value: string, maxLen = 72): string {
  let clean = String(value || '')
    .normalize('NFC')
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/^[.\s-]+|[.\s-]+$/g, '')
    .slice(0, maxLen)
    .replace(/[.\s-]+$/g, '');
  if (!clean) clean = 'ไม่ระบุชื่อ';
  if (WINDOWS_RESERVED.test(clean)) clean = `_${clean}`;
  return clean;
}

/** Converts an ISO date (`YYYY-MM-DD`) to Thai fiscal year BE (Oct 1 = start of next FY). */
export function fiscalYearBEFromDate(isoDate?: string | null): number | null {
  const m = String(isoDate || '').match(/^(\d{4})-(\d{2})-/);
  if (!m) return null;
  const yearAD = Number(m[1]);
  const month = Number(m[2]);
  if (!Number.isInteger(yearAD) || month < 1 || month > 12) return null;
  return yearAD + 543 + (month >= 10 ? 1 : 0);
}

export function fiscalYearFolder(fiscalYearBE?: number | null): string {
  if (fiscalYearBE && Number.isInteger(fiscalYearBE) && fiscalYearBE >= 2400 && fiscalYearBE <= 3000) {
    return `ปีงบประมาณ ${fiscalYearBE}`;
  }
  return 'ไม่ระบุปีงบประมาณ';
}

/** Ensures `target` stays strictly inside `root` and refuses symlinks along the path. */
export function resolveSafeChild(root: string, relative = ''): string {
  const base = path.resolve(root);
  const target = path.resolve(base, relative);
  const rel = path.relative(base, target);
  if (rel === '..' || rel.startsWith('..' + path.sep) || path.isAbsolute(rel)) {
    throw new Error('พาธอยู่นอกโฟลเดอร์จัดเก็บที่อนุญาต');
  }
  let cursor = base;
  for (const seg of ['', ...rel.split(path.sep).filter(Boolean)]) {
    if (seg) cursor = path.join(cursor, seg);
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) {
      throw new Error('ไม่อนุญาตให้ใช้ Symbolic Link ในโฟลเดอร์จัดเก็บแฟ้มงาน');
    }
  }
  return target;
}

/** Validates a user-configured handover root folder path on Windows/POSIX. */
export function validateHandoverRootPath(candidate: string): string {
  const trimmed = candidate.trim();
  if (!trimmed) throw new Error('กรุณาระบุพาธโฟลเดอร์ปลายทาง');
  const resolved = path.resolve(trimmed);
  if (!path.isAbsolute(resolved)) throw new Error('กรุณาระบุพาธเต็มของโฟลเดอร์ เช่น F:\\ข้อมูลสารบรรณ\\แฟ้มงานพร้อมใช้');
  const parsed = path.parse(resolved);
  if (resolved === parsed.root) {
    throw new Error('กรุณาระบุโฟลเดอร์ย่อย แทนการใช้รากของไดรฟ์โดยตรง');
  }
  const lower = resolved.toLowerCase();
  const forbidden = ['c:\\windows', 'c:\\program files', 'c:\\program files (x86)', 'c:\\programdata'];
  if (forbidden.some(prefix => lower === prefix || lower.startsWith(prefix + '\\'))) {
    throw new Error('ไม่สามารถใช้โฟลเดอร์ระบบของ Windows เป็นที่เก็บแฟ้มงานได้');
  }
  if (fs.existsSync(resolved)) {
    const stat = fs.lstatSync(resolved);
    if (stat.isSymbolicLink()) throw new Error('โฟลเดอร์ปลายทางต้องไม่เป็น Symbolic Link');
    if (!stat.isDirectory()) throw new Error('พาธที่ระบุเป็นไฟล์ ไม่ใช่โฟลเดอร์');
  }
  return resolved;
}

export function atomicWrite(filePath: string, bytes: Uint8Array): void {
  fs.mkdirSync(path.dirname(filePath), {recursive: true});
  const tmp = `${filePath}.${randomUUID().slice(0, 8)}.tmp`;
  try {
    fs.writeFileSync(tmp, bytes, {flag: 'wx'});
    fs.renameSync(tmp, filePath);
  } finally {
    if (fs.existsSync(tmp)) {
      try {
        fs.unlinkSync(tmp);
      } catch {
        // ignore cleanup error
      }
    }
  }
}

function bangkokStamp(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '00';
  return `${get('year')}${get('month')}${get('day')}-${get('hour')}${get('minute')}${get('second')}`;
}

export interface VersionedWriteResult {
  filePath: string;
  status: 'created' | 'updated' | 'unchanged';
  archivedPrevious?: string;
  sha256: string;
  bytes: number;
}

/**
 * Keeps ONE clean latest file at `<folder>/<relativeFile>`.
 * - If identical SHA-256 already exists -> skips cleanly (`unchanged`).
 * - If content changed -> moves the previous file into `<dir>/ประวัติรุ่นเก่า/<base>_<stamp>_<hash8><ext>`,
 *   then writes the new file atomically at the clean latest path (`updated`).
 */
export function writeVersionedFile(
  root: string,
  folder: string,
  relativeFile: string,
  bytes: Uint8Array,
): VersionedWriteResult {
  const target = resolveSafeChild(root, path.relative(path.resolve(root), path.resolve(folder, relativeFile)));
  const hash = sha256Hex(bytes);

  if (fs.existsSync(target)) {
    const existingBytes = fs.readFileSync(target);
    const existingHash = sha256Hex(existingBytes);
    if (existingHash === hash) {
      return {filePath: target, status: 'unchanged', sha256: hash, bytes: bytes.length};
    }

    const dir = path.dirname(target);
    const ext = path.extname(target);
    const base = path.basename(target, ext);
    const historyDir = resolveSafeChild(root, path.relative(path.resolve(root), path.join(dir, PREVIOUS_VERSIONS_DIR)));
    fs.mkdirSync(historyDir, {recursive: true});

    const stamp = bangkokStamp();
    let archiveName = `${base}_${stamp}_${existingHash.slice(0, 8)}${ext}`;
    let archiveTarget = path.join(historyDir, archiveName);
    let seq = 2;
    while (fs.existsSync(archiveTarget)) {
      archiveName = `${base}_${stamp}_${existingHash.slice(0, 8)}_${seq}${ext}`;
      archiveTarget = path.join(historyDir, archiveName);
      seq += 1;
    }

    // Move previous version safely into ประวัติรุ่นเก่า before replacing latest
    fs.renameSync(target, archiveTarget);
    atomicWrite(target, bytes);
    return {
      filePath: target,
      status: 'updated',
      archivedPrevious: archiveTarget,
      sha256: hash,
      bytes: bytes.length,
    };
  }

  atomicWrite(target, bytes);
  return {filePath: target, status: 'created', sha256: hash, bytes: bytes.length};
}

interface ArchiveIndex {
  schemaVersion: 1;
  folders: Record<string, string>;
  lastRun?: {
    at: string;
    fiscalYearBE?: number | null;
    created: number;
    updated: number;
    unchanged: number;
    archivedPrevious: number;
    errors: number;
  };
}

function readIndex(root: string): ArchiveIndex {
  const indexPath = resolveSafeChild(root, path.join(ARCHIVE_META_DIR, ARCHIVE_INDEX_FILE));
  if (!fs.existsSync(indexPath)) return {schemaVersion: 1, folders: {}};
  try {
    const parsed = JSON.parse(fs.readFileSync(indexPath, 'utf8')) as ArchiveIndex;
    if (parsed && parsed.schemaVersion === 1 && parsed.folders && typeof parsed.folders === 'object') {
      return parsed;
    }
  } catch {
    // recover cleanly if corrupted
  }
  return {schemaVersion: 1, folders: {}};
}

function writeIndex(root: string, index: ArchiveIndex): void {
  const indexPath = resolveSafeChild(root, path.join(ARCHIVE_META_DIR, ARCHIVE_INDEX_FILE));
  atomicWrite(indexPath, Buffer.from(JSON.stringify(index, null, 2), 'utf8'));
}

export function readLastArchiveRun(root: string): ArchiveIndex['lastRun'] | null {
  try {
    return readIndex(root).lastRun ?? null;
  } catch {
    return null;
  }
}

export function recordLastArchiveRun(root: string, run: NonNullable<ArchiveIndex['lastRun']>): void {
  fs.mkdirSync(root, {recursive: true});
  const index = readIndex(root);
  index.lastRun = run;
  writeIndex(root, index);
}

/**
 * Resolves a clean human-readable folder for `entityKey` (with NO UUID suffix in the folder name).
 * - If the same entity was renamed, migrates its existing folder cleanly.
 * - If another distinct entity already occupies `preferredRelative`, allocates `_2`, `_3`, ... automatically.
 */
export function resolveIndexedFolder(root: string, entityKey: string, preferredRelative: string): string {
  fs.mkdirSync(root, {recursive: true});
  const index = readIndex(root);
  const normalizedPreferred = preferredRelative.split(/[\\/]+/).filter(Boolean).join(path.sep);
  const previous = index.folders[entityKey];

  const occupiedByOther = (candidate: string) =>
    Object.entries(index.folders).some(
      ([k, v]) => k !== entityKey && v.toLowerCase() === candidate.toLowerCase(),
    );

  let chosen = normalizedPreferred;
  let suffix = 2;
  while (occupiedByOther(chosen)) {
    chosen = `${normalizedPreferred}_${suffix}`;
    suffix += 1;
  }

  const targetDir = resolveSafeChild(root, chosen);
  if (previous && previous !== chosen) {
    const oldDir = resolveSafeChild(root, previous);
    if (fs.existsSync(oldDir) && !fs.existsSync(targetDir)) {
      fs.mkdirSync(path.dirname(targetDir), {recursive: true});
      try {
        fs.renameSync(oldDir, targetDir);
      } catch {
        // Fallback: keep creating new folder without losing previous files
      }
    }
  }

  fs.mkdirSync(targetDir, {recursive: true});
  if (index.folders[entityKey] !== chosen) {
    index.folders[entityKey] = chosen;
    writeIndex(root, index);
  }
  return targetDir;
}
