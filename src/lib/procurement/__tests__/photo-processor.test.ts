import {it, expect} from 'vitest';
import sharp from 'sharp';
import {normalizeInspectionPhoto, fitPhotoDimensions} from '../media/photo-processor';

it('bounds high resolution images without changing aspect ratio', async () => {
  const input = await sharp({create: {width: 3000, height: 2000, channels: 3, background: '#d0a040'}}).png().toBuffer();
  const photo = await normalizeInspectionPhoto(input);
  expect(photo.width).toBe(1400); expect(photo.height).toBe(933);
  expect(photo.mimeType).toBe('image/jpeg'); expect(photo.buffer.subarray(0, 2)).toEqual(Buffer.from([255, 216]));
  expect(photo.dataUri).toMatch(/^data:image\/jpeg;base64,/);
  expect(photo.buffer.length).toBeLessThan(200000);
  const fit = fitPhotoDimensions(photo, 7.8, 8.5);
  expect(fit.widthCm).toBeCloseTo(7.8); expect(fit.heightCm).toBeLessThan(8.5);
  expect(fit.widthEmu).toBe(Math.round(fit.widthCm * 360000));
  expect(fit.widthPx / fit.heightPx).toBeCloseTo(photo.width / photo.height);
});
it('respects EXIF orientation, strips metadata and never enlarges a small image', async () => {
  const input = await sharp({create: {width: 120, height: 80, channels: 3, background: '#fff'}}).withMetadata({orientation: 6}).jpeg().toBuffer();
  const result = await normalizeInspectionPhoto(input), metadata = await sharp(result.buffer).metadata();
  expect([result.width, result.height]).toEqual([80, 120]);
  expect(metadata.orientation).toBeUndefined(); expect(metadata.exif).toBeUndefined();
  expect(() => fitPhotoDimensions(result, 0, 1)).toThrow();
  await expect(normalizeInspectionPhoto(Buffer.from('not an image'))).rejects.toThrow();
  await expect(normalizeInspectionPhoto(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="2" height="2"/>'))).rejects.toThrow();
});
