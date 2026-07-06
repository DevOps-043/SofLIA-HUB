/**
 * Puente del renderer hacia la memoria unificada del usuario (proceso main).
 * El chat de la app comparte el MISMO motor de memoria que WhatsApp: lee su
 * contexto (recientes, resúmenes, hechos y skills aprendidas) y registra cada
 * turno para que SofLIA aprenda. Todo es no bloqueante y tolera que la API no
 * exista (degradación elegante).
 */

export type LearnedSkill = {
  id: number;
  type: string;
  title: string;
  content: string;
  confidence: number;
  usageCount: number;
  source: string | null;
};

type MemoryBridge = {
  getContext?: (ownerKey: string, sessionKey: string, currentMessage: string) => Promise<{ success?: boolean; context?: string }>;
  recordTurn?: (ownerKey: string, sessionKey: string, userText: string, assistantText: string) => Promise<unknown>;
  setCurrentUser?: (userId: string | null) => Promise<unknown>;
  listSkills?: (ownerKey: string) => Promise<LearnedSkill[]>;
  deleteSkill?: (skillId: number) => Promise<{ success: boolean }>;
};

function bridge(): MemoryBridge | null {
  const api = (window as unknown as { memory?: MemoryBridge }).memory;
  return api ?? null;
}

/** Clave de owner canónica del renderer (debe coincidir con electron/memory/scope.ts). */
export function ownerKeyForUser(sofiaUserId?: string | null): string {
  const clean = String(sofiaUserId ?? '').trim();
  return clean ? `user:${clean}` : 'local:owner';
}

/** Sesión de memoria estable del chat de la app por usuario. */
export function chatSessionKey(ownerKey: string): string {
  return `chat:${ownerKey}`;
}

/** Obtiene el contexto de memoria formateado para inyectar en el prompt del chat. */
export async function fetchChatMemoryContext(sofiaUserId: string | undefined, currentMessage: string): Promise<string> {
  const api = bridge();
  if (!api?.getContext) return '';
  try {
    const ownerKey = ownerKeyForUser(sofiaUserId);
    const result = await api.getContext(ownerKey, chatSessionKey(ownerKey), currentMessage);
    return result?.context || '';
  } catch {
    return '';
  }
}

/**
 * Informa al proceso main quién es el usuario activo, para que superficies sin
 * identidad propia (agente de escritorio) escriban en la MISMA memoria.
 */
export function syncCurrentOwner(sofiaUserId?: string | null): void {
  const api = bridge();
  api?.setCurrentUser?.(sofiaUserId ?? null)?.catch?.(() => { /* no bloqueante */ });
}

/** Lista las skills aprendidas del usuario (para la tarjeta de gestión). */
export async function listUserSkills(sofiaUserId?: string | null): Promise<LearnedSkill[]> {
  const api = bridge();
  if (!api?.listSkills) return [];
  try {
    return (await api.listSkills(ownerKeyForUser(sofiaUserId))) ?? [];
  } catch {
    return [];
  }
}

/** Borra una skill aprendida (el usuario controla lo que SofLIA recuerda). */
export async function deleteUserSkill(skillId: number): Promise<boolean> {
  const api = bridge();
  if (!api?.deleteSkill) return false;
  try {
    return Boolean((await api.deleteSkill(skillId))?.success);
  } catch {
    return false;
  }
}

/** Registra un turno del chat (usuario + asistente) en la memoria del usuario. */
export function recordChatTurn(sofiaUserId: string | undefined, userText: string, assistantText: string): void {
  const api = bridge();
  if (!api?.recordTurn || !userText.trim()) return;
  const ownerKey = ownerKeyForUser(sofiaUserId);
  api.recordTurn(ownerKey, chatSessionKey(ownerKey), userText, assistantText).catch(() => { /* no bloqueante */ });
}
