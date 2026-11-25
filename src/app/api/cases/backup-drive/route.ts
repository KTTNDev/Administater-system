import {Readable} from 'node:stream';
import {z} from 'zod';
import {driveClient, driveStatus, escapeDriveQuery, queueDriveJob} from '@/lib/drive';
import {storageConfig} from '@/lib/storage';
import {
  exportFailure,
  guardExportRequest,
  PRIVATE_HEADERS,
  readExportJson,
} from '@/lib/procurement/exporters/api';
import {CaseFolderSchema} from '@/lib/cases/schema';
import {exportPortableCaseArchive} from '@/lib/cases/exporters/portable-archive';

export const runtime = 'nodejs';

const BackupDriveRequestSchema = z.object({
  folder: CaseFolderSchema,
});

async function ensureSubFolder(
  drive: Awaited<ReturnType<typeof driveClient>>,
  name: string,
  parent?: string,
): Promise<string> {
  const parentQuery = parent ? ` and '${escapeDriveQuery(parent)}' in parents` : '';
  const q = `trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${escapeDriveQuery(name)}'${parentQuery}`;
  const found = await drive.files.list({q, fields: 'files(id)', pageSize: 1});
  if (found.data.files?.[0]?.id) return found.data.files[0].id;
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parent ? [parent] : undefined,
      appProperties: {application: 'sarabun'},
    },
    fields: 'id',
  });
  if (!created.data.id) throw new Error('สร้างโฟลเดอร์บน Google Drive ไม่สำเร็จ');
  return created.data.id;
}

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const input = BackupDriveRequestSchema.parse(await readExportJson(request));
    const status = driveStatus();
    if (!status.configured || !status.connected) {
      return Response.json(
        {
          ok: false,
          configured: status.configured,
          connected: status.connected,
          message:
            'ยังไม่ได้เชื่อมต่อ Google Drive ในหน้าตั้งค่า (สามารถดาวน์โหลดไฟล์ .sarabun-case.json เพื่อสำรองในเครื่องแทนได้)',
        },
        {status: 200, headers: PRIVATE_HEADERS},
      );
    }

    const exported = exportPortableCaseArchive(input.folder);
    const uploaded = await queueDriveJob(async () => {
      const drive = await driveClient();
      const root =
        storageConfig().driveRoot.trim() || (await ensureSubFolder(drive, 'สารบรรณ'));
      const casesRoot = await ensureSubFolder(drive, 'แฟ้มงานสารบรรณ', root);
      const yearFolder = await ensureSubFolder(
        drive,
        `ปีงบประมาณ ${input.folder.fiscalYearBE}`,
        casesRoot,
      );
      const created = await drive.files.create({
        requestBody: {
          name: exported.fileName,
          parents: [yearFolder],
          appProperties: {
            application: 'sarabun',
            caseFolderId: input.folder.id,
          },
        },
        media: {
          mimeType: 'application/json',
          body: Readable.from(exported.bytes),
        },
        fields: 'id',
      });
      const fileId = created.data.id;
      if (!fileId) throw new Error('อัปโหลดขึ้น Google Drive ไม่สำเร็จ');
      return {fileId, url: `https://drive.google.com/file/d/${fileId}/view`};
    });

    return Response.json(
      {
        ok: true,
        configured: true,
        connected: true,
        fileId: uploaded.fileId,
        url: uploaded.url,
        fileName: exported.fileName,
      },
      {headers: PRIVATE_HEADERS},
    );
  } catch (e) {
    return exportFailure(e);
  }
}
