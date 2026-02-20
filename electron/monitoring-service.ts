/**
 * MonitoringService — Main-process work monitoring engine.
 * Captures active window, idle state, and screenshots at configurable intervals.
 * Follows the same EventEmitter pattern as WhatsAppService.
 */
import { EventEmitter } from 'node:events';
import { app, desktopCapturer, powerMonitor } from 'electron';
import path from 'node:path';
import fs from 'node:fs/promises';

// ─── Types ──────────────────────────────────────────────────────────

export interface MonitoringConfig {
  intervalSeconds: number;       // 30-60, default 30
  idleThresholdSeconds: number;  // seconds before marking idle, default 120
  screenshotEnabled: boolean;
  ocrEnabled: boolean;
}

export interface ActivitySnapshot {
  windowTitle: string;
  processName: string;
  url?: string;
  idle: boolean;
  idleSeconds: number;
  screenshotPath?: string;
  ocrText?: string;
  timestamp: Date;
}

export interface MonitoringStatus {
  isRunning: boolean;
  sessionId: string | null;
  userId: string | null;
  snapshotCount: number;
  currentWindow?: string;
  config: MonitoringConfig;
}

// ─── Active window via dynamic import (ESM module) ──────────────────

let activeWinModule: any = null;

async function getActiveWindowInfo(): Promise<{ title: string; process: string; url?: string } | null> {
  try {
    if (!activeWinModule) {
      activeWinModule = await import('active-win');
    }
    const win = await activeWinModule.default();
    if (!win) return null;
    return {
      title: win.title || 'Unknown',
      process: win.owner?.name || 'Unknown',
      url: win.url || undefined,
    };
  } catch (err: any) {
    console.error('[MonitoringService] active-win error:', err.message);
    return null;
  }
}

// ─── MonitoringService class ────────────────────────────────────────

export class MonitoringService extends EventEmitter {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private config: MonitoringConfig;
  private sessionId: string | null = null;
  private userId: string | null = null;
  private snapshotBuffer: ActivitySnapshot[] = [];
  private snapshotCount = 0;
  private screenshotDir: string;
  private lastWindowTitle = '';

  constructor() {
    super();
    this.config = {
      intervalSeconds: 30,
      idleThresholdSeconds: 120,
      screenshotEnabled: true,
      ocrEnabled: false,
    };
    this.screenshotDir = path.join(app.getPath('temp'), 'soflia-monitoring');
  }

  // ─── Public API ───────────────────────────────────────────────────

  async start(userId: string, sessionId: string): Promise<void> {
    if (this.isRunning) {
      console.log('[MonitoringService] Already running, stopping first...');
      await this.stop();
    }

    this.userId = userId;
    this.sessionId = sessionId;
    this.isRunning = true;
    this.snapshotCount = 0;
    this.snapshotBuffer = [];
    this.lastWindowTitle = '';

    // Ensure screenshot directory exists
    await this.ensureScreenshotDir();

    console.log(`[MonitoringService] Started for user ${userId}, session ${sessionId}, interval ${this.config.intervalSeconds}s`);
    this.emit('session-started', { userId, sessionId });

    // Start the capture loop
    this.intervalId = setInterval(() => {
      this.captureSnapshot().catch(err => {
        console.error('[MonitoringService] Capture error:', err.message);
        this.emit('error', err);
      });
    }, this.config.intervalSeconds * 1000);

    // Capture first snapshot immediately
    this.captureSnapshot().catch(() => {});
  }

