import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Resolucion y validacion de rutas del workspace de una Skill.
 *
 * El modelo nunca maneja rutas absolutas: entrega rutas relativas al
 * workspace y este modulo las resuelve. La contencion se verifica sobre la
 * ruta REAL (`realpath`), no sobre la textual: comparar prefijos de texto no
 * detecta un enlace simbolico que apunte fuera del workspace.
 */

export type PathRejectionReason =
  | 'vacia'
  | 'absoluta'
  | 'segmento_superior'
  | 'fuera_del_workspace'
  | 'enlace_externo'
  | 'extension_no_permitida';

export type ResolvedWorkspacePath =
  | { ok: true; absolutePath: string; relativePath: string }
  | { ok: false; reason: PathRejectionReason; message: string };

const REJECTION_MESSAGES: Record<PathRejectionReason, string> = {
  vacia: 'La ruta esta vacia.',
  absoluta: 'La ruta debe ser relativa al espacio de trabajo, no absoluta.',
  segmento_superior: 'La ruta no puede salir del espacio de trabajo con "..".',
  fuera_del_workspace: 'La ruta queda fuera del espacio de trabajo.',
  enlace_externo: 'La ruta resuelve, por un enlace, a una ubicacion fuera del espacio de trabajo.',
  extension_no_permitida: 'Esta skill no puede escribir archivos con esa extension.',
};

function reject(reason: PathRejectionReason, detail?: string): ResolvedWorkspacePath {
  return { ok: false, reason, message: detail ? `${REJECTION_MESSAGES[reason]} ${detail}` : REJECTION_MESSAGES[reason] };
}

/**
 * Normaliza la ruta que entrega el modelo y comprueba que sea relativa y sin
 * segmentos superiores. Es la primera barrera, puramente textual.
 */
export function normalizeRelativePath(candidate: string): ResolvedWorkspacePath {
  const raw = String(candidate ?? '').trim();
  if (!raw) return reject('vacia');

  // Se aceptan separadores de ambos sistemas: el modelo escribe indistintamente.
  const unified = raw.replace(/\\/g, '/');

  if (path.isAbsolute(raw) || path.isAbsolute(unified) || /^[a-zA-Z]:/.test(unified) || unified.startsWith('//')) {
    return reject('absoluta');
  }

  const normalized = path.posix.normalize(unified).replace(/^\.\//, '');
  if (normalized === '..' || normalized.startsWith('../') || normalized.split('/').includes('..')) {
    return reject('segmento_superior');
  }
  if (!normalized || normalized === '.') return reject('vacia');

  return { ok: true, absolutePath: '', relativePath: normalized };
}

/**
 * Resuelve una ruta relativa contra la raiz del workspace y verifica que la
 * ruta real quede contenida. `mustExist` distingue lectura de escritura: al
 * escribir, el archivo puede no existir todavia y se valida su carpeta
 * contenedora, que si debe existir o poder crearse dentro del workspace.
 */
export async function resolveInsideWorkspace(
  workspaceRoot: string,
  candidate: string,
  options: { mustExist?: boolean } = {},
): Promise<ResolvedWorkspacePath> {
  const normalized = normalizeRelativePath(candidate);
  if (!normalized.ok) return normalized;

  const realRoot = await realpathOrNull(workspaceRoot);
  if (!realRoot) {
    return reject('fuera_del_workspace', 'El espacio de trabajo no existe.');
  }

  const absolutePath = path.resolve(realRoot, normalized.relativePath);

  // Barrera textual sobre rutas ya resueltas: cubre el caso en que la ruta
  // apunte a un hermano cuyo nombre empieza igual que la raiz.
  if (!isContained(realRoot, absolutePath)) {
    return reject('fuera_del_workspace');
  }

  const realTarget = await realpathOrNull(absolutePath);
  if (realTarget) {
    // El destino existe: su ruta real debe seguir dentro del workspace.
    if (!isContained(realRoot, realTarget)) return reject('enlace_externo');
    return { ok: true, absolutePath: realTarget, relativePath: normalized.relativePath };
  }

  if (options.mustExist) {
    return reject('fuera_del_workspace', 'El archivo no existe.');
  }

  // El destino no existe todavia (escritura). Se valida el ancestro mas
  // cercano que si exista: si esa carpeta es un enlace hacia fuera, escribir
  // dentro escribiria fuera del workspace.
  const realParent = await nearestExistingRealPath(path.dirname(absolutePath));
  if (!realParent || !isContained(realRoot, realParent, true)) {
    return reject('enlace_externo');
  }

  return { ok: true, absolutePath, relativePath: normalized.relativePath };
}

/**
 * Comprueba que `target` este dentro de `root`. Compara segmento a segmento
 * para que `/datos/ws-otro` no se considere contenido en `/datos/ws`.
 */
export function isContained(root: string, target: string, allowEqual = true): boolean {
  const normalizedRoot = path.resolve(root);
  const normalizedTarget = path.resolve(target);
  if (normalizedRoot === normalizedTarget) return allowEqual;
  const relative = path.relative(normalizedRoot, normalizedTarget);
  return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
}

/** Valida la extension contra la allowlist de la Skill. */
export function hasAllowedExtension(relativePath: string, allowedExtensions: readonly string[]): boolean {
  const extension = path.posix.extname(relativePath).toLowerCase();
  return allowedExtensions.map((entry) => entry.toLowerCase()).includes(extension);
}

async function realpathOrNull(target: string): Promise<string | null> {
  try {
    return await fs.realpath(target);
  } catch {
    return null;
  }
}

/** Sube por el arbol hasta encontrar una ruta existente y devuelve su realpath. */
async function nearestExistingRealPath(start: string): Promise<string | null> {
  let current = path.resolve(start);
  // Cota dura: evita un bucle si `path.dirname` dejara de acortar la ruta.
  for (let depth = 0; depth < 64; depth += 1) {
    const real = await realpathOrNull(current);
    if (real) return real;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return null;
}
