import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  AgentTaskQueue,
  agentTaskQueue,
  TASK_QUEUE_TOOLS,
  handleTaskQueueTool,
} from '../agent-task-queue';
import type { ActiveTask } from '../agent-task-queue';

// ============================================================================
// AgentTaskQueue Tests
// Tests for electron/agent-task-queue.ts — retry logic, exponential backoff,
// cancellation, events, and tool handler.
// ============================================================================

describe('AgentTaskQueue', () => {
  let queue: AgentTaskQueue;

  beforeEach(() => {
    queue = new AgentTaskQueue();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    queue.removeAllListeners();
  });

  // --------------------------------------------------------------------------
  // ATQ-001: Successful execution on first attempt
  // --------------------------------------------------------------------------
  describe('ATQ-001: Success on first attempt', () => {
    it('should resolve with the result when the task succeeds immediately', async () => {
      const fn = vi.fn(async () => 'resultado');
      const promise = queue.executeWithRetry('test-task', fn);
      const result = await promise;
      expect(result).toBe('resultado');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-002: Retry then success
  // --------------------------------------------------------------------------
  describe('ATQ-002: Retry then success', () => {
    it('should retry on failure and succeed on second attempt', async () => {
      let callCount = 0;
      const fn = vi.fn(async () => {
        callCount++;
        if (callCount === 1) throw new Error('Fallo temporal');
        return 'ok';
      });

      const promise = queue.executeWithRetry('retry-task', fn, 3, 100);
      // First attempt fails, then backoff delay of 100ms
      await vi.advanceTimersByTimeAsync(100);
      const result = await promise;
      expect(result).toBe('ok');
      expect(fn).toHaveBeenCalledTimes(2);
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-003: All retries exhausted — throws last error
  // --------------------------------------------------------------------------
  describe('ATQ-003: All retries exhausted', () => {
    it('should throw the last error after all retries are exhausted', async () => {
      vi.useRealTimers();
      const fn = vi.fn(async () => {
        throw new Error('Fallo permanente');
      });

      await expect(
        queue.executeWithRetry('fail-task', fn, 2, 10)
      ).rejects.toThrow('Fallo permanente');
      expect(fn).toHaveBeenCalledTimes(2);
      vi.useFakeTimers();
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-004: Cancellation via cancelTask
  // --------------------------------------------------------------------------
  describe('ATQ-004: Cancellation via cancelTask', () => {
    it('should cancel a running task and throw cancellation error', async () => {
      const fn = vi.fn(async (signal: AbortSignal) => {
        // Simulate a long-running task
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
      // Get the task ID
      const tasks = queue.listActiveTasks();
      expect(tasks.length).toBe(1);

      const cancelled = queue.cancelTask(tasks[0].id);
      expect(cancelled).toBe(true);

      await expect(promise).rejects.toThrow(/cancelada/);
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-005: Exponential backoff timing
  // --------------------------------------------------------------------------
  describe('ATQ-005: Exponential backoff timing', () => {
    it('should use exponential backoff: baseDelay * 2^(attempt-1)', async () => {
      let attempt = 0;
      const fn = vi.fn(async () => {
        attempt++;
        if (attempt < 4) throw new Error('fail');
        return 'done';
      });

      const baseDelay = 1000;
      const promise = queue.executeWithRetry('backoff-task', fn, 4, baseDelay);

      // After attempt 1 fails: delay = 1000 * 2^0 = 1000ms
      await vi.advanceTimersByTimeAsync(1000);
      // After attempt 2 fails: delay = 1000 * 2^1 = 2000ms
      await vi.advanceTimersByTimeAsync(2000);
      // After attempt 3 fails: delay = 1000 * 2^2 = 4000ms
      await vi.advanceTimersByTimeAsync(4000);

      const result = await promise;
      expect(result).toBe('done');
      expect(fn).toHaveBeenCalledTimes(4);
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-006: Events — task:added emitted
  // --------------------------------------------------------------------------
  describe('ATQ-006: task:added event', () => {
    it('should emit task:added when a task is queued', async () => {
      const capturedStatuses: string[] = [];
      queue.on('task:added', (task: any) => capturedStatuses.push(task.status));

      await queue.executeWithRetry('event-task', async () => 'ok');

      expect(capturedStatuses).toContain('pending');
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-007: Events — task:running emitted
  // --------------------------------------------------------------------------
  describe('ATQ-007: task:running event', () => {
    it('should emit task:running when execution starts', async () => {
      const capturedStatuses: string[] = [];
      queue.on('task:running', (task: any) => capturedStatuses.push(task.status));

      await queue.executeWithRetry('run-task', async () => 'ok');

      expect(capturedStatuses).toContain('running');
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-008: Events — task:completed emitted
  // --------------------------------------------------------------------------
  describe('ATQ-008: task:completed event', () => {
    it('should emit task:completed on success', async () => {
      const completedSpy = vi.fn();
      queue.on('task:completed', completedSpy);

      await queue.executeWithRetry('complete-task', async () => 'done');

      expect(completedSpy).toHaveBeenCalledTimes(1);
      expect(completedSpy.mock.calls[0][0].status).toBe('completed');
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-009: Events — task:retrying emitted
  // --------------------------------------------------------------------------
  describe('ATQ-009: task:retrying event', () => {
    it('should emit task:retrying when a retry is scheduled', async () => {
      const capturedStatuses: string[] = [];
      queue.on('task:retrying', (task: any) => capturedStatuses.push(task.status));

      let calls = 0;
      const promise = queue.executeWithRetry(
        'retry-event-task',
        async () => {
          calls++;
          if (calls === 1) throw new Error('fail');
          return 'ok';
        },
        3,
        100
      );

      await vi.advanceTimersByTimeAsync(100);
      await promise;

      expect(capturedStatuses).toContain('retrying');
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-010: Events — task:failed emitted
  // --------------------------------------------------------------------------
  describe('ATQ-010: task:failed event', () => {
    it('should emit task:failed when all retries are exhausted', async () => {
      const failedSpy = vi.fn();
      queue.on('task:failed', failedSpy);

      const promise = queue.executeWithRetry(
        'fail-event-task',
        async () => { throw new Error('permanent'); },
        2,
        100
      );
      const completion = promise.catch(() => undefined);

      await vi.advanceTimersByTimeAsync(100);
      await completion;

      expect(failedSpy).toHaveBeenCalledTimes(1);
      expect(failedSpy.mock.calls[0][0].status).toBe('failed');
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-011: TaskId format
  // --------------------------------------------------------------------------
  describe('ATQ-011: TaskId format', () => {
    it('should generate taskId as taskName-timestamp-random7chars', async () => {
      const addedSpy = vi.fn();
      queue.on('task:added', addedSpy);

      const promise = queue.executeWithRetry('my-task', async () => 'ok');
      await promise;

      const task: ActiveTask = addedSpy.mock.calls[0][0];
      const idParts = task.id.split('-');
      // Format: my-task-<timestamp>-<random7>
      // "my-task" is 2 parts when split by "-", so total is at least 4 parts
      expect(task.id.startsWith('my-task-')).toBe(true);
      // The random part is the last segment, 7 chars alphanumeric
      const randomPart = idParts[idParts.length - 1];
      expect(randomPart).toMatch(/^[a-z0-9]{1,7}$/);
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-012: listActiveTasks tracks concurrent tasks
  // --------------------------------------------------------------------------
  describe('ATQ-012: Concurrent tasks tracked independently', () => {
    it('should track multiple active tasks simultaneously', async () => {
      // Create tasks that won't resolve immediately
      let resolver1: () => void;
      let resolver2: () => void;

      const p1 = queue.executeWithRetry('task-a', async () => {
        await new Promise<void>((r) => { resolver1 = r; });
        return 'a';
      });

      const p2 = queue.executeWithRetry('task-b', async () => {
        await new Promise<void>((r) => { resolver2 = r; });
        return 'b';
      });

      const activeTasks = queue.listActiveTasks();
      expect(activeTasks.length).toBe(2);
      expect(activeTasks.map(t => t.name)).toContain('task-a');
      expect(activeTasks.map(t => t.name)).toContain('task-b');

      // Resolve both
      resolver1!();
      resolver2!();
      await p1;
      await p2;

      expect(queue.listActiveTasks().length).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-013: cancelTask returns false for unknown id
  // --------------------------------------------------------------------------
  describe('ATQ-013: cancelTask with invalid id', () => {
    it('should return false when cancelling a non-existent task', () => {
      const result = queue.cancelTask('non-existent-task-id');
      expect(result).toBe(false);
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-014: handleTaskQueueTool — list_active_tasks and cancel_background_task
  // --------------------------------------------------------------------------
  describe('ATQ-014: handleTaskQueueTool', () => {
    it('should return empty message for list_active_tasks when no tasks active', async () => {
      const result = await handleTaskQueueTool('list_active_tasks', {});
      expect(result.message).toContain('No hay tareas activas');
    });

    it('should return error for cancel_background_task without taskId', async () => {
      await expect(
        handleTaskQueueTool('cancel_background_task', {})
      ).rejects.toThrow('Se requiere el parámetro "taskId"');
    });

    it('should return success:false for cancel_background_task with unknown taskId', async () => {
      const result = await handleTaskQueueTool('cancel_background_task', { taskId: 'unknown' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('No se encontró');
    });

    it('should throw for unknown tool name', async () => {
      await expect(
        handleTaskQueueTool('unknown_tool', {})
      ).rejects.toThrow("Herramienta 'unknown_tool' no es gestionada");
    });
  });

  // --------------------------------------------------------------------------
  // ATQ-015: TASK_QUEUE_TOOLS structure
  // --------------------------------------------------------------------------
  describe('ATQ-015: TASK_QUEUE_TOOLS structure', () => {
    it('should have exactly 2 tools with correct names and OBJECT parameters', () => {
      expect(TASK_QUEUE_TOOLS).toHaveLength(2);

      const listTool = TASK_QUEUE_TOOLS.find(t => t.name === 'list_active_tasks');
      expect(listTool).toBeDefined();
      expect(listTool!.parameters.type).toBe('OBJECT');
      expect(listTool!.description).toBeTruthy();

      const cancelTool = TASK_QUEUE_TOOLS.find(t => t.name === 'cancel_background_task');
      expect(cancelTool).toBeDefined();
      expect(cancelTool!.parameters.type).toBe('OBJECT');
      expect(cancelTool!.parameters.properties.taskId).toBeDefined();
      expect(cancelTool!.parameters.required).toContain('taskId');
    });

    it('should export agentTaskQueue as a singleton instance', () => {
      expect(agentTaskQueue).toBeInstanceOf(AgentTaskQueue);
    });
  });
});
