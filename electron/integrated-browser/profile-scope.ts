/**
 * Perfil del navegador integrado, aislado por usuario de Pulse Hub.
 *
 * Antes existia un solo perfil global: la particion `persist:` y los archivos de
 * historial, contrasenas, permisos por sitio y extensiones vivian en una ruta
 * unica bajo `userData`. Al cerrar sesion y entrar con otra cuenta, la sesion
 * seguia siendo la misma: cookies, historial, credenciales y preferencias del
 * usuario anterior quedaban a la vista del siguiente.
 *
 * Ahora cada usuario tiene su propio perfil, derivado de un hash de su id (el id
 * nunca aparece en una ruta ni en el nombre de la particion). Sin sesion se usa
 * un perfil neutro que se vacia en cada cierre de sesion.
 *
 * El ambito es un valor de modulo a proposito: en el proceso main existe un solo
 * navegador integrado, y las rutas de los almacenes se resuelven en cada lectura
 * o escritura para que un cambio de usuario no requiera reconstruirlos.
 */

import { app } from 'electron';
import { createHash } from 'node:crypto';
import path from 'node:path';

export type BrowserProfileKind = 'authenticated' | 'guest' | 'private';

/** Perfil usado mientras no hay sesion; se purga al cerrar sesion. */
export const BROWSER_ANONYMOUS_SCOPE = 'sin-sesion';

let currentScopeId = BROWSER_ANONYMOUS_SCOPE;
let currentProfileKind: BrowserProfileKind = 'guest';

const PRIVATE_SCOPE_PREFIX = 'privado-';

/** Identificador estable y no reversible del perfil de un usuario. */
export function browserScopeIdFor(userId: string | null | undefined): string {
  if (typeof userId !== 'string' || !userId.trim()) return BROWSER_ANONYMOUS_SCOPE;
  return createHash('sha256').update(userId.trim()).digest('hex').slice(0, 16);
}

export function getBrowserScopeId(): string {
  return currentScopeId;
}

export function setBrowserScopeId(scopeId: string): void {
  currentScopeId = scopeId || BROWSER_ANONYMOUS_SCOPE;
  if (currentScopeId === BROWSER_ANONYMOUS_SCOPE) currentProfileKind = 'guest';
  else if (currentScopeId.startsWith(PRIVATE_SCOPE_PREFIX)) currentProfileKind = 'private';
  else currentProfileKind = 'authenticated';
}

export function getBrowserProfileKind(): BrowserProfileKind { return currentProfileKind; }

export function setBrowserProfileKind(kind: BrowserProfileKind): void {
  currentProfileKind = kind;
}

export function browserPrivateScopeId(): string {
  return `${PRIVATE_SCOPE_PREFIX}${createHash('sha256').update(`${Date.now()}-${Math.random()}-${process.pid}`).digest('hex').slice(0, 24)}`;
}

export function isEphemeralBrowserScope(scopeId: string): boolean {
  return scopeId === BROWSER_ANONYMOUS_SCOPE || scopeId.startsWith(PRIVATE_SCOPE_PREFIX);
}

/** Particion de sesion de Chromium del perfil indicado (o del activo). */
export function browserPartitionFor(scopeId: string = currentScopeId): string {
  return isEphemeralBrowserScope(scopeId) ? `pulse-navegador-${scopeId}` : `persist:pulse-navegador-${scopeId}`;
}

/** Directorio en disco del perfil indicado (o del activo). */
export function browserProfileRoot(scopeId: string = currentScopeId): string {
  const root = isEphemeralBrowserScope(scopeId) ? app.getPath('temp') : app.getPath('userData');
  return path.join(root, 'integrated-browser', 'perfiles', scopeId);
}

/** Ruta dentro del perfil activo. */
export function browserProfilePath(...segments: string[]): string {
  return path.join(browserProfileRoot(), ...segments);
}

export function resolveStoreLocation(location: string | (() => string)): string {
  return typeof location === 'function' ? location() : location;
}

/** Solo para pruebas: restablece el perfil neutro. */
export function resetBrowserScopeForTests(): void {
  currentScopeId = BROWSER_ANONYMOUS_SCOPE;
  currentProfileKind = 'guest';
}
