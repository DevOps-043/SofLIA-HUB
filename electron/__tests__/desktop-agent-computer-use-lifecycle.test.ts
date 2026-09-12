import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CONFIG } from '../desktop-agent/agent-config';
import { getBrowserCuTask } from '../desktop-agent/browser-cu-task';
import { attachDesktopAgentLifecycle, type DesktopAgentLifecycleApi } from '../desktop-agent/service-lifecycle';
import type { DesktopAgentServiceConstructor } from '../desktop-agent/service-types';
import type { DesktopTaskQueueItem } from '../desktop-agent/task-control';

const mocks = vi.hoisted(() => ({
  runLoop: vi.fn(),
  createClient: vi.fn(() => ({ disponible: () => true })),
  createIntegratedDriver: vi.fn(() => ({ capturar: vi.fn(), ejecutar: vi.fn() })),
}));

vi.mock('../desktop-agent/gemini-cu/client', () => ({ createComputerUseClient: mocks.createClient }));
vi.mock('../desktop-agent/gemini-cu/loop', () => ({ runComputerUseLoop: mocks.runLoop }));
vi.mock('../integrated-browser', () => ({ createIntegratedBrowserCuDriver: mocks.createIntegratedDriver }));

const { runComputerUseBrowserTask } = await import('../desktop-agent/service-computer-use');

