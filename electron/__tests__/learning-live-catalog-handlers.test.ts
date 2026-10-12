import { ipcMain } from 'electron';
import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ catalog: vi.fn() }));
vi.mock('../iris/clients', () => ({ getSofiaClient: () => null }));
vi.mock('../main/sofia-session', () => ({ getSofiaSessionUserId: () => 'student' }));
vi.mock('../learning-sso', () => ({ readLearningBaseUrl: () => 'https://learning.test' }));
vi.mock('../learning-live-access', () => ({ openLearningLiveSession: vi.fn() }));
vi.mock('../learning-workspace-access', () => ({ requestLearningWorkspace: vi.fn() }));
vi.mock('../learning-live-catalog', () => ({ requestLearningLiveCatalog: mocks.catalog }));
import { registerLearningLiveHandlers } from '../learning-live-handlers';
type Handler = (event: unknown, input: unknown) => Promise<unknown>;
const ipc = ipcMain as unknown as { _getHandler: (name: string) => Handler; _clearHandlers: () => void };
beforeEach(() => { vi.clearAllMocks(); ipc._clearHandlers(); registerLearningLiveHandlers(vi.fn(), vi.fn()); });
describe('handler acotado del catálogo', () => {
  it('valida payload y aplica defaults antes de invocar el servicio', async () => {
    const handler = ipc._getHandler('learning-live:catalog');
    expect(await handler({}, { organization_slug: 'acme', user_id: 'teacher' })).toMatchObject({ success: false, code: 'access_denied' });
    expect(mocks.catalog).not.toHaveBeenCalled();
    mocks.catalog.mockResolvedValueOnce({ success: true, catalog: { sessions: [] } });
    await handler({}, { organization_slug: 'acme' });
    expect(mocks.catalog).toHaveBeenCalledWith({ organization_slug: 'acme', page: 0, view: 'student' }, expect.objectContaining({ baseUrl: 'https://learning.test' }));
  });
  it('limita operaciones simultáneas y libera capacidad al terminar', async () => {
    const handler = ipc._getHandler('learning-live:catalog');
    let finish!: () => void;
    mocks.catalog.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const pending = Array.from({ length: 4 }, () => handler({}, { organization_slug: 'acme' }));
    expect(await handler({}, { organization_slug: 'acme' })).toMatchObject({ success: false, code: 'unavailable' });
    finish(); await pending[3];
    mocks.catalog.mockResolvedValueOnce({ success: true });
    expect(await handler({}, { organization_slug: 'acme' })).toEqual({ success: true });
  });
});
