import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import {formatThaiDate, toThaiDigits, toThaiOfficialText} from '../procurement/formatting';
import {A4_TWIPS, blackBorders, cmToTwip, fontAttributes, ptToHalfPt} from '../procurement/exporters/docx/styles';
import {DOC_TYPE_THAI_NAMES, formatOfficialNumber, resolveCaseText} from './resolver';
import type {CaseFolder, LinkedModuleSummary, RoadmapRow} from './types';

const FONT = 'TH SarabunIT๙';

export function buildCaseRoadmap(
  folder: CaseFolder,
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>,
): RoadmapRow[] {
  const stageMap = new Map(folder.stages.map(s => [s.id, s]));
  const ordered = [...folder.items].sort((a, b) => {
    const sa = stageMap.get(a.stageId)?.order ?? 9999;
    const sb = stageMap.get(b.stageId)?.order ?? 9999;
    if (sa !== sb) return sa - sb;
    return a.order - b.order;
  });

  return ordered.map((item, index) => {
    const stage = stageMap.get(item.stageId);
    const stageName = stage?.name ?? 'เอกสารทั่วไป';

    if (item.kind === 'GENERATED_DOC') {
      const resolvedTitle = resolveCaseText(folder, item.title, {
        highlightBlanks: false,
        linkedSummaries,
      }).text;
      const refNo =
        item.docType === 'ANNOUNCEMENT' && item.payload.docType === 'ANNOUNCEMENT'
          ? item.payload.registryLogNo
            ? `ทะเบียนประกาศ ${toThaiDigits(item.payload.registryLogNo)}`
            : 'ไม่พิมพ์เลข'
          : formatOfficialNumber(folder, item) || 'รอจองเลข';
      const dateIso = item.date || '';
      const dateThai = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? formatThaiDate(dateIso) : 'รอลงวันที่';
      const isOverride = Boolean(item.externalOverride);
      return {
        sequence: index + 1,
        stageId: item.stageId,
        stageName,
        itemId: item.id,
        kind: item.kind,
        docTypeLabel: DOC_TYPE_THAI_NAMES[item.docType],
        title: resolvedTitle,
        referenceNo: refNo,
        dateIso,
        dateThai,
        copies: item.copies,
        statusBadge: isOverride ? 'ใช้ฉบับแก้ไขภายนอก' : 'ระบบสร้าง',
        isExternalOverride: isOverride,
        overrideNote: item.externalOverride?.note,
      };
    }

    if (item.kind === 'EXTERNAL_FILE_SLOT') {
      const dateIso = item.externalDate || '';
      const dateThai = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? formatThaiDate(dateIso) : 'ยังไม่ระบุวันที่';
      const hasFile = Boolean(item.uploadedFilePath);
      return {
        sequence: index + 1,
        stageId: item.stageId,
        stageName,
        itemId: item.id,
        kind: item.kind,
        docTypeLabel: 'เอกสารภายนอก',
        title: toThaiOfficialText(item.title),
        referenceNo: item.externalDocNo ? toThaiOfficialText(item.externalDocNo) : '-',
        dateIso,
        dateThai,
        copies: item.copies,
        statusBadge: hasFile
          ? item.exportBehavior === 'EMBED_UPLOADED_FILE'
            ? 'แนบไฟล์แล้ว (รวมเล่ม)'
            : 'แนบไฟล์แล้ว (พิมพ์แผ่นคั่น)'
          : 'แทรกเอกสารต้นฉบับ',
        isExternalOverride: false,
        stampReminderNote: item.stampReminderNote || undefined,
      };
    }

    // LINKED_MODULE_REF
    const summary = linkedSummaries?.get(item.id);
    const dateIso = summary?.date || '';
    const dateThai = dateIso && /^\d{4}-\d{2}-\d{2}$/.test(dateIso) ? formatThaiDate(dateIso) : 'รอวันที่';
    const moduleLabel =
      item.targetModule === 'PROCUREMENT'
        ? 'เชื่อมจัดซื้อจัดจ้าง'
        : item.targetModule === 'INVENTORY_REQUISITION'
          ? 'เชื่อมใบเบิกวัสดุ'
          : 'เชื่อมใบยืมครุภัณฑ์';
    return {
      sequence: index + 1,
      stageId: item.stageId,
      stageName,
      itemId: item.id,
      kind: item.kind,
      docTypeLabel: moduleLabel,
      title: toThaiOfficialText(summary?.title || item.title),
      referenceNo: summary?.referenceNo ? toThaiOfficialText(summary.referenceNo) : 'ยังไม่ระบุเลข',
      dateIso,
      dateThai,
      copies: item.copies,
      statusBadge: summary
        ? summary.found
          ? summary.isIncomplete
            ? `เชื่อมโยง (${summary.status} · ยังไม่ครบ)`
            : `เชื่อมโยง (${summary.status})`
          : 'ไม่พบต้นทาง'
        : 'เชื่อมโยงโมดูล',
      isExternalOverride: false,
      totalAmount: summary?.totalAmount,
    };
  });
}

