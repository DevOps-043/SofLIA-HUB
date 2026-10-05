import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BrowserWindow, screen } from 'electron';

/** Ventana de metadatos: nunca carga una URL proporcionada por un agente. */
export class ActivityWindow {
  window: BrowserWindow | null = null;
  private wanted = false;
  constructor(private readonly getParent: () => BrowserWindow | null) {}
  show(): void {
    this.wanted = true;
    if (this.window && !this.window.isDestroyed()) {
      if (this.window.isMinimized()) this.window.restore();
      this.window.showInactive(); return;
    }
    const parent = this.getParent();
    if (!parent || parent.isDestroyed() || !parent.webContents.getURL()) return;
    const url = new URL(parent.webContents.getURL());
    url.search = ''; url.hash = ''; url.searchParams.set('view', 'agent-activity');
    const area = screen.getDisplayMatching(parent.getBounds()).workArea;
    const win = new BrowserWindow({
      title: 'Equipo de SofLIA', width: 380, height: 440, minWidth: 320, minHeight: 260,
      x: area.x + Math.max(0, area.width - 400), y: area.y + Math.min(80, Math.max(0, area.height - 440)),
      parent, show: false, autoHideMenuBar: true, skipTaskbar: true,
      webPreferences: { preload: path.join(path.dirname(fileURLToPath(import.meta.url)), 'preload.js'),
        additionalArguments: ['--agent-activity-window'], contextIsolation: true, nodeIntegration: false, sandbox: true },
    });
    this.window = win;
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.webContents.on('will-navigate', event => event.preventDefault());
    win.on('close', event => { event.preventDefault(); this.hide(); });
    win.on('closed', () => { if (this.window === win) this.window = null; });
    void win.loadURL(url.toString()).then(() => {
      if (this.window === win && !win.isDestroyed() && this.wanted) win.showInactive();
    }).catch(() => {
      if (this.window === win) this.destroy();
      console.warn('[Equipo] No se pudo abrir el monitor.');
    });
  }
  hide(): void { this.wanted = false; this.window?.hide(); }
  minimize(): void { this.wanted = false; this.window?.minimize(); }
  destroy(): void {
    this.wanted = false;
    const win = this.window; this.window = null;
    if (win && !win.isDestroyed()) win.destroy();
  }
}
