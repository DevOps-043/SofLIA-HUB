/**
 * Mundo aislado del agente dentro de la pagina.
 *
 * La observacion del DOM y la resolucion de elementos corrian en el mundo
 * principal: el mismo contexto de JavaScript que el sitio. Eso dejaba dos
 * problemas reales. El registro de elementos (`window.__sofliaBrowserRefs`)
 * quedaba a la vista de la pagina, que podia leerlo o reemplazarlo para desviar
 * un clic del agente; y cualquier variable del sitio con el mismo nombre
 * colisionaba con la nuestra.
 *
 * Un mundo aislado comparte el DOM pero no el heap de V8: el `window` que ve
 * este codigo es un objeto global distinto del que ve el sitio. El registro deja
 * de ser alcanzable desde la pagina sin perder ninguna capacidad, porque
 * `getBoundingClientRect`, `scrollIntoView` y `elementFromPoint` operan sobre el
 * mismo arbol.
 *
 * Limite conocido: `WebContentsView.executeJavaScriptInIsolatedWorld` solo
 * alcanza el marco principal, y `WebFrameMain` no expone la API en Electron 44.
 * Por eso el vigia de seleccion y el panel de redaccion, que se instalan marco
 * por marco, siguen en el mundo principal: inyectan interfaz visible para la
 * persona, no herramientas del agente, y su superficie de riesgo es otra.
 */

import type { WebContents } from 'electron';

/**
 * Identificador del mundo. Chromium reserva el 0 para el contenido de la pagina
 * y Electron usa el 999 para su propio `contextIsolation`; el rango valido
 * llega a 536870911. Se elige un valor alto y fijo para no chocar con las
 * extensiones, que numeran desde abajo.
 */
export const AGENT_WORLD_ID = 1_974;

/** Nombre del mundo tal como lo veran las herramientas de CDP. */
export const AGENT_WORLD_NAME = 'soflia-agent';

/**
 * Superficie minima que necesita el ejecutor. Se define de forma estructural
 * para que las pruebas puedan pasar un doble sin construir un `WebContents`.
 */
export interface AgentWorldTarget {
  executeJavaScript(code: string, userGesture?: boolean): Promise<unknown>;
  executeJavaScriptInIsolatedWorld?(
    worldId: number,
    scripts: Array<{ code: string; url?: string }>,
    userGesture?: boolean,
  ): Promise<unknown>;
}

export function supportsAgentWorld(target: AgentWorldTarget): boolean {
  return typeof target.executeJavaScriptInIsolatedWorld === 'function';
}

/**
 * Ejecuta el codigo en el mundo del agente. Si el destino no expone la API
 * —un marco secundario o un doble de prueba— cae al mundo principal en lugar de
 * fallar: perder el aislamiento degrada la garantia, pero perder la lectura del
 * DOM deja al agente ciego.
 */
export async function runInAgentWorld(target: AgentWorldTarget, code: string): Promise<unknown> {
  if (typeof target.executeJavaScriptInIsolatedWorld === 'function') {
    return target.executeJavaScriptInIsolatedWorld(AGENT_WORLD_ID, [{ code }], true);
  }
  return target.executeJavaScript(code, true);
}

/**
 * Igual que `runInAgentWorld`, pero acotado a un `WebContents` real. Existe solo
 * para que los llamadores del servicio no tengan que ensanchar el tipo.
 */
export function runInAgentWorldOn(contents: WebContents, code: string): Promise<unknown> {
  return runInAgentWorld(contents as unknown as AgentWorldTarget, code);
}
