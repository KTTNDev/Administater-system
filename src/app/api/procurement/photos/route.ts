import {createHash} from 'node:crypto';
import {normalizeInspectionPhoto} from '@/lib/procurement/media/photo-processor';
import {guardExportRequest, limitedBody, exportFailure, PRIVATE_HEADERS} from '@/lib/procurement/exporters/api';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const body = await limitedBody(request, 40 * 1024 * 1024);
    const form = await new Request(request.url, {method: 'POST', headers: {'Content-Type': request.headers.get('content-type') || ''}, body: new Uint8Array(body)}).formData();
    if ([...form.keys()].some(k => k !== 'files[]')) throw new Error('กรุณาส่งรูปภาพในช่อง files[] เท่านั้น');
    const files = form.getAll('files[]');
    if (!files.length || files.length > 20 || files.some(file => !(file instanceof File))) throw new Error('กรุณาแนบภาพ 1–20 ไฟล์ต่อครั้ง');
    const result = [];
    for (const file of files as File[]) {
      const photo = await normalizeInspectionPhoto(Buffer.from(await file.arrayBuffer()));
      result.push({id: createHash('sha256').update(photo.buffer).digest('hex'), name: file.name, dataUri: photo.dataUri, width: photo.width, height: photo.height, mimeType: photo.mimeType, bytes: photo.buffer.length});
    }
    return Response.json(result, {headers: PRIVATE_HEADERS});
  } catch (error) {return exportFailure(error);}
}
