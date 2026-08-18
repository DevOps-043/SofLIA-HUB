/**
 * Sesion CDP compartida sobre una pestana del navegador integrado.
 *
 * `webContents.debugger` admite un solo cliente por `WebContents`. Antes cada
 * consumidor hacia su propio `attach`/`detach` (el modo lectura y la captura de
 * accesibilidad de Computer Use), asi que dos capturas solapadas se pisaban: la
 * primera en terminar desconectaba la sesion que la otra seguia usando.
 *
 * Este modulo centraliza el ciclo de vida con dos contadores: uno por sesion y
 * otro por dominio. La sesion se abre en el primer uso y se cierra cuando el
 * ultimo consumidor la suelta; un dominio se habilita una vez y se deshabilita
 * cuando nadie lo necesita. Mantener los dominios apagados fuera de la captura
 * no es cosmetico: `Accessibility` y `DOMSnapshot` activos cuestan CPU y memoria
 * reales en paginas grandes, y el usuario lo nota mientras navega.
 *
 * Cuando el usuario abre DevTools, Chromium ya tiene tomada la sesion y
 * `attach` falla. Ese caso no es un error del producto: se propaga como
 * {@link CdpUnavailableError} para que el llamador degrade a su camino en
 * JavaScript en vez de romper la funcion.
 */

import type { WebContents } from 'electron';

/** La sesion CDP no esta disponible: pestana destruida o DevTools la ocupa. */
export class CdpUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CdpUnavailableError';
  }
}

export type CdpSend = (method: string, params?: Record<string, unknown>) => Promise<Record<string, unknown>>;

/** Manejador de un evento del protocolo (`Runtime.bindingCalled`, etc.). */
export type CdpEventHandler = (params: Record<string, unknown>) => void;

interface SessionState {
  /** Consumidores vivos de la sesion. */
  users: number;
  /** Dominio habilitado -> consumidores que lo pidieron. */
  domains: Map<string, number>;
  /** Falso cuando la sesion ya estaba tomada al llegar el primer consumidor. */
  owned: boolean;
  /** Metodo del protocolo -> suscriptores. Solo lo usan los arrendamientos. */
  listeners: Map<string, Set<CdpEventHandler>>;
  /** Avisos de cierre forzado, para que cada arrendatario degrade. */
  lost: Set<(reason: string) => void>;
  /** Verdadero cuando ya se engancho el despacho de eventos de esta pestana. */
  bound: boolean;
}

const sessions = new WeakMap<WebContents, SessionState>();

function newState(): SessionState {
  return { users: 0, domains: new Map(), owned: false, listeners: new Map(), lost: new Set(), bound: false };
}

/**
 * Version del protocolo. 1.3 es la estable de Chromium y la que ya usaba la
 * captura de accesibilidad; cambiarla obliga a revisar cada comando.
 */
const PROTOCOL_VERSION = '1.3';

/**
 * Ejecuta `run` con la sesion abierta y los dominios habilitados, y libera lo
 * que haya tomado pase lo que pase. Los dominios se pasan sin sufijo: se
 * traducen a `<dominio>.enable` y `<dominio>.disable`.
 */
export async function withCdpSession<T>(
  contents: WebContents,
  domains: readonly string[],
  run: (send: CdpSend) => Promise<T>,
): Promise<T> {
  const state = await acquire(contents, domains);
  const send: CdpSend = async (method, params) => {
    if (contents.isDestroyed()) throw new CdpUnavailableError('La pestana se cerro durante la operacion.');
    return await contents.debugger.sendCommand(method, params) as Record<string, unknown>;
  };
  try {
    return await run(send);
  } finally {
    await release(contents, state, domains);
  }
}

