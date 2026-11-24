import {AgencyConfigSchema} from '../schema';
import type {AgencyConfig, ComputedProcurementCase} from '../types';
import {buildBinderManifest} from '../manifest';
import {context} from './helpers';
import type {GeneratedDocId, RenderedDocumentSpec, TemplateOptions} from './ir';
import {buildDoc01} from './docs/doc01-approve-principle';
import {buildDoc02} from './docs/doc02-assign-spec';
import {buildDoc03} from './docs/doc03-report-spec';
import {buildDoc041} from './docs/doc04-1-tor';
import {buildDoc061} from './docs/doc06-1-purchase-request';
import {buildDoc062} from './docs/doc06-2-inspector-order';
import {buildDoc07} from './docs/doc07-eval-report';
import {buildDoc08} from './docs/doc08-winner-announcement';
import {buildDoc09} from './docs/doc09-contract-notice';
import {buildDoc10} from './docs/doc10-purchase-order';
import {buildDoc111} from './docs/doc11-1-inspection-report';
import {buildDoc112} from './docs/doc11-2-inspection-sheet';
import {buildDoc113} from './docs/doc11-3-photo-sheet';
import {buildDoc12} from './docs/doc12-final-summary';
import {buildDoc13} from './docs/doc13-disbursement';

const builders = {'1': buildDoc01, '2': buildDoc02, '3': buildDoc03, '4.1': buildDoc041, '6.1': buildDoc061, '6.2': buildDoc062, '7': buildDoc07, '8': buildDoc08, '9': buildDoc09, '10': buildDoc10, '11.1': buildDoc111, '11.2': buildDoc112, '11.3': buildDoc113, '12': buildDoc12, '13': buildDoc13} satisfies Record<GeneratedDocId, (x: ReturnType<typeof context>) => RenderedDocumentSpec>;
/** Does not render or mutate the case. External slots stay in the Phase 1 binder manifest. */
export function buildDocumentModels(c: ComputedProcurementCase, agency: AgencyConfig, options: TemplateOptions = {}): RenderedDocumentSpec[] {
  const x = context(c, AgencyConfigSchema.parse(agency), options);
  return buildBinderManifest(c).filter(row => row.source === 'GENERATED').map(row => builders[row.docId as GeneratedDocId](x));
}
/** Explicit Core conversion includes editable alternatives for all fifteen slots. */
export function buildAllCoreDocumentModels(c: ComputedProcurementCase, agency: AgencyConfig, options: TemplateOptions = {}): RenderedDocumentSpec[] {
  const x = context(c, AgencyConfigSchema.parse(agency), options);
  return (Object.keys(builders) as GeneratedDocId[]).sort((a,b)=>Number(a)-Number(b)).map(id=>builders[id](x));
}
