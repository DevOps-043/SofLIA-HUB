import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { useTelegramConnection } from '../../components/connections-panel/useTelegramConnection';
import type { TelegramApi, TelegramStatusSnapshot } from '../../shared/legacy-communication';
const snapshot = (): TelegramStatusSnapshot => ({ success: true, configured: true, enabled: true, polling: false, poll_interval_ms: 1000, allowed_chat_ids: [], last_poll_at: null, last_error: null, bot: null, recent_chats: [], available_agents: [] });
let api: { [K in keyof TelegramApi]: ReturnType<typeof vi.fn<TelegramApi[K]>> };
beforeEach(() => {
  api = { getStatus: vi.fn(async () => snapshot()), updateConfig: vi.fn(async () => snapshot()), testConnection: vi.fn(async () => ({ success: false })), sendMessage: vi.fn(async () => ({ success: false })), listRecentChats: vi.fn(async () => ({ success: true, chats: [] })) };
  Object.defineProperty(window, 'telegram', { value: api, configurable: true });
});
afterEach(() => { Reflect.deleteProperty(window, 'telegram'); vi.restoreAllMocks(); });
async function fixture() { const hook = renderHook(({ userId }) => useTelegramConnection({ userId, organizationId: 'org' }), { initialProps: { userId: 'a' } }); await waitFor(() => expect(hook.result.current.status).not.toBeNull()); return hook; }
describe('Panel de Telegram', () => {
  it('una configuración cancelada no inicia la prueba ni borra el token escrito', async () => {
    const { result } = await fixture(); act(() => result.current.setTokenInput('clave-ficticia'));
    api.updateConfig.mockResolvedValueOnce({ ...snapshot(), success: false, error: 'Cancelado' });
    await act(() => result.current.saveToken());
    expect(api.testConnection).not.toHaveBeenCalled(); expect(result.current.tokenInput).toBe('clave-ficticia'); expect(result.current.error).toBe('Cancelado'); expect(result.current.testing).toBe(false);
  });
  it('una desconexión cancelada conserva el estado confirmado', async () => {
    const { result } = await fixture(); api.updateConfig.mockResolvedValueOnce({ ...snapshot(), success: false, error: 'Cancelado' });
    await act(() => result.current.disconnect()); expect(api.updateConfig).toHaveBeenCalledWith({ enabled: false, bot_token: '' }); expect(result.current.status?.enabled).toBe(true); expect(result.current.error).toBe('Cancelado');
  });
  it('al cambiar actor descarta una respuesta anterior y limpia el borrador', async () => {
    const { result, rerender } = await fixture(); let finish!: (value: TelegramStatusSnapshot) => void;
    api.updateConfig.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    act(() => result.current.setTokenInput('clave-anterior')); let pending!: Promise<void>; act(() => { pending = result.current.saveToken(); });
    rerender({ userId: 'b' }); await act(async () => { finish(snapshot()); await pending; });
    expect(result.current.tokenInput).toBe(''); expect(api.testConnection).not.toHaveBeenCalled(); expect(result.current.testing).toBe(false);
  });
});
