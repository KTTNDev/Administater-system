import 'server-only';
import {LegacyWordRendererDisabledError} from './legacy-word-disabled';
type Rendered={bytes:Buffer;pages:number;pageTexts:string[]};
/** Compatibility entry points fail closed. Retained archive readers never call these functions. */
export async function nativeD07Pdf(_bytes:Buffer):Promise<Rendered>{throw new LegacyWordRendererDisabledError();}
export async function finalizeProcurementWord(_bytes:Buffer):Promise<Rendered&{word:Buffer}>{throw new LegacyWordRendererDisabledError();}
