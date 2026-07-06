/**
 * Contrato de finalizacion estructurado de una tarea del agente de escritorio.
 * Permite al agente conversacional distinguir "completada" de "se agotaron los
 * pasos" o "expiro en cola", en lugar de interpretar un string plano.
 */
export type DesktopTaskEstado =
  | 'completada'
  | 'fallida'
  | 'cancelada'
  | 'presupuesto_agotado'
  | 'cola_expirada';

export type DesktopTaskOutcome = {
  taskId: string | null;
  estado: DesktopTaskEstado;
  mensaje: string;
  pasosEjecutados: number;
  duracionMs: number;
  ultimaVentana?: string;
};

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
