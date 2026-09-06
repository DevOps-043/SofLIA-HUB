import { createEncryptedRefreshTokenStore } from './encrypted-refresh-token-store';

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

const store = createEncryptedRefreshTokenStore({
  fileName: 'hub-session.enc',
  logScope: 'HubSession',
});

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
  return store.save(refreshToken);
}

/** Token guardado, o `null` si no hay, no se puede descifrar o esta corrupto. */
export function readHubRefreshToken(): string | null {
  return store.read();
}

/** Borra el token. Se llama al cerrar sesion y al rechazarlo el servidor. */
export function clearHubRefreshToken(): void {
  store.clear();
}

export function hasStoredHubSession(): boolean {
  return store.hasStored();
}
