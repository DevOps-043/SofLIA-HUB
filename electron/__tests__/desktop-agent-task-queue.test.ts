import { describe, expect, it, vi } from 'vitest';
import { executeDesktopAgentTaskEntrypoint } from '../desktop-agent/task-entrypoint';
import { processDesktopTaskQueue, type DesktopTaskQueueItem } from '../desktop-agent/task-control';
import { buildTaskOutcome } from '../desktop-agent/task-outcome';
import { DEFAULT_CONFIG } from '../desktop-agent-types';
import type { AgentTask } from '../desktop-agent-types';

function buildCtx(overrides: Record<string, any> = {}) {
  const activeTasks = new Map<string, AgentTask>();
  return {
    apiKey: 'test-key',
    browserWeb: { executeTask: vi.fn(async () => 'browser ok') } as any,
    windowsUIA: { executeTask: vi.fn(async () => 'uia ok'), getLastRunResult: vi.fn(() => null) } as any,
    config: { ...DEFAULT_CONFIG, maxConcurrentAgents: 1, queueTimeoutMs: 80 },
    activeTasks,
    taskQueue: [] as DesktopTaskQueueItem[],
    emit: vi.fn(),
    executeTaskInternal: vi.fn(async (task: string) => buildTaskOutcome({
      taskId: 't-1', estado: 'completada', mensaje: `ok: ${task}`, startedAt: Date.now(),
    })),
    runDesktopFallbackFromUIA: vi.fn(async () => 'fallback'),
    ...overrides,
  };
}

function fakeActiveTask(): AgentTask {
  return {
    id: 'activo', task: 'ocupado', status: 'executing', currentStep: 0, maxSteps: 10,
    plan: null, actionHistory: [], abortController: new AbortController(), startedAt: Date.now(),
    recovery: { consecutiveFailures: 0, sameScreenCount: 0, lastScreenHash: '', totalRecoveries: 0, lastRecoveryStep: -10 },
  };
}

