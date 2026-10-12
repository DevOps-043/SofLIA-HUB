import { describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import { registerSkillWorkspaceHandlers } from '../skill-workspace-handlers';
import { SkillWorkspaceService } from '../skill-workspace/service';
import { ALLOWED_IPC_CHANNELS } from '../preload/channels';
import { exposeSkillWorkspaceApi } from '../preload/skill-workspace-api';

const renderer = vi.hoisted(() => ({ render: vi.fn(async () => ({ frames: 1800, path: 'salida/video.mp4' })), cancel: vi.fn(() => true), stop: vi.fn() }));
vi.mock('../audiovisual/service', () => ({ AudiovisualService: class { render = renderer.render; cancel = renderer.cancel; stop = renderer.stop; } }));

describe('IPC de producción audiovisual', () => {
  it('valida payload estricto, responde errores y conserva la allowlist', async () => {
    registerSkillWorkspaceHandlers(new SkillWorkspaceService('C:/temporal-inactivo'), () => null);
    const handler = vi.mocked(ipcMain.handle).mock.calls.find(call => call[0] === 'audiovisual:render')?.[1]; if (!handler) throw new Error('Falta el handler.');
    expect((await handler({} as never, { workspaceId: 'demo', executable: 'shell' })).success).toBe(false);
    expect(renderer.render).not.toHaveBeenCalled();
    expect((await handler({} as never, { workspaceId: '../otro' })).success).toBe(false);
    expect((await handler({} as never, { workspaceId: 'demo' })).success).toBe(true);
    renderer.render.mockRejectedValueOnce(new Error('No existe el workspace.'));
    expect(await handler({} as never, { workspaceId: 'demo' })).toMatchObject({ success: false, error: 'No existe el workspace.' });
    for (const channel of ['audiovisual:render', 'audiovisual:cancel', 'presentation:export-pptx']) expect(ALLOWED_IPC_CHANNELS).toContain(channel);
    expect(ALLOWED_IPC_CHANNELS).not.toContain('audiovisual:execute');
  });
  it('preload solo transmite el identificador del workspace', async () => {
    const exposed = new Map<string, Record<string, (...args: unknown[]) => unknown>>();
    const safeInvoke = vi.fn(async () => ({ success: true }));
    exposeSkillWorkspaceApi({ exposeInMainWorld: (name, api) => { exposed.set(name, api as never); } }, { safeInvoke, safeOn: vi.fn() } as never);
    await exposed.get('skillWorkspace')!.renderVideo('demo');
    expect(safeInvoke).toHaveBeenCalledWith('audiovisual:render', { workspaceId: 'demo' });
    await exposed.get('skillWorkspace')!.cancelVideo('demo');
    expect(safeInvoke).toHaveBeenCalledWith('audiovisual:cancel', { workspaceId: 'demo' });
  });
});
