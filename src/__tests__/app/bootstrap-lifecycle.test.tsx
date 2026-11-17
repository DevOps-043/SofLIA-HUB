import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAppBootstrap } from '../../app/useAppBootstrap';

const mocks = vi.hoisted(() => ({ cached: vi.fn(() => null), settings: vi.fn() }));
vi.mock('../../services/settings-service', () => ({ getCachedSettings: mocks.cached, loadSettings: mocks.settings }));
afterEach(() => vi.restoreAllMocks());
const init = vi.fn().mockResolvedValue([]);
function props(userId: string, setUserSettings = vi.fn()) {
  return { userId, orgId: 'org', setUserSettings, chat: { loadInitialConversations: init }, folder: { loadInitialFolders: init } } as unknown as Parameters<typeof useAppBootstrap>[0];
}
describe('Inicialización sin rechazos globales ni ajustes tardíos', () => {
  it('una respuesta antigua no sustituye ajustes de otra sesión', async () => {
    let finish!: (value: unknown) => void;
    mocks.settings.mockReturnValueOnce(new Promise(resolve => { finish = resolve; })).mockResolvedValueOnce({ user_id: 'b' });
    const publish = vi.fn();
    const { rerender } = renderHook(({ userId }) => useAppBootstrap(props(userId, publish)), { initialProps: { userId: 'a' } });
    rerender({ userId: 'b' });
    await act(async () => { await Promise.resolve(); });
    expect(publish).toHaveBeenCalledWith({ user_id: 'b' });
    publish.mockClear();
    await act(async () => { finish({ user_id: 'a' }); });
    expect(publish).not.toHaveBeenCalled();
  });
  it('contiene el fallo de una dependencia y no publica después de desmontar', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.settings.mockRejectedValueOnce(new Error('Sin red'));
    const publish = vi.fn();
    const view = renderHook(() => useAppBootstrap(props('a', publish)));
    await act(async () => { await Promise.resolve(); });
    expect(warning).toHaveBeenCalled(); expect(publish).not.toHaveBeenCalled();
    view.unmount();
  });
});
