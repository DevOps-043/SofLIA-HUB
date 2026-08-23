import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain } from 'electron';
import { registerProjectHubHandlers } from '../project-hub-handlers';
import type { ProjectHubApiService } from '../project-hub';

type HandlerResult = { code?: string; [key: string]: unknown };
type Handler = (event: { sender: { id: number } }, payload?: unknown) => Promise<HandlerResult>;
const harness = ipcMain as unknown as { _clearHandlers: () => void; _getHandlers: () => Map<string, Handler> };

describe('IPC de Project Hub', () => {
  const service = {
    getStatus: vi.fn(() => ({ configured: true, authenticated: true, workspaces: [] })),
    listProjects: vi.fn(async () => ({ success: true, data: [] })),
    createProject: vi.fn(async () => ({ success: true, data: { project_id: crypto.randomUUID() } })),
  } as unknown as ProjectHubApiService;
  let window: InstanceType<typeof BrowserWindow>;

  beforeEach(() => {
    vi.clearAllMocks();
    harness._clearHandlers();
    window = new BrowserWindow();
    registerProjectHubHandlers(service, () => window);
  });

  it('registra la superficie acotada', () => {
    const channels = [...harness._getHandlers().keys()].filter((value) => value.startsWith('project-hub:'));
    expect(channels).toContain('project-hub:list-projects');
    expect(channels).toContain('project-hub:import-meeting');
    expect(channels).not.toContain('project-hub:request');
  });

  it('entrega una lista al sender autorizado', async () => {
    const handler = harness._getHandlers().get('project-hub:list-projects')!;
    const result = await handler({ sender: window.webContents }, { workspaceId: crypto.randomUUID() });
    expect(result).toEqual({ success: true, data: [] });
  });

  it('rechaza payload inválido antes de llamar al servicio', async () => {
    const handler = harness._getHandlers().get('project-hub:create-project')!;
    const result = await handler({ sender: window.webContents }, { workspaceId: 'no-uuid', project: {} });
    expect(result.code).toBe('INVALID_PAYLOAD');
    expect(service.createProject).not.toHaveBeenCalled();
  });

  it('rechaza una ventana distinta', async () => {
    const handler = harness._getHandlers().get('project-hub:list-projects')!;
    const result = await handler({ sender: { id: window.webContents.id + 10 } }, { workspaceId: crypto.randomUUID() });
    expect(result.code).toBe('IPC_DENIED');
    expect(service.listProjects).not.toHaveBeenCalled();
  });
});
