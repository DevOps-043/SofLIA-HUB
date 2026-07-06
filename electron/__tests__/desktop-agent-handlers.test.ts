import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import {
  createMockDesktopAgentService,
  expectedDesktopAgentChannels,
} from './desktop-agent-handlers.fixture';

describe('Desktop Agent Handlers Registration', () => {
  let registerDesktopAgentHandlers: any;
  let mockService: ReturnType<typeof createMockDesktopAgentService>;

  beforeEach(async () => {
    vi.clearAllMocks();
    (ipcMain as any)._clearHandlers();

    mockService = createMockDesktopAgentService();
    const mod = await import('../desktop-agent-handlers');
    registerDesktopAgentHandlers = mod.registerDesktopAgentHandlers;
    registerDesktopAgentHandlers(mockService);
  });

  it('CU-144: registers all expected desktop-agent IPC channels', () => {
    const handlers = (ipcMain as any)._getHandlers();

    for (const channel of expectedDesktopAgentChannels) {
      expect(handlers.has(channel), `Missing handler: ${channel}`).toBe(true);
    }
    expect(handlers.size).toBeGreaterThanOrEqual(expectedDesktopAgentChannels.length);
  });

  it('CU-145: execute-task handler calls service.executeTaskDetailed y devuelve outcome', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:execute-task');
    const result = await handler({}, 'click the button');
    expect(result.success).toBe(true);
    expect(result.outcome).toMatchObject({ estado: 'completada' });
    expect(mockService.executeTaskDetailed).toHaveBeenCalledWith('click the button', undefined);
  });

  it('CU-145B: execute-task con presupuesto agotado reporta success=false con outcome', async () => {
    mockService.executeTaskDetailed.mockResolvedValue({
      taskId: 'agent-test',
      estado: 'presupuesto_agotado' as const,
      mensaje: 'Completé 40 pasos de uso de computadora.',
      pasosEjecutados: 40,
      duracionMs: 1000,
    });
    const handler = (ipcMain as any)._getHandler('desktop-agent:execute-task');
    const result = await handler({}, 'tarea larga');
    expect(result.success).toBe(false);
    expect(result.outcome.estado).toBe('presupuesto_agotado');
    expect(result.message).toContain('40 pasos');
  });

  it('CU-146: execute-task handler returns error on failure', async () => {
    mockService.executeTaskDetailed.mockRejectedValue(new Error('Vision failed'));
    const handler = (ipcMain as any)._getHandler('desktop-agent:execute-task');
    const result = await handler({}, 'bad task');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Vision failed');
  });

  it('CU-147: abort handler calls abortAll', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:abort');
    const result = await handler({});
    expect(result.success).toBe(true);
    expect(mockService.abortAll).toHaveBeenCalled();
  });

  it('CU-148: click handler calls mouseClick with coordinates', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:click');
    const result = await handler({}, 100, 200);
    expect(result.success).toBe(true);
    expect(mockService.mouseClick).toHaveBeenCalledWith(100, 200);
  });

  it('CU-149: set-config handler calls setConfig and returns updated config', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:set-config');
    const result = await handler({}, { maxSteps: 50 });
    expect(result.success).toBe(true);
    expect(mockService.setConfig).toHaveBeenCalledWith({ maxSteps: 50 });
  });

  it('CU-150: take-screenshot handler returns base64 data', async () => {
    const handler = (ipcMain as any)._getHandler('desktop-agent:take-screenshot');
    const result = await handler({}, false);
    expect(result.success).toBe(true);
    expect(result.data).toBe('base64data');
    expect(mockService.takeScreenshot).toHaveBeenCalledWith(false);
  });
});
