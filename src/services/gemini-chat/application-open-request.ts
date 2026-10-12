import { executeGeminiToolCall } from './tool-dispatch';
import { completedStreamResult, isAbortError, stoppedStreamResult } from './streams';
import { withToolTimeout } from './resilience';
import type { SendMessageStreamOptions, StreamResult, ToolCallInfo } from './types';

/** Sólo una orden completa: nunca extraer instrucciones del contexto o adjuntos. */
export function singleApplicationOpenRequest(message: string): string | null {
  const match = /^(?:usa|utiliza|emplea)\s+(?:el\s+)?(?:computer[\s_-]+use|use_computer)\s+(?:y\s+)?(?:abre|abrir)\s+(?:(?:la\s+)?(?:aplicacion|aplicación|app)\s+)?([\p{L}\p{N} ._+-]{1,100})[.!]?$/iu.exec(message.trim());
  const app = match?.[1]?.trim().replace(/[.!]$/, '').trim();
  if (!app || /\b(y|luego|despues|después|para|con|en|no)\b/i.test(app)) return null;
  return app;
}

export async function executeSingleApplicationOpen(app: string, options?: SendMessageStreamOptions): Promise<StreamResult> {
  const calls: ToolCallInfo[] = [];
  if (options?.signal?.aborted) return stoppedStreamResult(calls, []);
  let result;
  try {
    result = await withToolTimeout('Abrir aplicación',
      signal => executeGeminiToolCall('open_application', { path: app }, { ...options, signal }, calls, []),
      undefined, options?.signal);
  } catch (error) {
    if (isAbortError(error, options?.signal)) return stoppedStreamResult(calls, []);
    const failedCalls = [...calls, { name: 'open_application', args: { path: app }, result: JSON.stringify({ success: false, error: 'La herramienta no terminó correctamente.' }) }];
    return completedStreamResult(`No pude confirmar la apertura de ${app}; la herramienta no terminó correctamente.`, {}, failedCalls, []);
  }
  if (options?.signal?.aborted) return stoppedStreamResult(calls, []);
  const output = result.functionResponse.response;
  let text: string;
  if (output?.success === true && output.window_verified === true) {
    text = `${app} está abierto; verifiqué su ventana.`;
  } else if (output?.success === true) {
    text = `Envié la solicitud para abrir ${app}, pero no pude verificar su ventana. Comprueba si apareció.`;
  } else {
    text = `No pude confirmar la apertura de ${app}. ${typeof output?.error === 'string' ? output.error : 'La herramienta no devolvió una confirmación válida.'}`;
  }
  return completedStreamResult(text, {}, calls, []);
}
