import type { App } from 'electron';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/** Conserva sesiones y datos locales al cambiar el nombre público de la app. */
export function configureApplicationBrand(app: Pick<App, 'isPackaged' | 'getPath' | 'setPath' | 'setName'>): void {
  // Las versiones distribuidas anteriores usaban productName para este perfil.
  // En desarrollo se mantiene el perfil de package.name que ya estaba activo.
  const userData = app.isPackaged
    ? path.join(app.getPath('appData'), 'Pulse Hub')
    : app.getPath('userData');
  // setPath exige que el directorio exista, también en una instalación nueva.
  mkdirSync(userData, { recursive: true });
  app.setPath('userData', userData);
  app.setPath('sessionData', userData);
  app.setName('Soflia Hub');
}
