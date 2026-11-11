import { beforeEach, describe, expect, it, vi } from 'vitest';
import { legacyChannelFixture, legacyMocks } from './helpers/legacy-channel.fixture';
import { setAuthState } from '../main/auth-state';
import { setOrganizationContext } from '../main/organization-context';
let f: ReturnType<typeof legacyChannelFixture>;
beforeEach(() => { f = legacyChannelFixture(); });
describe('Publicaciones WhatsApp con receptor autorizado', () => {
  it('sin consulta autorizada no publica ni consulta SOFIA', () => { f.wa.emit('qr', 'privado'); expect(f.send()).not.toHaveBeenCalled(); expect(legacyMocks.user).not.toHaveBeenCalled(); });
  it('QR y estado se envían una vez tras verificar rol', async () => {
    await f.call('whatsapp:get-status'); f.wa.emit('qr', 'qr-nuevo'); await vi.waitFor(() => expect(f.send()).toHaveBeenCalledWith('whatsapp:qr', 'qr-nuevo'));
    f.wa.emit('status', f.status); await vi.waitFor(() => expect(f.send()).toHaveBeenCalledTimes(2)); expect(f.send().mock.calls[1][1].lastDeliveryError).toBeUndefined();
  });
  it.each(['logout', 'organizacion', 'navegacion', 'destruccion'])('retira receptor revocado: %s', async mode => {
    await f.call('whatsapp:get-status'); legacyMocks.user.mockClear();
    if (mode === 'logout') { setAuthState({ authenticated: false, userId: null }); setAuthState({ authenticated: true, userId: 'usuario' }); }
    if (mode === 'organizacion') { setOrganizationContext('usuario', 'otra'); setOrganizationContext('usuario', 'org'); }
    if (mode === 'navegacion') f.hub.sender.emit('did-start-navigation', {}, 'https://ajeno.invalid', false, true);
    if (mode === 'destruccion') f.hub.destroy();
    f.wa.emit('qr', 'privado'); await Promise.resolve(); expect(f.send()).not.toHaveBeenCalled(); expect(legacyMocks.user).not.toHaveBeenCalled();
  });
  it('rol revocado no recibe eventos ni resucita sin nuevo permiso', async () => {
    await f.call('whatsapp:get-status'); legacyMocks.user.mockClear(); legacyMocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'member', status: 'active' }], error: null });
    f.wa.emit('qr', 'privado'); await vi.waitFor(() => expect(legacyMocks.user).toHaveBeenCalled()); await new Promise(resolve => setTimeout(resolve, 10)); expect(f.send()).not.toHaveBeenCalled();
    legacyMocks.user.mockClear(); legacyMocks.memberships.mockReturnValue({ data: [{ organization_id: 'org', role: 'owner', status: 'active' }], error: null }); f.wa.emit('qr', 'no-resucita'); await Promise.resolve(); expect(legacyMocks.user).not.toHaveBeenCalled();
  });
  it('coalescer descarta QR viejo y conserva sólo el más reciente', async () => {
    await f.call('whatsapp:get-status'); let finish!: (v: unknown) => void; legacyMocks.user.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); f.wa.emit('qr', 'viejo');
    for (let i = 0; i < 20; i++) f.wa.emit('qr', 'nuevo-' + i); finish({ data: { id: 'usuario' }, error: null }); await vi.waitFor(() => expect(f.send()).toHaveBeenCalledWith('whatsapp:qr', 'nuevo-19')); expect(f.send()).toHaveBeenCalledOnce();
  });
  it('revoca una publicación mientras espera la verificación', async () => {
    await f.call('whatsapp:get-status'); let finish!: (v: unknown) => void; legacyMocks.user.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; })); f.wa.emit('qr', 'privado'); setAuthState({ authenticated: false, userId: null }); finish({ data: { id: 'usuario' }, error: null }); await Promise.resolve(); await Promise.resolve(); expect(f.send()).not.toHaveBeenCalled();
  });
  it('renovar vista no duplica listeners ni emisiones', async () => {
    await f.call('whatsapp:get-status'); const count = f.hub.sender.listenerCount('destroyed'); for (let i = 0; i < 5; i++) await f.call('whatsapp:get-status'); expect(f.hub.sender.listenerCount('destroyed')).toBe(count);
    f.wa.emit('qr', 'único'); await vi.waitFor(() => expect(f.send()).toHaveBeenCalledOnce());
  });
  it('las tres familias comparten ocho plazas físicas', async () => {
    const finishes: ((v: unknown) => void)[] = []; legacyMocks.user.mockImplementation(() => new Promise(resolve => { finishes.push(resolve); }));
    const pending = Array.from({ length: 8 }, (_, i) => f.call(['channels:get-capabilities', 'whatsapp:get-status', 'telegram:get-status'][i % 3])); expect(finishes).toHaveLength(8);
    expect(await f.call('telegram:get-status')).toMatchObject({ success: false }); expect(finishes).toHaveLength(8); for (const finish of finishes) finish({ data: { id: 'usuario' }, error: null }); await Promise.all(pending);
  });
});
