export function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value || '').trim();
  return normalized || null;
}

export function normalizeEnum(value: unknown, allowed: string[], fallback: string): string {
  const normalized = String(value || '').trim();
  return allowed.includes(normalized) ? normalized : fallback;
}

export function normalizeNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export function requireNonEmptyString(value: unknown, errorMessage: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) throw new Error(errorMessage);
  return normalized;
}

export function resolveOwnerUserId(requestedBy: string | null): string {
  const normalized = String(requestedBy || '').trim();
  if (!normalized) {
    throw new Error('Necesito un usuario solicitante para crear el caso de reunion.');
  }
  if (normalized.startsWith('app:')) return normalized.slice(4);
  if (normalized.startsWith('whatsapp:')) return normalized.slice(9);
  if (normalized.startsWith('telegram:')) return normalized.slice(9);
  return normalized;
}
