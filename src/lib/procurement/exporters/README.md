# Phase 3 export integration

Server entry point: `src/lib/procurement/server.ts`. Keep binary exporters out of the
pure/client-safe `index.ts` barrel. All engines consume the Phase 2 document model.
No Word automation, filesystem templates or network requests are needed to export.

## APIs

POST requests require the existing app's authenticated user policy, a same-origin
`Origin` and `Host`, and strict Zod input. Shared fields are `caseInput` (Phase 1
ProcurementCaseInput), `agency` (AgencyConfig), and optional `allowExportWithErrors`.
The default rejects domain ERROR issues with HTTP 400 and `{issues: ValidationIssue[]}`.
An explicit override allows printing a draft; warnings and informational issues do not block.

- `preview-html`: add `docId` and optional `density`. Returns offline HTML containing
  the actual fonts, Garuda and normalized photos. It never launches Chromium. The HTML
  is a flowing editing preview; PDF export performs the physical-page measurement.
- `export/pdf`: add `options` with `profile`, `duplicateCopies`, `includeDividers`,
  `includeCoverChecklist`, and `routingStripMode`. Profiles are FULL_BINDER, BY_STAGE
  with one of the four stage identifiers, or SINGLE_DOC with `docId`. Returns PDF plus
  X-Page-Count and X-Applied-Densities. External slots are checklist dividers, not
  replacements for originals from e-GP/e-LAAS/vendors.
- `export/docx`: add `mode: ZIP_ALL` or `mode: SINGLE_DOC` with `docId`. ZIP includes
  all active manual documents once and a filing/copy/stamp checklist. Printing multiple
  copies is explicit in the PDF binder and in this checklist.
- `photos`: multipart field `files[]`, up to 20 files / 40 MB per request and 20 MB per
  source image. Returns normalized JPEG metadata, a content hash and `dataUri`.
  Store the returned **dataUri** in `caseInput.attachments.photoPaths`. A hash alone
  is not a persisted file reference. Server exports never fetch arbitrary URLs or
  read user-supplied local filesystem paths. Trusted Node callers may supply photo
  buffers directly to the individual document engines.

## Layout and assets

PDF export embeds local fonts and images, measures at the actual printable width,
tries density tiers only inside the specified overflow range, and otherwise paginates
at normal density. Tables split at intact row boundaries with repeated headers;
totals are reserved for the final segment. The final two body lines travel with a
signature cluster. Oversized indivisible rows/signatures produce an actionable error
instead of clipping or silently discarding content. Measured physical page counts
are checked against the generated PDF.

TH Sarabun IT๙'s legacy shaping glyphs use private Unicode slots. PDF export repairs
only their ToUnicode search maps, preserving the painted font/glyphs while enabling
standard Thai extraction. PDF text consumers should still normalize whitespace and
Unicode compatibility forms (e.g. decomposed Thai sara am) when comparing text.

Word files use the same prose, native tables, editable text, embedded fonts,
keepNext/keepLines/cantSplit, repeating table headers, Thai page-number fields and
different first-page headers. Word paginates its editable content independently;
its page count can change after editing or with different Word versions.
The Word font declarations use the family name stored inside the actual TTF (the
bundled IT๙ face is `TH SarabunIT๙`), retaining `TH Sarabun IT๙` as an alternate name.
Using only the CSS display alias in Word can select an incorrect italic face.

The browser pool reuses one browser, permits at most three active contexts, and
closes after two idle minutes. `PROCUREMENT_PDF_CONCURRENCY=1` is supported on smaller
machines; `CHROMIUM_EXECUTABLE_PATH` can select an existing Chrome/Edge installation.
`SARABUN_SOURCE_DIR` selects the source root containing public assets. Missing IT๙
faces fall back to TH Sarabun New with a warning naming the expected font paths.
