import type { DesktopActionPayload } from '../../desktop-agent-types';
import type { CuAction, CuCapture, CuDriver } from './types';

/**
 * Ejecuta una accion de Computer Use en el escritorio (Windows) REUTILIZANDO el
 * ejecutor del agente (`service.executeAction`): nut.js con movimiento humano,
 * resolucion de coordenadas captura->fisico y las guardas de padding ya
 * existentes. Las coordenadas de `CuAction` vienen en PIXELES de la captura, que
 * es justo el espacio que espera el ejecutor.
 */

export type DesktopCuDriverDeps = {
  executeAction: (action: DesktopActionPayload) => Promise<void>;
  delay: (ms: number) => Promise<void>;
  /** Captura RAW (sin marcas) que ademas fija el layout del paso. */
  takeScreenshot: () => Promise<string>;
  /** Dimensiones reales de la ultima captura (para denormalizar 0-999). */
  getScreenshotSize: () => { width: number; height: number };
};

/** Driver de Computer Use para escritorio (Windows) sobre el ejecutor nut.js del agente. */
export function createDesktopCuDriver(deps: DesktopCuDriverDeps): CuDriver {
  return {
    entorno: 'ENVIRONMENT_DESKTOP',
    async capturar(): Promise<CuCapture> {
      const base64 = await deps.takeScreenshot();
      const { width, height } = deps.getScreenshotSize();
      return { base64, width, height };
    },
    ejecutar: (action, intent) => ejecutarAccionDesktop(deps, action, intent),
  };
}

/** true si la accion es terminal/no aplicable en desktop (el loop la ignora). */
export function esAccionNoEjecutableEnDesktop(action: CuAction): boolean {
  return action.tipo === 'navigate' || action.tipo === 'go_back' || action.tipo === 'go_forward' || action.tipo === 'screenshot';
}

export async function ejecutarAccionDesktop(
  deps: DesktopCuDriverDeps,
  action: CuAction,
  intent: string,
): Promise<void> {
  const message = intent || `Computer Use: ${action.tipo}`;

  switch (action.tipo) {
    case 'click':
    case 'double_click':
    case 'right_click':
    case 'mouse_down':
    case 'mouse_up':
    case 'move': {
      const mapa: Record<string, DesktopActionPayload['action']> = {
        click: 'click', double_click: 'double_click', right_click: 'right_click',
        mouse_down: 'mouse_down', mouse_up: 'mouse_up', move: 'mouse_move',
      };
      await deps.executeAction({ action: mapa[action.tipo], x: action.punto.x, y: action.punto.y, message });
      return;
    }
    case 'middle_click':
      // No hay middle_click dedicado; se aproxima con un click normal.
      await deps.executeAction({ action: 'click', x: action.punto.x, y: action.punto.y, message });
      return;

    case 'type':
      await deps.executeAction({ action: 'type', text: action.texto, message });
      if (action.enter) await deps.executeAction({ action: 'key', key: 'enter', message: `${message} (enter)` });
      return;

    case 'key':
      await deps.executeAction({ action: 'key', key: action.teclas, message });
      return;

    case 'scroll':
      await deps.executeAction({
        action: 'scroll',
        direction: action.direccion === 'up' ? 'up' : 'down',
        amount: action.magnitud,
        message,
      });
      return;

    case 'drag':
      await deps.executeAction({
        action: 'drag',
        x: action.desde.x, y: action.desde.y,
        x2: action.hasta.x, y2: action.hasta.y,
        message,
      });
      return;

    case 'wait':
      await deps.delay(action.ms);
      return;

    // navigate/go_back/go_forward/screenshot: no aplican en desktop (el loop
    // ya recaptura cada vuelta). 'desconocida': se ignora con log en el loop.
    case 'navigate':
    case 'go_back':
    case 'go_forward':
    case 'screenshot':
    case 'desconocida':
      return;
  }
}
