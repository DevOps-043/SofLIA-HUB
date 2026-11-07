import { describe, expect, it, vi } from 'vitest';
import { createSafeIpc } from '../preload/safe-ipc';
import { exposeComputerApis } from '../preload/computer-apis';
import { exposeDesktopApi } from '../preload/desktop-apis';
import { exposeRemoteApis } from '../preload/remote-apis';
import type { ComputerUseApi } from '../../src/shared/computer-use';
import type { DesktopAgentApi } from '../../src/shared/desktop-agent';
import type { RemoteNodeApi } from '../../src/shared/remote-node';

function fixture() {
  const exposed = new Map<string, unknown>();
  const invoke = vi.fn<(channel: string, ...args: unknown[]) => Promise<unknown>>();
  const ipc = createSafeIpc({ invoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeAllListeners: vi.fn() });
  const bridge = { exposeInMainWorld: (key: string, value: unknown) => { exposed.set(key, value); } };
  exposeComputerApis(bridge, ipc); exposeDesktopApi(bridge, ipc); exposeRemoteApis(bridge, ipc);
  return { invoke, ipc,
    computer: exposed.get('computerUse') as ComputerUseApi,
    desktop: exposed.get('desktopAgent') as DesktopAgentApi,
    remote: exposed.get('remoteNode') as RemoteNodeApi,
  };
}
describe('Contratos de automatización sobre preload y allowlist reales', () => {
  it('preserva opciones y respuesta extensible Computer Use', async () => {
    const { computer, invoke } = fixture();
    const result = { success: true, content: 'Contenido ficticio', extra: { count: 1 } };
    invoke.mockResolvedValue(result);
    expect(await computer.readFile('documento-ficticio.txt')).toEqual(result);
    expect(invoke).toHaveBeenCalledWith('computer:read-file', 'documento-ficticio.txt');
    await computer.createWordDocument({ title: 'Prueba', open_after_save: false });
    expect(invoke).toHaveBeenLastCalledWith('computer:create-word-document', { title: 'Prueba', open_after_save: false });
  });
  it('preserva opciones serializables y resultados Desktop', async () => {
    const { desktop, invoke } = fixture();
    const result = { success: false, error: 'Tarea rechazada' }; invoke.mockResolvedValue(result);
    expect(await desktop.executeTask('Tarea ficticia', { backend: 'browser', maxSteps: 3 })).toEqual(result);
    expect(invoke).toHaveBeenCalledWith('desktop-agent:execute-task', 'Tarea ficticia', { backend: 'browser', maxSteps: 3 });
    await desktop.scroll('down', 2);
    expect(invoke).toHaveBeenLastCalledWith('desktop-agent:scroll', 'down', 2);
  });
  it('conserva campos manuales de emparejamiento y fallos de transporte Remote', async () => {
    const { remote, invoke } = fixture();
    const result = { success: true, token: 'credencial-ficticia' }; invoke.mockResolvedValue(result);
    expect(await remote.getHostStatus()).toEqual(result);
    expect(invoke).toHaveBeenCalledWith('remote-node:get-host-status');
    invoke.mockRejectedValue(new Error('Nodo no disponible'));
    await expect(remote.takeScreenshot('nodo-ficticio', { display_id: 'pantalla-ficticia' })).rejects.toThrow('Nodo no disponible');
    expect(invoke).toHaveBeenLastCalledWith('remote-node:take-screenshot', 'nodo-ficticio', { display_id: 'pantalla-ficticia' });
  });
  it('bloquea canales ajenos a la allowlist sin invocar transporte', () => {
    const { ipc, invoke } = fixture();
    expect(() => ipc.safeInvoke('automation:execute-arbitrary')).toThrow();
    expect(invoke).not.toHaveBeenCalled();
  });
});
