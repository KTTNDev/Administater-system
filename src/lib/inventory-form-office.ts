import 'server-only';
import {documentAssets} from './assets';
import {renderWordHtml} from './word';
import {inventoryFormHtml} from './inventory-form-render';
import type {InventoryFormInput} from './inventory-forms';
export function inventoryOfficeFile(d:InventoryFormInput){return renderWordHtml(inventoryFormHtml(d,false,documentAssets(),true),d.title);}
