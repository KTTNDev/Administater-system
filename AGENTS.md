<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Sarabun Core-First Document Architecture (Mandatory)

- **Always use the Core document system (`src/lib/document.ts`, `src/lib/templates.ts`, `src/lib/render-document.ts`, `src/lib/pdf.ts`, `src/lib/word.ts`, `documents` SQLite table, and the Core Editor `DocumentForm`) as the single source of truth** for rendering, previewing, editing, and exporting official Thai government forms across every module (including Procurement, Case Folders, and future modules).
- **Never build parallel standalone HTML/Word template renderers** that diverge from Core's layout, dotted field guides, margins, signature positioning, appendix images, or floating overlays.
- Every module that generates official documents must:
  1. Map its structured domain inputs into validated Core `Draft` objects (`documentSchema`).
  2. Persist and link generated drafts via Core bindings (e.g., `procurement_core_drafts`, `case_core_drafts`) so users can open any document directly in the Core Editor (`?view=editor`) and return seamlessly to the source module.
  3. Preserve user edits made in Core (content, floating text boxes, signatures, attachments) unless the user explicitly triggers a content sync.
  4. Render A4 Previews (`documentHtml`), PDFs (`renderPdf`), and Word `.docx` files (`renderWord`) from the Core `Draft` so Preview, PDF, and Word always match 1:1.

