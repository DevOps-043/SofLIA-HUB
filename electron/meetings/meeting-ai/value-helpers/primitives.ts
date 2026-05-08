export function getObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function asNullableString(value: unknown): string | null {
  const next = asString(value);
  return next || null;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

export function limitStrings(values: string[], limit: number): string[] {
  return values.filter(Boolean).slice(0, limit);
}

export function normalizeStringItems(value: unknown): string[] {
  return limitStrings(asStringArray(value), 8);
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function asConfidence(value: unknown, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return clampNumber(fallback, 0, 1);
  }
  return clampNumber(value, 0, 1);
}

export function asOptionalConfidence(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  return clampNumber(value, 0, 1);
}

export function normalizeText(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function toIsoDateOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}
