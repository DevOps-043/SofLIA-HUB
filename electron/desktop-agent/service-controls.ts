import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { quickScreenshotHash, waitForScreenHashChange, waitForWindowTitle } from './waiting-runtime';
import type { DesktopAgentService } from '../desktop-agent-service';
import type { DesktopAgentServiceConstructor } from './service-types';

const execAsync = promisify(execCb);

export interface DesktopAgentControlsApi {
  ps(script: string): Promise<string>;
  psEncoded(script: string, timeout?: number): Promise<string>;
  mouseClick(x: number, y: number): Promise<void>;
  mouseDoubleClick(x: number, y: number): Promise<void>;
  mouseRightClick(x: number, y: number): Promise<void>;
  mouseDrag(x1: number, y1: number, x2: number, y2: number, durationMs?: number): Promise<void>;
  mouseDown(x: number, y: number, button?: 'left' | 'right'): Promise<void>;
  mouseUp(x?: number, y?: number): Promise<void>;
  mouseMove(x: number, y: number): Promise<void>;
  mouseScroll(direction: 'up' | 'down', amount?: number): Promise<void>;
  keyboardType(text: string): Promise<void>;
  keyboardKey(key: string): Promise<void>;
  keyboardHotkey(...keys: string[]): Promise<void>;
  focusWindow(titleSubstring: string): Promise<boolean>;
  minimizeWindow(titleSubstring: string): Promise<boolean>;
  maximizeWindow(titleSubstring: string): Promise<boolean>;
  restoreWindow(titleSubstring: string): Promise<boolean>;
  closeWindow(titleSubstring: string): Promise<boolean>;
  listWindows(): Promise<Array<{ title: string; process: string; pid: number }>>;
  getActiveWindow(): Promise<{ title: string; process: string } | null>;
  waitForScreenChange(timeoutMs?: number): Promise<boolean>;
  waitForWindow(titleSubstring: string, timeoutMs?: number): Promise<boolean>;
  quickHash(base64: string): string;
}

export function attachDesktopAgentControls(Service: DesktopAgentServiceConstructor): void {
  Object.assign(Service.prototype, {
    async ps(script: string) {
      if (process.platform !== 'win32') {
        throw new Error('PowerShell/Win32 solo esta disponible en Windows. En Linux usa X11 + xdotool para automatizacion GUI.');
      }
      const { stdout } = await execAsync(
        `powershell -NoProfile -Command "${script.replace(/\n/g, '; ').replace(/"/g, '\\"')}"`,
        { timeout: 10000, windowsHide: true },
      );
      return stdout?.trim() || '';
    },
    async psEncoded(script: string, timeout = 10000) {
      if (process.platform !== 'win32') {
        throw new Error('PowerShell/Win32 solo esta disponible en Windows. La captura degradara a escritorio completo en Linux.');
      }
      const encoded = Buffer.from(script, 'utf16le').toString('base64');
      const { stdout } = await execAsync(`powershell -NoProfile -EncodedCommand ${encoded}`, { timeout, windowsHide: true });
      return stdout?.trim() || '';
    },
    mouseClick(x, y) { return this.mouseControls.mouseClick(x, y); },
    mouseDoubleClick(x, y) { return this.mouseControls.mouseDoubleClick(x, y); },
    mouseRightClick(x, y) { return this.mouseControls.mouseRightClick(x, y); },
    mouseDrag(x1, y1, x2, y2, durationMs = 500) { return this.mouseControls.mouseDrag(x1, y1, x2, y2, durationMs); },
    mouseDown(x, y, button = 'left') { return this.mouseControls.mouseDown(x, y, button); },
    mouseUp(x, y) { return this.mouseControls.mouseUp(x, y); },
    mouseMove(x, y) { return this.mouseControls.mouseMove(x, y); },
    mouseScroll(direction, amount = 3) { return this.mouseControls.mouseScroll(direction, amount); },
    keyboardType(text) { return this.keyboardControls.keyboardType(text); },
    keyboardKey(key) { return this.keyboardControls.keyboardKey(key); },
    keyboardHotkey(...keys) { return this.keyboardControls.keyboardHotkey(...keys); },
    focusWindow(titleSubstring) { return this.windowControls.focusWindow(titleSubstring); },
    minimizeWindow(titleSubstring) { return this.windowControls.minimizeWindow(titleSubstring); },
    maximizeWindow(titleSubstring) { return this.windowControls.maximizeWindow(titleSubstring); },
    restoreWindow(titleSubstring) { return this.windowControls.restoreWindow(titleSubstring); },
    closeWindow(titleSubstring) { return this.windowControls.closeWindow(titleSubstring); },
    listWindows() { return this.windowControls.listWindows(); },
    getActiveWindow() { return this.windowControls.getActiveWindow(); },
    waitForScreenChange(timeoutMs) {
      return waitForScreenHashChange({
        timeoutMs: timeoutMs ?? this.config.waitForChangeTimeout,
        intervalMs: this.config.waitForChangeInterval,
        takeScreenshot: () => this.takeScreenshot(),
        delay: (ms) => this.delay(ms),
      });
    },
    waitForWindow(titleSubstring, timeoutMs = 10000) {
      return waitForWindowTitle({ titleSubstring, timeoutMs, listWindows: () => this.listWindows(), delay: (ms) => this.delay(ms) });
    },
    quickHash: (base64) => quickScreenshotHash(base64),
  } satisfies DesktopAgentControlsApi & ThisType<DesktopAgentService>);
}
