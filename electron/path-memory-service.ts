import { app } from 'electron';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { SCAN_INTERVAL_MS } from './path-memory/constants';
import type { ScannedDir } from './path-memory/types';
import { markChangedKeyDirs } from './path-memory/changed-dirs';
import { resolveKeyPaths } from './path-memory/key-paths';
import { scanDirectory } from './path-memory/scanner';
import { setupPathWatchers, stopPathWatchers } from './path-memory/watchers';
import { writePathsMarkdownFile } from './path-memory/write-paths';
export class PathMemoryService extends EventEmitter {
  private knowledgePath = path.join(app.getPath('userData'), 'knowledge');
  private pathsFilePath = path.join(this.knowledgePath, 'PATHS.md');
  private scanInterval: NodeJS.Timeout | null = null;
  private watchers: fs.FSWatcher[] = [];
  private watchDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private scannedDirs: Map<string, ScannedDir> = new Map();
  private keyPaths: Map<string, string> = new Map();
  private changedDirs: Set<string> = new Set();
  private initialized = false;
  private running = false;
  private revision = 0;
  private updatePromise: Promise<void> | null = null;
  private updateRequested = false;
  async init(): Promise<void> {
    try { await fsPromises.mkdir(this.knowledgePath, { recursive: true }); } catch {}
    if (!fs.existsSync(this.pathsFilePath)) {
      console.log('[PathMemory] Primera ejecucion - iniciando escaneo completo...');
      await this.fullScan();
    } else {
      console.log('[PathMemory] PATHS.md existente - cargando rutas clave...');
      this.keyPaths = await resolveKeyPaths(os.homedir());
    }
    this.initialized = true;
  }
  start(): void {
    if (!this.initialized || this.running) return;
    this.running = true;
    this.revision++;
    this.setupWatchers();
    this.scanInterval = setInterval(() => {
      void this.requestUpdate().catch(() => console.error('[PathMemory] No se pudo actualizar el índice de rutas.'));
    }, SCAN_INTERVAL_MS);
    this.scanInterval.unref();
    void this.requestUpdate().catch(() => console.error('[PathMemory] No se pudo recuperar el índice inicial.'));
    console.log('[PathMemory] Servicio iniciado - watchers activos + intervalo de 15 min.');
  }
  stop(): void {
    this.running = false;
    this.revision++;
    this.updateRequested = false;
    if (this.scanInterval) clearInterval(this.scanInterval);
    this.scanInterval = null;
    stopPathWatchers(this.watchers);
    for (const timer of this.watchDebounceTimers.values()) clearTimeout(timer);
    this.watchDebounceTimers.clear();
    console.log('[PathMemory] Servicio detenido.');
  }
  private async fullScan(): Promise<void> {
    const startTime = Date.now();
    this.scannedDirs.clear();
    this.keyPaths = await resolveKeyPaths(os.homedir());
    for (const [label, dirPath] of this.keyPaths.entries()) {
      if (label === 'Home' || label === 'OneDrive') continue;
      await scanDirectory(this.scannedDirs, dirPath, label, 2);
    }
    await scanDirectory(this.scannedDirs, os.homedir(), 'Home', 1);
    const oneDrivePath = this.keyPaths.get('OneDrive');
    if (oneDrivePath) await scanDirectory(this.scannedDirs, oneDrivePath, 'OneDrive', 2);
    await this.writePathsMd();
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[PathMemory] Escaneo completo terminado en ${elapsed}s - ${this.scannedDirs.size} directorios indexados.`);
  }
  private requestUpdate(): Promise<void> {
    if (!this.running) return Promise.resolve();
    this.updateRequested = true;
    if (this.updatePromise) return this.updatePromise;
    const pending = (async () => {
      while (this.running && this.updateRequested) {
        this.updateRequested = false;
        const revision = this.revision;
        await this.incrementalUpdate(() => this.running && this.revision === revision);
      }
    })().finally(() => {
      if (this.updatePromise !== pending) return;
      this.updatePromise = null;
      if (this.running && this.updateRequested) {
        void this.requestUpdate().catch(() => console.error('[PathMemory] No se pudo recuperar una actualización pendiente.'));
      }
    });
    this.updatePromise = pending;
    return pending;
  }
  private async incrementalUpdate(current: () => boolean): Promise<void> {
    await markChangedKeyDirs(this.keyPaths, this.scannedDirs, this.changedDirs);
    if (!current()) return;
    if (this.changedDirs.size === 0) return;
    console.log(`[PathMemory] Actualizacion incremental - ${this.changedDirs.size} directorio(s) con cambios.`);
    const dirsToUpdate = [...this.changedDirs];
    this.changedDirs.clear();
    for (const dirPath of dirsToUpdate) {
      if (!current()) { dirsToUpdate.forEach(dir => this.changedDirs.add(dir)); return; }
      const existing = this.scannedDirs.get(path.normalize(dirPath));
      await scanDirectory(this.scannedDirs, dirPath, existing?.label || '', 1, 0, current);
    }
    if (!current()) { dirsToUpdate.forEach(dir => this.changedDirs.add(dir)); return; }
    await this.writePathsMd(current);
  }
  private setupWatchers(): void {
    setupPathWatchers({
      keyPaths: this.keyPaths,
      watchers: this.watchers,
      timers: this.watchDebounceTimers,
      changedDirs: this.changedDirs,
      isActive: () => this.running,
      onChanged: () => { void this.requestUpdate().catch(() => console.error('[PathMemory] No se pudo actualizar el índice por cambios.')); },
    });
    console.log(`[PathMemory] ${this.watchers.length} watcher(s) activos.`);
  }
  private async writePathsMd(current: () => boolean = () => true): Promise<void> {
    try {
      if (!current()) return;
      const result = await writePathsMarkdownFile(this.pathsFilePath, this.keyPaths, this.scannedDirs);
      if (current()) this.emit('updated', result);
    } catch (err: any) { console.error('[PathMemory] Error escribiendo PATHS.md:', err.message); }
  }
}
