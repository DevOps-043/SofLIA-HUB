import { buildHumanPath, motionDurationMs, distance } from './human-motion';
import type {
  InputDriver,
  InputDriverCapabilities,
  MouseButton,
  MoveOptions,
  PhysicalPoint,
  TypeOptions,
} from './types';

/**
 * Backend nut.js (@nut-tree-fork/nut-js): control nativo C++ in-process de
 * mouse/teclado, multiplataforma (Windows/macOS/Linux) — el mismo runtime que
 * usa UI-TARS Desktop de ByteDance. El mouse se MUEVE por una trayectoria
 * humana (buildHumanPath) en vez de teletransportarse.
 *
 * El modulo se carga PEREZOSAMENTE con require: si el binario nativo no esta
 * disponible (ABI incompatible, no reconstruido), la factory lo detecta y cae
 * al backend legacy sin romper el agente.
 */

type NutModule = any;

let cachedModule: NutModule | null = null;
let loadError: string | null = null;

/** Carga perezosa del modulo nativo; memoiza exito y error. */
export function loadNutModule(): NutModule | null {
  if (cachedModule) return cachedModule;
  if (loadError) return null;
  try {
    // require dinamico: no se evalua salvo que se pida este backend.
    // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
    cachedModule = require('@nut-tree-fork/nut-js');
    return cachedModule;
  } catch (err) {
    loadError = err instanceof Error ? err.message : String(err);
    return null;
  }
}

const HUMAN_TYPE_DELAY_MS = 18;

export function createNutInputDriver(nut: NutModule): InputDriver {
  const { mouse, keyboard, Point, Button, Key, straightTo } = nut;
  // Configuracion base: el path lo generamos nosotros (buildHumanPath), asi que
  // usamos velocidad alta de nut y controlamos el timing por pasos.
  if (mouse?.config) mouse.config.autoDelayMs = 0;

  const toPoint = (p: PhysicalPoint) => new Point(Math.round(p.x), Math.round(p.y));

  async function humanMoveTo(destino: PhysicalPoint, humano: boolean): Promise<void> {
    if (!humano) {
      await mouse.setPosition(toPoint(destino));
      return;
    }
    const actual = await currentPosition();
    const path = buildHumanPath(actual, destino);
    // Ejecutar el path respetando su timing acumulado (movimiento no lineal).
    let lastMs = 0;
    for (const wp of path) {
      const wait = wp.atMs - lastMs;
      lastMs = wp.atMs;
      if (wait > 0) await delay(wait);
      await mouse.setPosition(new Point(wp.x, wp.y));
    }
  }

  async function currentPosition(): Promise<PhysicalPoint> {
    try {
      const pos = await mouse.getPosition();
      return { x: pos.x, y: pos.y };
    } catch {
      return { x: 0, y: 0 };
    }
  }

  const buttonOf = (button: MouseButton) =>
    button === 'right' ? Button.RIGHT : button === 'middle' ? Button.MIDDLE : Button.LEFT;

  return {
    capacidades(): InputDriverCapabilities {
      return { backend: 'nut', disponible: true, movimientoHumano: true };
    },
    async moveTo(destino, opts) {
      await humanMoveTo(destino, opts?.humano !== false);
    },
    async click(punto, button = 'left', opts) {
      await humanMoveTo(punto, opts?.humano !== false);
      await mouse.click(buttonOf(button));
    },
    async doubleClick(punto, opts) {
      await humanMoveTo(punto, opts?.humano !== false);
      await mouse.doubleClick(Button.LEFT);
    },
    async dragTo(desde, hasta, opts) {
      await humanMoveTo(desde, opts?.humano !== false);
      await mouse.pressButton(Button.LEFT);
      await humanMoveTo(hasta, true);
      await mouse.releaseButton(Button.LEFT);
    },
    async scroll(direccion, amount) {
      if (direccion === 'up') await mouse.scrollUp(amount);
      else await mouse.scrollDown(amount);
    },
    async typeText(texto, opts?: TypeOptions) {
      if (keyboard?.config) keyboard.config.autoDelayMs = opts?.perCharDelayMs ?? HUMAN_TYPE_DELAY_MS;
      await keyboard.type(texto);
    },
    async pressKeys(keys) {
      const mapped = keys.map((k) => mapKey(Key, k)).filter((k) => k !== undefined);
      if (mapped.length === 0) return;
      await keyboard.pressKey(...mapped);
      await keyboard.releaseKey(...mapped.slice().reverse());
    },
  } satisfies InputDriver & { moveTo: (d: PhysicalPoint, o?: MoveOptions) => Promise<void> };

  // straightTo/motionDurationMs/distance quedan disponibles para variantes
  // futuras (nut soporta path providers propios); se referencian para no perder
  // el import y documentar la intencion.
  void straightTo; void motionDurationMs; void distance;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Traduce nombres de tecla comunes al enum Key de nut.js. */
function mapKey(Key: any, name: string): any {
  const normalized = name.trim().toLowerCase();
  const table: Record<string, string> = {
    ctrl: 'LeftControl', control: 'LeftControl',
    shift: 'LeftShift', alt: 'LeftAlt', win: 'LeftSuper', meta: 'LeftSuper',
    enter: 'Enter', return: 'Enter', tab: 'Tab', escape: 'Escape', esc: 'Escape',
    space: 'Space', backspace: 'Backspace', delete: 'Delete', del: 'Delete',
    up: 'Up', down: 'Down', left: 'Left', right: 'Right',
    home: 'Home', end: 'End', pageup: 'PageUp', pagedown: 'PageDown',
  };
  if (table[normalized]) return Key[table[normalized]];
  if (normalized.length === 1) {
    const upper = normalized.toUpperCase();
    return Key[upper] ?? Key[normalized];
  }
  // Nombre ya en formato Key (p.ej. "F5")
  const capitalized = name.charAt(0).toUpperCase() + name.slice(1);
  return Key[capitalized] ?? Key[name];
}
