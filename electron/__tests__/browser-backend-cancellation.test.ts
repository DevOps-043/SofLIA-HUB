import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import type { BrowserWebService } from '../browser-web-service';
import type { BrowserTaskMutableState, BrowserWebConstructor } from '../browser-web/service-types';
import { attachBrowserWebRuntime } from '../browser-web/service-runtime';
import { runBrowserTaskLoop } from '../browser-web/service-task-loop';
import { finalizeBrowserTaskArtifacts } from '../browser-web/service-artifacts';
import type { BrowserActionPayload, BrowserPageSnapshot } from '../browser-web/types';

const snapshot: BrowserPageSnapshot = { url: 'https://example.test/', title: 'Prueba', textExcerpt: '', elements: [], screenshotBase64: '', scrollY: 0, activeRef: '', signature: 'inicial' };
function fixture() {
  const abort = new AbortController();
  const page = { url: () => snapshot.url, title: vi.fn(async () => 'Prueba'), isClosed: () => false, goto: vi.fn() };
  const artifacts = { taskId: 'ficticia', runDirectory: 'ficticio', reportPath: 'ficticio', tracePath: 'ficticio', finalScreenshotPath: 'ficticio' };
  class Service extends EventEmitter {
    apiKey = 'ficticia'; status = 'idle'; currentTask = null; currentStep = 0; currentMaxSteps = 0; currentUrl = null;
    abortController = null; page = null;
    createTaskArtifacts = vi.fn(() => artifacts);
    ensurePage = vi.fn(async () => page);
    startTaskTrace = vi.fn(async () => ({ success: true, error: null }));
    shouldNavigateToStartUrl = vi.fn(() => false);
    collectSnapshot = vi.fn(async () => snapshot);
    decideNextAction = vi.fn(async (): Promise<BrowserActionPayload> => ({ action: 'done', message: 'completada' }));
    executeAction = vi.fn(async () => undefined);
    finalizeTaskArtifacts = vi.fn<BrowserWebService['finalizeTaskArtifacts']>(async () => undefined);
    processQueue = vi.fn();
  }
  attachBrowserWebRuntime(Service as unknown as BrowserWebConstructor);
  const fake = new Service(), service = fake as unknown as BrowserWebService;
  const state: BrowserTaskMutableState = { history: [], finalSnapshot: null, finalStatus: 'failed', finalMessage: '', traceStarted: false, traceStartError: null };
  const run = () => runBrowserTaskLoop(service, { task: 'tarea de prueba', maxSteps: 1, taskAbort: abort, artifacts, state });
  return { fake, service, abort, state, run, artifacts };
}
describe('Cancelación entre etapas del backend web', () => {
  it('conserva un resultado legítimo', async () => { const f = fixture(); expect(await f.run()).toBe('completada'); expect(f.state.finalStatus).toBe('completed'); });
  it('revocada antes del inicio no prepara página', async () => { const f = fixture(); f.abort.abort(); await expect(f.run()).rejects.toThrow('cancelada'); expect(f.fake.ensurePage).not.toHaveBeenCalled(); });
  it('revocada al preparar página no inicia traza', async () => { const f = fixture(); f.fake.ensurePage.mockImplementationOnce(async () => { f.abort.abort(); return { url: () => snapshot.url } as Awaited<ReturnType<typeof f.fake.ensurePage>>; }); await expect(f.run()).rejects.toThrow('cancelada'); expect(f.fake.startTaskTrace).not.toHaveBeenCalled(); });
  it('retiene la traza iniciada al revocar para poder cerrarla', async () => { const f = fixture(); f.fake.startTaskTrace.mockImplementationOnce(async () => { f.abort.abort(); return { success: true, error: null }; }); await expect(f.run()).rejects.toThrow('cancelada'); expect(f.state.traceStarted).toBe(true); expect(f.fake.collectSnapshot).not.toHaveBeenCalled(); });
  it('revocar durante captura no inicia modelo', async () => { const f = fixture(); f.fake.collectSnapshot.mockImplementationOnce(async () => { f.abort.abort(); return snapshot; }); await expect(f.run()).rejects.toThrow('cancelada'); expect(f.fake.decideNextAction).not.toHaveBeenCalled(); });
  it('revocar en step no inicia la acción', async () => { const f = fixture(); f.fake.decideNextAction.mockResolvedValueOnce({ action: 'press_key', key: 'Enter', message: 'prueba' }); f.fake.on('step', () => f.abort.abort()); await expect(f.run()).rejects.toThrow('cancelada'); expect(f.fake.executeAction).not.toHaveBeenCalled(); });
  it('revocar durante la acción no inicia captura posterior', async () => { const f = fixture(); f.fake.decideNextAction.mockResolvedValueOnce({ action: 'press_key', key: 'Enter', message: 'prueba' }); f.fake.executeAction.mockImplementationOnce(async () => { f.abort.abort(); }); await expect(f.run()).rejects.toThrow('cancelada'); expect(f.fake.collectSnapshot).toHaveBeenCalledOnce(); });
  it('cancelación en task-started queda enlazada antes de publicar', async () => { const f = fixture(); const outer = new AbortController(); f.fake.on('task-started', () => outer.abort()); expect(await f.service.executeTaskInternal('tarea', { signal: outer.signal })).toContain('cancelada'); expect(f.fake.ensurePage).not.toHaveBeenCalled(); expect(f.fake.finalizeTaskArtifacts.mock.calls[0][0]).toMatchObject({ finalStatus: 'cancelled' }); });
  it('una tarea cancelada cierra traza sin tomar captura final nueva', async () => {
    const f = fixture(); const stop = vi.fn(async () => {}); f.service.page = { isClosed: () => false }; f.service.context = { tracing: { stop } }; f.abort.abort();
    const write = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    try {
      await finalizeBrowserTaskArtifacts(f.service, { ...f.state, traceStarted: true, finalStatus: 'cancelled', task: 'tarea', artifacts: f.artifacts, signal: f.abort.signal, startedAt: 'ficticio', finishedAt: 'ficticio' });
      expect(f.fake.collectSnapshot).not.toHaveBeenCalled(); expect(stop).toHaveBeenCalledOnce();
    } finally { write.mockRestore(); }
  });
  it('conserva el listener durante finalización y lo retira al terminar', async () => {
    const f = fixture(); const outer = new AbortController(); const remove = vi.spyOn(outer.signal, 'removeEventListener');
    f.fake.finalizeTaskArtifacts.mockImplementationOnce(async params => { outer.abort(); expect(params.signal?.aborted).toBe(true); });
    await f.service.executeTaskInternal('tarea', { signal: outer.signal }); expect(remove).toHaveBeenCalledOnce(); expect(f.fake.status).toBe('idle');
  });
  it('una URL descartada que lanza error no impide liberar la cola', async () => { const f = fixture(); f.service.page = { isClosed: () => { throw new Error('página descartada'); } }; expect(await f.service.executeTaskInternal('tarea')).toBe('completada'); expect(f.fake.status).toBe('idle'); expect(f.fake.processQueue).toHaveBeenCalledOnce(); });
  it('revocar al crear artefactos no publica inicio', async () => { const f = fixture(); const outer = new AbortController(); const started = vi.fn(); f.fake.on('task-started', started); f.fake.createTaskArtifacts.mockImplementationOnce(() => { outer.abort(); return f.artifacts; }); expect(await f.service.executeTaskInternal('tarea', { signal: outer.signal })).toContain('cancelada'); expect(started).not.toHaveBeenCalled(); expect(f.fake.ensurePage).not.toHaveBeenCalled(); });
  it('no ejecuta una decisión que llega después de cancelar', async () => {
    const f = fixture(); let resolve!: (value: BrowserActionPayload) => void;
    f.fake.decideNextAction.mockImplementation(() => new Promise(done => { resolve = done; }));
    const pending = f.run().catch(() => undefined);
    await vi.waitFor(() => expect(f.fake.decideNextAction).toHaveBeenCalledOnce());
    f.abort.abort(); resolve({ action: 'press_key', key: 'Enter', message: 'acción tardía' }); await pending;
    expect(f.fake.executeAction).not.toHaveBeenCalled();
  });
  it('libera estado y cola aunque falle la finalización', async () => {
    const f = fixture(); f.fake.finalizeTaskArtifacts.mockRejectedValue(new Error('finalización ficticia'));
    await expect(f.service.executeTaskInternal('tarea')).rejects.toThrow('finalización ficticia');
    expect(f.fake.status).toBe('idle'); expect(f.fake.abortController).toBeNull(); expect(f.fake.processQueue).toHaveBeenCalledOnce();
  });
  it('limpia estado aunque un consumidor rechace el evento inicial', async () => {
    const f = fixture(); f.fake.on('task-started', () => { throw new Error('consumidor ficticio'); });
    await expect(f.service.executeTaskInternal('tarea')).rejects.toThrow('consumidor ficticio');
    expect(f.fake.status).toBe('idle'); expect(f.fake.processQueue).toHaveBeenCalledOnce(); expect(f.fake.ensurePage).not.toHaveBeenCalled();
  });
});
