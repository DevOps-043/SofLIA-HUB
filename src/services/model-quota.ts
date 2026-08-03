import { OPENAI_MODELS } from '../config';

/** Pulse Max: el modelo caro del catalogo, limitado por mes. */
export const PULSE_MAX_MODEL_ID = OPENAI_MODELS.COMPUTER_USE;
export const PULSE_MAX_MONTHLY_LIMIT = 3;

const STORAGE_PREFIX = 'pulse:max-quota:';

export interface PulseMaxQuota {
  /** Periodo 'YYYY-MM' al que pertenece el conteo. */
  periodo: string;
  usos: number;
  /** Tokens acumulados en el periodo; es el costo real que motiva el limite. */
  tokens: number;
}

export function currentPeriod(now: Date = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Lectura del consumo del periodo en curso. Al cambiar de mes el contador se
 * reinicia solo: no hace falta un job de limpieza.
 */
export function readPulseMaxQuota(userId?: string): PulseMaxQuota {
  const periodo = currentPeriod();
  const vacio: PulseMaxQuota = { periodo, usos: 0, tokens: 0 };
  const raw = safeGetItem(storageKey(userId));
  if (!raw) return vacio;
  try {
    const parsed = JSON.parse(raw) as Partial<PulseMaxQuota>;
    if (parsed?.periodo !== periodo) return vacio;
    return {
      periodo,
      usos: Number.isFinite(parsed.usos) ? Number(parsed.usos) : 0,
      tokens: Number.isFinite(parsed.tokens) ? Number(parsed.tokens) : 0,
    };
  } catch {
    return vacio;
  }
}

export function remainingPulseMaxUses(userId?: string): number {
  return Math.max(0, PULSE_MAX_MONTHLY_LIMIT - readPulseMaxQuota(userId).usos);
}

export function hasPulseMaxQuota(userId?: string): boolean {
  return remainingPulseMaxUses(userId) > 0;
}

/** Descuenta un uso del mes. Se llama al arrancar el turno, no al terminarlo. */
export function consumePulseMaxUse(userId?: string): PulseMaxQuota {
  const actual = readPulseMaxQuota(userId);
  const siguiente = { ...actual, usos: actual.usos + 1 };
  writeQuota(userId, siguiente);
  return siguiente;
}

/** Acumula el gasto real del turno una vez que la API reporta el uso. */
export function recordPulseMaxTokens(userId: string | undefined, tokens: number): void {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const actual = readPulseMaxQuota(userId);
  writeQuota(userId, { ...actual, tokens: actual.tokens + Math.round(tokens) });
}

/** Solo para pruebas y para el boton de reset de soporte. */
export function resetPulseMaxQuota(userId?: string): void {
  safeRemoveItem(storageKey(userId));
}

function storageKey(userId?: string): string {
  return `${STORAGE_PREFIX}${userId || 'local'}`;
}

function writeQuota(userId: string | undefined, quota: PulseMaxQuota): void {
  safeSetItem(storageKey(userId), JSON.stringify(quota));
}

// El chat corre en el renderer, pero estas funciones tambien se importan desde
// pruebas y modulos sin DOM: nunca deben reventar por falta de localStorage.
function safeGetItem(key: string): string | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetItem(key: string, value: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
  } catch {
    // Cuota del navegador llena o almacenamiento bloqueado: no es critico.
  }
}

function safeRemoveItem(key: string): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(key);
  } catch {
    // Ver safeSetItem.
  }
}
