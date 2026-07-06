import type { CuAction, CuFunctionCall, CuMappedCall, CuPoint, CuSafety } from './types';

/**
 * Mapea una function_call de Computer Use a una accion interna, denormalizando
 * las coordenadas 0-999 a PIXELES de la captura. PURO/testeable.
 *
 * Los nombres de accion siguen el conjunto predefinido de CU (click, type,
 * scroll, drag_and_drop, press_key, hotkey, wait, navigate, ...). Los nombres de
 * argumento se leen de forma DEFENSIVA (varias variantes) porque el esquema
 * exacto puede variar por entorno/version; una accion no reconocida se marca
 * como 'desconocida' en vez de romper el loop.
 */

const CU_COORD_SCALE = 1000; // el modelo normaliza a 0-999

/** Denormaliza un valor 0-999 a pixeles de una dimension. Robusto a NaN/strings. */
export function denormalizar(valor: unknown, dimension: number): number {
  const n = typeof valor === 'number' ? valor : Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n / CU_COORD_SCALE) * dimension);
}

function leer(args: Record<string, unknown>, claves: string[]): unknown {
  for (const clave of claves) {
    if (args[clave] !== undefined && args[clave] !== null) return args[clave];
  }
  return undefined;
}

function punto(args: Record<string, unknown>, w: number, h: number, ejeX: string[], ejeY: string[]): CuPoint {
  return { x: denormalizar(leer(args, ejeX), w), y: denormalizar(leer(args, ejeY), h) };
}

export function extraerSafety(args: Record<string, unknown>): CuSafety {
  const raw = args['safety_decision'] ?? args['safetyDecision'];
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const decision = String(obj['decision'] ?? '');
  if (decision === 'require_confirmation' || decision === 'blocked' || decision === 'allowed') {
    return { decision, explanation: obj['explanation'] ? String(obj['explanation']) : undefined };
  }
  return null;
}

export function mapCuFunctionCall(fc: CuFunctionCall, screenshotWidth: number, screenshotHeight: number): CuMappedCall {
  const nombre = String(fc.name ?? '').trim();
  const args = (fc.args ?? {}) as Record<string, unknown>;
  const w = screenshotWidth;
  const h = screenshotHeight;
  const intent = typeof args['intent'] === 'string' ? (args['intent'] as string) : '';

  return {
    callId: fc.id ?? null,
    nombreOriginal: nombre,
    intent,
    safety: extraerSafety(args),
    action: mapAccion(nombre, args, w, h),
  };
}

function mapAccion(nombre: string, args: Record<string, unknown>, w: number, h: number): CuAction {
  const p = (): CuPoint => punto(args, w, h, ['x', 'coordinate_x', 'pos_x'], ['y', 'coordinate_y', 'pos_y']);

  switch (nombre) {
    case 'click':
    case 'left_click':
      return { tipo: 'click', punto: p() };
    case 'double_click':
      return { tipo: 'double_click', punto: p() };
    case 'right_click':
      return { tipo: 'right_click', punto: p() };
    case 'middle_click':
      return { tipo: 'middle_click', punto: p() };
    case 'move':
    case 'mouse_move':
    case 'hover':
    case 'hover_at':
      return { tipo: 'move', punto: p() };
    case 'mouse_down':
    case 'left_mouse_down':
      return { tipo: 'mouse_down', punto: p() };
    case 'mouse_up':
    case 'left_mouse_up':
      return { tipo: 'mouse_up', punto: p() };

    case 'type':
    case 'type_text':
    case 'type_text_at': {
      const texto = String(leer(args, ['text', 'texto', 'value']) ?? '');
      const enter = Boolean(leer(args, ['press_enter', 'pressEnter', 'enter']));
      return { tipo: 'type', texto, enter };
    }

    case 'press_key':
    case 'key':
    case 'hotkey':
    case 'key_combination':
    case 'keypress': {
      const teclas = normalizarTeclas(leer(args, ['keys', 'key', 'combination', 'text']));
      return { tipo: 'key', teclas };
    }

    case 'scroll':
    case 'scroll_at':
    case 'scroll_document': {
      const dir = String(leer(args, ['direction', 'direccion']) ?? 'down').toLowerCase();
      const direccion = (['up', 'down', 'left', 'right'].includes(dir) ? dir : 'down') as 'up' | 'down' | 'left' | 'right';
      const magNum = Number(leer(args, ['magnitude', 'amount', 'scroll_amount', 'clicks']) ?? 3);
      const magnitud = Number.isFinite(magNum) && magNum > 0 ? Math.min(Math.round(magNum), 20) : 3;
      const tieneCoord = leer(args, ['x', 'coordinate_x']) !== undefined;
      return { tipo: 'scroll', direccion, magnitud, punto: tieneCoord ? p() : undefined };
    }

    case 'drag':
    case 'drag_and_drop':
    case 'left_click_drag': {
      const desde = punto(args, w, h, ['x', 'start_x', 'from_x'], ['y', 'start_y', 'from_y']);
      const hasta = punto(args, w, h, ['destination_x', 'end_x', 'to_x', 'x2'], ['destination_y', 'end_y', 'to_y', 'y2']);
      return { tipo: 'drag', desde, hasta };
    }

    case 'wait':
    case 'wait_5_seconds': {
      const ms = Number(leer(args, ['ms', 'milliseconds', 'duration_ms']) ?? (nombre === 'wait_5_seconds' ? 5000 : 1000));
      return { tipo: 'wait', ms: Number.isFinite(ms) && ms > 0 ? Math.min(ms, 15000) : 1000 };
    }

    case 'navigate':
    case 'open_web_browser': {
      const url = String(leer(args, ['url', 'uri', 'address']) ?? '');
      return { tipo: 'navigate', url };
    }
    case 'go_back':
      return { tipo: 'go_back' };
    case 'go_forward':
      return { tipo: 'go_forward' };
    case 'take_screenshot':
    case 'screenshot':
      return { tipo: 'screenshot' };

    default:
      return { tipo: 'desconocida', nombre, args };
  }
}

/** Normaliza combinaciones de teclas a un string tipo "ctrl+s"; acepta array o string. */
export function normalizarTeclas(valor: unknown): string {
  if (Array.isArray(valor)) return valor.map((k) => String(k).trim().toLowerCase()).filter(Boolean).join('+');
  return String(valor ?? '').trim().toLowerCase().replace(/\s+/g, '+');
}
