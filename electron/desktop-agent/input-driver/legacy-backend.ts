import type { DesktopKeyboardControls } from '../keyboard-controls';
import type { DesktopMouseControls } from '../mouse-controls';
import type {
  InputDriver,
  InputDriverCapabilities,
  MouseButton,
  MoveOptions,
  PhysicalPoint,
  TypeOptions,
} from './types';

/**
 * Backend legacy: envuelve los controles PowerShell/SetCursorPos existentes.
 * No hay movimiento humano (el mouse se teletransporta), pero garantiza que el
 * agente sigue funcionando si el modulo nativo nut.js no puede cargar.
 */
export function createLegacyInputDriver(deps: {
  mouse: DesktopMouseControls;
  keyboard: DesktopKeyboardControls;
  detalle?: string;
}): InputDriver {
  return {
    capacidades(): InputDriverCapabilities {
      return { backend: 'legacy', disponible: true, movimientoHumano: false, detalle: deps.detalle };
    },
    async moveTo(destino: PhysicalPoint) {
      await deps.mouse.mouseMoveToPhysicalPoint(destino.x, destino.y);
    },
    async click(punto: PhysicalPoint, button: MouseButton = 'left') {
      if (button === 'right') {
        await deps.mouse.rightClickAtPhysicalPoint(punto.x, punto.y);
      } else {
        await deps.mouse.clickAtPhysicalPoint(punto.x, punto.y);
      }
    },
    async doubleClick(punto: PhysicalPoint) {
      await deps.mouse.doubleClickAtPhysicalPoint(punto.x, punto.y);
    },
    async dragTo(desde: PhysicalPoint, hasta: PhysicalPoint) {
      await deps.mouse.dragBetweenPhysicalPoints(desde.x, desde.y, hasta.x, hasta.y);
    },
    async scroll(direccion: 'up' | 'down', amount: number) {
      await deps.mouse.mouseScroll(direccion, amount);
    },
    async typeText(texto: string, _opts?: TypeOptions) {
      await deps.keyboard.keyboardType(texto);
    },
    async pressKeys(keys: string[]) {
      if (keys.length === 1) {
        await deps.keyboard.keyboardKey(keys[0]);
      } else {
        await deps.keyboard.keyboardHotkey(...keys);
      }
    },
  } satisfies InputDriver & { moveTo: (d: PhysicalPoint, o?: MoveOptions) => Promise<void> };
}
