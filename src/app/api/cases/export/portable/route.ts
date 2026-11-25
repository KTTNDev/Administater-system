import {z} from 'zod';
import {
  contentDisposition,
  exportFailure,
  guardExportRequest,
  PRIVATE_HEADERS,
  readExportJson,
} from '@/lib/procurement/exporters/api';
import {CaseFolderSchema} from '@/lib/cases/schema';
import {
  exportPortableCaseArchive,
  parsePortableCaseArchive,
} from '@/lib/cases/exporters/portable-archive';
import {sqliteCaseRepository} from '@/lib/cases/server-context';

export const runtime = 'nodejs';

const ExportPortableSchema = z.object({
  folder: CaseFolderSchema,
  includeBlueprints: z.boolean().default(false),
});

export async function POST(request: Request) {
  try {
    await guardExportRequest(request);
    const input = ExportPortableSchema.parse(await readExportJson(request));
    const blueprints = input.includeBlueprints
      ? sqliteCaseRepository.load().data.blueprints
      : [];
    const exported = exportPortableCaseArchive(input.folder, {blueprints});
    return new Response(new Uint8Array(exported.bytes), {
      status: 200,
      headers: {
        ...PRIVATE_HEADERS,
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': contentDisposition(exported.fileName),
      },
    });
  } catch (e) {
    return exportFailure(e);
  }
}

const ImportPortableSchema = z.object({
  archive: z.union([z.string(), z.record(z.string(), z.unknown())]),
  regenerateId: z.boolean().default(true),
  suffixImportedName: z.boolean().default(true),
});

export async function PUT(request: Request) {
  try {
    await guardExportRequest(request);
    const input = ImportPortableSchema.parse(await readExportJson(request));
    const parsed = parsePortableCaseArchive(input.archive, {
      regenerateId: input.regenerateId,
      suffixImportedName: input.suffixImportedName,
    });
    sqliteCaseRepository.upsertFolder(parsed.folder);
    for (const bp of parsed.blueprints) {
      sqliteCaseRepository.upsertBlueprint(bp);
    }
    const record = sqliteCaseRepository.load();
    return Response.json(
      {ok: true, importedFolderId: parsed.folder.id, folderName: parsed.folder.name, record},
      {headers: PRIVATE_HEADERS},
    );
  } catch (e) {
    return exportFailure(e);
  }
}
