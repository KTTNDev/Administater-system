import {afterEach, describe, expect, it} from 'vitest';
import JSZip from 'jszip';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type {RegisterEntry} from '../src/lib/correspondence';
import {renderCorrespondenceWord} from '../src/lib/handover-archive/correspondence-word';
import {
  ARCHIVE_META_DIR,
  fiscalYearBEFromDate,
  fiscalYearFolder,
  PREVIOUS_VERSIONS_DIR,
  resolveIndexedFolder,
  resolveSafeChild,
  safeArchivePart,
  validateHandoverRootPath,
  writeVersionedFile,
} from '../src/lib/handover-archive/fs-utils';

const tempDirs: string[] = [];

function makeTempRoot(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sarabun-handover-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  while (tempDirs.length) {
    const dir = tempDirs.pop()!;
    fs.rmSync(dir, {recursive: true, force: true});
  }
});

describe('Local Handover Archive — filesystem & versioning invariants', () => {
  it('computes Thai fiscal years across Oct 1 boundary and sanitizes Windows/Thai names', () => {
    expect(fiscalYearBEFromDate('2025-09-30')).toBe(2568);
    expect(fiscalYearBEFromDate('2025-10-01')).toBe(2569);
    expect(fiscalYearBEFromDate('2026-09-30')).toBe(2569);
    expect(fiscalYearBEFromDate('2026-10-01')).toBe(2570);
    expect(fiscalYearFolder(2569)).toBe('ปีงบประมาณ 2569');
    expect(fiscalYearFolder(null)).toBe('ไม่ระบุปีงบประมาณ');

    expect(safeArchivePart('ขออนุมัติจัดซื้อ/วัสดุ:สำนักงาน*2569.')).toBe('ขออนุมัติจัดซื้อ-วัสดุ-สำนักงาน-2569');
    expect(safeArchivePart('CON')).toBe('_CON');
    expect(safeArchivePart('')).toBe('ไม่ระบุชื่อ');
  });

  it('keeps 1 clean latest file in main folder and archives changed older versions into ประวัติรุ่นเก่า/', () => {
    const root = makeTempRoot();
    const folder = resolveIndexedFolder(
      root,
      'document:doc-1',
      path.join('ปีงบประมาณ 2569', '01_หนังสือราชการ', 'หนังสือภายใน', 'ภก 52707-101_ขออนุมัติจัดซื้อ'),
    );

    // 1st write -> created
    const v1 = Buffer.from('Word v1 content');
    const r1 = writeVersionedFile(root, folder, 'ขออนุมัติจัดซื้อ.docx', v1);
    expect(r1.status).toBe('created');
    expect(r1.archivedPrevious).toBeUndefined();
    expect(fs.existsSync(path.join(folder, PREVIOUS_VERSIONS_DIR))).toBe(false);

    // Identical rewrite -> unchanged (no spam in ประวัติรุ่นเก่า)
    const r2 = writeVersionedFile(root, folder, 'ขออนุมัติจัดซื้อ.docx', v1);
    expect(r2.status).toBe('unchanged');
    expect(fs.existsSync(path.join(folder, PREVIOUS_VERSIONS_DIR))).toBe(false);

    // Changed content -> updated, previous moved into ประวัติรุ่นเก่า/, latest stays 1 clean file!
    const v2 = Buffer.from('Word v2 updated content');
    const r3 = writeVersionedFile(root, folder, 'ขออนุมัติจัดซื้อ.docx', v2);
    expect(r3.status).toBe('updated');
    expect(r3.archivedPrevious).toBeTruthy();
    expect(fs.readFileSync(r3.filePath).toString()).toBe('Word v2 updated content');
    expect(fs.readFileSync(r3.archivedPrevious!).toString()).toBe('Word v1 content');

    // Main folder has ONLY the clean latest file and ประวัติรุ่นเก่า/ — zero .json files!
    const entries = fs.readdirSync(folder);
    expect(entries.sort()).toEqual(['ขออนุมัติจัดซื้อ.docx', PREVIOUS_VERSIONS_DIR].sort());
    expect(entries.some(name => name.endsWith('.json'))).toBe(false);
    // Index lives strictly inside hidden .sarabun-archive-meta/
    expect(fs.existsSync(path.join(root, ARCHIVE_META_DIR, 'index.json'))).toBe(true);
  });

  it('migrates renamed folders cleanly and avoids collisions for duplicate titles', () => {
    const root = makeTempRoot();
    const f1 = resolveIndexedFolder(root, 'procurement:case-1', path.join('ปีงบประมาณ 2569', '02_จัดซื้อจัดจ้าง', '2026-01_1,520บาท_วัสดุสำนักงาน'));
    writeVersionedFile(root, f1, '01_บันทึก.docx', Buffer.from('doc1'));

    // Another distinct case with the exact same name gets _2 cleanly
    const f2 = resolveIndexedFolder(root, 'procurement:case-2', path.join('ปีงบประมาณ 2569', '02_จัดซื้อจัดจ้าง', '2026-01_1,520บาท_วัสดุสำนักงาน'));
    expect(f2).not.toBe(f1);
    expect(path.basename(f2)).toBe('2026-01_1,520บาท_วัสดุสำนักงาน_2');

    // Renaming case-1 migrates existing files to the new folder name cleanly
    const f1Renamed = resolveIndexedFolder(root, 'procurement:case-1', path.join('ปีงบประมาณ 2569', '02_จัดซื้อจัดจ้าง', '2026-01_1,520บาท_วัสดุสำนักงาน_ปรับชื่อ'));
    expect(fs.existsSync(f1)).toBe(false);
    expect(fs.readFileSync(path.join(f1Renamed, '01_บันทึก.docx')).toString()).toBe('doc1');
  });

  it('rejects path traversal and unsafe root directories', () => {
    const root = makeTempRoot();
    expect(() => resolveSafeChild(root, '..\\outside.txt')).toThrow();
    expect(() => validateHandoverRootPath('C:\\')).toThrow();
    expect(() => validateHandoverRootPath('C:\\Windows\\Temp')).toThrow();
    expect(validateHandoverRootPath(path.join(root, 'แฟ้มส่งมอบ'))).toBe(path.join(root, 'แฟ้มส่งมอบ'));
  });

  it('exports an editable TH SarabunIT๙ Word (.docx) register book for ทะเบียนรับ–ส่งหนังสือ', async () => {
    const sample: RegisterEntry = {
      id: '11111111-1111-4111-8111-111111111111',
      direction: 'incoming',
      department: 'กองสวัสดิการสังคม',
      registeredDate: '2026-10-15',
      registeredTime: '09:30',
      number: 'ภก 0023.1/1025',
      documentDate: '2026-10-14',
      from: 'สำนักงานส่งเสริมการปกครองท้องถิ่นจังหวัดภูเก็ต',
      to: 'นายกเทศมนตรีตำบลฉลอง',
      subject: 'ซักซ้อมแนวทางการจัดทำรายงานพัสดุประจำปีงบประมาณ 2569',
      practice: 'เสนอ ผอ.กองสวัสดิการสังคม เพื่อทราบและดำเนินการ',
      notes: '',
      owner: 'นายกิตตินันท์ พลรบ',
      status: 'working',
      urgency: 'normal',
      documentId: '',
      relatedId: '',
      attachmentFiles: [],
      serial: 1,
      year: 2026,
      version: 1,
      createdAt: '2026-10-15T02:30:00.000Z',
      updatedAt: '2026-10-15T02:30:00.000Z',
      createdBy: 'นายกิตตินันท์ พลรบ',
      updatedBy: 'นายกิตตินันท์ พลรบ',
      historyText: '',
    };

    const bytes = await renderCorrespondenceWord([sample], {
      mode: 'book',
      description: 'ปีงบประมาณ พ.ศ. 2570',
    });
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file('word/document.xml')!.async('string');
    expect(xml).toContain('TH SarabunIT๙');
    expect(xml).toContain('<w:tblHeader');
    expect(xml).toContain('<w:cantSplit');
    expect(xml).toContain('ทะเบียนหนังสือรับ');
    expect(xml).toContain('ซักซ้อมแนวทางการจัดทำรายงานพัสดุประจำปีงบประมาณ 2569');
  });
});
