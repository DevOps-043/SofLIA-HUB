import { getUserPreferenceScope, scopedPreferenceKey } from '../user-scope';

const STORAGE_KEY = 'soflia:command-approvals:v1';
const MAX_APPROVALS = 200;

/** Guarda únicamente huellas exactas; nunca texto de comandos ni secretos. */
export async function commandApprovalKey(tool: string, command: string, directory: unknown): Promise<string | null> {
  try {
    const data = new TextEncoder().encode(JSON.stringify([tool, command.trim(), String(directory ?? '')]));
    const hash = await globalThis.crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch {
    return null;
  }
}

export function hasCommandApproval(key: string | null): boolean {
  return key !== null && readApprovals().includes(key);
}

export function rememberCommandApproval(key: string | null): void {
  if (!key || getUserPreferenceScope() === 'sin-sesion') return;
  try {
    const entries = [...readApprovals().filter(entry => entry !== key), key].slice(-MAX_APPROVALS);
    localStorage.setItem(scopedPreferenceKey(STORAGE_KEY), JSON.stringify(entries));
  } catch {
    console.warn('[Permisos] No se pudo guardar la aprobación; se aplica sólo a esta ejecución.');
  }
}

export function clearCommandApprovals(): boolean {
  try {
    localStorage.removeItem(scopedPreferenceKey(STORAGE_KEY));
    return true;
  } catch {
    return false;
  }
}

function readApprovals(): string[] {
  if (getUserPreferenceScope() === 'sin-sesion') return [];
  try {
    const entries: unknown = JSON.parse(localStorage.getItem(scopedPreferenceKey(STORAGE_KEY)) ?? '[]');
    return Array.isArray(entries) ? entries.filter((entry): entry is string => typeof entry === 'string' && /^[a-f0-9]{64}$/.test(entry)).slice(-MAX_APPROVALS) : [];
  } catch { return []; }
}
