import { expect, it, vi } from 'vitest';
import type { AgentTaskQueueTestContext } from './types';

export function registerAgentTaskQueueEventTests(ctx: AgentTaskQueueTestContext) {
  it('ATQ-006: emits task:added when a task is queued', async () => {
    const capturedStatuses: string[] = [];
    ctx.getQueue().on('task:added', (task: any) => capturedStatuses.push(task.status));
    await ctx.getQueue().executeWithRetry('event-task', async () => 'ok');
    expect(capturedStatuses).toContain('pending');
  });

  it('ATQ-007: emits task:running when execution starts', async () => {
    const capturedStatuses: string[] = [];
    ctx.getQueue().on('task:running', (task: any) => capturedStatuses.push(task.status));
    await ctx.getQueue().executeWithRetry('run-task', async () => 'ok');
    expect(capturedStatuses).toContain('running');
  });

  it('ATQ-008: emits task:completed on success', async () => {
    const completedSpy = vi.fn();
    ctx.getQueue().on('task:completed', completedSpy);
    await ctx.getQueue().executeWithRetry('complete-task', async () => 'done');
    expect(completedSpy).toHaveBeenCalledTimes(1);
    expect(completedSpy.mock.calls[0][0].status).toBe('completed');
  });

  it('ATQ-009: emits task:retrying when a retry is scheduled', async () => {
    const capturedStatuses: string[] = [];
    ctx.getQueue().on('task:retrying', (task: any) => capturedStatuses.push(task.status));

    let calls = 0;
    const promise = ctx.getQueue().executeWithRetry('retry-event-task', async () => {
      calls++;
      if (calls === 1) throw new Error('fail');
      return 'ok';
    }, 3, 100);

    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(capturedStatuses).toContain('retrying');
  });

  it('ATQ-010: emits task:failed when retries are exhausted', async () => {
    const failedSpy = vi.fn();
    ctx.getQueue().on('task:failed', failedSpy);

    const promise = ctx.getQueue().executeWithRetry('fail-event-task', async () => {
      throw new Error('permanent');
    }, 2, 100);
    const completion = promise.catch(() => undefined);

    await vi.advanceTimersByTimeAsync(100);
    await completion;
    expect(failedSpy).toHaveBeenCalledTimes(1);
    expect(failedSpy.mock.calls[0][0].status).toBe('failed');
  });

  it('ATQ-012: tracks concurrent tasks independently', async () => {
    let resolver1: () => void;
    let resolver2: () => void;
    const queue = ctx.getQueue();

    const p1 = queue.executeWithRetry('task-a', async () => {
      await new Promise<void>((resolve) => { resolver1 = resolve; });
      return 'a';
    });
    const p2 = queue.executeWithRetry('task-b', async () => {
      await new Promise<void>((resolve) => { resolver2 = resolve; });
      return 'b';
    });

    expect(queue.listActiveTasks().map((task) => task.name)).toEqual(['task-a', 'task-b']);
    resolver1!();
    resolver2!();
    await Promise.all([p1, p2]);
    expect(queue.listActiveTasks()).toHaveLength(0);
  });

  it('ATQ-013: cancelTask returns false for unknown id', () => {
    expect(ctx.getQueue().cancelTask('non-existent-task-id')).toBe(false);
  });
}
