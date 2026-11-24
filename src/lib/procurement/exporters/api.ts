import 'server-only';
import {z} from 'zod';
import {requireUser} from '../../auth';
import {AgencyConfigSchema, ProcurementCaseInputSchema} from '../schema';
import {computeProcurementCase} from '../calculations';
import {validateProcurementCase} from '../validator';
import type {ValidationIssue} from '../types';

export const exportRequestFields = {caseInput: ProcurementCaseInputSchema, agency: AgencyConfigSchema, allowExportWithErrors: z.boolean().default(false),density:z.enum(['normal','compact','tight']).optional()};
export const PRIVATE_HEADERS = {'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff'};
export class ExportRequestError extends Error {
  constructor(public issues: ValidationIssue[], public status = 400) {super(issues.map(i => i.messageTh).join('; '));}
}
export async function guardExportRequest(request: Request) {
  try {await requireUser();} catch {throw new ExportRequestError([{code: 'UNAUTHENTICATED', severity: 'ERROR', docIds: [], messageTh: 'กรุณาเข้าสู่ระบบใหม่'}], 401);}
  const origin=request.headers.get('origin'),host=request.headers.get('host');
  let valid=false;
  try{
    const source=new URL(origin!),targets=[new URL(request.url)],loopback=new Set(['localhost','127.0.0.1','[::1]']);
    if(process.env.APP_URL)targets.push(new URL(process.env.APP_URL));
    // Next may normalize a local Request URL to localhost; Host is the public authority.
    valid=!!origin&&!!host&&source.origin===origin&&source.host===host&&['http:','https:'].includes(source.protocol)&&targets.some(target=>target.origin===source.origin||loopback.has(target.hostname)&&loopback.has(source.hostname)&&target.port===source.port&&target.protocol===source.protocol);
  }catch{valid=false;}
  if(!valid)throw new ExportRequestError([{code:'INVALID_ORIGIN',severity:'ERROR',docIds:[],messageTh:'ไม่อนุญาตคำขอจากเว็บไซต์อื่น'}],403);
}
export async function limitedBody(request: Request, max = 20 * 1024 * 1024): Promise<Buffer> {
  if (Number(request.headers.get('content-length')) > max) throw new Error('ข้อมูลมีขนาดใหญ่เกินกำหนด');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('ไม่พบข้อมูลคำขอ');
  const chunks: Uint8Array[] = []; let length = 0;
  try {
    while (true) {const {value, done} = await reader.read(); if (done) break; length += value.length; if (length > max) {await reader.cancel(); throw new Error('ข้อมูลมีขนาดใหญ่เกินกำหนด');} chunks.push(value);}
  } finally {reader.releaseLock();}
  return Buffer.concat(chunks);
}
export async function readExportJson(request: Request) {return JSON.parse((await limitedBody(request)).toString('utf8')) as unknown;}
export function validatedCase(input: z.infer<z.ZodObject<typeof exportRequestFields>>) {
  const computed = computeProcurementCase(input.caseInput), issues = validateProcurementCase(computed);
  if (!input.allowExportWithErrors && issues.some(i => i.severity === 'ERROR')) throw new ExportRequestError(issues);
  return computed;
}
export function exportFailure(error: unknown) {
  const issues: ValidationIssue[] = error instanceof ExportRequestError ? error.issues : error instanceof z.ZodError ? error.issues.map(issue => ({code: 'INVALID_INPUT', severity: 'ERROR', docIds: [], field: issue.path.join('.'), messageTh: issue.message})) : [{code: 'EXPORT_FAILED', severity: 'ERROR', docIds: [], messageTh: error instanceof Error ? error.message : 'ไม่สามารถส่งออกเอกสารได้'}];
  return Response.json({issues}, {status: error instanceof ExportRequestError ? error.status : 400, headers: PRIVATE_HEADERS});
}
export function contentDisposition(filename: string) {
  return `attachment; filename="document.${filename.split('.').at(-1)}"; filename*=UTF-8''${encodeURIComponent(filename).replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16).toUpperCase())}`;
}
