// Standalone learning exercise. Does not import the app DB or modify user data.
import assert from 'node:assert/strict';
import { z } from 'zod';

const noteSchema = z.object({
  subject: z.string().trim().min(1).max(300),
  contact: z.string().max(200).default(''),
  reviewed: z.boolean().default(false),
});
type Note = z.infer<typeof noteSchema>;
type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export function parseNote(input: unknown): Result<Note> {
  const parsed = noteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  return { ok: true, data: parsed.data };
}
export function setField<T, K extends keyof T>(current: T, key: K, value: T[K]): T {
  return { ...current, [key]: value };
}

type Floating =
  | { kind: 'text'; text: string; fontPt: number }
  | { kind: 'image'; imageId: string; widthMm: number };
export function describe(item: Floating): string {
  switch (item.kind) {
    case 'text': return item.text;
    case 'image': return item.imageId;
    default: {
      const unreachable: never = item;
      return unreachable;
    }
  }
}

const result = parseNote(JSON.parse('{"subject":" Example "}'));
if (!result.ok) throw new Error(result.error);
assert.equal(result.ok, true);
assert.equal(result.data.subject, 'Example');
assert.equal(result.data.contact, '');
assert.equal(result.data.reviewed, false);
const next = setField(result.data, 'reviewed', true);
assert.equal(next.reviewed, true);
assert.equal(result.data.reviewed, false); // Original object was not changed.
assert.equal(parseNote({ subject: '' }).ok, false);
assert.equal(parseNote({ subject: 42 }).ok, false);
assert.equal(parseNote({ subject: 'X', contact: 'x'.repeat(201) }).ok, false);
assert.equal(describe({ kind: 'text', text: 'Example', fontPt: 16 }), 'Example');
assert.equal(describe({ kind: 'image', imageId: 'image-1', widthMm: 30 }), 'image-1');

// Checked by tsc, not executed. Delete the directive to see the actual error.
if (false) {
  // @ts-expect-error reviewed accepts boolean, not string
  setField(result.data, 'reviewed', 'true');
  // @ts-expect-error a text item cannot omit text
  describe({ kind: 'text', fontPt: 16 });
}
console.log('TypeScript lab: 11 runtime assertions passed; no app data accessed.');
