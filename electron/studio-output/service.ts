import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { OutputAnswer, OutputOffer } from '../../src/shared/studio-program';

export class StudioOutputService {
  window: BrowserWindow | null = null;
  id = '';
  offer: OutputOffer | null = null;
  ready = false;
  private settle: ((answer: OutputAnswer | null) => void) | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private previousThrottling: boolean | null = null;
  constructor(private parent: BrowserWindow, private changed: (state: 'ready' | 'closed' | 'error') => void) {}
  close(): void {
    const window = this.window; this.window = null; this.ready = false; this.id = ''; this.offer = null;
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.settle?.(null); this.settle = null;
    if (window && !window.isDestroyed()) window.destroy();
    if (this.previousThrottling !== null && !this.parent.isDestroyed()) this.parent.webContents.setBackgroundThrottling(this.previousThrottling);
    this.previousThrottling = null;
    this.changed('closed');
  }
  async open(offer: OutputOffer): Promise<OutputAnswer> {
    if (this.window) throw new Error('La salida ya está preparada.');
    const runtimeDir = path.join(app.getAppPath(), 'dist-electron');
    const window = new BrowserWindow({ parent: this.parent, show: false, width: 1280, height: 720, useContentSize: true, frame: false, title: 'Salida del curso',
      webPreferences: { preload: path.join(runtimeDir, 'preload.js'), additionalArguments: ['--studio-output'], sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    this.window = window; this.id = randomUUID(); this.offer = offer;
    this.previousThrottling = this.parent.webContents.getBackgroundThrottling();
    this.parent.webContents.setBackgroundThrottling(false);
    window.setMenu(null);
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    const fail = () => { if (this.window === window) { this.close(); this.changed('error'); } };
    window.webContents.on('will-navigate', (event) => { event.preventDefault(); fail(); });
    window.webContents.on('will-redirect', (event) => { event.preventDefault(); fail(); });
    window.webContents.once('render-process-gone', fail);
    window.once('closed', () => { if (this.window === window) this.close(); });
    const answer = new Promise<OutputAnswer>((resolve, reject) => {
      this.settle = (value) => value ? resolve(value) : reject(new Error('No se pudo preparar la salida.'));
      // Incluye carga, ICE, respuesta y primer frame: nunca queda una concesión pendiente.
      this.timer = setTimeout(fail, 25000);
    });
    const devUrl = process.env.VITE_DEV_SERVER_URL;
    void Promise.resolve(devUrl ? window.loadURL(`${devUrl.replace(/\/$/, '')}/?view=studio-output`) : window.loadFile(path.join(runtimeDir, '../dist/index.html'), { query: { view: 'studio-output' } })).catch(fail);
    return answer;
  }
  answer(id: string, answer: OutputAnswer): boolean {
    if (id !== this.id || !this.settle) return false;
    const settle = this.settle; this.settle = null; settle(answer); return true;
  }
  state(id: string, state: 'ready' | 'error'): boolean {
    if (id !== this.id || !this.window || this.window.isDestroyed()) return false;
    if (state === 'error') { this.close(); this.changed('error'); return true; }
    if (this.timer) clearTimeout(this.timer); this.timer = null;
    this.ready = true; this.changed('ready'); return true;
  }
  capture(): Electron.WebFrameMain | null {
    if (!this.ready || !this.window || this.window.isDestroyed()) return null;
    const frame = this.window.webContents.mainFrame;
    return frame.detached ? null : frame;
  }
}
