/**
 * Ambito de almacenamiento local por usuario.
 *
 * Varias preferencias vivian en claves globales de `localStorage`
 * (`sofLia_integratedBrowserFavorites`, `lia_user_settings`,
 * `soflia:selected-model`...). En un equipo compartido eso significa que al
 * cerrar sesion y entrar con otra cuenta el usuario nuevo hereda los favoritos,
 * el modelo, el perfil personal y las instrucciones del anterior.
 *
 * Este modulo da a cada identidad su propio espacio de claves. El ambito se fija
 * en el proveedor de autenticacion, de forma sincrona, antes de que se monte
 * cualquier vista que lea preferencias; sin sesion se usa un espacio de paso que
 * se vacia en cada cambio de usuario.
 */

const ANONYMOUS_SCOPE = 'sin-sesion';

/**
 * Claves globales anteriores al aislamiento. Se eliminan una vez: no se pueden
 * atribuir a un usuario, y heredarlas es precisamente la fuga que se corrige.
 */
const LEGACY_GLOBAL_KEYS = [
  'sofLia_integratedBrowserFavorites',
  'sofLia_integratedBrowserUtilityBarVisible',
  'sofLia_integratedBrowserFloatingChatWidth',
  'sofLia_integratedBrowserFloatingChatSide',
  'lia_user_settings',
  'soflia:selected-model',
  'soflia:thinking-by-model',
];

let currentScope = ANONYMOUS_SCOPE;
let legacyPurged = false;

/** Clave de preferencia acotada al usuario activo. */
export function scopedPreferenceKey(baseKey: string): string {
  return `${baseKey}__${currentScope}`;
}

export function getUserPreferenceScope(): string {
  return currentScope;
}

/**
 * Fija el usuario dueño de las preferencias locales. Idempotente: se puede
 * invocar en cada render. Al cambiar de usuario descarta el espacio de paso para
 * que nada navegado o elegido sin sesion se herede.
 */
export function setUserPreferenceScope(userId: string | null | undefined): void {
  const nextScope = typeof userId === 'string' && userId.trim() ? userId.trim() : ANONYMOUS_SCOPE;
  purgeLegacyGlobalPreferences();
  if (nextScope === currentScope) return;
  currentScope = nextScope;
  if (nextScope !== ANONYMOUS_SCOPE) clearScopePreferences(ANONYMOUS_SCOPE);
}

function purgeLegacyGlobalPreferences(): void {
  if (legacyPurged) return;
  legacyPurged = true;
  try {
    for (const key of LEGACY_GLOBAL_KEYS) localStorage.removeItem(key);
  } catch {
    // Sin storage no hay nada que purgar.
  }
}

function clearScopePreferences(scope: string): void {
  const suffix = `__${scope}`;
  try {
    const doomed: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (key && key.endsWith(suffix)) doomed.push(key);
    }
    for (const key of doomed) localStorage.removeItem(key);
  } catch {
    // Degradacion silenciosa: no bloquear el inicio de sesion por storage.
  }
}

/** Solo para pruebas. */
export function resetUserPreferenceScopeForTests(): void {
  currentScope = ANONYMOUS_SCOPE;
  legacyPurged = false;
}
