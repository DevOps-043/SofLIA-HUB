import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { subscribeStudioRevisions } from '../learning-studio-realtime';
describe('invalidaciones privadas del estudio', () => {
  it('suscribe solo revisiones de la sesión y libera el canal una sola vez', () => {
    const callbacks: Array<() => void> = []; let status: (value: string) => void = () => {};
    const channel = { on: vi.fn((_event, _filter, callback) => { callbacks.push(callback); return channel; }), subscribe: vi.fn((callback) => { status = callback; return channel; }) };
    const client = { channel: vi.fn(() => channel), removeChannel: vi.fn(async () => 'ok') };
    const notify = vi.fn(), session_id = '00000000-0000-4000-8000-000000000031';
    const stop = subscribeStudioRevisions(client as unknown as SupabaseClient, { organization_slug: 'acme', session_id }, notify);
    expect(channel.on.mock.calls.map(([, filter]) => filter)).toEqual(['INSERT', 'UPDATE'].map((event) => ({ event, schema: 'public', table: 'live_studio_revisions', filter: `session_id=eq.${session_id}` })));
    status('SUBSCRIBED'); callbacks[0]();
    expect(notify.mock.calls).toEqual([[{ session_id, status: 'connected' }], [{ session_id, status: 'changed' }]]);
    stop(); stop(); callbacks[1](); status('CLOSED');
    expect(client.removeChannel).toHaveBeenCalledOnce(); expect(notify).toHaveBeenCalledTimes(2);
  });
});
