import { normalizeSearchValue } from './search-resolution';

export function normalizeProjectKey(rawValue: string | null | undefined): string {
  return (rawValue || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 16);
}

function buildProjectKeySeed(projectName: string): string {
  const normalized = normalizeSearchValue(projectName).replace(/[^a-z0-9\s-]/g, ' ');
  const tokens = normalized.split(' ').filter(Boolean);

  if (tokens.length === 0) return 'PROJ';
  if (tokens.length === 1) return tokens[0].toUpperCase().slice(0, 8);

  const initials = tokens.slice(0, 3).map((token) => token.slice(0, 3).toUpperCase()).join('-');
  return normalizeProjectKey(initials) || tokens[0].toUpperCase().slice(0, 8);
}

export function generateUniqueProjectKey(
  projectName: string,
  existingKeys: Iterable<string>,
  preferredKey?: string | null,
): string {
  const usedKeys = new Set(
    Array.from(existingKeys)
      .map((key) => normalizeProjectKey(key))
      .filter(Boolean),
  );

  const preferred = normalizeProjectKey(preferredKey);
  if (preferred && !usedKeys.has(preferred)) return preferred;

  const base = normalizeProjectKey(preferred || buildProjectKeySeed(projectName)) || 'PROJ';
  if (!usedKeys.has(base)) return base;

  for (let index = 2; index < 1000; index += 1) {
    const suffix = `${index}`;
    const trimmedBase = base.slice(0, Math.max(1, 16 - suffix.length - 1));
    const candidate = `${trimmedBase}-${suffix}`;
    if (!usedKeys.has(candidate)) return candidate;
  }

  return `${base.slice(0, 12)}-${Date.now().toString().slice(-3)}`;
}
