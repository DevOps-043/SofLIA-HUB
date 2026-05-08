import path from 'node:path';
import { SKIP_DIR_NAMES } from './constants';

export function normalizeLookupToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function stripLaunchExtension(value: string): string {
  return value.replace(/\.(exe|lnk|appref-ms|cmd|bat|com)$/i, '');
}

export function looksLikeConcretePath(value: string): boolean {
  const trimmed = (value || '').trim();
  if (!trimmed) return false;

  return (
    path.isAbsolute(trimmed) ||
    /[\\/]/.test(trimmed) ||
    /\.[a-z0-9]{2,10}$/i.test(path.basename(trimmed))
  );
}

export function isLaunchableCandidatePath(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return ['.exe', '.lnk', '.appref-ms', '.cmd', '.bat', '.com'].includes(ext);
}

export function shouldSkipApplicationSearchDirectory(name: string): boolean {
  const lower = name.toLowerCase();
  return lower.startsWith('.') || SKIP_DIR_NAMES.has(lower);
}
