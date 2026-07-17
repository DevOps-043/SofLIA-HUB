/**
 * Deteccion del perfil ACTIVO del navegador real del usuario.
 *
 * A diferencia de los perfiles persistentes de Playwright (vacios, sin logins),
 * aqui se lee el "Local State" del navegador predeterminado instalado para saber
 * que perfil usa el usuario (nombre visible y cuenta). Esa informacion se inyecta
 * al agente visual cuando una tarea requiere las sesiones/contraseñas reales:
 * Chrome/Edge >= 136 bloquean CDP sobre el perfil real, asi que Playwright NUNCA
 * puede manejarlo; la unica via es el backend visual sobre el navegador real.
 */
import fs from 'node:fs';
import path from 'node:path';
import { getDefaultBrowserInfo, type DefaultBrowserId } from './constants';

export type PerfilNavegadorReal = {
  navegador: DefaultBrowserId;
  nombreNavegador: string;
  /** Carpeta del perfil dentro de User Data (p.ej. "Default", "Profile 1"). */
  directorioPerfil: string | null;
  /** Nombre visible del perfil (p.ej. "Fernando"). */
  nombrePerfil: string | null;
  /** Email de la cuenta asociada al perfil, si existe. */
  emailCuenta: string | null;
};

/** Directorio "User Data" del navegador (solo variantes Chromium). */
function getUserDataDir(id: DefaultBrowserId): string | null {
  const localAppData = process.env.LOCALAPPDATA || '';
  const appData = process.env.APPDATA || '';
  switch (id) {
    case 'chrome': return path.join(localAppData, 'Google', 'Chrome', 'User Data');
    case 'edge': return path.join(localAppData, 'Microsoft', 'Edge', 'User Data');
    case 'brave': return path.join(localAppData, 'BraveSoftware', 'Brave-Browser', 'User Data');
    case 'vivaldi': return path.join(localAppData, 'Vivaldi', 'User Data');
    // Opera guarda un solo perfil directamente en este directorio (sin info_cache).
    case 'opera': return path.join(appData, 'Opera Software', 'Opera Stable');
    default: return null;
  }
}

type LocalStateProfileEntry = {
  name?: string;
  user_name?: string;
  gaia_name?: string;
};

type LocalState = {
  profile?: {
    last_used?: string;
    info_cache?: Record<string, LocalStateProfileEntry>;
  };
};

let cachedProfile: { info: PerfilNavegadorReal; readAt: number } | null = null;
const CACHE_TTL_MS = 60_000;

/**
 * Perfil activo del navegador predeterminado del usuario (ultimo perfil usado
 * segun el Local State del navegador). Best-effort: devuelve los campos en null
 * si el navegador no expone esa informacion (Firefox, Opera, desconocido).
 */
export function getRealBrowserActiveProfile(): PerfilNavegadorReal {
  if (cachedProfile && Date.now() - cachedProfile.readAt < CACHE_TTL_MS) return cachedProfile.info;
  const defaultBrowser = getDefaultBrowserInfo();
  const info: PerfilNavegadorReal = {
    navegador: defaultBrowser.id,
    nombreNavegador: defaultBrowser.nombre,
    directorioPerfil: null,
    nombrePerfil: null,
    emailCuenta: null,
  };
  try {
    const userDataDir = getUserDataDir(defaultBrowser.id);
    if (userDataDir) {
      const localStatePath = path.join(userDataDir, 'Local State');
      if (fs.existsSync(localStatePath)) {
        const state = JSON.parse(fs.readFileSync(localStatePath, 'utf8')) as LocalState;
        const lastUsed = state.profile?.last_used || 'Default';
        const entry = state.profile?.info_cache?.[lastUsed];
        info.directorioPerfil = lastUsed;
        info.nombrePerfil = entry?.name || entry?.gaia_name || null;
        info.emailCuenta = entry?.user_name || null;
      }
    }
  } catch (err) {
    console.warn('[BrowserWeb] No se pudo leer el perfil activo del navegador real:', err instanceof Error ? err.message : String(err));
  }
  cachedProfile = { info, readAt: Date.now() };
  return info;
}

/** Descripcion en español del navegador/perfil real, lista para prompts del agente. */
export function describeRealBrowserContext(): string {
  const perfil = getRealBrowserActiveProfile();
  if (perfil.navegador === 'desconocido') {
    return 'No se pudo detectar el navegador predeterminado del usuario; abre las URLs con open_url y trabaja sobre la ventana que aparezca.';
  }
  const partes = [`El navegador predeterminado del usuario es ${perfil.nombreNavegador}`];
  if (perfil.nombrePerfil || perfil.emailCuenta) {
    const cuenta = [perfil.nombrePerfil, perfil.emailCuenta ? `(${perfil.emailCuenta})` : null].filter(Boolean).join(' ');
    partes.push(`con el perfil activo "${cuenta}"`);
  }
  partes.push('donde ya tiene sus sesiones iniciadas y contraseñas guardadas.');
  return partes.join(' ');
}
