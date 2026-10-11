import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const { createSession } = vi.hoisted(() => ({ createSession: vi.fn() }));
vi.mock('@/lib/auth', () => ({ createSession }));
import { POST } from '../src/app/api/desktop/session/route';
const token = 'a'.repeat(64);
const request = (value: unknown, origin = 'http://127.0.0.1:3000', host = '127.0.0.1:3000') => new Request('http://127.0.0.1:3000/api/desktop/session', { method: 'POST', headers: { origin, host, 'Content-Type': 'application/json' }, body: JSON.stringify({ token: value }) });
beforeEach(() => { vi.stubEnv('SARABUN_DESKTOP_TOKEN', token); createSession.mockReset(); });
afterEach(() => vi.unstubAllEnvs());
it('rejects requests when not launched in desktop mode', async () => {
  vi.stubEnv('SARABUN_DESKTOP_TOKEN', '');
  expect((await POST(request(token))).status).toBe(403);
  expect(createSession).not.toHaveBeenCalled();
});
it('rejects foreign origins, hosts and invalid tokens without creating a session', async () => {
  for (const req of [request(token, 'https://example.com'), request(token, 'null'), request(token, 'http://127.0.0.1:3000', 'example.com'), request('b'.repeat(64)), request(undefined), request({ token }), request('short')]) expect((await POST(req)).status).toBe(403);
  expect(createSession).not.toHaveBeenCalled();
});
it('creates an ordinary authenticated session for the local launcher', async () => {
  const response = await POST(request(token));
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('no-store');
  expect(createSession).toHaveBeenCalledOnce();
});
