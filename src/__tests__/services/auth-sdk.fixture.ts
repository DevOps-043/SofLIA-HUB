import { vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

export const QA_AUTH_USER = '00000000-0000-4000-8000-000000000033';
export function createAuthSdkFixture() {
  const user = { id: QA_AUTH_USER, aud: 'authenticated', role: 'authenticated', email: 'qa@example.invalid',
    created_at: '2026-10-25T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: {} };
  const encode = (value: unknown) => btoa(JSON.stringify(value)).split('=').join('').split('+').join('-').split('/').join('_');
  const token = (revision: number) => [encode({ alg: 'HS256', typ: 'JWT' }),
    encode({ sub: QA_AUTH_USER, aud: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600, revision }), encode('firma-ficticia')].join('.');
  const fetch = vi.fn<typeof globalThis.fetch>(async input => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname !== 'auth.example.invalid') throw new Error('Destino de QA no permitido.');
    if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
    const body = url.pathname.endsWith('/user') ? user : url.pathname.endsWith('/token')
      ? { user, access_token: token(2), refresh_token: 'refresh-ficticio-2', expires_in: 3600, token_type: 'bearer' } : null;
    if (!body) throw new Error('Endpoint de QA no permitido.');
    return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const client = createClient('https://auth.example.invalid', 'clave-publica-ficticia', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false,
      storageKey: `soflia-qa-${randomUUID()}` }, global: { fetch },
  });
  return { client, fetch, initial: { access_token: token(1), refresh_token: 'refresh-ficticio-1' } };
}
