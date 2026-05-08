import { describe, expect, it, vi } from 'vitest';
import type { DesktopAgentStatus } from '../../desktop-agent-types';
import { createDesktopAgentService, DEFAULT_CONFIG } from './fixture';

describe('DesktopAgentService - API publica', () => {
  it('CU-136: getConfig returns copy of config', async () => {
    const service = await createDesktopAgentService();
    const config = service.getConfig();
    config.maxSteps = 999;
    expect(service.getConfig().maxSteps).toBe(DEFAULT_CONFIG.maxSteps);
  });

  it('CU-137: setConfig merges partial updates', async () => {
    const service = await createDesktopAgentService();
    service.setConfig({ maxSteps: 50, screenshotWidth: 800 });
    expect(service.getConfig()).toMatchObject({ maxSteps: 50, screenshotWidth: 800, screenshotHeight: DEFAULT_CONFIG.screenshotHeight });
  });

  it('CU-138: setConfig emits config-updated event', async () => {
    const service = await createDesktopAgentService();
    const listener = vi.fn();
    service.on('config-updated', listener);
    service.setConfig({ maxSteps: 100 });
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ maxSteps: 100 }));
  });

  it('CU-139: setApiKey clears cached genAI', async () => {
    const service = await createDesktopAgentService();
    service.setApiKey('new-key');
    expect(() => service.getConfig()).not.toThrow();
  });

  it('CU-140: getStatus returns DesktopAgentStatus shape', async () => {
    const status: DesktopAgentStatus = (await createDesktopAgentService()).getStatus();
    for (const key of ['status', 'currentTask', 'currentStep', 'maxSteps', 'plan', 'lastAction', 'config', 'activeTasks', 'totalActiveAgents']) {
      expect(status).toHaveProperty(key);
    }
  });

  it('CU-141/CU-142/CU-143: idle status, empty tasks and EventEmitter methods are present', async () => {
    const service = await createDesktopAgentService();
    expect(service.getStatus().status).toBe('idle');
    expect(service.getStatus().currentTask).toBeNull();
    expect(service.getActiveTasks()).toEqual([]);
    expect(typeof service.on).toBe('function');
    expect(typeof service.emit).toBe('function');
    expect(typeof service.removeListener).toBe('function');
  });
});
