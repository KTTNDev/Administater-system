import 'server-only';
import {loadGarudaAsset, loadSarabunFonts} from './loader';
import {prepareInspectionPhotos} from '../media/photo-processor';
import {renderDocumentHtml, type HtmlRenderOptions} from '../templates/html/render-html';
import type {RenderedDocumentSpec} from '../templates/ir';

export async function offlineDocumentHtml(model: RenderedDocumentSpec, options: HtmlRenderOptions = {}, suppliedPhotos?: ReadonlyMap<string, Buffer>) {
  const [garuda, fonts, photos] = await Promise.all([loadGarudaAsset(), loadSarabunFonts(), prepareInspectionPhotos(model, suppliedPhotos)]);
  let html = renderDocumentHtml(model, {...options, resolveAssetUrl: source => source === '/assets/garuda.png' ? garuda.dataUri : photos.get(source)?.dataUri ?? source});
  html = html.replace(/@font-face\{[^}]*\}/g, '').replaceAll("'TH Sarabun IT๙'", `'${fonts.family}'`);
  return html.replace('</style>', `${fonts.css}</style>`);
}
