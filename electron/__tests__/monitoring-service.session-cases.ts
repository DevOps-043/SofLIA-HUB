import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getPowerMonitorMock, MonitoringStatus, setupMonitoringTest, teardownMonitoringTest } from './monitoring-service.helpers';

let MonitoringService: any;

describe('MonitoringService session flow', () => {
  beforeEach(async () => { MonitoringService = await setupMonitoringTest(); });
  afterEach(teardownMonitoringTest);

  it('MON-001: start inicializa estado y emite session-started', async () => {
    const svc = new MonitoringService();
    const emitSpy = vi.spyOn(svc, 'emit');
    await svc.start('user-1', 'session-abc');
    const status: MonitoringStatus = svc.getStatus();
    expect(status.isRunning).toBe(true);
    expect(status.userId).toBe('user-1');
    expect(status.sessionId).toBe('session-abc');
    expect(emitSpy).toHaveBeenCalledWith('session-started', { userId: 'user-1', sessionId: 'session-abc' });
    await svc.stop();
  });

  it('MON-002: captureSnapshot incrementa snapshotCount tras tick', async () => {
    const svc = new MonitoringService();
    svc.setConfig({ screenshotEnabled: false, ocrEnabled: false });
    await svc.start('user-1', 'sess-1');
    await vi.advanceTimersByTimeAsync(31_000);
    expect(svc.getStatus().snapshotCount).toBeGreaterThanOrEqual(1);
    await svc.stop();
  });

  it('MON-003: marca idle cuando powerMonitor supera umbral', async () => {
    const svc = new MonitoringService();
    svc.setConfig({ screenshotEnabled: false, ocrEnabled: false });
    const snapshots: any[] = [];
    svc.on('snapshot', (snapshot: any) => snapshots.push(snapshot));
    (getPowerMonitorMock().getSystemIdleTime as any).mockReturnValue(120);
    await svc.start('user-1', 'sess-idle');
    await vi.advanceTimersByTimeAsync(1000);
    expect(snapshots[0].idle).toBe(true);
    expect(snapshots[0].idleSeconds).toBeGreaterThanOrEqual(120);
    await svc.stop();
  });

  it('MON-004: OCR queda habilitado cuando ocrEnabled es true', async () => {
    const svc = new MonitoringService();
    svc.setConfig({ screenshotEnabled: true, ocrEnabled: true });
    await svc.start('user-1', 'sess-ocr');
    await vi.advanceTimersByTimeAsync(1000);
    expect(svc.getStatus().config.ocrEnabled).toBe(true);
    await svc.stop();
  });

  it('MON-005: stop devuelve snapshotCount y emite session-ended', async () => {
    const svc = new MonitoringService();
    svc.setConfig({ screenshotEnabled: false, ocrEnabled: false });
    const endedSpy = vi.fn();
    svc.on('session-ended', endedSpy);
    await svc.start('user-1', 'sess-stop');
    await vi.advanceTimersByTimeAsync(1000);
    const result = await svc.stop();
    expect(result).toHaveProperty('snapshotCount');
    expect(result).toHaveProperty('buffer');
    expect(endedSpy.mock.calls[0][0]).toHaveProperty('userId', 'user-1');
  });

  it('MON-006: setConfig actualiza configuracion', () => {
    const svc = new MonitoringService();
    svc.setConfig({ intervalSeconds: 45, idleThresholdSeconds: 180 });
    expect(svc.getStatus().config.intervalSeconds).toBe(45);
    expect(svc.getStatus().config.idleThresholdSeconds).toBe(180);
  });

  it('MON-007: screenshotEnabled false omite ruta de screenshot', async () => {
    const svc = new MonitoringService();
    svc.setConfig({ screenshotEnabled: false, ocrEnabled: false });
    const snapshots: any[] = [];
    svc.on('snapshot', (snapshot: any) => snapshots.push(snapshot));
    await svc.start('user-1', 'sess-noscreen');
    await vi.advanceTimersByTimeAsync(1000);
    if (snapshots.length > 0) expect(snapshots[0].screenshotPath).toBeUndefined();
    await svc.stop();
  });
});
