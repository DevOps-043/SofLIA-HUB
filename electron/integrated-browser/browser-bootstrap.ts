/**
 * Arranque del mundo del agente en cada documento de la pestana.
 *
 * `executeJavaScriptInIsolatedWorld` solo alcanza el marco principal y solo
 * corre cuando alguien lo pide, asi que hasta ahora todo lo que el producto
 * inyecta habia que reinstalarlo despues de cada `did-finish-load`. En una
 * aplicacion de pagina unica eso llega tarde —el sitio ya ejecuto su codigo— y
 * en los marcos secundarios no llegaba nunca.
 *
 * `Page.addScriptToEvaluateOnNewDocument` registra el arranque una sola vez y
 * Chromium lo ejecuta en **cada marco y cada navegacion, antes del script del
 * sitio**. Con `worldName` el codigo nace ya en un mundo aislado, y
 * `Runtime.addBinding` abre un canal real de la pagina al proceso principal:
 * hasta ahora el aviso viajaba por `console-message`, que es un canal que la
 * propia pagina puede inundar o imitar.
 *
 * Las dos capacidades solo viven mientras la sesion de inspeccion siga adjunta,
 * de ahi el arrendamiento persistente. Eso choca con DevTools, que exige ser el
 * unico cliente: cuando el usuario lo abre, Chromium nos expulsa. No se disputa
 * la sesion. Se cede, se marca el arranque como degradado —el servicio vuelve a
 * su reinstalacion por carga— y al cerrar DevTools se recupera solo.
 *
 * Limite conocido: el mundo con nombre que crea CDP y el mundo numerico de
 * `executeJavaScriptInIsolatedWorld` son contextos distintos. Este modulo
 * rastrea el `executionContextId` del mundo con nombre por marco para que la
 * observacion pueda unificarse sobre el mas adelante; hoy el registro de
 * referencias sigue viviendo en el mundo numerico del marco principal.
 */

import type { WebContents } from 'electron';
import { AGENT_WORLD_NAME } from './agent-world';
import { acquireCdpLease, type CdpLease } from './cdp-session';

/** Nombre del puente que el arranque expone dentro del mundo del agente. */
export const AGENT_BRIDGE_BINDING = '__sofliaAgentBridge';

/** Version del arranque. Viaja en cada aviso para detectar marcos rezagados. */
export const AGENT_BOOTSTRAP_VERSION = 1;

export type BrowserBridgeMessage =
  | { type: 'documento-listo'; url: string; version: number }
  | { type: 'aviso'; detalle: string };

export interface BrowserBootstrapOptions {
  /** Mensaje del mundo del agente. Es contenido no confiable, como el DOM. */
  onMessage?: (message: BrowserBridgeMessage, frameId: string) => void;
  /** La sesion se perdio: el llamador debe volver a su camino sin CDP. */
  onDegraded?: (reason: string) => void;
  /** El arranque volvio a quedar instalado tras recuperar la sesion. */
  onRestored?: () => void;
}

/** Longitud maxima de un aviso. El puente lo escribe la pagina. */
const MAX_MESSAGE_CHARS = 4_000;

/**
 * Codigo que Chromium ejecuta al inicio de cada documento. Se mantiene minimo a
 * proposito: corre en el camino critico de carga de **todos** los marcos, y lo
 * que aqui cueste lo paga el usuario en cada navegacion.
 */
const BOOTSTRAP_SOURCE = `(() => {
  const puente = globalThis[${JSON.stringify(AGENT_BRIDGE_BINDING)}];
  if (typeof puente !== 'function') return;
  const enviar = (mensaje) => {
    try { puente(JSON.stringify(mensaje)); } catch {}
  };
  Object.defineProperty(globalThis, '__sofliaAgentWorld', {
    value: Object.freeze({ version: ${AGENT_BOOTSTRAP_VERSION}, enviar }),
    configurable: true,
  });
  enviar({ type: 'documento-listo', url: String(location.href).slice(0, 500), version: ${AGENT_BOOTSTRAP_VERSION} });
})()`;

export class IntegratedBrowserBootstrap {
  private lease: CdpLease | null = null;
  private scriptId: string | null = null;
  private installing: Promise<boolean> | null = null;
  private disposed = false;
  /** Marco -> contexto del mundo con nombre, para dirigir evaluaciones futuras. */
  private readonly contexts = new Map<string, number>();

  constructor(
    private readonly contents: WebContents,
    private readonly options: BrowserBootstrapOptions = {},
  ) {}

  get active(): boolean {
    return this.lease?.alive === true && this.scriptId !== null;
  }