async function acquire(contents: WebContents, domains: readonly string[]): Promise<SessionState> {
  if (contents.isDestroyed()) throw new CdpUnavailableError('La pestana ya no existe.');
  let state = sessions.get(contents);
  if (!state) {
    state = newState();
    sessions.set(contents, state);
  }
  if (state.users === 0) {
    // `isAttached` solo informa de nuestra propia conexion. Si DevTools tiene la
    // sesion, `isAttached` es falso y es `attach` quien falla: por eso se
    // intenta siempre y se interpreta el error.
    if (!contents.debugger.isAttached()) {
      try {
        contents.debugger.attach(PROTOCOL_VERSION);
      } catch (error) {
        throw new CdpUnavailableError(
          `No se pudo abrir la sesion de inspeccion: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      state.owned = true;
      // Si Chromium cierra la sesion por su cuenta (recarga, cierre de la
      // pestana, DevTools que toma el control) el estado local queda mintiendo.
      contents.debugger.once('detach', (_event: unknown, reason?: unknown) => {
        const current = sessions.get(contents);
        if (!current) return;
        current.users = 0;
        current.owned = false;
        current.domains.clear();
        current.listeners.clear();
        const aviso = typeof reason === 'string' && reason ? reason : 'sesion cerrada por Chromium';
        for (const handler of [...current.lost]) {
          try {
            handler(aviso);
          } catch {
            // Un arrendatario que falla al degradar no debe impedir que los
            // demas se enteren de que la sesion ya no existe.
          }
        }
      });
    }
  }
  state.users += 1;

  for (const domain of domains) {
    const previous = state.domains.get(domain) ?? 0;
    if (previous === 0) {
      try {
        await contents.debugger.sendCommand(`${domain}.enable`);
      } catch (error) {
        // Deshacer lo ya tomado antes de propagar: un dominio que no engancha
        // no debe dejar la sesion abierta ni los anteriores habilitados.
        state.domains.set(domain, 1);
        await release(contents, state, domains);
        throw new CdpUnavailableError(
          `No se pudo habilitar ${domain}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    state.domains.set(domain, previous + 1);
  }
  return state;
}

async function release(contents: WebContents, state: SessionState, domains: readonly string[]): Promise<void> {
  for (const domain of domains) {
    const previous = state.domains.get(domain) ?? 0;
    if (previous <= 1) {
      state.domains.delete(domain);
      if (previous === 1 && !contents.isDestroyed()) {
        await contents.debugger.sendCommand(`${domain}.disable`).catch(() => undefined);
      }
    } else {
      state.domains.set(domain, previous - 1);
    }
  }
  state.users = Math.max(0, state.users - 1);
  if (state.users > 0 || !state.owned) return;
  state.owned = false;
  if (contents.isDestroyed()) return;
  try {
    if (contents.debugger.isAttached()) contents.debugger.detach();
  } catch {
    // La pestana puede cerrarse entre la ultima operacion y la liberacion.
  }
}

/**
 * Sesion retenida en el tiempo, no acotada a una operacion.
 *
 * Existe porque hay dos capacidades del protocolo que solo viven mientras la
 * sesion sigue adjunta: `Page.addScriptToEvaluateOnNewDocument`, cuyo registro
 * se borra al desconectar, y `Runtime.addBinding`, cuyos eventos dejan de
 * llegar. Un `withCdpSession` no sirve para eso.
 */
export interface CdpLease {
  send: CdpSend;
  /** Suscribe un metodo del protocolo. Se limpia solo al soltar o al perderla. */
  on(method: string, handler: CdpEventHandler): void;
  /** Falso en cuanto Chromium cierra la sesion o el arrendatario la suelta. */
  readonly alive: boolean;
  release(): Promise<void>;
}

export interface CdpLeaseOptions {
  /**
   * Aviso de cierre forzado. Es el camino normal cuando el usuario abre
   * DevTools: Chromium nos expulsa y el arrendatario debe degradar, no fallar.
   */
  onLost?: (reason: string) => void;
}

/**
 * Toma la sesion y la mantiene abierta hasta que se suelte. El arrendatario
 * hereda el mismo contador que `withCdpSession`, asi que una captura puntual
 * que ocurra mientras tanto reutiliza la conexion en vez de abrir otra.
 */
export async function acquireCdpLease(
  contents: WebContents,
  domains: readonly string[],
  options: CdpLeaseOptions = {},
): Promise<CdpLease> {
  const state = await acquire(contents, domains);
  bindEvents(contents, state);

  let alive = true;
  const owned = new Map<string, CdpEventHandler>();
  const onLost = (reason: string) => {
    if (!alive) return;
    alive = false;
    owned.clear();
    options.onLost?.(reason);
  };
  state.lost.add(onLost);

  return {
    send: async (method, params) => {
      if (!alive) throw new CdpUnavailableError('El arrendamiento de inspeccion ya no esta vigente.');
      if (contents.isDestroyed()) throw new CdpUnavailableError('La pestana se cerro durante la operacion.');
      return await contents.debugger.sendCommand(method, params) as Record<string, unknown>;
    },
    on: (method, handler) => {
      if (!alive) return;
      owned.set(method, handler);
      const current = state.listeners.get(method) ?? new Set<CdpEventHandler>();
      current.add(handler);
      state.listeners.set(method, current);
    },
    get alive() { return alive; },
    release: async () => {
      if (!alive) {
        // Ya lo solto Chromium: el contador se puso a cero en el aviso de
        // cierre y restar otra vez desbalancearia a los demas consumidores.
        state.lost.delete(onLost);
        return;
      }
      alive = false;
      state.lost.delete(onLost);
      for (const [method, handler] of owned) state.listeners.get(method)?.delete(handler);
      owned.clear();
      await release(contents, state, domains);
    },
  };
}

/**
 * Engancha el despacho de eventos una sola vez por pestana. Solo lo necesitan
 * los arrendamientos: una captura puntual pregunta y responde, no escucha.
 */
function bindEvents(contents: WebContents, state: SessionState): void {
  if (state.bound) return;
  state.bound = true;
  contents.debugger.on('message', (_event: unknown, method: string, params: Record<string, unknown>) => {
    const handlers = state.listeners.get(method);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      try {
        handler(params ?? {});
      } catch {
        // El contenido de la pagina llega por aqui: un mensaje malformado no
        // puede tumbar el despacho del resto.
      }
    }
  });
}

/** Solo para pruebas: olvida el estado acumulado de una pestana. */
export function resetCdpSessionState(contents: WebContents): void {
  sessions.delete(contents);
}
