import { describe, expect, it, vi } from 'vitest';
import { executeProactiveRecovery } from '../desktop-agent/recovery-runtime';
import { DEFAULT_CONFIG } from '../desktop-agent-types';

describe('Recovery validation', () => {
  it('RV-001: rechaza acciones desconocidas dentro de recovery', async () => {
    const executeAction = vi.fn(async () => {});
    const ai = {
      getGenerativeModel: () => ({
        generateContent: vi.fn(async () => ({
          response: {
            text: () => JSON.stringify({
              strategy: 'alternative_approach',
              actions: [
                { action: 'hover_magic', message: 'accion inventada' },
                { action: 'wait', amount: 1, message: 'esperar' },
              ],
            }),
          },
        })),
      }),
    } as any;

    const ok = await executeProactiveRecovery({
      task: 'test',
      screenshotBase64: 'img',
      reason: 'stuck',
      ai,
      config: { ...DEFAULT_CONFIG },
      currentPlan: null,
      actionHistory: [],
      recovery: { consecutiveFailures: 0, sameScreenCount: 3, lastScreenHash: '', totalRecoveries: 0, lastRecoveryStep: -10 },
      currentStep: 4,
      abortSignal: null,
      emit: vi.fn(),
      setStatus: vi.fn(),
      executeAction,
      delay: vi.fn(async () => {}),
      getErrorMessage: (error) => (error instanceof Error ? error.message : String(error)),
    });

    expect(ok).toBe(true);
    expect(executeAction).toHaveBeenCalledTimes(1);
    expect(executeAction).toHaveBeenCalledWith(expect.objectContaining({ action: 'wait' }));
  });
});
