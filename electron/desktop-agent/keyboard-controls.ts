import { execFile as execFileCb } from 'node:child_process';
import { promisify } from 'node:util';
import { clipboard as electronClipboard } from 'electron';
import { assertGuiAutomationSupported, detectPlatformCapabilities } from '../platform-capabilities';
import type { PowerShellExecutor } from './window-controls';
import type { InputDriver } from './input-driver/types';
import { buildWindowsHotkey } from './windows-hotkey';
import { desktopKeys } from '../../src/shared/desktop-keys';
type Delay = (ms: number) => Promise<void>;
const execFileAsync = promisify(execFileCb);

export class DesktopKeyboardControls {
  private inputDriver: InputDriver | null = null;
  constructor(private readonly ps: PowerShellExecutor, private readonly delay: Delay) {}
  setInputDriver(driver: InputDriver | null): void { this.inputDriver = driver; }
  async keyboardType(text: string): Promise<void> {
    if (typeof text !== 'string' || text.length > 20000 || text.includes('\0')) throw new Error('Texto de teclado no válido.');
    if (this.inputDriver) { await this.inputDriver.typeText(text); return; }
    if (process.platform !== 'win32') { await runXdotool(['type', '--clearmodifiers', '--', text]); return; }
    const savedClip = await electronClipboard.readText();
    await electronClipboard.writeText(text);
    try {
      await this.delay(50);
      await this.ps("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')");
      await this.delay(100);
    } finally {
      // No sobrescribir una modificación del usuario/otra aplicación durante la espera.
      if (await electronClipboard.readText() === text) await electronClipboard.writeText(savedClip);
    }
  }
  async keyboardKey(key: string): Promise<void> { await this.pressValidated(desktopKeys(key)); }
  async keyboardHotkey(...keys: string[]): Promise<void> {
    if (!keys.length || keys.some(key => typeof key !== 'string')) throw new Error('Combinación de teclado no válida.');
    await this.pressValidated(desktopKeys(keys.join('+')));
  }
  private async pressValidated(keys: string[]): Promise<void> {
    if (this.inputDriver) { await this.inputDriver.pressKeys(keys); return; }
    if (process.platform !== 'win32') { await runXdotool(['key', '--clearmodifiers', keys.map(normalizeXdotoolKey).join('+')]); return; }
    await this.ps(buildWindowsHotkey(keys));
  }
}
async function runXdotool(args: string[]): Promise<void> {
  const capabilities = detectPlatformCapabilities(); assertGuiAutomationSupported(capabilities);
  if (!capabilities.linuxXdotool) throw new Error('xdotool sólo está disponible en Linux X11.');
  try { await execFileAsync('xdotool', args, { timeout: 10000, windowsHide: true, maxBuffer: 65536 }); }
  catch { throw new Error('No se completó la entrada xdotool. Comprueba instalación y sesión X11.'); }
}
function normalizeXdotoolKey(key: string): string {
  const names: Readonly<Record<string, string>> = { ctrl: 'Control_L', shift: 'Shift_L', alt: 'Alt_L', meta: 'Super_L', enter: 'Return', escape: 'Escape', tab: 'Tab', backspace: 'BackSpace', delete: 'Delete', pageup: 'Prior', pagedown: 'Next', up: 'Up', down: 'Down', left: 'Left', right: 'Right', home: 'Home', end: 'End', '+': 'plus', ';': 'semicolon', "'": 'apostrophe', '\x60': 'grave', '\\': 'backslash', '[': 'bracketleft', ']': 'bracketright', '=': 'equal', '-': 'minus', ',': 'comma', '.': 'period', '/': 'slash' };
  return names[key] ?? (/^f\d+$/.test(key) ? key.toUpperCase() : key);
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
