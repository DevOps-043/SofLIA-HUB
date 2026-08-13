import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { clipboard as electronClipboard } from 'electron';
import { SEND_KEYS_MAP } from '../desktop-agent-types';
import { assertGuiAutomationSupported, detectPlatformCapabilities } from '../platform-capabilities';
import type { PowerShellExecutor } from './window-controls';
import type { InputDriver } from './input-driver/types';

type Delay = (ms: number) => Promise<void>;
const execFileAsync = promisify(execFileCb);

export class DesktopKeyboardControls {
  /** Driver de alto nivel (nut.js, tecleo humano). Si es null, se usa raw. */
  private inputDriver: InputDriver | null = null;

  constructor(
    private readonly ps: PowerShellExecutor,
    private readonly delay: Delay,
  ) {}

  setInputDriver(driver: InputDriver | null): void {
    this.inputDriver = driver;
  }

  async keyboardType(text: string): Promise<void> {
    if (this.inputDriver) {
      await this.inputDriver.typeText(text);
      return;
    }
    if (process.platform !== 'win32') {
      await runXdotool(['type', '--clearmodifiers', text]);
      return;
    }
    const savedClip = await electronClipboard.readText();
    await electronClipboard.writeText(text);
    try {
      await this.delay(50);
      await this.ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`);
      await this.delay(100);
    } finally {
      await electronClipboard.writeText(savedClip);
    }
  }

  async keyboardKey(key: string): Promise<void> {
    // Computer Use emite combinaciones como un solo string ("ctrl+shift+n").
    // Sin este desglose el driver nut.js no encontraba ninguna tecla con ese
    // nombre, filtraba todo y la accion se perdia SIN error: el agente creia
    // haber pulsado el atajo. SEND_KEYS_MAP solo cubre unos pocos combos fijos.
    const partes = splitKeyCombination(key);
    if (partes.length > 1) {
      await this.keyboardHotkey(...partes);
      return;
    }
    if (this.inputDriver) {
      await this.inputDriver.pressKeys([key]);
      return;
    }
    const sendKey = SEND_KEYS_MAP[key.toLowerCase()] || key;
    if (process.platform !== 'win32') {
      await runXdotool(['key', '--clearmodifiers', normalizeXdotoolKey(sendKey)]);
      return;
    }
    await this.ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')`);
  }

  async keyboardHotkey(...keys: string[]): Promise<void> {
    if (this.inputDriver) {
      await this.inputDriver.pressKeys(keys);
      return;
    }
    if (process.platform !== 'win32') {
      await runXdotool(['key', '--clearmodifiers', keys.map(normalizeXdotoolKey).join('+')]);
      return;
    }
    let combo = '';
    for (const key of keys) {
      const lower = key.toLowerCase();
      if (lower === 'ctrl') combo += '^';
      else if (lower === 'shift') combo += '+';
      else if (lower === 'alt') combo += '%';
      else combo += lower.length === 1 ? lower : `{${lower.toUpperCase()}}`;
    }
    await this.ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${combo}')`);
  }
}

async function runXdotool(args: string[]): Promise<void> {
  const capabilities = detectPlatformCapabilities();
  assertGuiAutomationSupported(capabilities);
  if (!capabilities.linuxXdotool) throw new Error(capabilities.unsupportedReason || 'xdotool solo se usa en Linux X11.');
  try {
    await execFileAsync('xdotool', args, { timeout: 10000, windowsHide: true });
  } catch (error: unknown) {
    const detail = error instanceof Error ? error.message : String(error);
    throw Object.assign(
      new Error(`No se pudo ejecutar xdotool. Instala xdotool y usa una sesion X11. Detalle: ${detail}`),
      { cause: error },
    );
  }
}

function normalizeXdotoolKey(key: string): string {
  const normalized = key.replace(/[{}]/g, '').toLowerCase();
  const map: Record<string, string> = {
    ctrl: 'ctrl',
    control: 'ctrl',
    shift: 'shift',
    alt: 'alt',
    enter: 'Return',
    return: 'Return',
    esc: 'Escape',
    escape: 'Escape',
    tab: 'Tab',
    backspace: 'BackSpace',
    delete: 'Delete',
    del: 'Delete',
    space: 'space',
  };
  return map[normalized] || key;
}

/**
 * Desglosa "ctrl+shift+n" en sus teclas. Un "+" suelto (la tecla mas) se
 * conserva como tecla: "ctrl++" es Ctrl y el signo mas.
 */
export function splitKeyCombination(key: string): string[] {
  const limpio = (key || '').trim();
  if (!limpio) return [];
  if (!limpio.includes('+')) return [limpio];

  // Se recorre a mano en vez de split('+'): con split, "ctrl++" produce dos
  // cadenas vacias y no se distingue el separador de la tecla mas.
  const teclas: string[] = [];
  let actual = '';
  for (const caracter of limpio) {
    if (caracter !== '+') {
      actual += caracter;
      continue;
    }
    if (actual.trim() === '') {
      teclas.push('+');
      continue;
    }
    teclas.push(actual.trim());
    actual = '';
  }
  if (actual.trim()) teclas.push(actual.trim());
  return teclas;
}
