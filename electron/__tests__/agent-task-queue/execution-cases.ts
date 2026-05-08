import { expect, it, vi } from 'vitest';
import type { ActiveTask } from '../../agent-task-queue';
import type { AgentTaskQueueTestContext } from './types';

export function registerAgentTaskQueueExecutionTests(ctx: AgentTaskQueueTestContext) {
  it('ATQ-001: resolves with result on first attempt', async () => {
    const fn = vi.fn(async () => 'resultado');
    await expect(ctx.getQueue().executeWithRetry('test-task', fn)).resolves.toBe('resultado');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('ATQ-002: retries once and then succeeds', async () => {
    let callCount = 0;
    const fn = vi.fn(async () => {
      callCount++;
      if (callCount === 1) throw new Error('Fallo temporal');
      return 'ok';
    });

    const promise = ctx.getQueue().executeWithRetry('retry-task', fn, 3, 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(promise).resolves.toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('ATQ-003: throws last error when retries are exhausted', async () => {
    vi.useRealTimers();
    const fn = vi.fn(async () => {
      throw new Error('Fallo permanente');
    });

    await expect(ctx.getQueue().executeWithRetry('fail-task', fn, 2, 10))
      .rejects.toThrow('Fallo permanente');
    expect(fn).toHaveBeenCalledTimes(2);
    vi.useFakeTimers();
  });

  it('ATQ-004: cancels a running task', async () => {
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

    const queue = ctx.getQueue();
    const promise = queue.executeWithRetry('cancel-task', fn, 3, 100);
    const tasks = queue.listActiveTasks();
    expect(tasks.length).toBe(1);
    expect(queue.cancelTask(tasks[0].id)).toBe(true);
    await expect(promise).rejects.toThrow(/cancelada/);
  });

  it('ATQ-005: uses exponential backoff between attempts', async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt < 4) throw new Error('fail');
      return 'done';
    });

    const promise = ctx.getQueue().executeWithRetry('backoff-task', fn, 4, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);

    await expect(promise).resolves.toBe('done');
    expect(fn).toHaveBeenCalledTimes(4);
  });

  it('ATQ-011: generates task ids with task name and random suffix', async () => {
    const addedSpy = vi.fn();
    ctx.getQueue().on('task:added', addedSpy);

    await ctx.getQueue().executeWithRetry('my-task', async () => 'ok');

    const task: ActiveTask = addedSpy.mock.calls[0][0];
    const idParts = task.id.split('-');
    const randomPart = idParts[idParts.length - 1];
    expect(task.id.startsWith('my-task-')).toBe(true);
    expect(randomPart).toMatch(/^[a-z0-9]{1,7}$/);
  });
}