  /** Contexto del mundo del agente en un marco, si Chromium ya lo creo. */
  executionContextFor(frameId: string): number | undefined {
    return this.contexts.get(frameId);
  }

  /**
   * Instala el arranque. Es idempotente y seguro de llamar en cualquier momento:
   * devuelve `false` en vez de lanzar cuando la sesion no esta disponible, que
   * es el caso corriente si el usuario tiene DevTools abierto.
   */
  async install(): Promise<boolean> {
    if (this.disposed || this.contents.isDestroyed()) return false;
    if (this.active) return true;
    if (this.installing) return this.installing;
    this.installing = this.doInstall().finally(() => { this.installing = null; });
    return this.installing;
  }

  private async doInstall(): Promise<boolean> {
    try {
      const lease = await acquireCdpLease(this.contents, ['Page', 'Runtime'], {
        onLost: (reason) => this.handleLost(reason),
      });
      this.lease = lease;
      this.contexts.clear();

      lease.on('Runtime.executionContextCreated', (params) => this.trackContext(params));
      lease.on('Runtime.executionContextsCleared', () => this.contexts.clear());
      lease.on('Runtime.bindingCalled', (params) => this.handleBinding(params));

      await lease.send('Runtime.addBinding', {
        name: AGENT_BRIDGE_BINDING,
        executionContextName: AGENT_WORLD_NAME,
      });
      const registered = await lease.send('Page.addScriptToEvaluateOnNewDocument', {
        source: BOOTSTRAP_SOURCE,
        worldName: AGENT_WORLD_NAME,
        // Sin esto el arranque solo aplicaria a la siguiente navegacion y la
        // pagina que el usuario ya tiene abierta se quedaria sin mundo.
        runImmediately: true,
      });
      this.scriptId = typeof registered?.identifier === 'string' ? registered.identifier : null;
      if (!this.scriptId) {
        await this.teardown();
        return false;
      }
      this.options.onRestored?.();
      return true;
    } catch (error) {
      // DevTools abierto, pestana cerrandose o dominio no disponible. Ninguno
      // es un fallo del producto: el llamador sigue con su camino sin CDP.
      this.lease = null;
      this.scriptId = null;
      this.options.onDegraded?.(error instanceof Error ? error.message : String(error));
      return false;
    }
  }

  private trackContext(params: Record<string, unknown>): void {
    const context = params.context as { id?: unknown; name?: unknown; auxData?: { frameId?: unknown } } | undefined;
    if (!context || context.name !== AGENT_WORLD_NAME) return;
    const frameId = context.auxData?.frameId;
    if (typeof context.id !== 'number' || typeof frameId !== 'string') return;
    this.contexts.set(frameId, context.id);
  }

  private handleBinding(params: Record<string, unknown>): void {
    if (params.name !== AGENT_BRIDGE_BINDING) return;
    const payload = params.payload;
    if (typeof payload !== 'string' || payload.length > MAX_MESSAGE_CHARS) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(payload);
    } catch {
      return;
    }
    const message = normalizeMessage(parsed);
    if (!message) return;
    const frameId = typeof params.executionContextId === 'number'
      ? this.frameForContext(params.executionContextId)
      : '';
    this.options.onMessage?.(message, frameId);
  }

  private frameForContext(contextId: number): string {
    for (const [frameId, id] of this.contexts) if (id === contextId) return frameId;
    return '';
  }

  private handleLost(reason: string): void {
    this.lease = null;
    this.scriptId = null;
    this.contexts.clear();
    if (this.disposed) return;
    this.options.onDegraded?.(reason);
  }

  /** Suelta el arranque sin desmontar el objeto: permite reinstalar despues. */
  private async teardown(): Promise<void> {
    const lease = this.lease;
    const scriptId = this.scriptId;
    this.lease = null;
    this.scriptId = null;
    this.contexts.clear();
    if (!lease?.alive) return;
    if (scriptId) {
      await lease.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId }).catch(() => undefined);
    }
    await lease.send('Runtime.removeBinding', { name: AGENT_BRIDGE_BINDING }).catch(() => undefined);
    await lease.release();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.teardown();
  }
}

function normalizeMessage(value: unknown): BrowserBridgeMessage | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  if (record.type === 'documento-listo') {
    return {
      type: 'documento-listo',
      url: clean(record.url, 500),
      version: typeof record.version === 'number' ? record.version : 0,
    };
  }
  if (record.type === 'aviso') return { type: 'aviso', detalle: clean(record.detalle, 500) };
  return null;
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string'
    ? value.replace(/[\p{Cc}]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, max)
    : '';
}