const Lifecycle = class {};
attachDesktopAgentLifecycle(Lifecycle as unknown as DesktopAgentServiceConstructor);
const lifecycle = Lifecycle.prototype as DesktopAgentLifecycleApi;
function fixture() {
  const backend = () => ({ abortAll: vi.fn(), isRunning: () => false, getStatus: () => ({ status: 'idle', currentStep: 0 }) });
  return {
    apiKey: 'test-key', config: { ...DEFAULT_CONFIG },
    integratedBrowser: { bindAgentTask: vi.fn(() => vi.fn()), openForAgent: vi.fn(async (): Promise<void> => undefined), releaseAgentControl: vi.fn() },
    status: 'idle', currentTask: null, currentStep: 0, emit: vi.fn(), delay: vi.fn(async () => undefined),
    activeTasks: new Map(), abortController: null, browserWeb: backend(), windowsUIA: backend(),
    taskQueue: [] as DesktopTaskQueueItem[],
    stopObservation: vi.fn(), processQueue: vi.fn(), getConfig: () => ({ ...DEFAULT_CONFIG }),
    actionHistory: [], currentPlan: null, platformCapabilities: {},
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('Ciclo de vida de Computer Use integrado', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registra la apertura y cancela por ID sin afectar otros backends ni iniciar el loop', async () => {
    const service = fixture(); const opening = deferred<void>();
    service.integratedBrowser.openForAgent.mockImplementation(() => opening.promise);
    const result = runComputerUseBrowserTask(service, 'Abrir página');
    const entry = getBrowserCuTask(service)!;
    expect(lifecycle.isRunning.call(service)).toBe(true);
    expect(lifecycle.getActiveTaskCount.call(service)).toBe(1);
    expect(lifecycle.getStatus.call(service)).toMatchObject({ totalActiveAgents: 1, activeTasks: [expect.objectContaining({ id: entry.taskId, backend: 'browser_web' })] });
    lifecycle.abort.call(service, entry.taskId);
    expect(service.browserWeb.abortAll).not.toHaveBeenCalled();
    await expect(runComputerUseBrowserTask(service, 'Abrir página')).rejects.toThrow('terminando');
    opening.resolve();
    expect(await result).toMatchObject({ estado: 'cancelada', taskId: entry.taskId });
    expect(mocks.runLoop).not.toHaveBeenCalled();
    expect(service.integratedBrowser.releaseAgentControl).toHaveBeenCalledOnce();
    expect(lifecycle.isRunning.call(service)).toBe(false);
    expect(getBrowserCuTask(service)).toBeNull();
  });

  it('detener todo alcanza el loop y conserva la reserva hasta terminar la entrada nativa', async () => {
    const service = fixture(); const entered = deferred<void>(); const drained = deferred<void>();
    mocks.runLoop.mockImplementationOnce(async ({ abortSignal, onStep }) => {
      onStep({ step: 2, nombre: 'click', action: { tipo: 'click' }, intent: '' });
      entered.resolve(); await drained.promise;
      expect(abortSignal.aborted).toBe(true);
      return { estado: 'cancelada', mensaje: 'Tarea cancelada.', pasos: 2 };
    });
    const result = runComputerUseBrowserTask(service, 'Tarea'); await entered.promise;
    expect(getBrowserCuTask(service)?.currentStep).toBe(2);
    lifecycle.abort.call(service);
    expect(service.browserWeb.abortAll).toHaveBeenCalledOnce();
    expect(service.integratedBrowser.releaseAgentControl).not.toHaveBeenCalled();
    await expect(runComputerUseBrowserTask(service, 'Otra tarea')).rejects.toThrow('terminando');
    drained.resolve();
    expect(await result).toMatchObject({ estado: 'cancelada', pasosEjecutados: 2 });
    expect(getBrowserCuTask(service)).toBeNull();
    expect(service.emit.mock.calls.some(([event]) => event === 'task-completed')).toBe(false);
  });

  it('no abre una tarea ya cancelada y retira el vínculo con la señal externa', async () => {
    const service = fixture(); const source = new AbortController(); source.abort('secreto');
    expect(await runComputerUseBrowserTask(service, 'Tarea', { signal: source.signal })).toMatchObject({ estado: 'cancelada', mensaje: 'Tarea cancelada.' });
    expect(service.integratedBrowser.openForAgent).not.toHaveBeenCalled();
    expect(getBrowserCuTask(service)).toBeNull();
  });

  it('detener todo vacía la cola y resuelve cancelación sin ejecutar sus tareas', () => {
    const service = fixture(); const resolve = vi.fn(); const cleanup = vi.fn();
    service.taskQueue.push({ task: 'En cola', enqueuedAt: Date.now(), resolve, reject: vi.fn(), onDequeue: cleanup });
    lifecycle.abort.call(service);
    expect(service.taskQueue).toHaveLength(0);
    expect(cleanup).toHaveBeenCalledOnce();
    expect(resolve).toHaveBeenCalledWith(expect.objectContaining({ estado: 'cancelada', pasosEjecutados: 0 }));
    expect(service.processQueue).not.toHaveBeenCalled();
    lifecycle.abort.call(service);
    expect(resolve).toHaveBeenCalledOnce();
  });

  it('ignora ID ajeno, enlaza cancelación externa y no pisa una tarea de escritorio', async () => {
    const service = { ...fixture(), currentTask: 'Tarea', status: 'executing', currentStep: 7 };
    const source = new AbortController(); const entered = deferred<void>(); const drained = deferred<void>();
    const remove = vi.spyOn(source.signal, 'removeEventListener');
    mocks.runLoop.mockImplementationOnce(async ({ abortSignal }) => {
      entered.resolve(); await drained.promise;
      expect(abortSignal.aborted).toBe(true);
      return { estado: 'cancelada', mensaje: 'Tarea cancelada.', pasos: 0 };
    });
    const result = runComputerUseBrowserTask(service, 'Tarea', { signal: source.signal }); await entered.promise;
    lifecycle.abort.call(service, 'inexistente'); source.abort(); drained.resolve(); await result;
    expect(service).toMatchObject({ currentTask: 'Tarea', status: 'executing', currentStep: 7 });
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });

  it('restaura idle y publica agotamiento sin perder la sesión visible', async () => {
    mocks.runLoop.mockResolvedValue({ estado: 'presupuesto_agotado', mensaje: 'límite', pasos: 90 });
    const integratedBrowser = {
      bindAgentTask: vi.fn(() => vi.fn()),
      openForAgent: vi.fn(async () => undefined),
      releaseAgentControl: vi.fn(),
    };
    const service = {
      apiKey: 'test-key',
      config: { ...DEFAULT_CONFIG, maxSteps: 60, defaultStepBudget: 40 },
      integratedBrowser,
      status: 'idle',
      currentTask: null,
      currentStep: 0,
      emit: vi.fn(),
      delay: vi.fn(async () => undefined),
    };

    const outcome = await runComputerUseBrowserTask(service, 'Inicia sesión y abre Empresas', { backend: 'browser' });

    expect(mocks.runLoop).toHaveBeenCalledWith(expect.objectContaining({ maxSteps: 90 }));
    expect(outcome).toMatchObject({ estado: 'presupuesto_agotado', pasosEjecutados: 90 });
    expect(outcome?.mensaje).toContain('página, cookies y sesión');
    expect(service.emit).toHaveBeenCalledWith('task-budget-exhausted', expect.objectContaining({ maxSteps: 90 }));
    expect(service.status).toBe('idle');
    expect(service.currentTask).toBeNull();
    expect(service.currentStep).toBe(0);
    expect(integratedBrowser.releaseAgentControl).toHaveBeenCalledTimes(1);
  });
});
