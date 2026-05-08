import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSupabaseFetch } from '../../shared/supabase-http';

describe('createSupabaseFetch', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('reintenta lecturas idempotentes ante respuestas transitorias', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    globalThis.fetch = fetchMock;

    const fetch = createSupabaseFetch({ retryBaseDelayMs: 1 });
    const response = await fetch('https://example.supabase.co/rest/v1/teams');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('no reintenta escrituras para evitar duplicados', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 503 }));
    globalThis.fetch = fetchMock;

    const fetch = createSupabaseFetch({ retryBaseDelayMs: 1 });
    const response = await fetch('https://example.supabase.co/rest/v1/task_issues', {
      method: 'POST',
      body: JSON.stringify({ title: 'Nueva tarea' }),
    });

    expect(response.status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
