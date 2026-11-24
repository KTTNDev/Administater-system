import {it, expect, vi} from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {loadSarabunFonts, loadGarudaAsset} from '../assets/loader';
import {prepareInspectionPhotos} from '../media/photo-processor';
import {modelsFor, findDoc, templateFixture} from './templates-fixtures';

it('embeds cached local assets and falls back to Sarabun New when IT๙ is missing', async () => {
  const garuda = await loadGarudaAsset();
  expect(garuda.buffer.length).toBeGreaterThan(1000); expect(garuda.dataUri).toMatch(/^data:image\/png;base64,/);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'sarabun-font-fallback-'));
  await fs.mkdir(path.join(root, 'public/fonts'), {recursive: true});
  for (const filename of ['THSarabunNew.ttf', 'THSarabunNew-Bold.ttf']) await fs.copyFile(path.resolve('public/fonts', filename), path.join(root, 'public/fonts', filename));
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.stubEnv('SARABUN_SOURCE_DIR', root);
  try {
    const fonts = await loadSarabunFonts();
    expect(fonts.family).toBe('TH Sarabun New');
    expect(fonts.css).toContain('data:font/ttf;base64,');
    expect(warning).toHaveBeenCalledTimes(1);
    expect(warning.mock.calls[0][0]).toContain('THSarabunIT9.ttf');
    expect(await loadSarabunFonts()).toBe(fonts);
  } finally {vi.unstubAllEnvs(); warning.mockRestore();}
});
it('rejects URL/path photo sources rather than silently omitting evidence or making server-side requests', async () => {
  const input = templateFixture(); input.attachments.photoPaths = ['https://example.com/private-photo.jpg'];
  await expect(prepareInspectionPhotos(findDoc(modelsFor(input), '11.3'))).rejects.toThrow('อัปโหลดภาพ');
});
