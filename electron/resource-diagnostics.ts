import type { ProcessMetric } from 'electron';

export const RESOURCE_DIAGNOSTICS_INTERVAL_MS = 30_000;

export type ResourceMetricGroup = {
  type: string;
  processes: number;
  cpuPercent: number;
  workingSetMb: number;
  privateMemoryMb: number | null;
};

export type ResourceMetricsSnapshot = {
  sampledAt: string;
  totals: Omit<ResourceMetricGroup, 'type'>;
  byType: ResourceMetricGroup[];
};

type ResourceDiagnosticsOptions = {
  enabled: boolean;
  metricsProvider: () => ProcessMetric[];
  intervalMs?: number;
  log?: (message: string) => void;
  warn?: (message: string) => void;
  now?: () => Date;
};

/**
 * Agrega únicamente unidades operativas. Los nombres, PID, origen y argumentos
 * de cada proceso se omiten a propósito para que el diagnóstico no filtre la
 * navegación ni aumente la cardinalidad de logs.
 */
export function aggregateResourceMetrics(
  metrics: readonly ProcessMetric[],
  sampledAt = new Date(),
): ResourceMetricsSnapshot {
  const groups = new Map<string, ResourceMetricGroup>();
  for (const metric of metrics) {
    const type = normalizeProcessType(metric.type);
    const group = groups.get(type) ?? {
      type,
      processes: 0,
      cpuPercent: 0,
      workingSetMb: 0,
      privateMemoryMb: null,
    };
    group.processes += 1;
    group.cpuPercent += finiteOrZero(metric.cpu?.percentCPUUsage);
    group.workingSetMb += kibToMb(metric.memory?.workingSetSize);
    if (typeof metric.memory?.privateBytes === 'number' && Number.isFinite(metric.memory.privateBytes)) {
      group.privateMemoryMb = (group.privateMemoryMb ?? 0) + kibToMb(metric.memory.privateBytes);
    }
    groups.set(type, group);
  }

  const byType = Array.from(groups.values())
    .map(roundGroup)
    .sort((left, right) => left.type.localeCompare(right.type));
  return {
    sampledAt: sampledAt.toISOString(),
    totals: {
      processes: byType.reduce((sum, group) => sum + group.processes, 0),
      cpuPercent: round(byType.reduce((sum, group) => sum + group.cpuPercent, 0)),
      workingSetMb: round(byType.reduce((sum, group) => sum + group.workingSetMb, 0)),
      privateMemoryMb: sumNullable(byType.map((group) => group.privateMemoryMb)),
    },
    byType,
  };
}

/** Activa muestreo solo bajo opt-in; apagado no crea timers ni consulta Electron. */
export function startResourceDiagnostics(options: ResourceDiagnosticsOptions): { dispose: () => void } {
  if (!options.enabled) return { dispose: () => undefined };
  const log = options.log ?? console.info;
  const warn = options.warn ?? console.warn;
  const now = options.now ?? (() => new Date());
  const intervalMs = Math.max(1_000, options.intervalMs ?? RESOURCE_DIAGNOSTICS_INTERVAL_MS);
  let disposed = false;

  // La primera lectura de CPU de Chromium devuelve cero; se usa solamente para
  // cebar el contador y la primera muestra publicada llega tras el intervalo.
  try {
    options.metricsProvider();
  } catch {
    warn('[Rendimiento] No se pudo iniciar el diagnóstico de recursos.');
  }

  const timer = setInterval(() => {
    if (disposed) return;
    try {
      const snapshot = aggregateResourceMetrics(options.metricsProvider(), now());
      log(`[Rendimiento] ${JSON.stringify(snapshot)}`);
    } catch {
      warn('[Rendimiento] No se pudo obtener la muestra de recursos.');
    }
  }, intervalMs);
  timer.unref?.();

  return {
    dispose: () => {
      if (disposed) return;
      disposed = true;
      clearInterval(timer);
    },
  };
}

function normalizeProcessType(value: unknown): string {
  const normalized = typeof value === 'string' ? value.trim() : '';
  return normalized && /^[\w -]{1,40}$/.test(normalized) ? normalized : 'Unknown';
}

function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function kibToMb(value: unknown): number {
  return finiteOrZero(value) / 1_024;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundGroup(group: ResourceMetricGroup): ResourceMetricGroup {
  return {
    ...group,
    cpuPercent: round(group.cpuPercent),
    workingSetMb: round(group.workingSetMb),
    privateMemoryMb: group.privateMemoryMb === null ? null : round(group.privateMemoryMb),
  };
}

function sumNullable(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  return present.length === 0 ? null : round(present.reduce((sum, value) => sum + value, 0));
}
