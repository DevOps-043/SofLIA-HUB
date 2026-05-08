import path from 'node:path';
import { normalizeLookupToken, stripLaunchExtension } from './path-helpers';

export function scoreApplicationCandidate(filePath: string, normalizedQueries: string[]): number {
  const lowerPath = filePath.toLowerCase();
  const baseName = stripLaunchExtension(path.basename(filePath)).toLowerCase();
  const compactBase = normalizeLookupToken(baseName);
  const compactPath = normalizeLookupToken(lowerPath);

  let score = 0;
  for (const query of normalizedQueries) {
    if (!query) continue;
    if (compactBase === query) score = Math.max(score, 220);
    else if (compactBase.startsWith(query)) score = Math.max(score, 180);
    else if (compactBase.includes(query)) score = Math.max(score, 145);
    else if (compactPath.includes(query)) score = Math.max(score, 70);
  }

  if (score === 0) return 0;

  if (
    /[\\/]program files( \(x86\))?[\\/]/i.test(lowerPath) ||
    /[\\/]appdata[\\/]local[\\/]programs[\\/]/i.test(lowerPath)
  ) {
    score += 90;
  }
  if (/[\\/]start menu[\\/]programs[\\/]/i.test(lowerPath)) score += 70;
  if (lowerPath.includes('\\windowsapps\\')) score += 55;
  if (lowerPath.includes('\\downloads\\')) score -= 80;
  if (/(setup|installer|install|update|updater|uninstall|bootstrap|helper)/i.test(lowerPath)) {
    score -= 180;
  }

  const ext = path.extname(lowerPath).toLowerCase();
  if (ext === '.exe') score += 25;
  if (ext === '.lnk' || ext === '.appref-ms') score += 10;

  return score;
}
