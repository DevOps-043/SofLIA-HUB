import { OPENAI_MODELS } from '../config';

/** SofLIA Max: el modelo caro del catalogo, limitado por mes. */
export const SOFLIA_MAX_MODEL_ID = OPENAI_MODELS.COMPUTER_USE;
export const SOFLIA_MAX_MONTHLY_LIMIT = 3;

// La clave conserva el prefijo antiguo a proposito: renombrarla reiniciaria el
// contador mensual de quien ya tuviera consumo guardado.
const STORAGE_PREFIX = 'pulse:max-quota:';

export interface SofliaMaxQuota {
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
export function readSofliaMaxQuota(userId?: string): SofliaMaxQuota {
  const periodo = currentPeriod();
  const vacio: SofliaMaxQuota = { periodo, usos: 0, tokens: 0 };
  const raw = safeGetItem(storageKey(userId));
  if (!raw) return vacio;
  try {
    const parsed = JSON.parse(raw) as Partial<SofliaMaxQuota>;
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

export function remainingSofliaMaxUses(userId?: string): number {
  return Math.max(0, SOFLIA_MAX_MONTHLY_LIMIT - readSofliaMaxQuota(userId).usos);
}

export function hasSofliaMaxQuota(userId?: string): boolean {
  return remainingSofliaMaxUses(userId) > 0;
}

/** Descuenta un uso del mes. Se llama al arrancar el turno, no al terminarlo. */
export function consumeSofliaMaxUse(userId?: string): SofliaMaxQuota {
  const actual = readSofliaMaxQuota(userId);
  const siguiente = { ...actual, usos: actual.usos + 1 };
  writeQuota(userId, siguiente);
  return siguiente;
}

/** Acumula el gasto real del turno una vez que la API reporta el uso. */
export function recordSofliaMaxTokens(userId: string | undefined, tokens: number): void {
  if (!Number.isFinite(tokens) || tokens <= 0) return;
  const actual = readSofliaMaxQuota(userId);
  writeQuota(userId, { ...actual, tokens: actual.tokens + Math.round(tokens) });
}

/** Solo para pruebas y para el boton de reset de soporte. */
export function resetSofliaMaxQuota(userId?: string): void {
  safeRemoveItem(storageKey(userId));
}

function storageKey(userId?: string): string {
  return `${STORAGE_PREFIX}${userId || 'local'}`;
}

function writeQuota(userId: string | undefined, quota: SofliaMaxQuota): void {
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
