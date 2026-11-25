import {requireUser} from '@/lib/auth';
import {contentDisposition, PRIVATE_HEADERS} from '@/lib/procurement/exporters/api';
import {readCaseExternalFileById} from '@/lib/cases/server-context';

export const runtime = 'nodejs';

export async function GET(
  request: Request,
  context: {params: Promise<{id: string}>},
) {
  try {
    await requireUser();
  } catch {
    return Response.json({error: 'กรุณาเข้าสู่ระบบใหม่'}, {status: 401, headers: PRIVATE_HEADERS});
  }

  const {id} = await context.params;
  const stored = readCaseExternalFileById(id);
  if (!stored) {
    return Response.json({error: 'ไม่พบไฟล์แนบในแฟ้มงาน'}, {status: 404, headers: PRIVATE_HEADERS});
  }

  const url = new URL(request.url);
  const forceDownload = url.searchParams.get('download') === '1' || stored.fileType === 'DOCX';
  const headers: Record<string, string> = {
    ...PRIVATE_HEADERS,
    'Content-Type': stored.mime,
    'Content-Disposition': forceDownload
      ? contentDisposition(stored.originalName)
      : `inline; filename*=UTF-8''${encodeURIComponent(stored.originalName)}`,
  };
  return new Response(new Uint8Array(stored.bytes), {status: 200, headers});
}
