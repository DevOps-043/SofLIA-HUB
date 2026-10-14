import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { normalizeLookupToken } from './path-helpers';
import type { ResolvedApplicationTarget } from './types';

export async function resolveLinuxApplication(target: string): Promise<ResolvedApplicationTarget | null> {
  const token = normalizeLookupToken(target);
  if (!token || target.length > 200) return null;
  const roots = [
    path.join(process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local/share'), 'applications'),
    ...(process.env.XDG_DATA_DIRS || '/usr/local/share:/usr/share').split(':')
      .filter(path.isAbsolute).map(root => path.join(root, 'applications')),
    '/var/lib/snapd/desktop/applications',
    '/var/lib/flatpak/exports/share/applications',
    path.join(os.homedir(), '.local/share/flatpak/exports/share/applications'),
  ];
  const seen = new Set<string>();
  for (const root of new Set(roots)) {
    const entries = await fs.readdir(root).catch(() => [] as string[]);
    for (const entry of entries.filter(name => name.endsWith('.desktop')).sort().slice(0, 1000)) {
      // Un override del usuario, incluso Hidden=true, prevalece sobre el sistema.
      if (seen.has(entry)) continue;
      seen.add(entry);
      const candidate = path.join(root, entry);
      const info = await fs.stat(candidate).catch(() => null);
      if (!info?.isFile() || info.size > 128 * 1024) continue;
      const content = await fs.readFile(candidate, 'utf8').catch(() => '');
      const section = content.split(/^\[Desktop Entry\]\s*$/m)[1]?.split(/^\[/m)[0] || '';
      if (!/^Type=Application\s*$/m.test(section) || /^(Hidden|NoDisplay)=true\s*$/m.test(section)) continue;
      const name = /^Name=(.+)$/m.exec(section)?.[1]?.trim();
      if (![name, entry.slice(0, -8)].some(value => value && normalizeLookupToken(value) === token)) continue;
      return { path: candidate, source: 'linux-desktop', searchedQuery: target, alternatives: [] };
    }
  }
  // Nunca enviar el nombre a una shell: PATH sólo aporta rutas ejecutables.
  if (!/^[a-zA-Z0-9_.+-]+$/.test(target) || target.startsWith('-')) return null;
  for (const root of (process.env.PATH || '').split(':').filter(path.isAbsolute)) {
    const candidate = path.join(root, target.toLowerCase());
    try {
      await fs.access(candidate, fs.constants.X_OK);
      if (!(await fs.stat(candidate)).isFile()) continue;
      return { path: candidate, source: 'linux-path', searchedQuery: target, alternatives: [] };
    } catch { /* Continuar con la siguiente carpeta del PATH. */ }
  }
  return null;
}
