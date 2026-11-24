/** Teaching model only: it does not replace the production Draft schema. */
export type YearMode = 'calendar' | 'fiscal';
export type Draft = { subject: string; body: string; status: 'draft' | 'reviewed' };
export type SavedDraft = Draft & { id: string; version: number };
export type SaveResult = { ok: true; data: SavedDraft } | { ok: false; error: string };
export type Period = { start: number; end: number; buffer: number };
