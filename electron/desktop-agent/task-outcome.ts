import type { DesktopTaskEstado, DesktopTaskOutcome } from '../../src/shared/desktop-agent';
export type { DesktopTaskEstado, DesktopTaskOutcome } from '../../src/shared/desktop-agent';
export function buildTaskOutcome(params: {
  taskId: string | null;
  estado: DesktopTaskEstado;
  mensaje: string;
  pasosEjecutados?: number;
  startedAt?: number;
  ultimaVentana?: string;
}): DesktopTaskOutcome {
  return {
    taskId: params.taskId,
    estado: params.estado,
    mensaje: params.mensaje,
    pasosEjecutados: params.pasosEjecutados ?? 0,
    duracionMs: params.startedAt ? Math.max(0, Date.now() - params.startedAt) : 0,
    ultimaVentana: params.ultimaVentana,
  };
}

/** Envuelve resultados de backends externos (browser/uia) que reportan un string. */
export function wrapExternalBackendResult(mensaje: string, startedAt: number): DesktopTaskOutcome {
  return buildTaskOutcome({ taskId: null, estado: 'completada', mensaje, startedAt });
}
