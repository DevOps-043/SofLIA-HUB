import { describe, expect, it, vi } from 'vitest';
import { MediaInputService } from '../media-input/service';
const input = { path: '/archivo-ficticio.mp4', mimeType: 'video/mp4', apiKey: 'clave-nativa-ficticia-de-pruebas' };
function fixture() {
  const releases: Array<(value: { name: string; state: string; uri: string }) => void> = [];
  const rejects: Array<(error: Error) => void> = [];
  const upload = vi.fn(() => new Promise<{ name: string; state: string; uri: string }>((resolve, reject) => { releases.push(resolve); rejects.push(reject); }));
  const remove = vi.fn(async () => ({})); const construct = vi.fn();
  class GoogleGenAI { constructor() { construct(); } files = { upload, get: vi.fn(async () => ({})), delete: remove }; }
  const service = new MediaInputService({ loadSdk: () => ({ GoogleGenAI }), statFile: async () => ({ size: 10 }) });
  return { service, releases, rejects, upload, construct, remove };
}
describe('Recursos físicos de medios', () => {
  it('limita cuatro subidas y conserva plazas aunque se invalide sesión', async () => {
    const f = fixture(); const jobs = Array.from({ length: 4 }, () => f.service.upload(input)); const outcomes = Promise.allSettled(jobs);
    await vi.waitFor(() => expect(f.upload).toHaveBeenCalledTimes(4));
    await expect(f.service.upload(input)).rejects.toThrow(); expect(f.upload).toHaveBeenCalledTimes(4);
    f.service.invalidateSession(); await expect(f.service.upload(input)).rejects.toThrow();
    f.releases.forEach((finish, i) => finish({ name: `files/${i}`, state: 'ACTIVE', uri: 'https://archivo.invalid' }));
    expect((await outcomes).every(result => result.status === 'rejected')).toBe(true);
    const next = f.service.upload(input); await vi.waitFor(() => expect(f.upload).toHaveBeenCalledTimes(5)); f.releases[4]({ name: 'files/next', state: 'ACTIVE', uri: 'https://archivo.invalid' }); expect((await next).state).toBe('ready');
  });
  it('no restaura registros cuando el proveedor falla tras invalidar sesión', async () => {
    const f = fixture();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(1234);
    try {
      const pending = f.service.upload(input);
      const outcome = expect(pending).rejects.toThrow('sesión');
      await vi.waitFor(() => expect(f.upload).toHaveBeenCalledTimes(1));
      expect(f.service.status('media-1-1234')?.state).toBe('processing');
      f.service.invalidateSession();
      f.rejects[0](new Error('Fallo tardío ficticio'));
      await outcome;
      expect(f.service.status('media-1-1234')).toBeNull();
    } finally { clock.mockRestore(); }
  });
  it('no restaura cancelaciones cuando la sesión termina durante el borrado remoto', async () => {
    const f = fixture();
    let finishDelete: () => void = () => {};
    f.remove.mockImplementation(() => new Promise(resolve => { finishDelete = () => resolve({}); }));
    const clock = vi.spyOn(Date, 'now').mockReturnValue(5678);
    try {
      const pending = f.service.upload(input);
      const outcome = Promise.allSettled([pending]);
      await vi.waitFor(() => expect(f.upload).toHaveBeenCalledTimes(1));
      f.service.cancel('media-1-5678');
      f.releases[0]({ name: 'files/cancelled', state: 'ACTIVE', uri: 'https://archivo.invalid' });
      await vi.waitFor(() => expect(f.remove).toHaveBeenCalledTimes(1));
      f.service.invalidateSession();
      finishDelete();
      expect((await outcome)[0].status).toBe('rejected');
      expect(f.service.status('media-1-5678')).toBeNull();
    } finally { clock.mockRestore(); }
  });
  it('no retiene una caché de clientes indexada por clave', async () => {
    const f = fixture(); const first = f.service.upload(input); await vi.waitFor(() => expect(f.upload).toHaveBeenCalledTimes(1)); f.releases[0]({ name: 'files/one', state: 'ACTIVE', uri: 'https://archivo.invalid' }); await first;
    const second = f.service.upload(input); await vi.waitFor(() => expect(f.upload).toHaveBeenCalledTimes(2)); f.releases[1]({ name: 'files/two', state: 'ACTIVE', uri: 'https://archivo.invalid' }); await second;
    expect(f.construct).toHaveBeenCalledTimes(2);
  });
});
