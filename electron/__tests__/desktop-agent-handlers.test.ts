import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain, dialog, type IpcMainInvokeEvent } from 'electron';
import { authSourceFixture } from './helpers/auth-source.fixture';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { registerDesktopAgentHandlers } from '../desktop-agent-handlers';
import type { DesktopAgentService } from '../desktop-agent-service';
import {
  createMockDesktopAgentService,
  expectedDesktopAgentChannels,
} from './desktop-agent-handlers.fixture';

describe('Desktop Agent Handlers Registration', () => {
  let hub: ReturnType<typeof authSourceFixture>;
  let mockService: ReturnType<typeof createMockDesktopAgentService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    (ipcMain as unknown as { _clearHandlers(): void; _getHandlers(): Map<string, unknown>; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> })._clearHandlers();

    mockService = createMockDesktopAgentService();
    resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-qa' }); hub = authSourceFixture();
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 1, checkboxChecked: false });
    registerDesktopAgentHandlers(mockService as unknown as DesktopAgentService, () => hub.window);
  });

  it('CU-144: registers all expected desktop-agent IPC channels', () => {
    const handlers = (ipcMain as unknown as { _clearHandlers(): void; _getHandlers(): Map<string, unknown>; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> })._getHandlers();

    for (const channel of expectedDesktopAgentChannels) {
      expect(handlers.has(channel), `Missing handler: ${channel}`).toBe(true);
    }
    expect(handlers.size).toBeGreaterThanOrEqual(expectedDesktopAgentChannels.length);
  });

  it('CU-145: execute-task handler calls service.executeTaskDetailed y devuelve outcome', async () => {
    const handler = (ipcMain as unknown as { _clearHandlers(): void; _getHandlers(): Map<string, unknown>; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> })._getHandler('desktop-agent:execute-task');
    const result = await handler(hub.event, 'click the button');
    expect(result.success).toBe(true);
    expect(result.outcome).toMatchObject({ estado: 'completada' });
    expect(mockService.executeTaskDetailed).toHaveBeenCalledWith('click the button', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it('CU-145B: execute-task con presupuesto agotado reporta success=false con outcome', async () => {
    mockService.executeTaskDetailed.mockResolvedValue({
      taskId: 'agent-test',
      estado: 'presupuesto_agotado' as const,
      mensaje: 'Completé 40 pasos de uso de computadora.',
      pasosEjecutados: 40,
      duracionMs: 1000,
    });
    const handler = (ipcMain as unknown as { _clearHandlers(): void; _getHandlers(): Map<string, unknown>; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> })._getHandler('desktop-agent:execute-task');
    const result = await handler(hub.event, 'tarea larga');
    expect(result.success).toBe(false);
    expect((result.outcome as { estado: string }).estado).toBe('presupuesto_agotado');
    expect(result.message).toContain('40 pasos');
  });

  it('CU-146: execute-task handler returns error on failure', async () => {
    mockService.executeTaskDetailed.mockRejectedValue(new Error('Vision failed'));
    const handler = (ipcMain as unknown as { _clearHandlers(): void; _getHandlers(): Map<string, unknown>; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> })._getHandler('desktop-agent:execute-task');
    const result = await handler(hub.event, 'bad task');
    expect(result.success).toBe(false);
    expect(result.error).toBe('DESKTOP_FAILED');
  });

  it('CU-147: abort handler calls abortAll', async () => {
    const handler = (ipcMain as unknown as { _clearHandlers(): void; _getHandlers(): Map<string, unknown>; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> })._getHandler('desktop-agent:abort');
    const result = await handler(hub.event);
    expect(result.success).toBe(true);
    expect(mockService.abortAll).toHaveBeenCalled();
  });

  it('CU-148: click handler calls mouseClick with coordinates', async () => {
    const handler = (ipcMain as unknown as { _clearHandlers(): void; _getHandlers(): Map<string, unknown>; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> })._getHandler('desktop-agent:click');
    const result = await handler(hub.event, 100, 200);
    expect(result.success).toBe(true);
    expect(mockService.mouseClick).toHaveBeenCalledWith(100, 200);
  });

  it('CU-149: set-config handler calls setConfig and returns updated config', async () => {
    const handler = (ipcMain as unknown as { _clearHandlers(): void; _getHandlers(): Map<string, unknown>; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> })._getHandler('desktop-agent:set-config');
    const result = await handler(hub.event, { maxSteps: 50 });
    expect(result.success).toBe(true);
    expect(mockService.setConfig).toHaveBeenCalledWith({ maxSteps: 50 });
  });

  it('CU-150: take-screenshot handler returns base64 data', async () => {
    const handler = (ipcMain as unknown as { _clearHandlers(): void; _getHandlers(): Map<string, unknown>; _getHandler(name: string): (event: IpcMainInvokeEvent, ...args: unknown[]) => Promise<Record<string, unknown>> })._getHandler('desktop-agent:take-screenshot');
    const result = await handler(hub.event, false);
    expect(result.success).toBe(true);
    expect(result.data).toBe('base64data');
    expect(mockService.takeScreenshot).toHaveBeenCalledWith(false);
  });
});
