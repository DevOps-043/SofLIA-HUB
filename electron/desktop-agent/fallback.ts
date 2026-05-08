import type { WindowsUIAFallbackRunResult } from './types';

export function buildDesktopFallbackTask(
  originalTask: string,
  runResult: WindowsUIAFallbackRunResult,
): string {
  return `${originalTask}

Contexto adicional del intento previo con windows_uia:
- Falla detectada: ${runResult.message}
- Categoria: ${runResult.failureCategory}
- Ultima verificacion: ${runResult.verification || 'sin detalle'}
- Reporte UIA: ${runResult.reportPath || 'sin reporte'}
- Traza UIA: ${runResult.tracePath || 'sin traza'}

Continua desde el estado ACTUAL de la pantalla usando vision desktop. No reinicies la tarea desde cero salvo que sea imprescindible.`;
}
