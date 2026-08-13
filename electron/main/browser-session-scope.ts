// Vincula el navegador integrado al usuario con sesion activa.
//
// El main ya mantiene una copia minima del estado de sesion (`auth-state`) para
// negar por defecto las funciones sensibles. El navegador necesita ademas
// REACCIONAR a ese estado: mientras el perfil era global, cerrar sesion y entrar
// con otra cuenta dejaba intactas las cookies, el historial, las contrasenas y
// los permisos por sitio del usuario anterior.

import { getAuthState, onAuthStateChange } from './auth-state';

type BrowserProfileTarget = {
  applyUserScope: (userId: string | null) => Promise<void>;
};

/** Aplica el perfil actual y sigue los cambios. Devuelve la baja de suscripcion. */
export function bindBrowserProfileToSession(browser: BrowserProfileTarget): () => void {
  const apply = (userId: string | null) => {
    void browser.applyUserScope(userId).catch((error) => {
      console.error('[Navegador] No se pudo conmutar el perfil de sesion:', error);
    });
  };

  apply(getAuthState().userId);
  return onAuthStateChange((state) => apply(state.userId));
}
