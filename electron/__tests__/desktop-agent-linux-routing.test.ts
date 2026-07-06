import { describe, expect, it, vi } from 'vitest';
import { detectPlatformCapabilities } from '../platform-capabilities';
import { executeDesktopAgentTaskEntrypoint } from '../desktop-agent/task-entrypoint';

describe('Desktop Agent Linux routing', () => {
  it('LINUX-010: forced UIA backend fails before executing Windows UIA outside Windows', async () => {
    const windowsUIA = {
      executeTask: vi.fn(async () => 'should not run'),
      getLastRunResult: vi.fn(() => null),
    };

    await expect(executeDesktopAgentTaskEntrypoint('abrir explorador de archivos', { backend: 'uia' }, {
      apiKey: 'test-key',
      browserWeb: { executeTask: vi.fn() } as any,
      windowsUIA: windowsUIA as any,
      platformCapabilities: detectPlatformCapabilities('linux', { DISPLAY: ':0', XDG_SESSION_TYPE: 'x11' }),
      config: { keywordRoutingEnabled: true, maxConcurrentAgents: 1, queueTimeoutMs: 1000 } as any,
      activeTasks: new Map(),
      taskQueue: [],
      emit: vi.fn(),
      executeTaskInternal: vi.fn(),
      runDesktopFallbackFromUIA: vi.fn(),
    })).rejects.toThrow(/Windows UI Automation/i);

    expect(windowsUIA.executeTask).not.toHaveBeenCalled();
  });
});

