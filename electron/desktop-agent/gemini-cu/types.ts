/**
 * Contratos del backend Gemini Computer Use (CU).
 *
 * El modelo (`gemini-3.5-flash`) devuelve, por la vía entrenada `computer_use`,
 * una `function_call` con una accion de UI y coordenadas NORMALIZADAS 0-999
 * sobre la captura enviada. Aqui se normaliza a una accion interna (`CuAction`)
 * con coordenadas ya en PIXELES de la captura; cada driver (desktop/browser) la
 * ejecuta con su mecanismo (nut.js / Playwright).
 */

export type CuPoint = { x: number; y: number };

/** Entorno de operacion del modelo. */
export type CuEnvironment = 'ENVIRONMENT_DESKTOP' | 'ENVIRONMENT_BROWSER';

/** Decision de seguridad que acompaña a una accion del modelo. */
export type CuSafety = {
  decision: 'allowed' | 'require_confirmation' | 'blocked';
  explanation?: string;
} | null;

/** function_call cruda del SDK (@google/genai). */
export type CuFunctionCall = {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
};

/** Accion interna normalizada; coordenadas en PIXELES de la captura. */
export type CuAction =
  | { tipo: 'click' | 'double_click' | 'right_click' | 'middle_click' | 'move' | 'mouse_down' | 'mouse_up'; punto: CuPoint }
  | { tipo: 'type'; texto: string; enter: boolean }
  | { tipo: 'key'; teclas: string }
  | { tipo: 'scroll'; direccion: 'up' | 'down' | 'left' | 'right'; magnitud: number; punto?: CuPoint }
  | { tipo: 'drag'; desde: CuPoint; hasta: CuPoint }
  | { tipo: 'wait'; ms: number }
  | { tipo: 'navigate'; url: string }
  | { tipo: 'go_back' }
  | { tipo: 'go_forward' }
  | { tipo: 'screenshot' }
  | { tipo: 'desconocida'; nombre: string; args: Record<string, unknown> };

/** Resultado de mapear una function_call: accion + intent + seguridad. */
export type CuMappedCall = {
  callId: string | null;
  nombreOriginal: string;
  action: CuAction;
  intent: string;
  safety: CuSafety;
};

/** Captura para el modelo: imagen + dimensiones REALES (para denormalizar 0-999). */
export type CuCapture = { base64: string; width: number; height: number };

/**
 * Driver de ejecucion: abstrae "capturar pantalla" y "ejecutar accion" para que
 * el loop sea agnostico del entorno (desktop nut.js / browser Playwright).
 */
export interface CuDriver {
  readonly entorno: CuEnvironment;
  capturar(): Promise<CuCapture>;
  ejecutar(action: CuAction, intent: string): Promise<void>;
  /** Contexto extra para el function_response (p.ej. url actual del navegador). */
  contexto?(): Record<string, unknown>;
}