export function buildRoadmapChecklistText(
  folder: CaseFolder,
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>,
): string {
  const rows = buildCaseRoadmap(folder, linkedSummaries);
  const lines: string[] = [
    `ลายแทงเรียงแฟ้มงานสารบรรณ: ${toThaiOfficialText(folder.name)}`,
    `ปีงบประมาณ พ.ศ. ${toThaiDigits(folder.fiscalYearBE)} · ${toThaiOfficialText(folder.agency.divisionName)} ${toThaiOfficialText(folder.agency.municipalityName)}`,
    '='.repeat(72),
  ];

  let currentStage = '';
  for (const row of rows) {
    if (row.stageName !== currentStage) {
      currentStage = row.stageName;
      lines.push('', `[${toThaiOfficialText(currentStage)}]`);
    }
    const amt =
      row.totalAmount !== undefined
        ? ` · วงเงิน ${toThaiDigits(row.totalAmount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2}))} บาท`
        : '';
    const overrideInfo = row.overrideNote ? ` (${row.overrideNote})` : '';
    const stampInfo = row.stampReminderNote ? ` [เตือน: ${row.stampReminderNote}]` : '';
    lines.push(
      `☐ ${toThaiDigits(row.sequence)}. ${row.title} | ${row.docTypeLabel} | เลขที่: ${row.referenceNo} | วันที่: ${row.dateThai} | ${toThaiDigits(row.copies)} ชุด | ${row.statusBadge}${amt}${overrideInfo}${stampInfo}`,
    );
  }

  return lines.join('\r\n');
}

export async function renderRoadmapChecklistDocx(
  folder: CaseFolder,
  linkedSummaries?: ReadonlyMap<string, LinkedModuleSummary>,
): Promise<Buffer> {
  const rows = buildCaseRoadmap(folder, linkedSummaries);
  const contentWidth = A4_TWIPS.width - cmToTwip(2.0) - cmToTwip(2.0);
  const colWidths = [
    Math.round(contentWidth * 0.08),
    Math.round(contentWidth * 0.34),
    Math.round(contentWidth * 0.18),
    Math.round(contentWidth * 0.16),
    Math.round(contentWidth * 0.14),
    contentWidth -
      Math.round(contentWidth * 0.08) -
      Math.round(contentWidth * 0.34) -
      Math.round(contentWidth * 0.18) -
      Math.round(contentWidth * 0.16) -
      Math.round(contentWidth * 0.14),
  ];

  const makeRun = (text: string, bold = false, sizePt = 14) =>
    new TextRun({
      text,
      font: fontAttributes(FONT),
      bold,
      boldComplexScript: bold,
      size: ptToHalfPt(sizePt),
      sizeComplexScript: ptToHalfPt(sizePt),
      color: '000000',
      language: {value: 'th-TH', eastAsia: 'th-TH', bidirectional: 'th-TH'},
    });

  const cell = (
    text: string,
    width: number,
    bold = false,
    align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT,
  ) =>
    new TableCell({
      width: {size: width, type: WidthType.DXA},
      borders: blackBorders,
      margins: {top: 50, bottom: 50, left: 70, right: 70},
      children: [
        new Paragraph({
          alignment: align,
          spacing: {before: 0, after: 0},
          children: [makeRun(text, bold, 14)],
        }),
      ],
    });

  const headerRow = new TableRow({
    tableHeader: true,
    cantSplit: true,
    children: [
      cell('ลำดับ', colWidths[0], true, AlignmentType.CENTER),
      cell('รายการเอกสาร / รอบเสนอแฟ้ม', colWidths[1], true, AlignmentType.CENTER),
      cell('เลขที่อ้างอิง', colWidths[2], true, AlignmentType.CENTER),
      cell('วันที่', colWidths[3], true, AlignmentType.CENTER),
      cell('สถานะ / แหล่งที่มา', colWidths[4], true, AlignmentType.CENTER),
      cell('ตรวจ', colWidths[5], true, AlignmentType.CENTER),
    ],
  });

  const bodyRows = rows.map(
    row =>
      new TableRow({
        cantSplit: true,
        children: [
          cell(toThaiDigits(row.sequence), colWidths[0], false, AlignmentType.CENTER),
          cell(`${row.title}\n(${toThaiOfficialText(row.stageName)})`, colWidths[1]),
          cell(row.referenceNo, colWidths[2], false, AlignmentType.CENTER),
          cell(row.dateThai, colWidths[3], false, AlignmentType.CENTER),
          cell(`${row.statusBadge} · ${toThaiDigits(row.copies)} ชุด`, colWidths[4]),
          cell('☐', colWidths[5], false, AlignmentType.CENTER),
        ],
      }),
  );

  const doc = new Document({
    creator: 'sarabun-cases',
    title: `ใบปะหน้าลายแทงเรียงแฟ้ม — ${folder.name}`,
    sections: [
      {
        properties: {
          page: {
            size: A4_TWIPS,
            margin: {
              top: cmToTwip(2.0),
              bottom: cmToTwip(2.0),
              left: cmToTwip(2.0),
              right: cmToTwip(2.0),
            },
          },
        },
        children: [
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {before: 0, after: 80},
            children: [makeRun('ใบปะหน้าลายแทงเรียงแฟ้มงานสารบรรณ', true, 20)],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: {before: 0, after: 120},
            children: [
              makeRun(
                `${toThaiOfficialText(folder.name)} · ปีงบประมาณ พ.ศ. ${toThaiDigits(folder.fiscalYearBE)}`,
                false,
                16,
              ),
            ],
          }),
          new Table({
            width: {size: contentWidth, type: WidthType.DXA},
            columnWidths: colWidths,
            layout: TableLayoutType.FIXED,
            borders: {
              top: {style: BorderStyle.SINGLE, size: 4, color: '000000'},
              bottom: {style: BorderStyle.SINGLE, size: 4, color: '000000'},
              left: {style: BorderStyle.SINGLE, size: 4, color: '000000'},
              right: {style: BorderStyle.SINGLE, size: 4, color: '000000'},
              insideHorizontal: {style: BorderStyle.SINGLE, size: 4, color: '000000'},
              insideVertical: {style: BorderStyle.SINGLE, size: 4, color: '000000'},
            },
            rows: [headerRow, ...bodyRows],
          }),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}
