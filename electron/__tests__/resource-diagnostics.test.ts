import { describe, expect, it, vi } from 'vitest';
import type { ProcessMetric } from 'electron';
import {
  aggregateResourceMetrics,
  startResourceDiagnostics,
} from '../resource-diagnostics';

function metric(input: {
  type: ProcessMetric['type'];
  cpu: number;
  workingSetKiB: number;
  privateKiB?: number;
  name?: string;
}): ProcessMetric {
  return {
    pid: 1,
    type: input.type,
    name: input.name,
    creationTime: 0,
    cpu: { percentCPUUsage: input.cpu, idleWakeupsPerSecond: 0 },
    memory: {
      workingSetSize: input.workingSetKiB,
      peakWorkingSetSize: input.workingSetKiB,
      privateBytes: input.privateKiB,
    },
  };
}

describe('diagnóstico de recursos', () => {
  it('agrega CPU y KiB por tipo sin conservar nombres, PID ni sitios', () => {
    const snapshot = aggregateResourceMetrics([
      metric({ type: 'Tab', cpu: 3.125, workingSetKiB: 102_400, privateKiB: 80_000, name: 'https://correo.example/secreto' }),
      metric({ type: 'Tab', cpu: 1.875, workingSetKiB: 51_200, privateKiB: 40_000 }),
      metric({ type: 'GPU', cpu: 2, workingSetKiB: 25_600 }),
    ], new Date('2026-08-13T18:00:00.000Z'));

    expect(snapshot).toEqual({
      sampledAt: '2026-08-13T18:00:00.000Z',
      totals: { processes: 3, cpuPercent: 7, workingSetMb: 175, privateMemoryMb: 117.19 },
      byType: [
        { type: 'GPU', processes: 1, cpuPercent: 2, workingSetMb: 25, privateMemoryMb: null },
        { type: 'Tab', processes: 2, cpuPercent: 5, workingSetMb: 150, privateMemoryMb: 117.19 },
      ],
    });
    expect(JSON.stringify(snapshot)).not.toContain('correo.example');
    expect(JSON.stringify(snapshot)).not.toContain('pid');
  });

  it('apagado no consulta métricas ni crea muestreo', async () => {
    vi.useFakeTimers();
    const metricsProvider = vi.fn(() => []);
    const diagnostics = startResourceDiagnostics({ enabled: false, metricsProvider });
    await vi.advanceTimersByTimeAsync(60_000);
    expect(metricsProvider).not.toHaveBeenCalled();
    diagnostics.dispose();
    vi.useRealTimers();
  });

  it('publica a intervalo acotado y dispose es idempotente', async () => {
    vi.useFakeTimers();
    const metricsProvider = vi.fn(() => [metric({ type: 'Browser', cpu: 2, workingSetKiB: 10_240 })]);
    const log = vi.fn();
    const diagnostics = startResourceDiagnostics({
      enabled: true,
      metricsProvider,
      intervalMs: 1_000,
      log,
      now: () => new Date('2026-08-13T18:00:00.000Z'),
    });

    expect(metricsProvider).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(metricsProvider).toHaveBeenCalledTimes(2);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('"workingSetMb":10'));
    diagnostics.dispose();
    diagnostics.dispose();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(metricsProvider).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});
