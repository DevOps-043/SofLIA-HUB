import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ key: vi.fn(), upload: vi.fn(), callbacks: new Set<(event: string) => void>() }));
vi.mock('../../services/api-keys', () => ({ getApiKeyWithCache: mocks.key }));
vi.mock('../../lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: (cb: (event: string) => void) => { mocks.callbacks.add(cb); return { data: { subscription: { unsubscribe: () => { mocks.callbacks.delete(cb); } } } }; } } } }));
import { grantMediaUploadConsent, hasMediaUploadConsent, resetMediaUploadConsent, uploadMedia } from '../../services/media-input-service';
function change() { for (const cb of mocks.callbacks) cb('SIGNED_OUT'); }
beforeEach(() => { resetMediaUploadConsent(); vi.clearAllMocks(); mocks.key.mockResolvedValue('clave-ficticia'); mocks.upload.mockResolvedValue({ success: true, upload: { uploadId: 'uno', state: 'ready' } }); vi.stubGlobal('window', { mediaInput: { upload: mocks.upload } }); });
afterEach(() => { resetMediaUploadConsent(); expect(mocks.callbacks.size).toBe(0); vi.unstubAllGlobals(); });
describe('Consentimiento de medios por sesión', () => {
  it('revoca consentimiento al cambiar sesión', () => { grantMediaUploadConsent(); change(); expect(hasMediaUploadConsent()).toBe(false); });
  it('no envía archivo si se revoca antes del despacho', async () => {
    grantMediaUploadConsent();
    const pending = uploadMedia({ path: '/archivo-ficticio', mimeType: 'video/mp4' }); resetMediaUploadConsent(); await expect(pending).rejects.toThrow(); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('una nueva aprobación no habilita una operación anterior', async () => {
    grantMediaUploadConsent();
    const pending = uploadMedia({ path: '/archivo-ficticio', mimeType: 'video/mp4' }); change(); grantMediaUploadConsent(); await expect(pending).rejects.toThrow(); expect(mocks.upload).not.toHaveBeenCalled();
  });
  it('rechaza resultado tardío sin afirmar revertir subida enviada', async () => {
    let finish!: (value: unknown) => void; mocks.upload.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); grantMediaUploadConsent();
    const pending = uploadMedia({ path: '/archivo-ficticio', mimeType: 'video/mp4' }); await vi.waitFor(() => expect(mocks.upload).toHaveBeenCalled()); change(); finish({ success: true, upload: { uploadId: 'anterior' } }); await expect(pending).rejects.toThrow();
  });
  it('permite envío autorizado y sólo mantiene una suscripción', async () => { grantMediaUploadConsent(); grantMediaUploadConsent(); expect(mocks.callbacks.size).toBe(1); expect((await uploadMedia({ path: '/archivo-ficticio', mimeType: 'video/mp4' })).uploadId).toBe('uno'); });
});
