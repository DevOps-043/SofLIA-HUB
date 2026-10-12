import { describe, expect, it, vi } from 'vitest';
import { openLearningLiveSession, isZoomSessionUrl } from '../learning-live-access';
import { parseAppProtocolCommand } from '../app-protocol';
import { createRuntimeState } from '../main/runtime-state';

const reference = { organization_slug: 'acme', session_id: '00000000-0000-4000-8000-000000000031' };
function deps() {
  return { baseUrl: 'https://learning.test',
    getIdentity: vi.fn(async () => ({ userId: 'student', accessToken: 'secret-token' })),
    openTab: vi.fn(async () => undefined),
    fetcher: vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ session: { id: reference.session_id, title: 'Clase' }, join_url: 'https://zoom.us/j/123' }))),
  };
}
describe('entrada académica desde Learning', () => {
  it('abre solamente el acceso validado y no devuelve credenciales al renderer', async () => {
    const d = deps(); const result = await openLearningLiveSession(reference, d);
    expect(d.fetcher.mock.calls[0][0]).toBe('https://learning.test/api/auth/live/access');
    expect(d.openTab).toHaveBeenCalledWith('https://zoom.us/j/123');
    expect(result).toEqual({ success: true, title: 'Clase' });
  });
  it('no hace red sin sesión SOFIA', async () => {
    const d = { ...deps(), getIdentity: vi.fn(async () => null) };
    expect((await openLearningLiveSession(reference, d)).code).toBe('not_ready');
    expect(d.fetcher).not.toHaveBeenCalled();
  });
  it('no abre medios después de cambiar o cerrar cuenta', async () => {
    const d = { ...deps(), getIdentity: vi.fn().mockResolvedValueOnce({ userId: 'a', accessToken: 'token' }).mockResolvedValueOnce(null) };
    expect((await openLearningLiveSession(reference, d)).success).toBe(false);
    expect(d.openTab).not.toHaveBeenCalled();
  });
  it.each(['https://zoom.us.evil.test/j/123', 'http://zoom.us/j/123', 'https://name@zoom.us/j/123', 'https://zoom.us:99/j/123'])(
    'rechaza destino remoto %s', (url) => expect(isZoomSessionUrl(url)).toBe(false));
  it('rechaza respuesta para una sesión diferente', async () => {
    const d = deps(); d.fetcher.mockResolvedValue(new Response(JSON.stringify({ session: { id: 'other', title: 'Clase' }, join_url: 'https://zoom.us/j/123' })));
    expect((await openLearningLiveSession(reference, d)).success).toBe(false); expect(d.openTab).not.toHaveBeenCalled();
  });
  it('clasifica caída de Learning y maneja fallo de apertura', async () => {
    const d = deps(); d.fetcher.mockResolvedValueOnce(new Response('', { status: 503 }));
    expect((await openLearningLiveSession(reference, d)).code).toBe('unavailable');
    d.openTab.mockRejectedValueOnce(new Error('native failure'));
    expect((await openLearningLiveSession(reference, d)).error).not.toContain('native failure');
  });
  it('conserva la referencia del arranque frío sin convertirla en monitoreo', () => {
    const command = parseAppProtocolCommand(`soflia://learning-session?organization_slug=acme&session_id=${reference.session_id}`);
    expect(command).toEqual({ type: 'learning-session', payload: reference });
    expect(createRuntimeState(command).pendingLearningSession).toEqual(reference);
  });
  it.each(['&role=host', '&session_id=second', '&url=https://evil.test', '#secret'])(
    'rechaza datos adicionales en protocolo %s', (suffix) => {
      expect(parseAppProtocolCommand(`soflia://learning-session?organization_slug=acme&session_id=${reference.session_id}${suffix}`)).toBeNull();
    });
});
