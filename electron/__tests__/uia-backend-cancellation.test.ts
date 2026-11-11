import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeTaskInternal } from '../windows-uia/runner';
import type { WindowsUIAServiceCore } from '../windows-uia/core';
import type { WindowsUIAActionPayload, WindowsUIASnapshot } from '../windows-uia/types';

const ports = vi.hoisted(() => ({ artifacts: vi.fn(), finalize: vi.fn(), snapshot: vi.fn(), decide: vi.fn(), action: vi.fn(), trace: vi.fn() }));
vi.mock('../windows-uia/artifacts', () => ({ createArtifacts: ports.artifacts }));
vi.mock('../windows-uia/finalize', () => ({ finalizeArtifacts: ports.finalize }));
vi.mock('../windows-uia/snapshot', () => ({ collectSnapshot: ports.snapshot }));
vi.mock('../windows-uia/planner', () => ({ decideNextAction: ports.decide }));
vi.mock('../windows-uia/action-executor', () => ({ executeAction: ports.action }));
vi.mock('../windows-uia/trace', () => ({ appendTrace: ports.trace, summarizeSnapshot: () => ({}) }));
const snapshot: WindowsUIASnapshot = { currentWindowTitle: 'Prueba', currentProcess: 'prueba', windows: [{ title: 'Prueba', process: 'prueba', pid: 1 }], elements: [{ id: 1, name: 'Prueba', controlType: 'Button', isEnabled: true, boundingRect: { x: 0, y: 0, width: 10, height: 10 } }], screenshotBase64: '', signature: 'inicial' };
function fixture() {
  const desktop = { listWindows: vi.fn(async () => []), focusWindow: vi.fn() };
  const service = Object.assign(new EventEmitter(), { desktopAgent: desktop, status: 'idle', currentTask: null, currentStep: 0, abortController: null, processQueue: vi.fn() });
  const core = service as unknown as WindowsUIAServiceCore;
  const abort = new AbortController();
  return { service, core, desktop, abort, run: () => executeTaskInternal(core, 'tarea', { maxSteps: 1, signal: abort.signal }) };
}
beforeEach(() => {
  vi.clearAllMocks();
  ports.artifacts.mockReturnValue({ taskId: 'ficticia', runDirectory: 'ficticio', tracePath: 'ficticio', reportPath: 'ficticio', finalScreenshotPath: 'ficticio' });
  ports.finalize.mockResolvedValue(undefined); ports.snapshot.mockResolvedValue(snapshot);
  ports.decide.mockResolvedValue({ action: 'done', message: 'completada' }); ports.action.mockResolvedValue(undefined);
});
describe('Cancelación y limpieza del backend UIA', () => {
  it('conserva el éxito legítimo', async () => { const f = fixture(); expect(await f.run()).toBe('completada'); expect(f.service.status).toBe('idle'); expect(ports.finalize.mock.calls[0][5]).toBe('completed'); });
  it('niega una tarea ya revocada antes de crear artefactos', async () => { const f = fixture(); f.abort.abort(); await expect(f.run()).rejects.toThrow(); expect(ports.artifacts).not.toHaveBeenCalled(); });
  it('no actúa tras una decisión tardía', async () => {
    const f = fixture(); let resolve!: (action: WindowsUIAActionPayload) => void;
    ports.decide.mockImplementationOnce(() => new Promise(done => { resolve = done; }));
    const pending = f.run(); await vi.waitFor(() => expect(ports.decide).toHaveBeenCalledOnce());
    f.abort.abort(); resolve({ action: 'click_element', elementId: 1, message: 'tardía' });
    expect(await pending).toContain('cancelada'); expect(ports.action).not.toHaveBeenCalled(); expect(ports.finalize.mock.calls[0][7]).toBe('cancelled');
  });
  it('cancelar durante listado no inicia captura ni enfoque', async () => {
    const f = fixture(); f.desktop.listWindows.mockImplementationOnce(async () => { f.abort.abort(); return []; });
    expect(await f.run()).toContain('cancelada'); expect(ports.snapshot).not.toHaveBeenCalled(); expect(f.desktop.focusWindow).not.toHaveBeenCalled();
  });
  it('cancelar en task-started no inicia I/O', async () => {
    const f = fixture(); f.service.on('task-started', () => f.abort.abort());
    expect(await f.run()).toContain('cancelada'); expect(f.desktop.listWindows).not.toHaveBeenCalled();
  });
  it('cancelar en step no ejecuta la acción', async () => {
    const f = fixture(); ports.decide.mockResolvedValueOnce({ action: 'key', key: 'enter', message: 'prueba' }); f.service.on('step', () => f.abort.abort());
    expect(await f.run()).toContain('cancelada'); expect(ports.action).not.toHaveBeenCalled();
  });
  it('inicio rechazado libera estado y retira listener', async () => {
    const f = fixture(); const remove = vi.spyOn(f.abort.signal, 'removeEventListener'); f.service.on('task-started', () => { throw new Error('inicio ficticio'); });
    await expect(f.run()).rejects.toThrow('inicio ficticio'); expect(f.service.status).toBe('idle'); expect(f.service.processQueue).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
  });
  it('finalización rechazada libera estado y retira listener', async () => {
    const f = fixture(); const remove = vi.spyOn(f.abort.signal, 'removeEventListener'); ports.finalize.mockRejectedValueOnce(new Error('finalización ficticia'));
    await expect(f.run()).rejects.toThrow('finalización ficticia'); expect(f.service.status).toBe('idle'); expect(f.service.abortController).toBeNull(); expect(f.service.processQueue).toHaveBeenCalledOnce(); expect(remove).toHaveBeenCalledOnce();
  });
  it('una captura revocada no pide decisión', async () => { const f = fixture(); ports.snapshot.mockImplementationOnce(async () => { f.abort.abort(); return snapshot; }); expect(await f.run()).toContain('cancelada'); expect(ports.decide).not.toHaveBeenCalled(); });
  it('revocar al preparar artefactos no publica inicio ni lista ventanas', async () => { const f = fixture(); let started = false; f.service.on('task-started', () => { started = true; }); const artifacts = ports.artifacts.getMockImplementation()!(); ports.artifacts.mockImplementationOnce(() => { f.abort.abort(); return artifacts; }); expect(await f.run()).toContain('cancelada'); expect(started).toBe(false); expect(f.desktop.listWindows).not.toHaveBeenCalled(); });
});
