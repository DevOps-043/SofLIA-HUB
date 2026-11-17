import { afterEach, describe, expect, it, vi } from 'vitest';
import { captureMonitoringSnapshot } from '../monitoring/capture-snapshot';
import { takeMonitoringScreenshot } from '../monitoring/take-screenshot';
import type { MonitoringDiagnostics } from '../monitoring/types';
const mocks = vi.hoisted(() => ({ window: vi.fn(), ocr: vi.fn(), semantic: vi.fn(), cleanup: vi.fn(), write: vi.fn() }));
vi.mock('../monitoring/active-window', () => ({ getActiveWindowInfo: mocks.window }));
vi.mock('../monitoring/snapshot-enrichment', () => ({ readOcrText: mocks.ocr, readSemanticSnapshot: mocks.semantic, deleteTransientScreenshot: mocks.cleanup }));
vi.mock('node:fs/promises', () => ({ default: { writeFile: mocks.write } }));
vi.mock('../monitoring/screenshot-processing', () => ({ renderMarkedScreenBuffer: async () => Buffer.from('fixture'), composeMonitorBuffers: async () => Buffer.from('fixture') }));
vi.mock('../monitoring/screenshot-guardrail', () => ({ validateScreenshotSafety: async () => true }));
afterEach(() => vi.clearAllMocks());
const diagnostics = (): MonitoringDiagnostics => ({ sharpAvailable: true, activeWinAvailable: false, activeWinFailCount: 0, screenshotFailCount: 0 });
function input(current: () => boolean) {
  return { current, isRunning: true, config: { intervalSeconds: 1, idleThresholdSeconds: 120, screenshotEnabled: true, ocrEnabled: true, semanticSnapshotEnabled: true },
    diagnostics: diagnostics(), emitError: vi.fn(), getIdleSeconds: () => 0, takeScreenshot: vi.fn().mockResolvedValue('fixture.png') };
}
describe('Cancelación entre etapas y archivos de captura únicos', () => {
  it('detener durante detección de ventana evita captura y OCR posteriores', async () => {
    let finish!: (value: unknown) => void, current = true;
    mocks.window.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const ports = input(() => current), operation = captureMonitoringSnapshot(ports);
    current = false; finish({ title: 'Ventana', process: 'Aplicación' });
    expect(await operation).toBeNull(); expect(ports.takeScreenshot).not.toHaveBeenCalled(); expect(mocks.ocr).not.toHaveBeenCalled();
  });
  it('detener después de OCR evita semántica y limpia la captura no publicada', async () => {
    let finish!: (value: string) => void, current = true;
    mocks.window.mockResolvedValue({ title: 'Ventana', process: 'Aplicación' });
    mocks.ocr.mockReturnValueOnce(new Promise(resolve => { finish = resolve; }));
    const operation = captureMonitoringSnapshot(input(() => current));
    await vi.waitFor(() => expect(mocks.ocr).toHaveBeenCalled());
    current = false; finish('Texto');
    expect(await operation).toBeNull(); expect(mocks.semantic).not.toHaveBeenCalled(); expect(mocks.cleanup).toHaveBeenCalledWith('fixture.png', false);
  });
  it('capturas del mismo milisegundo no sobrescriben el mismo archivo', async () => {
    mocks.write.mockResolvedValue(undefined);
    const options = { timestamp: new Date(0), screenshotDir: 'fixture', sharp: {}, diagnostics: diagnostics(), emitError: vi.fn(),
      desktopCapturerApi: { getSources: async () => [{ id: 'pantalla', display_id: 'pantalla', thumbnail: {} }] } } as unknown as Parameters<typeof takeMonitoringScreenshot>[0];
    const [first, second] = await Promise.all([takeMonitoringScreenshot(options), takeMonitoringScreenshot(options)]);
    expect(first).toBeDefined(); expect(second).toBeDefined(); expect(first).not.toBe(second);
    expect(mocks.write).toHaveBeenCalledTimes(2);
  });
});
