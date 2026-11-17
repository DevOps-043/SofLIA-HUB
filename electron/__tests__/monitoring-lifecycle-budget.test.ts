import { afterEach, describe, expect, it, vi } from 'vitest';
import { MonitoringService } from '../monitoring/monitoring-service';

const mocks = vi.hoisted(() => ({ capture: vi.fn(), mkdir: vi.fn() }));
vi.mock('../monitoring/capture-snapshot', () => ({ captureMonitoringSnapshot: mocks.capture }));
vi.mock('../monitoring/screenshot-cleanup', () => ({ ensureMonitoringScreenshotDir: mocks.mkdir, cleanupMonitoringScreenshots: vi.fn() }));
vi.mock('../monitoring/native-deps', () => ({ loadOptionalSharp: () => null }));
const tracked: MonitoringService[] = [];
afterEach(async () => { for (const service of tracked.splice(0)) await service.stop(); vi.useRealTimers(); vi.restoreAllMocks(); });
function create() {
  vi.useFakeTimers(); mocks.capture.mockReset().mockResolvedValue(null); mocks.mkdir.mockReset().mockResolvedValue(undefined);
  const service = new MonitoringService(); tracked.push(service); service.setConfig({ intervalSeconds: 1 }); return service;
}
function pending<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { resolve, promise }; }
const result = { idle: false, processName: 'Aplicación', windowTitle: 'Ventana', snapshot: { windowTitle: 'Ventana', processName: 'Aplicación', idle: false, idleSeconds: 0, timestamp: new Date(0) } };
describe('Pipeline periódico de captura acotado y revocable', () => {
  it('inicios concurrentes conservan únicamente la última sesión y un timer', async () => {
    const service = create(), wait = pending<void>(); mocks.mkdir.mockReturnValueOnce(wait.promise);
    const first = service.start('a', 'uno');
    const second = service.start('b', 'dos');
    const third = service.start('c', 'tres');
    await Promise.all([second, third]); wait.resolve(); await first;
    expect(service.getStatus()).toMatchObject({ userId: 'c', sessionId: 'tres', isRunning: true });
    expect(vi.getTimerCount()).toBe(1);
  });

  it('varios ticks durante OCR lento conservan una sola operación', async () => {
    const service = create(), wait = pending<typeof result>(); mocks.capture.mockReturnValueOnce(wait.promise);
    await service.start('usuario', 'sesión');
    await vi.advanceTimersByTimeAsync(10000);
    expect(mocks.capture).toHaveBeenCalledTimes(1);
    wait.resolve(result); await vi.advanceTimersByTimeAsync(1);
    expect(service.getStatus().snapshotCount).toBe(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.capture).toHaveBeenCalledTimes(2);
  });
  it('stop y cambio de sesión impiden publicar el resultado antiguo', async () => {
    const service = create(), wait = pending<typeof result>(); mocks.capture.mockReturnValueOnce(wait.promise);
    const snapshots = vi.fn(); service.on('snapshot', snapshots);
    await service.start('a', 'uno'); await service.stop(); await service.start('b', 'dos');
    wait.resolve(result); await vi.advanceTimersByTimeAsync(1);
    expect(snapshots).not.toHaveBeenCalled();
    expect(mocks.capture).toHaveBeenCalledTimes(2);
    expect(service.getStatus()).toMatchObject({ userId: 'b', sessionId: 'dos', snapshotCount: 0 });
  });
  it('cambiar configuración invalida la captura en curso', async () => {
    const service = create(), wait = pending<typeof result>(); mocks.capture.mockReturnValueOnce(wait.promise);
    await service.start('a', 'uno'); service.setConfig({ ocrEnabled: false });
    wait.resolve(result); await vi.advanceTimersByTimeAsync(1);
    expect(service.getStatus().snapshotCount).toBe(0);
  });
  it('un start lento superado por stop no reactiva el intervalo', async () => {
    const service = create(), wait = pending<void>(); mocks.mkdir.mockReturnValueOnce(wait.promise);
    const start = service.start('a', 'uno'); await service.stop(); wait.resolve(); await start;
    expect(service.getStatus().isRunning).toBe(false); expect(vi.getTimerCount()).toBe(0);
    expect(mocks.capture).not.toHaveBeenCalled();
  });
  it('un error sin receptor de error no produce rechazo global', async () => {
    const service = create(); vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.capture.mockRejectedValueOnce(new Error('Fallo nativo'));
    await service.start('a', 'uno'); await vi.advanceTimersByTimeAsync(1);
    expect(service.getStatus().isRunning).toBe(true);
    await vi.advanceTimersByTimeAsync(1000); expect(mocks.capture).toHaveBeenCalledTimes(2);
  });

  it('un receptor de diagnóstico fallido no interrumpe el siguiente ciclo', async () => {
    const service = create(); vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    service.on('error', () => { throw new Error('Receptor fallido'); });
    mocks.capture.mockRejectedValueOnce(new Error('Fallo nativo'));
    await service.start('a', 'uno'); await vi.advanceTimersByTimeAsync(1001);
    expect(mocks.capture).toHaveBeenCalledTimes(2);
  });
});
