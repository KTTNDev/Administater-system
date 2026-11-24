import type {Page} from 'playwright';
import type {DocumentFamily} from '../../templates/ir';
import {pageRules} from '../../templates/sarabun-rules';
import {paginateDocument} from '../../layout/paginate-document';
/** Uses the same geometry function as the live A4 preview. */
export async function paginateDom(page:Page,family:DocumentFamily){
 return page.evaluate(paginateDocument,{margins:pageRules(family).marginsCm});
}