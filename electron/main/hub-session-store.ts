import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Custodia del token de refresco de la sesion del Hub en el proceso main.
 *
 * Por que main guarda una credencial: sin ella, su rol ante la base es `anon`,
 * `auth.uid()` es NULL y toda politica por identidad le devuelve cero filas.
 * Eso dejaba sin efecto la eleccion de canales del usuario y hacia invisibles
 * en WhatsApp y Telegram las Skills que solo viven en la base.
 *
 * Que se guarda y que no: SOLO el token de refresco. El de acceso dura minutos
 * y no sirve para arrancar en frio, que es el requisito real —los agentes de
 * canal corren sin ventana abierta—. Guardar menos y que caduque solo es mejor
 * que guardar mas.
 *
 * El valor NUNCA se registra. Las trazas dicen que ocurrio, no con que token.
 */

const FILE_NAME = 'hub-session.enc';

function getTokenPath(): string {
  return path.join(app.getPath('userData'), FILE_NAME);
}

/**
 * Guarda el token de refresco cifrado.
 *
 * Si el sistema operativo no ofrece cifrado, NO se escribe nada. Es una
 * desviacion deliberada del patron de `memory/token-store.ts`, que cae a texto
 * plano: alli el secreto es de un servicio acotado, y aqui seria una credencial
 * de larga vida del USUARIO, legible por cualquier proceso del equipo. Se
 * prefiere perder la persistencia —la sesion durara lo que dure el proceso— a
 * degradar el secreto en silencio.
 */
export function saveHubRefreshToken(refreshToken: string): boolean {
  const token = String(refreshToken || '').trim();
  if (!token) return false;

  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[HubSession] El sistema no ofrece cifrado seguro: la sesion no se persistira.');
    return false;
  }

  try {
    fs.writeFileSync(getTokenPath(), safeStorage.encryptString(token), { mode: 0o600 });
    console.log('[HubSession] Sesion del Hub guardada de forma cifrada.');
    return true;
  } catch (error) {
    console.error('[HubSession] No se pudo guardar la sesion:', error instanceof Error ? error.message : error);
    return false;
  }
}

/** Token guardado, o `null` si no hay, no se puede descifrar o esta corrupto. */
export function readHubRefreshToken(): string | null {
  const tokenPath = getTokenPath();
  if (!fs.existsSync(tokenPath)) return null;

  try {
    const data = fs.readFileSync(tokenPath);
    if (!safeStorage.isEncryptionAvailable()) {
      // El archivo se escribio cifrado; sin cifrado disponible no es legible.
      // No se intenta interpretarlo como texto plano: nunca se guardo asi.
      console.warn('[HubSession] Hay sesion guardada pero el sistema ya no ofrece descifrado.');
      return null;
    }
    const token = safeStorage.decryptString(data).trim();
    return token || null;
  } catch (error) {
    // Perfil migrado de otro equipo o archivo danado: se descarta en silencio
    // operativo (una traza, sin valor) y se pedira iniciar sesion de nuevo.
    console.warn('[HubSession] La sesion guardada no se pudo leer; se descarta.');
    void error;
    return null;
  }
}

/** Borra el token. Se llama al cerrar sesion y al rechazarlo el servidor. */
export function clearHubRefreshToken(): void {
  const tokenPath = getTokenPath();
  try {
    if (fs.existsSync(tokenPath)) {
      fs.unlinkSync(tokenPath);
      console.log('[HubSession] Sesion del Hub borrada del disco.');
    }
  } catch (error) {
    console.error('[HubSession] No se pudo borrar la sesion:', error instanceof Error ? error.message : error);
  }
}

export function hasStoredHubSession(): boolean {
  return fs.existsSync(getTokenPath());
}
