import { BrowserWindow, screen } from 'electron';
import type { GuidanceState } from '../../src/shared/orb-guidance';
import { GUIDANCE_OVERLAY_DOCUMENT } from './overlay-document';
import { placeOrb, targetOnDisplay } from './geometry';

export type OrbSurfaceOptions = {
  getOrb: () => BrowserWindow | null;
  showOrb: () => Promise<void>;
  compact: (enabled: boolean) => void;
  captureVisibility?: (hidden: boolean) => void;
};

export class GuidanceSurfaces {
  private overlays = new Map<number, { window: BrowserWindow; ready: Promise<void> }>();
  private revision = 0;
  private moveTimer: ReturnType<typeof setTimeout> | null = null;
  private finishMotion: (() => void) | null = null;
  private captures = 0;
  private captureOrb: BrowserWindow | null = null;
  private captureRevision = 0;
  private captureWaiters = new Set<() => void>();

  constructor(private readonly options: OrbSurfaceOptions) {}

  async render(state: GuidanceState): Promise<void> {
    const revision = ++this.revision;
    this.stopMotion();
    this.hideOverlays();
    if (state.phase === 'idle' || state.phase === 'complete') {
      this.options.compact(false);
      return;
    }
    await this.waitForCaptures();
    if (revision !== this.revision) return;
    await this.options.showOrb();
    if (revision !== this.revision) return;
    if (this.captures) {
      this.options.getOrb()?.hide();
      await this.waitForCaptures();
      if (revision !== this.revision) return;
      await this.options.showOrb();
    }
    this.options.compact(true);
    if (!state.target) return;
    const orb = this.options.getOrb();
    if (!orb || orb.isDestroyed()) return;
    orb.setFocusable(false);
    const display = screen.getDisplayNearestPoint(state.target.point);
    const destination = placeOrb(state.target, display.workArea, screen.getCursorScreenPoint());
    await this.moveOrb(orb, destination, state.reducedMotion ? 0 : 280, revision);
    await this.waitForCaptures();
    if (revision !== this.revision || state.phase === 'paused') return;
    for (const monitor of screen.getAllDisplays()) {
      const target = targetOnDisplay(state.target, monitor.bounds);
      if (!target) continue;
      const overlay = this.overlay(monitor.id, monitor.bounds);
      await overlay.ready;
      await this.waitForCaptures();
      if (revision !== this.revision || overlay.window.isDestroyed()) return;
      await overlay.window.webContents.executeJavaScript(`window.showGuidance(${JSON.stringify({ target, style: state.style })})`);
      if (revision === this.revision && !this.captures) overlay.window.showInactive();
    }
  }

  /** La captura nunca restaura superficies de una revisión anterior. */
  async capture<T>(operation: () => Promise<T>): Promise<T> {
    const orb = this.options.getOrb();
    const visible = orb && !orb.isDestroyed() && orb.isVisible();
    if (!this.captures) { this.captureOrb = visible ? orb : null; this.captureRevision = this.revision; }
    this.captures++;
    this.options.captureVisibility?.(true);
    this.hideOverlays();
    if (visible) orb.hide();
    try {
      // Dar al compositor del SO una oportunidad de retirar la superficie.
      await new Promise<void>(resolve => setTimeout(resolve, 32));
      return await operation();
    } finally {
      this.captures--;
      const restore = this.captureOrb;
      if (!this.captures) {
        this.options.captureVisibility?.(false);
        this.captureOrb = null;
        if (this.captureRevision === this.revision && restore && this.options.getOrb() === restore && !restore.isDestroyed()) restore.showInactive();
        for (const release of this.captureWaiters) release();
        this.captureWaiters.clear();
      }
    }
  }

  clear(): void {
    this.revision++;
    if (this.captures) this.captureRevision = this.revision;
    this.stopMotion();
    this.hideOverlays();
    this.options.compact(false);
    this.releaseCaptureWaiters();
  }

  suspend(): void {
    this.revision++;
    if (this.captures) this.captureRevision = this.revision;
    this.stopMotion();
    this.hideOverlays();
    this.releaseCaptureWaiters();
  }

  dismiss(): void {
    this.captureOrb = null;
    this.clear();
  }

  async input<T>(operation: () => Promise<T>): Promise<T> {
    const orb = this.options.getOrb();
    if (orb && !orb.isDestroyed()) orb.setIgnoreMouseEvents(true);
    try { return await operation(); }
    finally { if (orb && !orb.isDestroyed() && this.options.getOrb() === orb) orb.setIgnoreMouseEvents(false); }
  }

  dispose(): void {
    this.clear();
    for (const { window } of this.overlays.values()) if (!window.isDestroyed()) window.destroy();
    this.overlays.clear();
  }

  private overlay(id: number, bounds: Electron.Rectangle) {
    const existing = this.overlays.get(id);
    if (existing && !existing.window.isDestroyed()) {
      existing.window.setBounds(bounds, false);
      return existing;
    }
    const window = new BrowserWindow({ ...bounds, transparent: true, frame: false, alwaysOnTop: true, focusable: false,
      skipTaskbar: true, hasShadow: false, resizable: false, movable: false, show: false,
      webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, devTools: false },
    });
    window.setIgnoreMouseEvents(true);
    window.setAlwaysOnTop(true, 'screen-saver');
    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    window.webContents.on('will-navigate', event => event.preventDefault());
    const ready = window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(GUIDANCE_OVERLAY_DOCUMENT)}`);
    const result = { window, ready };
    this.overlays.set(id, result);
    return result;
  }

  private hideOverlays(): void {
    for (const { window } of this.overlays.values()) if (!window.isDestroyed()) window.hide();
  }

  private waitForCaptures(): Promise<void> {
    return this.captures ? new Promise(resolve => this.captureWaiters.add(resolve)) : Promise.resolve();
  }

  private releaseCaptureWaiters(): void {
    for (const release of this.captureWaiters) release();
    this.captureWaiters.clear();
  }

  private stopMotion(): void {
    if (this.moveTimer) clearTimeout(this.moveTimer);
    this.moveTimer = null;
    this.finishMotion?.();
    this.finishMotion = null;
  }

  private moveOrb(orb: BrowserWindow, destination: Electron.Rectangle, duration: number, revision: number): Promise<void> {
    const start = orb.getBounds(), started = Date.now();
    return new Promise(resolve => {
      this.finishMotion = resolve;
      const frame = () => {
        if (revision !== this.revision || orb.isDestroyed()) { resolve(); return; }
        const progress = duration ? Math.min(1, (Date.now() - started) / duration) : 1;
        const ease = 1 - Math.pow(1 - progress, 3);
        orb.setBounds({ ...destination, x: Math.round(start.x + (destination.x - start.x) * ease), y: Math.round(start.y + (destination.y - start.y) * ease) }, false);
        if (progress === 1) { this.moveTimer = null; this.finishMotion = null; resolve(); }
        else this.moveTimer = setTimeout(frame, 16);
      };
      frame();
    });
  }
}
