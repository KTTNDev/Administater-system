import {z} from 'zod';
import {guardExportRequest,readExportJson,exportFailure,PRIVATE_HEADERS} from '@/lib/procurement/exporters/api';
import {GeneratedDocIdSchema} from '@/lib/procurement/exporters/profiles';
import {coreOutputCase} from '@/lib/procurement/core/output';
import {coreOutputFields} from '@/lib/procurement/core/output-schema';
import {documentHtml} from '@/lib/render-document';
import {documentAssets} from '@/lib/assets';
import {appendixSources} from '@/lib/appendix';
export const runtime='nodejs';
const schema=z.object({...coreOutputFields,docId:GeneratedDocIdSchema}).strict();
export async function POST(request:Request){try{
 await guardExportRequest(request);const input=schema.parse(await readExportJson(request)),draft=coreOutputCase(input).draft(input.docId);
 return new Response(documentHtml(draft,documentAssets(),appendixSources(draft)),{headers:{...PRIVATE_HEADERS,'Content-Type':'text/html; charset=utf-8','X-Core-Draft-Id':draft.id,'X-Core-Draft-Version':String(draft.version),'Content-Security-Policy':"default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; frame-ancestors 'self'"}});
}catch(error){return exportFailure(error);}}
