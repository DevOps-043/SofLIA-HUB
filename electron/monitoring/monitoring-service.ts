import { EventEmitter } from 'node:events';
import { powerMonitor } from 'electron';
import { fetchFocusedAccessibilityTree } from './accessibility-tree';
import { captureMonitoringSnapshot } from './capture-snapshot';
import { loadOptionalSharp } from './native-deps';
import { cleanupMonitoringScreenshots, ensureMonitoringScreenshotDir } from './screenshot-cleanup';
import { startMonitoringServiceLoop, stopMonitoringServiceLoop } from './service-loop';
import { takeMonitoringServiceScreenshot } from './service-screenshot';
import { buildMonitoringStatus, clearMonitoringSession, createMonitoringState, flushMonitoringBuffer, recordMonitoringSnapshot, resetMonitoringSession } from './state';
import type { ActivitySnapshot, MonitoringConfig, MonitoringStatus } from './types';

const sharp = loadOptionalSharp();

export class MonitoringService extends EventEmitter {
  private readonly state = createMonitoringState(!!sharp);
  private sessionRevision = 0;
  private captureRevision = 0;
  private captureInFlight: Promise<void> | null = null;
  private captureInFlightRevision = 0;
  private captureRequested = false;

  async start(userId: string, sessionId: string): Promise<void> {
    const revision = ++this.sessionRevision;
    this.captureRevision++;
    if (this.state.isRunning) {
      console.log('[MonitoringService] Already running, stopping first...');
      await this.stopCurrentSession();
    }
    if (this.sessionRevision !== revision) return;

    resetMonitoringSession(this.state, userId, sessionId);
    await ensureMonitoringScreenshotDir(this.state.screenshotDir);
    if (this.sessionRevision !== revision || !this.state.isRunning) return;
    console.log(`[MonitoringService] Started for user ${userId}, session ${sessionId}, interval ${this.state.config.intervalSeconds}s`);
    this.emit('session-started', { userId, sessionId });
    this.startLoop();
    void this.captureSnapshot().catch(error => this.reportError(error));
  }

  async stop(): Promise<{ snapshotCount: number; buffer: ActivitySnapshot[] }> {
    this.sessionRevision++;
    this.captureRevision++;
    this.captureRequested = false;
    return this.stopCurrentSession();
  }

  private async stopCurrentSession(): Promise<{ snapshotCount: number; buffer: ActivitySnapshot[] }> {
    if (!this.state.isRunning) return { snapshotCount: 0, buffer: [] };

    this.stopLoop();
    this.state.isRunning = false;
    const count = this.state.snapshotCount;
    const buffer = flushMonitoringBuffer(this.state);
    console.log(`[MonitoringService] Stopped. Total snapshots: ${count}`);
    const ended = {
      userId: this.state.userId,
      sessionId: this.state.sessionId,
      snapshotCount: count,
      pendingSnapshots: buffer,
      allSnapshots: [...this.state.allSnapshots],
    };
    clearMonitoringSession(this.state);
    this.emit('session-ended', ended);
    return { snapshotCount: count, buffer };
  }

  getStatus(): MonitoringStatus {
    return buildMonitoringStatus(this.state);
  }

  setConfig(config: Partial<MonitoringConfig>): void {
    this.captureRevision++;
    Object.assign(this.state.config, config);
    console.log('[MonitoringService] Config updated:', this.state.config);
    if (this.state.isRunning && config.intervalSeconds && this.state.intervalId) this.startLoop();
  }

  public async getSemanticSnapshot(displayId?: string): Promise<{ axTree: string | null; imagePath: string | undefined }> {
    const timestamp = new Date();
    const imagePath = await this.takeScreenshot(timestamp, displayId);
    const axTree = await fetchFocusedAccessibilityTree();
    return { axTree, imagePath };
  }

  async cleanupScreenshots(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    return cleanupMonitoringScreenshots(this.state.screenshotDir, maxAgeMs);
  }

  private captureSnapshot(): Promise<void> {
    if (this.captureInFlight) {
      if (this.captureInFlightRevision !== this.captureRevision) this.captureRequested = true;
      return this.captureInFlight;
    }
    this.captureInFlightRevision = this.captureRevision;
    this.captureRequested = false;
    const pending = this.captureCurrentSnapshot().finally(() => {
      if (this.captureInFlight !== pending) return;
      this.captureInFlight = null;
      if (this.captureRequested && this.state.isRunning) {
        void this.captureSnapshot().catch(error => this.reportError(error));
      }
    });
    this.captureInFlight = pending;
    return pending;
  }

  private async captureCurrentSnapshot(): Promise<void> {
    const revision = this.captureRevision;
    const current = () => this.state.isRunning && this.captureRevision === revision;
    const result = await captureMonitoringSnapshot({
      config: { ...this.state.config },
      diagnostics: this.state.diagnostics,
      emitError: (message) => this.reportError({ message }),
      getIdleSeconds: () => powerMonitor.getSystemIdleTime(),
      isRunning: this.state.isRunning,
      current,
      takeScreenshot: (timestamp, displayId) => this.takeScreenshot(timestamp, displayId),
    });
    if (!result || !current()) return;
    const flushBatch = recordMonitoringSnapshot(this.state, result.snapshot, result.windowTitle);
    this.emit('snapshot', result.snapshot);
    if (flushBatch) this.emit('flush', { userId: this.state.userId, sessionId: this.state.sessionId, snapshots: flushBatch });
    console.log(`[MonitoringService] #${this.state.snapshotCount} | ${result.processName}: ${result.windowTitle.slice(0, 60)}${result.idle ? ' [IDLE]' : ''}`);
  }

  private startLoop(): void {
    this.state.intervalId = startMonitoringServiceLoop(
      this.state.intervalId,
      this.state.config.intervalSeconds,
      () => this.captureSnapshot(),
      (err) => this.reportError(err),
    );
  }

  private stopLoop(): void {
    this.state.intervalId = stopMonitoringServiceLoop(this.state.intervalId);
  }

  private reportError(error: unknown): void {
    console.warn('[Monitoreo] No se pudo completar una operación de captura.');
    if (this.listenerCount('error') === 0) return;
    try { this.emit('error', error); }
    catch { console.error('[Monitoreo] Falló un receptor del diagnóstico de captura.'); }
  }

  private async takeScreenshot(timestamp: Date, displayId?: string): Promise<string | undefined> {
    return takeMonitoringServiceScreenshot({
      displayId,
      emitError: (message) => this.reportError({ message }),
      sharp,
      state: this.state,
      timestamp,
    });
  }
}
