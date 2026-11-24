import 'server-only';
import sharp from 'sharp';
import type {RenderedDocumentSpec} from '../templates/ir';

export interface NormalizedInspectionPhoto {
  buffer: Buffer; dataUri: string; width: number; height: number; mimeType: 'image/jpeg';
}
export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export async function normalizeInspectionPhoto(inputBuffer: Buffer): Promise<NormalizedInspectionPhoto> {
  if (!inputBuffer.length || inputBuffer.length > MAX_PHOTO_BYTES) throw new RangeError('รูปภาพต้องมีขนาดไม่เกิน 20 MB');
  const image = sharp(inputBuffer, {limitInputPixels: 40_000_000, failOn: 'error'});
  const metadata = await image.metadata();
  if (!['jpeg', 'png', 'webp', 'heif', 'tiff', 'gif'].includes(metadata.format || '') || (metadata.pages ?? 1) > 1) throw new Error('รองรับเฉพาะภาพนิ่ง JPEG, PNG, WebP, HEIF หรือ TIFF');
  const {data, info} = await image.rotate().resize({width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true}).flatten({background: '#fff'}).jpeg({quality: 85, mozjpeg: true}).toBuffer({resolveWithObject: true});
  return {buffer: data, dataUri: `data:image/jpeg;base64,${data.toString('base64')}`, width: info.width, height: info.height, mimeType: 'image/jpeg'};
}
export function fitPhotoDimensions(photo: Pick<NormalizedInspectionPhoto, 'width' | 'height'>, maxWidthCm: number, maxHeightCm: number) {
  if (![photo.width, photo.height, maxWidthCm, maxHeightCm].every(n => Number.isFinite(n) && n > 0)) throw new RangeError('ขนาดภาพไม่ถูกต้อง');
  const scale = Math.min(maxWidthCm / photo.width, maxHeightCm / photo.height);
  const widthCm = photo.width * scale, heightCm = photo.height * scale;
  return {widthCm, heightCm, widthEmu: Math.round(widthCm * 360000), heightEmu: Math.round(heightCm * 360000), widthPx: widthCm * 96 / 2.54, heightPx: heightCm * 96 / 2.54};
}
export async function prepareInspectionPhotos(model: RenderedDocumentSpec, supplied?: ReadonlyMap<string, Buffer>): Promise<Map<string, NormalizedInspectionPhoto>> {
  const sources = [...new Set(model.pages.flatMap(p => p.blocks).flatMap(b => b.kind === 'photo-grid' ? b.photos.map(p => p.source) : []))];
  if (sources.length > 50) throw new RangeError('แนบภาพได้ไม่เกิน 50 ภาพต่อเอกสาร');
  const result = new Map<string, NormalizedInspectionPhoto>();
  // Never fetch user URLs or read arbitrary client-provided filesystem paths on the server.
  for (const source of sources) {
    let data = supplied?.get(source);
    if (!data) {
      const match = /^data:image\/(?:jpeg|png|webp|gif|tiff|heif);base64,([A-Za-z0-9+/=\r\n]+)$/.exec(source);
      if (!match || match[1].length > MAX_PHOTO_BYTES * 4 / 3 + 8) throw new Error('ไม่พบไฟล์ภาพที่แนบ กรุณาอัปโหลดภาพผ่านระบบก่อนส่งออก');
      data = Buffer.from(match[1], 'base64');
    }
    result.set(source, await normalizeInspectionPhoto(data));
  }
  return result;
}
