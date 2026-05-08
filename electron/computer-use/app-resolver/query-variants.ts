import path from 'node:path';
import { WINDOWS_APP_ALIASES } from './constants';
import { normalizeLookupToken, stripLaunchExtension } from './path-helpers';

export function buildApplicationQueryVariants(rawTarget: string): string[] {
  const base = stripLaunchExtension(path.basename((rawTarget || '').trim()));
  if (!base) return [];

  const variants = new Set<string>();
  variants.add(base);
  variants.add(base.replace(/[-_]+/g, ' '));
  variants.add(base.replace(/\s+/g, ''));
  variants.add(`${base}.exe`);

  const aliasKey = normalizeLookupToken(base);
  for (const alias of WINDOWS_APP_ALIASES[aliasKey] || []) {
    variants.add(alias);
  }

  return Array.from(variants).map((value) => value.trim()).filter(Boolean);
}
