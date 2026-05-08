import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentTaskQueue } from '../../agent-task-queue';
import type { ActiveTask } from '../../agent-task-queue';

describe('AgentTaskQueue events and active task tracking', () => {
  let queue: AgentTaskQueue;

  beforeEach(() => {
    queue = new AgentTaskQueue();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    queue.removeAllListeners();
  });

  it('ATQ-006: emits task:added when queued', async () => {
    const statuses: string[] = [];
    queue.on('task:added', (task: any) => statuses.push(task.status));
    await queue.executeWithRetry('event-task', async () => 'ok');
    expect(statuses).toContain('pending');
  });

  it('ATQ-007: emits task:running when execution starts', async () => {
    const statuses: string[] = [];
    queue.on('task:running', (task: any) => statuses.push(task.status));
    await queue.executeWithRetry('run-task', async () => 'ok');
    expect(statuses).toContain('running');
  });

  it('ATQ-008: emits task:completed on success', async () => {
    const completedSpy = vi.fn();
    queue.on('task:completed', completedSpy);
    await queue.executeWithRetry('complete-task', async () => 'done');
    expect(completedSpy).toHaveBeenCalledTimes(1);
    expect(completedSpy.mock.calls[0][0].status).toBe('completed');
  });

  it('ATQ-009: emits task:retrying when a retry is scheduled', async () => {
    const statuses: string[] = [];
    let calls = 0;
    queue.on('task:retrying', (task: any) => statuses.push(task.status));

    const promise = queue.executeWithRetry('retry-event-task', async () => {
      calls++;
      if (calls === 1) throw new Error('fail');
      return 'ok';
    }, 3, 100);

    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(statuses).toContain('retrying');
  });

  it('ATQ-010: emits task:failed after retry exhaustion', async () => {
    const failedSpy = vi.fn();
    queue.on('task:failed', failedSpy);

    const promise = queue.executeWithRetry('fail-event-task', async () => {
      throw new Error('permanent');
    }, 2, 100);
    const completion = promise.catch(() => undefined);

    await vi.advanceTimersByTimeAsync(100);
    await completion;
    expect(failedSpy).toHaveBeenCalledTimes(1);
    expect(failedSpy.mock.calls[0][0].status).toBe('failed');
  });

  it('ATQ-011: generates task ids with task name and random suffix', async () => {
    const addedSpy = vi.fn();
    queue.on('task:added', addedSpy);
    await queue.executeWithRetry('my-task', async () => 'ok');

    const task: ActiveTask = addedSpy.mock.calls[0][0];
    expect(task.id.startsWith('my-task-')).toBe(true);
    const idParts = task.id.split('-');
    expect(idParts[idParts.length - 1]).toMatch(/^[a-z0-9]{1,7}$/);
  });

  it('ATQ-012: tracks concurrent tasks independently', async () => {
    let resolver1: () => void;
    let resolver2: () => void;
    const p1 = queue.executeWithRetry('task-a', async () => new Promise<string>((resolve) => { resolver1 = () => resolve('a'); }));
    const p2 = queue.executeWithRetry('task-b', async () => new Promise<string>((resolve) => { resolver2 = () => resolve('b'); }));

    const activeTasks = queue.listActiveTasks();
    expect(activeTasks.map(t => t.name)).toEqual(expect.arrayContaining(['task-a', 'task-b']));
    resolver1!();
    resolver2!();
    await Promise.all([p1, p2]);
    expect(queue.listActiveTasks()).toHaveLength(0);
  });
});
