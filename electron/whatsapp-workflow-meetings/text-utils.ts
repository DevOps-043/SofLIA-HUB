export function compactParts(parts: Array<string | null | undefined>): string[] {
  return parts.map((part) => String(part || '').trim()).filter(Boolean);
}

export function summarizeList(values: string[] | null | undefined, limit: number): string | null {
  const normalized = Array.from(new Set((values || []).map((value) => String(value || '').trim()).filter(Boolean)));
  if (normalized.length === 0) return null;
  const trimmed = normalized.slice(0, limit);
  const suffix = normalized.length > limit ? '...' : '';
  return `${trimmed.join(', ')}${suffix}`;
}

export function humanizeToken(value: string | null | undefined): string | null {
  const normalized = String(value || '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!normalized) return null;
  return normalized.split(' ').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
}

export function stripStrategyPrefix(value: string): string {
  return value
    .replace(/^estrategia seleccionada por clasificacion como\s+/i, '')
    .replace(/^la estrategia de\s+/i, '')
    .replace(/^clasifique como\s+/i, '')
    .trim();
}

export function truncateSentence(value: string, maxLength: number): string {
  const text = truncateText(value, maxLength);
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

export function truncateText(value: string | null | undefined, maxLength: number): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
}