  async stop(): Promise<{ snapshotCount: number; buffer: ActivitySnapshot[] }> {
    if (!this.isRunning) {
      return { snapshotCount: 0, buffer: [] };
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    const count = this.snapshotCount;
    const buffer = this.flushBuffer();

    console.log(`[MonitoringService] Stopped. Total snapshots: ${count}`);

    this.emit('session-ended', {
      userId: this.userId,
      sessionId: this.sessionId,
      snapshotCount: count,
      pendingSnapshots: buffer,
    });

    const result = { snapshotCount: count, buffer };
    this.sessionId = null;
    this.userId = null;
    this.snapshotCount = 0;

    return result;
  }

  getStatus(): MonitoringStatus {
    return {
      isRunning: this.isRunning,
      sessionId: this.sessionId,
      userId: this.userId,
      snapshotCount: this.snapshotCount,
      currentWindow: this.lastWindowTitle || undefined,
      config: { ...this.config },
    };
  }

  setConfig(config: Partial<MonitoringConfig>): void {
    Object.assign(this.config, config);
    console.log('[MonitoringService] Config updated:', this.config);

    // If running and interval changed, restart the loop
    if (this.isRunning && config.intervalSeconds && this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = setInterval(() => {
        this.captureSnapshot().catch(() => {});
      }, this.config.intervalSeconds * 1000);
    }
  }

  // ─── Private: Capture loop ────────────────────────────────────────

  private async captureSnapshot(): Promise<void> {
    if (!this.isRunning) return;

    const timestamp = new Date();

    // 1. Get active window info
    const windowInfo = await getActiveWindowInfo();
    const windowTitle = windowInfo?.title || 'Unknown';
    const processName = windowInfo?.process || 'Unknown';
    const url = windowInfo?.url;

    this.lastWindowTitle = windowTitle;

    // 2. Get idle time
    const idleSeconds = powerMonitor.getSystemIdleTime();
    const isIdle = idleSeconds >= this.config.idleThresholdSeconds;

    // 3. Take screenshot (if enabled and not idle)
    let screenshotPath: string | undefined;
    if (this.config.screenshotEnabled && !isIdle) {
      screenshotPath = await this.takeScreenshot(timestamp);
    }

    // 4. OCR on screenshot (if enabled, async — don't block)
    let ocrText: string | undefined;
    if (this.config.ocrEnabled && screenshotPath) {
      try {
        const { extractTextFromFile } = await import('./ocr-service');
        ocrText = await extractTextFromFile(screenshotPath);
        if (ocrText && ocrText.length > 2000) ocrText = ocrText.slice(0, 2000);
      } catch {
        // OCR failure is non-critical
      }
    }

    // 5. Delete screenshot after OCR (keep disk clean)
    if (screenshotPath) {
      fs.unlink(screenshotPath).catch(() => {});
    }

    // 6. Build snapshot
    const snapshot: ActivitySnapshot = {
      windowTitle,
      processName,
      url,
      idle: isIdle,
      idleSeconds,
      screenshotPath: undefined, // Path deleted, only ocrText persists
      ocrText,
      timestamp,
    };

    this.snapshotCount++;
    this.snapshotBuffer.push(snapshot);

    // Emit for real-time UI updates
    this.emit('snapshot', snapshot);

    // 5. Flush buffer every 5 snapshots (~2.5 min at 30s interval)
    if (this.snapshotBuffer.length >= 5) {
      const batch = this.flushBuffer();
      this.emit('flush', {
        userId: this.userId,
        sessionId: this.sessionId,
        snapshots: batch,
      });
    }

    console.log(`[MonitoringService] #${this.snapshotCount} | ${processName}: ${windowTitle.slice(0, 60)}${isIdle ? ' [IDLE]' : ''}`);
  }

  private async takeScreenshot(timestamp: Date): Promise<string | undefined> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1280, height: 720 }, // Reduced for efficiency
      });

      if (sources.length === 0) return undefined;

      const primarySource = sources[0];
      const thumbnail = primarySource.thumbnail;

      if (thumbnail.isEmpty()) return undefined;

      const pngBuffer = thumbnail.toPNG();
      const filename = `snap_${timestamp.getTime()}.png`;
      const filePath = path.join(this.screenshotDir, filename);

      await fs.writeFile(filePath, pngBuffer);

      return filePath;
    } catch (err: any) {
      console.error('[MonitoringService] Screenshot error:', err.message);
      return undefined;
    }
  }

  private flushBuffer(): ActivitySnapshot[] {
    const batch = [...this.snapshotBuffer];
    this.snapshotBuffer = [];
    return batch;
  }

  private async ensureScreenshotDir(): Promise<void> {
    try {
      await fs.mkdir(this.screenshotDir, { recursive: true });
    } catch {
      // Already exists
    }
  }

  // ─── Cleanup: delete old screenshots ──────────────────────────────

  async cleanupScreenshots(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
    let deleted = 0;
    try {
      const files = await fs.readdir(this.screenshotDir);
      const now = Date.now();
      for (const file of files) {
        const filePath = path.join(this.screenshotDir, file);
        try {
          const stat = await fs.stat(filePath);
          if (now - stat.mtimeMs > maxAgeMs) {
            await fs.unlink(filePath);
            deleted++;
          }
        } catch { /* skip */ }
      }
    } catch { /* dir doesn't exist */ }
    return deleted;
  }
}
