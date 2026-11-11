import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachDesktopAgentTasks } from '../desktop-agent/service-tasks';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopAgentServiceConstructor } from '../desktop-agent/service-types';
import { DesktopAgentService as RealService } from '../desktop-agent-service';
import { DEFAULT_CONFIG } from '../desktop-agent-types';
import { resetAuthStateForTests, setAuthState } from '../main/auth-state';
import { setCurrentUserId } from '../memory/owner-context';
import { recordDesktopTaskMemory } from '../memory/record-desktop-task';
import { executeDesktopAgentTaskEntrypoint } from '../desktop-agent/task-entrypoint';
import { withDesktopTaskPublication, bindDesktopTaskPublication } from '../desktop-agent/task-publications';
const mocks = vi.hoisted(() => ({ entry: vi.fn() }));
vi.mock('../desktop-agent/task-entrypoint', () => ({ executeDesktopAgentTaskEntrypoint: mocks.entry }));
class Fake extends EventEmitter {
  override emit(name: string | symbol, ...args: unknown[]): boolean { return RealService.prototype.emit.call(this, name, ...args); }
  apiKey = 'ficticia'; config = { ...DEFAULT_CONFIG }; activeTasks = new Map(); taskQueue = []; currentTask: string | null = null; currentStep = 0; status = 'idle';
  browserWeb = { getStatus: () => ({ status: 'idle', currentStep: 0 }) }; windowsUIA = this.browserWeb;
  platformCapabilities = {}; visualGuidance = null; integratedBrowser = null; observationRunning = false;
}
attachDesktopAgentTasks(Fake as unknown as DesktopAgentServiceConstructor);
beforeEach(() => { vi.clearAllMocks(); resetAuthStateForTests(); setAuthState({ authenticated: true, userId: 'usuario-A' }); setCurrentUserId('usuario-A'); });
afterEach(() => { resetAuthStateForTests(); setCurrentUserId(null); vi.restoreAllMocks(); });
describe('Publicaciones y aprendizaje de tareas Desktop', () => {
  it('un payload con propietario inventado no concede permiso para memoria', () => {
    const saveMessage = vi.fn(); recordDesktopTaskMemory({ saveMessage }, { task: 'tarea', message: 'texto', ownerKey: 'user:usuario-A' });
    expect(saveMessage).not.toHaveBeenCalled();
  });
  it('evento de tarea sin contexto no se publica aunque haya sesión', () => {
    const service = Object.create(RealService.prototype) as DesktopAgentService;
    EventEmitter.call(service); const listener = vi.fn(); service.on('task-completed', listener);
    service.emit('task-completed', { task: 'tarea', message: 'resultado' }); expect(listener).not.toHaveBeenCalled();
  });
  it('la respuesta posterior a A/B/A no vuelve al llamador', async () => {
    const service = new Fake() as unknown as DesktopAgentService;
    vi.mocked(executeDesktopAgentTaskEntrypoint).mockImplementationOnce(async () => {
      setAuthState({ authenticated: true, userId: 'usuario-B' }); setAuthState({ authenticated: true, userId: 'usuario-A' });
      return { taskId: 'qa', estado: 'completada', mensaje: 'resultado-privado', pasosEjecutados: 1, duracionMs: 1 };
    });
    await expect(service.executeTaskDetailed('tarea')).rejects.toThrow();
  });
  it('tarea legítima conserva DTO y aprende sólo con propietario originario', async () => {
    const service = new Fake() as unknown as DesktopAgentService, saveMessage = vi.fn();
    setCurrentUserId('otro-contexto'); service.on('task-completed', payload => recordDesktopTaskMemory({ saveMessage }, payload));
    vi.mocked(executeDesktopAgentTaskEntrypoint).mockImplementationOnce(async (_task, _options, ctx) => {
      ctx.emit('task-completed', { task: 'tarea válida', message: 'resultado', ownerKey: 'user:inventado' });
      return { taskId: 'qa', estado: 'completada', mensaje: 'resultado', pasosEjecutados: 1, duracionMs: 1 };
    });
    expect(await service.executeTaskDetailed('tarea válida')).toMatchObject({ estado: 'completada', mensaje: 'resultado' });
    expect(saveMessage).toHaveBeenCalledTimes(2);
    for (const [message] of saveMessage.mock.calls) expect(message).toMatchObject({ ownerKey: 'user:usuario-A', sessionKey: 'desktop:user:usuario-A' });
  });
  it.each(['logout', 'A/B/A', 'signal'] as const)('suprime publicación y aprendizaje tras %s', async reason => {
    const service = new Fake(), listener = vi.fn(), saveMessage = vi.fn(), controller = new AbortController();
    service.on('task-completed', payload => { listener(payload); recordDesktopTaskMemory({ saveMessage }, payload); });
    await expect(withDesktopTaskPublication(service, 'tarea', controller.signal, async () => {
      if (reason === 'logout') setAuthState({ authenticated: false, userId: null });
      if (reason === 'A/B/A') { setAuthState({ authenticated: true, userId: 'B' }); setAuthState({ authenticated: true, userId: 'usuario-A' }); }
      if (reason === 'signal') controller.abort();
      service.emit('task-completed', { task: 'tarea', message: 'privado' }); return 'privado';
    })).rejects.toThrow(); expect(listener).not.toHaveBeenCalled(); expect(saveMessage).not.toHaveBeenCalled();
  });
  it('copias y campos inventados pierden procedencia; mutar evento no cambia snapshot aprendido', async () => {
    const service = new Fake(), saveMessage = vi.fn(); let captured: unknown;
    service.on('task-completed', payload => { captured = payload; Object.assign(payload, { task: 'mutada', message: 'mutado', ownerKey: 'user:B' }); });
    service.on('task-completed', payload => {
      recordDesktopTaskMemory({ saveMessage }, { ...payload });
      recordDesktopTaskMemory({ saveMessage }, payload); recordDesktopTaskMemory({ saveMessage }, payload);
    });
    await withDesktopTaskPublication(service, 'original', undefined, async () => { service.emit('task-completed', { task: 'original', message: 'resultado original' }); });
    expect(saveMessage).toHaveBeenCalledTimes(2); expect(saveMessage.mock.calls[0][0].content).toBe('original');
    expect(saveMessage.mock.calls[1][0].content).toContain('resultado original');
    recordDesktopTaskMemory({ saveMessage }, captured); expect(saveMessage).toHaveBeenCalledTimes(2);
  });
  it('evento legítimo diferido hasta después de lease no concede replay', async () => {
    const service = new Fake(), saveMessage = vi.fn(); let payload: unknown;
    service.on('task-failed', value => { payload = value; });
    await withDesktopTaskPublication(service, 'original', undefined, async () => { service.emit('task-failed', { message: 'fallo' }); });
    recordDesktopTaskMemory({ saveMessage }, payload, true); expect(saveMessage).not.toHaveBeenCalled();
  });
  it('aprende fallo sin task del backend desde la tarea originaria', async () => {
    const service = new Fake(), saveMessage = vi.fn();
    service.on('task-failed', payload => recordDesktopTaskMemory({ saveMessage }, payload, true));
    await withDesktopTaskPublication(service, 'tarea originaria', undefined, async () => { service.emit('task-failed', { message: 'fallo declarado' }); });
    expect(saveMessage.mock.calls[0][0].content).toBe('tarea originaria'); expect(saveMessage.mock.calls[1][0].content).toContain('FALLIDA');
  });
  it('cambio de usuario dentro del primer guardado impide el segundo', async () => {
    const service = new Fake(), saveMessage = vi.fn(() => setAuthState({ authenticated: true, userId: 'B' }));
    service.on('task-completed', payload => recordDesktopTaskMemory({ saveMessage }, payload));
    await expect(withDesktopTaskPublication(service, 'tarea', undefined, async () => { service.emit('task-completed', { message: 'resultado' }); })).rejects.toThrow();
    expect(saveMessage).toHaveBeenCalledOnce();
  });
  it('un forwarding sin scope o revocado no modifica marcas del servicio', async () => {
    const service = new Fake() as unknown as DesktopAgentService, backend = new EventEmitter();
    service.registerExternalBackendEventForwarding(backend);
    backend.emit('task-started', { task: 'ajena' }); expect(service.currentTask).toBe(null);
    await expect(withDesktopTaskPublication(service, 'tarea', undefined, async () => {
      backend.emit('task-started', { task: 'vigente' }); expect(service.currentTask).toBe('vigente');
      setAuthState({ authenticated: false, userId: null }); backend.emit('task-started', { task: 'obsoleta' }); backend.emit('step', { step: 200 });
      expect(service.currentTask).toBe('vigente'); expect(service.currentStep).toBe(0);
    })).rejects.toThrow();
  });
  it('continuación ligada no hereda ni reabre lease desde otra operación', async () => {
    const service = new Fake(); let callback!: () => string;
    await withDesktopTaskPublication(service, 'primera', undefined, async () => { callback = bindDesktopTaskPublication(service, () => 'texto privado'); });
    await withDesktopTaskPublication(service, 'segunda', undefined, async () => { expect(callback).toThrow(); });
  });
  it('lease anidada conserva revocación y no captura identidad nueva', async () => {
    const service = new Fake();
    await expect(withDesktopTaskPublication(service, 'primera', undefined, async () => {
      setAuthState({ authenticated: true, userId: 'B' });
      await withDesktopTaskPublication(service, 'segunda', undefined, async () => 'privado');
    })).rejects.toThrow();
  });
  it('getters no se evalúan al admitir payload de tarea', async () => {
    const service = new Fake(), getter = vi.fn(() => 'privado'), listener = vi.fn(); service.on('task-completed', listener);
    await withDesktopTaskPublication(service, 'tarea', undefined, async () => { service.emit('task-completed', Object.defineProperty({}, 'message', { get: getter, enumerable: true })); });
    expect(getter).not.toHaveBeenCalled(); expect(listener).not.toHaveBeenCalled();
  });
  it('tareas simultáneas conservan snapshots y lease propia', async () => {
    const service = new Fake(), saveMessage = vi.fn(); service.on('task-completed', payload => recordDesktopTaskMemory({ saveMessage }, payload));
    let release!: () => void; const wait = new Promise<void>(resolve => { release = resolve; });
    const first = withDesktopTaskPublication(service, 'primera', undefined, async () => { await wait; service.emit('task-completed', { message: 'resultado 1' }); });
    await withDesktopTaskPublication(service, 'segunda', undefined, async () => { service.emit('task-completed', { message: 'resultado 2' }); });
    release(); await first;
    expect(saveMessage.mock.calls.map(call => call[0].content)).toEqual(['segunda', '[Tarea de escritorio COMPLETADA] resultado 2', 'primera', '[Tarea de escritorio COMPLETADA] resultado 1']);
  });
  it('un payload de backend se copia al emitir y no se marca el original', async () => {
    const service = new Fake(), saveMessage = vi.fn(), original = { message: 'resultado' };
    service.on('task-completed', payload => { recordDesktopTaskMemory({ saveMessage }, original); recordDesktopTaskMemory({ saveMessage }, payload); });
    await withDesktopTaskPublication(service, 'tarea', undefined, async () => { service.emit('task-completed', original); });
    expect(saveMessage).toHaveBeenCalledTimes(2); expect(original).toEqual({ message: 'resultado' });
  });
  it('rechazo del consumidor no reintenta memoria ni refleja su error', async () => {
    const service = new Fake(), saveMessage = vi.fn(() => { throw new Error('fallo-privado'); });
    service.on('task-completed', payload => { recordDesktopTaskMemory({ saveMessage }, payload); recordDesktopTaskMemory({ saveMessage }, payload); });
    await withDesktopTaskPublication(service, 'tarea', undefined, async () => { service.emit('task-completed', { message: 'resultado' }); });
    expect(saveMessage).toHaveBeenCalledOnce();
  });
  it('una continuación sobreviviente no publica después de finalizar la lease', async () => {
    const service = new Fake(), listener = vi.fn(); service.on('task-completed', listener);
    let late!: () => void;
    await withDesktopTaskPublication(service, 'tarea', undefined, async () => {
      late = bindDesktopTaskPublication(service, () => { service.emit('task-completed', { message: 'tardío' }); });
    });
    expect(late).toThrow(); expect(listener).not.toHaveBeenCalled();
  });
  it('control de cancelación conserva aviso mínimo sin conceder aprendizaje', () => {
    const service = new Fake(), listener = vi.fn(), saveMessage = vi.fn(); service.on('task-aborted', listener);
    service.emit('task-aborted', { taskId: 'agent-qa' }); expect(listener).toHaveBeenCalledWith({ taskId: 'agent-qa' });
    recordDesktopTaskMemory({ saveMessage }, listener.mock.calls[0][0]); expect(saveMessage).not.toHaveBeenCalled();
    service.emit('task-aborted', { taskId: 'agent-qa', task: 'privada' }); expect(listener).toHaveBeenCalledOnce();
  });
  it('sin sesión el control no publica ni su aviso mínimo', () => {
    const service = new Fake(), listener = vi.fn(); service.on('task-aborted', listener);
    setAuthState({ authenticated: false, userId: null }); service.emit('task-aborted', { taskId: 'agent-qa' }); expect(listener).not.toHaveBeenCalled();
  });
});
