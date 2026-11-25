import {z} from 'zod';
import {CaseBlueprintSchema, CaseFolderSchema} from '../schema';
import type {CaseBlueprint, CaseFolder} from '../types';

export const PortableCaseArchiveSchema = z.object({
  format: z.literal('sarabun-case-portable'),
  schemaVersion: z.literal(1),
  exportedAt: z.string().min(1),
  folder: CaseFolderSchema,
  blueprints: z.array(CaseBlueprintSchema).default([]),
});

export type PortableCaseArchive = z.infer<typeof PortableCaseArchiveSchema>;

export function sanitizeCaseFileName(name: string, fallback = 'case-folder'): string {
  const cleaned = name
    .replace(/[\\/:*?"<>|\x00-\x1f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
  return cleaned || fallback;
}

export function exportPortableCaseArchive(
  folder: CaseFolder,
  options: {blueprints?: CaseBlueprint[]} = {},
): {archive: PortableCaseArchive; json: string; bytes: Buffer; fileName: string} {
  const archive = PortableCaseArchiveSchema.parse({
    format: 'sarabun-case-portable',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    folder: CaseFolderSchema.parse(folder),
    blueprints: options.blueprints ?? [],
  });
  const json = JSON.stringify(archive, null, 2);
  const fileName = `${sanitizeCaseFileName(folder.name)}.sarabun-case.json`;
  return {
    archive,
    json,
    bytes: Buffer.from(json, 'utf8'),
    fileName,
  };
}

export function parsePortableCaseArchive(
  raw: string | unknown,
  options: {regenerateId?: boolean; suffixImportedName?: boolean} = {},
): PortableCaseArchive {
  const parsedRaw = typeof raw === 'string' ? (JSON.parse(raw) as unknown) : raw;
  const archive = PortableCaseArchiveSchema.parse(parsedRaw);
  const now = new Date().toISOString();

  if (!options.regenerateId && !options.suffixImportedName) {
    return archive;
  }

  return {
    ...archive,
    folder: {
      ...archive.folder,
      id: options.regenerateId ? globalThis.crypto.randomUUID() : archive.folder.id,
      name: options.suffixImportedName
        ? `${archive.folder.name} (นำเข้า)`.slice(0, 240)
        : archive.folder.name,
      updatedAt: now,
    },
  };
}
