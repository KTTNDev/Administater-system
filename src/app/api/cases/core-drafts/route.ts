import {z} from 'zod';
import {requireUser} from '@/lib/auth';
import {
  exportFailure,
  guardExportRequest,
  PRIVATE_HEADERS,
  readExportJson,
} from '@/lib/procurement/exporters/api';
import {
  bindCaseCoreDrafts,
  CaseCoreSyncConflict,
  listCaseCoreDraftBindings,
} from '@/lib/cases/core/bindings';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  try {
    await requireUser();
  } catch {
    return Response.json({error: 'กรุณาเข้าสู่ระบบใหม่'}, {status: 401, headers: PRIVATE_HEADERS});
  }
  try {
    const folderId = z
      .string()
      .min(1)
      .max(200)
      .parse(new URL(request.url).searchParams.get('folderId'));
    return Response.json(listCaseCoreDraftBindings(folderId), {headers: PRIVATE_HEADERS});
  } catch (e) {
    return exportFailure(e);
  }
}

const PostSchema = z.object({
  folderId: z.string().min(1).max(200),
  mode: z.enum(['create', 'sync']),
  itemIds: z.array(z.string().min(1)).optional(),
});

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const input = PostSchema.parse(await readExportJson(request));
    const links = bindCaseCoreDrafts(input.folderId, input.mode, {itemIds: input.itemIds});
    return Response.json(links, {headers: PRIVATE_HEADERS});
  } catch (e) {
    if (e instanceof CaseCoreSyncConflict) {
      return Response.json({error: e.message}, {status: 409, headers: PRIVATE_HEADERS});
    }
    return exportFailure(e);
  }
}
