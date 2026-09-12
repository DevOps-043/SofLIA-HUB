import { runComputerUseLoop } from './loop';
import type { BrowserCuSupervisor } from '../browser-cu-supervisor';

/** Reanuda con percepción nueva y el mismo driver/guarda de destino y presupuesto total. */
export async function runSupervisedCuLoop(options: Parameters<typeof runComputerUseLoop>[0], control: BrowserCuSupervisor) {
  let used = 0;
  let resumed = false;
  for (;;) {
    if (control.signal.aborted) return { estado: 'cancelada' as const, mensaje: 'Tarea cancelada.', pasos: used };
    if (used >= options.maxSteps) return { estado: 'presupuesto_agotado' as const, mensaje: 'Se alcanzó el límite de pasos.', pasos: used };
    const result = await runComputerUseLoop({
      ...options,
      task: resumed ? `${options.task}\n\nLa tarea fue pausada después de ${used} pasos intentados. Continúa desde la página actual. No repitas operaciones ya aplicadas; si no puedes comprobar si una operación sensible ocurrió, detente y pide revisión al usuario.` : options.task,
      maxSteps: options.maxSteps - used,
      abortSignal: control.beginPhase(),
      onStep: step => options.onStep?.({ ...step, step: used + step.step }),
    });
    used += result.pasos;
    if (control.pauseRequested && !control.signal.aborted) {
      try { await control.waitForResume(); }
      catch { return { estado: 'cancelada' as const, mensaje: 'Tarea cancelada.', pasos: used }; }
      resumed = true;
      continue;
    }
    return { ...result, pasos: used };
  }
}
