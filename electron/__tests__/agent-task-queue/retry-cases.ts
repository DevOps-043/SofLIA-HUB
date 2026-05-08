import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentTaskQueue } from '../../agent-task-queue';

describe('AgentTaskQueue retry lifecycle', () => {
  let queue: AgentTaskQueue;

  beforeEach(() => {
    queue = new AgentTaskQueue();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    queue.removeAllListeners();
  });

  it('ATQ-001: resolves when the task succeeds immediately', async () => {
    const fn = vi.fn(async () => 'resultado');
    const result = await queue.executeWithRetry('test-task', fn);
    expect(result).toBe('resultado');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ATQ-002: retries on failure and succeeds on second attempt', async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error('Fallo temporal');
      return 'ok';
    });

    const promise = queue.executeWithRetry('retry-task', fn, 3, 100);
    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('ATQ-003: throws the last error after retries are exhausted', async () => {
    vi.useRealTimers();
    const fn = vi.fn(async () => {
      throw new Error('Fallo permanente');
    });

    await expect(queue.executeWithRetry('fail-task', fn, 2, 10)).rejects.toThrow('Fallo permanente');
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useFakeTimers();
  });

  it('ATQ-004: cancelTask aborts a running task', async () => {
    const fn = vi.fn(async (signal: AbortSignal) => {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(resolve, 10000);
        signal.addEventListener('abort', () => {
          clearTimeout(timer);
          reject(new Error('Aborted'));
        });
      });
      return 'should not reach';
    });

    const promise = queue.executeWithRetry('cancel-task', fn, 3, 100);
    const tasks = queue.listActiveTasks();
    expect(tasks).toHaveLength(1);
    expect(queue.cancelTask(tasks[0].id)).toBe(true);
    await expect(promise).rejects.toThrow(/cancelada/);
  });

  it('ATQ-005: applies exponential backoff between attempts', async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt < 4) throw new Error('fail');
      return 'done';
    });

    const promise = queue.executeWithRetry('backoff-task', fn, 4, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    await expect(promise).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(4);
  });
});
