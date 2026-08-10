/**
 * Decision de si el turno usa el bucle de herramientas.
 *
 * Vive aparte porque es la regla que decide si el modelo recibe herramientas
 * o no, y equivocarla no da un error: da un modelo que ESCRIBE las llamadas
 * como texto (`<tool_call> to=read_browser_dom`) porque no tiene ninguna que
 * ejecutar. Aislada se puede probar; dentro del pipeline no.
 */
export interface ToolLoopSignals {
  /** Herramientas que declara la Skill activa del turno. */
  skillToolCount: number;
  /** El turno necesita el navegador y no hay observacion utilizable. */
  requiresBrowserCapabilities: boolean;
  /** Hay observacion del navegador y el usuario solo pregunta por ella. */
  isReadOnlyBrowserObservation: boolean;
  /** Consulta informativa que se resuelve con busqueda web. */
  isPureWebResearch: boolean;
  /** La intencion por palabras clave pide herramientas locales. */
  hasToolIntent: boolean;
}

export function shouldRunToolLoop(signals: ToolLoopSignals): boolean {
  // Una Skill que declara herramientas DEFINE el turno: existe para que el
  // modelo actue, no para que describa. Va primero porque debe ganar incluso
  // sobre una observacion de solo lectura del navegador.
  if (signals.skillToolCount > 0) return true;

  if (signals.requiresBrowserCapabilities) return true;

  return !signals.isReadOnlyBrowserObservation
    && !signals.isPureWebResearch
    && signals.hasToolIntent;
}
