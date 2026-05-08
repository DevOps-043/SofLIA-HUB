import { clipboard as electronClipboard } from 'electron';
import { SEND_KEYS_MAP } from '../desktop-agent-types';
import type { PowerShellExecutor } from './window-controls';

type Delay = (ms: number) => Promise<void>;

export class DesktopKeyboardControls {
  constructor(
    private readonly ps: PowerShellExecutor,
    private readonly delay: Delay,
  ) {}

  async keyboardType(text: string): Promise<void> {
    const savedClip = electronClipboard.readText();
    electronClipboard.writeText(text);
    await this.delay(50);
    await this.ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`);
    await this.delay(100);
    electronClipboard.writeText(savedClip);
  }

  async keyboardKey(key: string): Promise<void> {
    const sendKey = SEND_KEYS_MAP[key.toLowerCase()] || key;
    await this.ps(`Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${sendKey}')`);
  }

  async keyboardHotkey(...keys: string[]): Promise<void> {
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
