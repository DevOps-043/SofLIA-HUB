import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  resetGeminiResilienceState,
  withGeminiTimeout,
} from '../../services/gemini-chat/resilience';

describe('gemini-chat resilience', () => {
  afterEach(() => {
    vi.useRealTimers();
    resetGeminiResilienceState();
  });

  it('GCHAT-RES-001: resolves successful operations', async () => {
    await expect(withGeminiTimeout('ok', async () => 'done', 100)).resolves.toBe('done');
  });

  it('GCHAT-RES-002: times out slow operations', async () => {
    vi.useFakeTimers();
    const promise = withGeminiTimeout('slow', () => new Promise((resolve) => setTimeout(() => resolve('late'), 1000)), 50);
    const expectation = expect(promise).rejects.toThrow(/tiempo limite/);

    await vi.advanceTimersByTimeAsync(60);
    await expectation;
  });
});
