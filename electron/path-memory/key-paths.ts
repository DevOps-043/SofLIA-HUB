import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import { KEY_FOLDER_VARIANTS } from './constants';

/**
 * Resolucion de carpetas clave (Escritorio, Documentos, Descargas...) en
 * Windows, macOS y Linux.
 *
 * Antes solo se probaban nombres de carpeta ("Desktop", "Escritorio") dentro de
 * $HOME. Eso falla cuando:
 *   - Windows redirige las carpetas conocidas a OneDrive (caso muy comun).
 *   - macOS/Linux usan rutas o nombres distintos (XDG, localizacion).
 * Ahora se pregunta PRIMERO al sistema operativo (Electron `app.getPath`, que
 * usa el API nativo de cada plataforma) y solo despues se recurre al escaneo
 * por nombre como respaldo.
 */

/** Carpetas conocidas del SO: etiqueta interna → clave de Electron `app.getPath`. */
const OS_FOLDER_KEYS: Record<string, 'desktop' | 'documents' | 'downloads' | 'pictures' | 'music' | 'videos'> = {
  Escritorio: 'desktop',
  Documentos: 'documents',
  Descargas: 'downloads',
  Imagenes: 'pictures',
  Musica: 'music',
  Videos: 'videos',
};

export type OsPathResolver = (key: string) => string | null;

/** Lee la ruta oficial del SO; devuelve null si Electron no esta disponible. */
function defaultOsPathResolver(key: string): string | null {
  try {
    // Import perezoso: key-paths debe poder usarse en tests sin Electron.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron') as typeof import('electron');
    const resolved = app?.getPath?.(key as Parameters<typeof app.getPath>[0]);
    return resolved || null;
  } catch {
    return null;
  }
}

async function dirExists(dirPath: string): Promise<boolean> {
  try {
    const stats = await fsPromises.stat(dirPath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}

async function findOneDrivePaths(home: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await fsPromises.readdir(home, { withFileTypes: true });
    for (const entry of entries) {
      // En Windows la carpeta puede llamarse "OneDrive - Empresa"; en otros SO
      // simplemente no existira.
      if (entry.isDirectory() && entry.name.startsWith('OneDrive')) {
        results.push(path.join(home, entry.name));
      }
    }
  } catch { /* home ilegible: se continua sin OneDrive */ }
  return results;
}

export async function resolveKeyPaths(
  home: string,
  getOsPath: OsPathResolver = defaultOsPathResolver,
): Promise<Map<string, string>> {
  const keyPaths = new Map<string, string>();
  keyPaths.set('Home', home);

  const oneDriveCandidates = await findOneDrivePaths(home);
  const searchRoots = [home, ...oneDriveCandidates];

  for (const [label, variants] of Object.entries(KEY_FOLDER_VARIANTS)) {
    // 1) La ruta que declara el sistema operativo (respeta redirecciones a
    //    OneDrive en Windows y la localizacion en macOS/Linux).
    const osKey = OS_FOLDER_KEYS[label];
    const osPath = osKey ? getOsPath(osKey) : null;
    if (osPath && await dirExists(osPath)) {
      keyPaths.set(label, osPath);
      continue;
    }

    // 2) Respaldo: buscar por nombre en $HOME y en las carpetas de OneDrive.
    for (const root of searchRoots) {
      const found = await findFirstExistingVariant(root, variants);
      if (!found) continue;
      const prefix = root === home ? '' : '(OneDrive) ';
      keyPaths.set(`${prefix}${label}`, found);
      break;
    }
  }

  for (const oneDrivePath of oneDriveCandidates) keyPaths.set('OneDrive', oneDrivePath);
  return keyPaths;
}

async function findFirstExistingVariant(root: string, variants: string[]): Promise<string | null> {
  for (const variant of variants) {
    const candidate = path.join(root, variant);
    if (await dirExists(candidate)) return candidate;
  }
  return null;
}
