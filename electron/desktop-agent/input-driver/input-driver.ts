import type { DesktopKeyboardControls } from '../keyboard-controls';
import type { DesktopMouseControls } from '../mouse-controls';
import { createLegacyInputDriver } from './legacy-backend';
import { createNutInputDriver, loadNutModule } from './nut-backend';
import type { InputDriver } from './types';

export type InputBackendKind = 'nut' | 'legacy';

export type CreateInputDriverDeps = {
  backend: InputBackendKind;
  mouse: DesktopMouseControls;
  keyboard: DesktopKeyboardControls;
  /** Inyectable para tests: reemplaza la carga real de nut.js. */
  loadNut?: () => unknown | null;
};

/**
 * Factory del InputDriver: elige el backend segun config y disponibilidad real.
 * Si se pide 'nut' pero el modulo nativo no carga, cae a 'legacy' con un aviso —
 * el agente nunca queda sin control de entrada.
 */
export function createInputDriver(deps: CreateInputDriverDeps): InputDriver {
  const legacy = () => createLegacyInputDriver({
    mouse: deps.mouse,
    keyboard: deps.keyboard,
    detalle: deps.backend === 'nut' ? 'nut.js no disponible; usando backend legacy' : undefined,
  });

  if (deps.backend !== 'nut') {
    return legacy();
  }

  const nut = (deps.loadNut ?? loadNutModule)();
  if (!nut) {
    console.warn('[DesktopAgent] Backend de entrada nut.js no disponible; usando legacy (mouse sin movimiento humano).');
    return legacy();
  }

  try {
    const driver = createNutInputDriver(nut);
    console.log('[DesktopAgent] Backend de entrada: nut.js (movimiento humano activo).');
    return driver;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[DesktopAgent] nut.js cargó pero falló al inicializar (${message}); usando legacy.`);
    return legacy();
  }
}
