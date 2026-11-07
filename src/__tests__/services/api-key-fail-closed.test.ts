import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), upsert: vi.fn(), remove: vi.fn(), eq: vi.fn(), user: vi.fn() }));
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: mocks.rpc, auth: { getUser: mocks.user, onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }) }, from: () => ({ upsert: mocks.upsert, delete: mocks.remove }) } }));
import { getApiKey } from '../../services/api-keys/queries';
import { getApiKeyWithCache } from '../../services/api-keys/cache';
import { saveUserApiKey, deleteUserApiKey } from '../../services/api-keys/mutations';
import * as records from '../../services/api-keys/records';
const secret = 'clave-ficticia error-privado';
beforeEach(() => { vi.resetAllMocks(); mocks.user.mockResolvedValue({ data: { user: { id: 'usuario' } } }); });
afterEach(() => vi.restoreAllMocks());
describe('Errores de credenciales', () => {
  it('distingue RPC fallido de clave ausente sin filtrar detalle', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {}); mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: secret } });
    await expect(getApiKeyWithCache('google')).rejects.toThrow(); expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
    mocks.rpc.mockResolvedValueOnce({ data: null, error: null }); await expect(getApiKey('google')).resolves.toBeNull();
  });
  it('un fallo de transporte no se convierte en clave ausente ni se registra en bruto', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {}); mocks.rpc.mockRejectedValueOnce(new Error(secret));
    await expect(getApiKey()).rejects.toThrow('No se pudo consultar la credencial.'); expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it('rechaza respuesta RPC con tipo incorrecto', async () => { mocks.rpc.mockResolvedValueOnce({ data: { key: secret }, error: null }); await expect(getApiKey()).rejects.toThrow(); });
  it.each(['guardar', 'borrar'])('%s oculta errores del servidor', async operation => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {}); mocks.upsert.mockResolvedValue({ error: { message: secret } }); mocks.eq.mockReturnValueOnce({ eq: mocks.eq }).mockResolvedValue({ error: { message: secret } }); mocks.remove.mockReturnValue({ eq: mocks.eq });
    const result = operation === 'guardar' ? await saveUserApiKey({ provider: 'google', api_key: 'clave-ficticia' }) : await deleteUserApiKey();
    expect(result.success).toBe(false); expect(JSON.stringify(result)).not.toContain(secret); expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it('un fallo de autenticación no revela detalles de sesión', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {}); mocks.user.mockRejectedValueOnce(new Error(secret));
    const result = await saveUserApiKey({ provider: 'google', api_key: 'clave-ficticia' });
    expect(result.success).toBe(false); expect(JSON.stringify(result)).not.toContain(secret); expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  });
  it('el módulo compatible usa las mismas funciones', () => { expect(records.getApiKey).toBe(getApiKey); expect(records.saveUserApiKey).toBe(saveUserApiKey); });
});