describe('Cola y ciclo de vida de tareas del Desktop Agent', () => {
  it('TQ-001: sin saturacion ejecuta directo y devuelve outcome completada', async () => {
    const ctx = buildCtx();
    const outcome = await executeDesktopAgentTaskEntrypoint('organiza mis iconos', { backend: 'desktop' }, ctx);
    expect(outcome.estado).toBe('completada');
    expect(ctx.executeTaskInternal).toHaveBeenCalled();
  });

  it('TQ-002: una tarea encolada expira con estado cola_expirada y sale de la cola', async () => {
    const ctx = buildCtx();
    ctx.activeTasks.set('activo', fakeActiveTask());
    const outcome = await executeDesktopAgentTaskEntrypoint('tarea encolada', { backend: 'desktop' }, ctx);
    expect(outcome.estado).toBe('cola_expirada');
    expect(outcome.mensaje).toContain('expiro');
    expect(ctx.taskQueue).toHaveLength(0);
    expect(ctx.emit).toHaveBeenCalledWith('task-queue-timeout', expect.objectContaining({ task: 'tarea encolada' }));
    expect(ctx.executeTaskInternal).not.toHaveBeenCalled();
  });

  it('TQ-003: cancelar la senal mientras espera en cola resuelve cancelada sin ejecutar', async () => {
    const ctx = buildCtx({ config: { ...DEFAULT_CONFIG, maxConcurrentAgents: 1, queueTimeoutMs: 5000 } });
    ctx.activeTasks.set('activo', fakeActiveTask());
    const controller = new AbortController();
    const promise = executeDesktopAgentTaskEntrypoint('tarea cancelable', { backend: 'desktop', signal: controller.signal }, ctx);
    expect(ctx.taskQueue).toHaveLength(1);
    controller.abort();
    const outcome = await promise;
    expect(outcome.estado).toBe('cancelada');
    expect(ctx.taskQueue).toHaveLength(0);
    expect(ctx.executeTaskInternal).not.toHaveBeenCalled();
  });

  it('TQ-004: una senal ya abortada ni siquiera entra a la cola', async () => {
    const ctx = buildCtx();
    ctx.activeTasks.set('activo', fakeActiveTask());
    const controller = new AbortController();
    controller.abort();
    const outcome = await executeDesktopAgentTaskEntrypoint('tarea abortada', { backend: 'desktop', signal: controller.signal }, ctx);
    expect(outcome.estado).toBe('cancelada');
    expect(ctx.taskQueue).toHaveLength(0);
  });

  it('TQ-005: al liberarse un slot la cola ejecuta en orden FIFO y limpia su timeout', async () => {
    const ctx = buildCtx({ config: { ...DEFAULT_CONFIG, maxConcurrentAgents: 1, queueTimeoutMs: 5000 } });
    ctx.activeTasks.set('activo', fakeActiveTask());
    // Como en produccion: iniciar una tarea la registra sincronamente en activeTasks,
    // asi que el drenado de la cola respeta maxConcurrentAgents.
    const ordenEjecucion: string[] = [];
    ctx.executeTaskInternal = vi.fn(async (task: string) => {
      ordenEjecucion.push(task);
      ctx.activeTasks.set(`slot-${task}`, fakeActiveTask());
      return buildTaskOutcome({ taskId: 't-1', estado: 'completada', mensaje: `ok: ${task}`, startedAt: Date.now() });
    });
    const primera = executeDesktopAgentTaskEntrypoint('primera', { backend: 'desktop' }, ctx);
    const segunda = executeDesktopAgentTaskEntrypoint('segunda', { backend: 'desktop' }, ctx);
    expect(ctx.taskQueue).toHaveLength(2);

    ctx.activeTasks.delete('activo');
    processDesktopTaskQueue({
      queue: ctx.taskQueue,
      activeTasks: ctx.activeTasks,
      maxConcurrentAgents: 1,
      executeTask: ctx.executeTaskInternal,
    });
    const outcome = await primera;
    expect(outcome.mensaje).toBe('ok: primera');
    expect(ordenEjecucion).toEqual(['primera']);
    expect(ctx.taskQueue).toHaveLength(1);

    // Liberar de nuevo para drenar la segunda.
    processDesktopTaskQueue({
      queue: ctx.taskQueue,
      activeTasks: ctx.activeTasks,
      maxConcurrentAgents: 3,
      executeTask: ctx.executeTaskInternal,
    });
    await expect(segunda).resolves.toMatchObject({ mensaje: 'ok: segunda' });
    expect(ordenEjecucion).toEqual(['primera', 'segunda']);
  });

  it('TQ-006: la cola descarta items con senal abortada al desencolar', async () => {
    const abortado = new AbortController();
    abortado.abort();
    let resolvedOutcome: any = null;
    const queue: DesktopTaskQueueItem[] = [{
      task: 'cancelada en cola',
      options: { signal: abortado.signal },
      enqueuedAt: Date.now(),
      resolve: (value) => { resolvedOutcome = value; },
      reject: () => {},
    }];
    const executeTask = vi.fn(async () => buildTaskOutcome({ taskId: 'x', estado: 'completada', mensaje: 'no debe pasar' }));
    processDesktopTaskQueue({ queue, activeTasks: new Map(), maxConcurrentAgents: 3, executeTask });
    expect(executeTask).not.toHaveBeenCalled();
    expect(resolvedOutcome?.estado).toBe('cancelada');
  });

  it('TQ-007: con keywordRoutingEnabled=false una tarea que menciona chrome NO va al backend browser', async () => {
    const ctx = buildCtx({ config: { ...DEFAULT_CONFIG, maxConcurrentAgents: 1, keywordRoutingEnabled: false } });
    const outcome = await executeDesktopAgentTaskEntrypoint('abre chrome y busca algo', undefined, ctx);
    expect(ctx.browserWeb.executeTask).not.toHaveBeenCalled();
    expect(ctx.executeTaskInternal).toHaveBeenCalled();
    expect(outcome.estado).toBe('completada');
  });

  it('TQ-008: con keywordRoutingEnabled=true la heuristica legacy sigue enrutando a browser', async () => {
    const ctx = buildCtx({ config: { ...DEFAULT_CONFIG, maxConcurrentAgents: 1, keywordRoutingEnabled: true } });
    const outcome = await executeDesktopAgentTaskEntrypoint('abre chrome y busca algo', undefined, ctx);
    expect(ctx.browserWeb.executeTask).toHaveBeenCalled();
    expect(outcome.estado).toBe('completada');
    expect(outcome.mensaje).toBe('browser ok');
  });
});
