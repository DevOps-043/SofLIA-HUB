import { describe, expect, it } from 'vitest';
import {
  AgentTaskQueue,
  TASK_QUEUE_TOOLS,
  agentTaskQueue,
  handleTaskQueueTool,
} from '../../agent-task-queue';

describe('AgentTaskQueue tool surface', () => {
  it('ATQ-013: cancelTask returns false for unknown id', () => {
    const queue = new AgentTaskQueue();
    expect(queue.cancelTask('non-existent-task-id')).toBe(false);
  });

  it('ATQ-014A: list_active_tasks reports an empty queue', async () => {
    const result = await handleTaskQueueTool('list_active_tasks', {});
    expect(result.message).toContain('No hay tareas activas');
  });

  it('ATQ-014B: cancel_background_task validates taskId', async () => {
    await expect(handleTaskQueueTool('cancel_background_task', {})).rejects.toThrow('taskId');
  });

  it('ATQ-014C: cancel_background_task reports unknown ids', async () => {
    const result = await handleTaskQueueTool('cancel_background_task', { taskId: 'unknown' });
    expect(result.success).toBe(false);
    expect(result.error).toContain('No se encontr');
  });

  it('ATQ-014D: rejects unknown task queue tools', async () => {
    await expect(handleTaskQueueTool('unknown_tool', {})).rejects.toThrow("Herramienta 'unknown_tool' no es gestionada");
  });

  it('ATQ-015: exposes the two task queue tool declarations and singleton', () => {
    expect(TASK_QUEUE_TOOLS).toHaveLength(2);
    const listTool = TASK_QUEUE_TOOLS.find(t => t.name === 'list_active_tasks');
    const cancelTool = TASK_QUEUE_TOOLS.find(t => t.name === 'cancel_background_task');

    expect(listTool?.parameters.type).toBe('OBJECT');
    expect(cancelTool?.parameters.properties.taskId).toBeDefined();
    expect(cancelTool?.parameters.required).toContain('taskId');
    expect(agentTaskQueue).toBeInstanceOf(AgentTaskQueue);
  });
});
