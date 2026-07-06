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
    const savedClip = electronClipboard.readText();
    electronClipboard.writeText(text);
    await this.delay(50);
    await this.ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`);
    await this.delay(100);
    electronClipboard.writeText(savedClip);
  }

  async keyboardKey(key: string): Promise<void> {
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
  } catch (err: any) {
    throw new Error(`No se pudo ejecutar xdotool. Instala xdotool y usa una sesion X11. Detalle: ${err.message}`);
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
