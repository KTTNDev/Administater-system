# Phase 2 document model contract

`buildDocumentModels(computedCase, agency, options)` builds resolved, renderer-neutral
models in binder order. It follows Phase 1's manifest, including individual manual
overrides. External files remain binder entries; these builders do not regenerate them.

All official prose, names, references, dates, amounts and labels belong to the model.
HTML and the future Word adapter consume the same model. Machine identifiers, copies,
layout measurements and asset paths deliberately retain their machine representation.
Product codes and email addresses retain the exceptions defined by Phase 1.

```ts
import {
  computeProcurementCase, buildDocumentModels, renderDocumentHtml, defaultAgency,
} from '../index';

const models = buildDocumentModels(computeProcurementCase(input), defaultAgency, {
  poTableMode: 'SUMMARY', // or ITEMIZED
  routingStripCopies: 'FIRST_COPY', // or ALL_COPIES
});
const html = renderDocumentHtml(models[0]);
```

## Pagination boundary

Phase 2 provides CSS print fragmentation and explicit attachment/photo page groups.
`pages` describes authored groups, not a claim about final physical page count. A long
body group can occupy several physical pages. The screen HTML shows flowing content.
Phase 3 must await local fonts/images and measure content before binary export:

- `nextDensity` steps normal → compact → tight only for eligible single-page documents
  with measured overflow at most 15%. Do not estimate rendered heights from text length.
- `keepTrailingLines: 2` and `keepWithPrevious` preserve the final body lines, closing,
  signatures and approvals together. An oversized cluster needs measured fragmentation;
  it must never be silently clipped or scaled below the tight tier.
- `splitTableByMeasuredRows` consumes actual header/caption/row/footer heights. Continued
  table models repeat column headers and show `ตารางรายการ (ต่อ)`. Footer totals appear
  only in the final segment. Move a table first if no intact row fits the remaining area;
  an oversized row raises an explicit error rather than dropping content.
- CSS margin boxes use Thai page counters, suppress the first page number and carry
  the model's continuation note. Explicit groups also expose Thai headers for screen
  previews. The Phase 3 paginator must use physical page indexes when materializing pages.

Fonts (`/fonts/THSarabunIT9*.ttf`) and Garuda (`/assets/garuda.png`) reuse the existing
local assets. Serve HTML on the app's origin. An asset adapter can resolve photo paths
with `resolveAssetUrl`; the pure renderer never opens files or embeds arbitrary HTML.
No API route, database migration or PDF/DOCX binary exporter is introduced in this phase.
