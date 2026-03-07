/**
 * PathMemoryService — Servicio proactivo de indexación de rutas del sistema de archivos.
 *
 * Resuelve el problema de que el agente de WhatsApp no encuentra archivos porque
 * OneDrive renombra carpetas (Desktop→Escritorio, Documents→Documentos) y el agente
 * adivina rutas incorrectas.
 *
 * - Primera ejecución: escaneo completo del sistema de archivos del usuario (profundidad 3-4)
 * - Cada 15 min: actualización incremental solo de directorios con cambios
 * - fs.watch en directorios clave (Descargas, Escritorio, Documentos)
 * - Escribe PATHS.md en knowledge/ para inyección en el contexto del agente
 */
import { app } from 'electron';
import { EventEmitter } from 'node:events';
import * as fs from 'node:fs';
import * as fsPromises from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

// ─── Constantes ──────────────────────────────────────────────────────
const SCAN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos
const WATCH_DEBOUNCE_MS = 5000; // 5 segundos debounce para fs.watch
const MAX_ENTRIES_PER_DIR = 200;
const MAX_DEPTH = 4;
const MAX_PATHS_MD_SIZE = 8000; // ~8KB máximo para PATHS.md

const EXCLUDED_DIRS = new Set([
  'node_modules', '.git', '.vscode', '.idea', '__pycache__',
  'AppData', '$Recycle.Bin', 'Program Files', 'Program Files (x86)',
  'Windows', 'ProgramData', 'Recovery', 'System Volume Information',
  'MSOCache', 'Intel', 'PerfLogs', 'All Users',
]);

const EXCLUDED_PREFIXES = ['.', '$'];

// Variantes de nombres de carpetas clave (español/inglés/OneDrive)
const KEY_FOLDER_VARIANTS: Record<string, string[]> = {
  'Escritorio': ['Desktop', 'Escritorio'],
  'Documentos': ['Documents', 'Documentos'],
  'Descargas': ['Downloads', 'Descargas'],
  'Imágenes': ['Pictures', 'Imágenes', 'Imagenes'],
  'Música': ['Music', 'Música', 'Musica'],
  'Videos': ['Videos'],
};

interface DirEntry {
  name: string;
  isDir: boolean;
  size?: number;
  mtime?: number;
}

interface ScannedDir {
  path: string;
  label: string;
  entries: DirEntry[];
  lastScanMs: number;
}

export class PathMemoryService extends EventEmitter {
  private knowledgePath: string;
  private pathsFilePath: string;
  private scanInterval: NodeJS.Timeout | null = null;
  private watchers: fs.FSWatcher[] = [];
  private watchDebounceTimers: Map<string, NodeJS.Timeout> = new Map();
  private scannedDirs: Map<string, ScannedDir> = new Map();
  private keyPaths: Map<string, string> = new Map(); // label → resolved path
  private changedDirs: Set<string> = new Set();
  private initialized = false;

  constructor() {
    super();
    this.knowledgePath = path.join(app.getPath('userData'), 'knowledge');
    this.pathsFilePath = path.join(this.knowledgePath, 'PATHS.md');
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────

  async init(): Promise<void> {
    // Asegurar que el directorio knowledge/ existe
    try {
      await fsPromises.mkdir(this.knowledgePath, { recursive: true });
    } catch { /* ya existe */ }

    const needsFullScan = !fs.existsSync(this.pathsFilePath);

    if (needsFullScan) {
      console.log('[PathMemory] Primera ejecución — iniciando escaneo completo...');
      await this.fullScan();
    } else {
      console.log('[PathMemory] PATHS.md existente — cargando rutas clave...');
      await this.detectKeyPaths();
    }

    this.initialized = true;
  }

  start(): void {
    if (!this.initialized) return;

    // Iniciar watchers en directorios clave
    this.setupWatchers();

    // Intervalo de actualización incremental cada 15 min
    this.scanInterval = setInterval(() => {
      this.incrementalUpdate().catch(err => {
        console.error('[PathMemory] Error en actualización incremental:', err.message);
      });
    }, SCAN_INTERVAL_MS);

    console.log('[PathMemory] Servicio iniciado — watchers activos + intervalo de 15 min.');
  }

  stop(): void {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
    }

    for (const watcher of this.watchers) {
      try { watcher.close(); } catch { /* ignorar */ }
    }
    this.watchers = [];

    for (const timer of this.watchDebounceTimers.values()) {
      clearTimeout(timer);
    }
    this.watchDebounceTimers.clear();

    console.log('[PathMemory] Servicio detenido.');
  }

  // ─── Detección de rutas clave ───────────────────────────────────────

  private async detectKeyPaths(): Promise<void> {
    const home = os.homedir();
    this.keyPaths.set('Home', home);

    // Detectar OneDrive
    const oneDriveCandidates = await this.findOneDrivePaths(home);

    // Para cada categoría de carpeta clave, buscar la primera variante que exista
    const searchRoots = [home, ...oneDriveCandidates];

    for (const [label, variants] of Object.entries(KEY_FOLDER_VARIANTS)) {
      for (const root of searchRoots) {
        let found = false;
        for (const variant of variants) {
          const candidate = path.join(root, variant);
          if (await this.dirExists(candidate)) {
            const prefix = root === home ? '' : `(OneDrive) `;
            this.keyPaths.set(`${prefix}${label}`, candidate);
            found = true;
            break;
          }
        }
        if (found) break;
      }
    }

    // Buscar raíces adicionales de OneDrive
    for (const od of oneDriveCandidates) {
      this.keyPaths.set('OneDrive', od);
    }
  }

  private async findOneDrivePaths(home: string): Promise<string[]> {
    const results: string[] = [];
    try {
      const entries = await fsPromises.readdir(home, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name.startsWith('OneDrive')) {
          results.push(path.join(home, entry.name));
        }
      }
    } catch { /* ignorar */ }
    return results;
  }

  // ─── Escaneo completo ──────────────────────────────────────────────

  private async fullScan(): Promise<void> {
    const startTime = Date.now();
    this.scannedDirs.clear();
    this.keyPaths.clear();

    await this.detectKeyPaths();

    const home = os.homedir();

    // Escanear directorios clave primero
    for (const [label, dirPath] of this.keyPaths.entries()) {
      if (label === 'Home' || label === 'OneDrive') continue; // escanear contenido, no solo la ruta
      await this.scanDirectory(dirPath, label, 2);
    }

    // Escanear home a profundidad limitada (solo nivel 1 para no duplicar)
    await this.scanDirectory(home, 'Home', 1);

    // Escanear OneDrive si existe
    const oneDrivePath = this.keyPaths.get('OneDrive');
    if (oneDrivePath) {
      await this.scanDirectory(oneDrivePath, 'OneDrive', 2);
    }

    await this.writePathsMd();

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[PathMemory] Escaneo completo terminado en ${elapsed}s — ${this.scannedDirs.size} directorios indexados.`);
  }

  // ─── Escaneo de un directorio ──────────────────────────────────────

  private async scanDirectory(dirPath: string, label: string, maxDepth: number, currentDepth: number = 0): Promise<void> {
    if (currentDepth > maxDepth || currentDepth > MAX_DEPTH) return;

    const normalizedPath = path.normalize(dirPath);

    // Evitar directorios excluidos
    const dirName = path.basename(normalizedPath);
    if (EXCLUDED_DIRS.has(dirName)) return;
    if (EXCLUDED_PREFIXES.some(p => dirName.startsWith(p)) && currentDepth > 0) return;

    try {
      const rawEntries = await fsPromises.readdir(normalizedPath, { withFileTypes: true });
      const entries: DirEntry[] = [];
      const subdirs: string[] = [];

      for (const entry of rawEntries.slice(0, MAX_ENTRIES_PER_DIR)) {
        const entryName = entry.name;

        // Saltar entradas ocultas/excluidas
        if (EXCLUDED_PREFIXES.some(p => entryName.startsWith(p))) continue;
        if (entry.isDirectory() && EXCLUDED_DIRS.has(entryName)) continue;

        const isDir = entry.isDirectory();
        let size: number | undefined;
        let mtime: number | undefined;

        if (!isDir) {
          try {
            const stats = await fsPromises.stat(path.join(normalizedPath, entryName));
            size = stats.size;
            mtime = stats.mtimeMs;
          } catch { /* archivo cloud-only o sin permisos */ }
        }

        entries.push({ name: entryName, isDir, size, mtime });

        if (isDir) {
          subdirs.push(path.join(normalizedPath, entryName));
        }
      }

      // Ordenar: carpetas primero, luego archivos por fecha más reciente
      entries.sort((a, b) => {
        if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
        if (a.mtime && b.mtime) return b.mtime - a.mtime;
        return a.name.localeCompare(b.name);
      });

      this.scannedDirs.set(normalizedPath, {
        path: normalizedPath,
        label: currentDepth === 0 ? label : '',
        entries,
        lastScanMs: Date.now(),
      });

      // Recursar en subdirectorios
      for (const subdir of subdirs) {
        await this.scanDirectory(subdir, '', maxDepth, currentDepth + 1);
      }
    } catch (err: any) {
      if (err.code !== 'EPERM' && err.code !== 'EACCES' && err.code !== 'ENOENT') {
        console.warn(`[PathMemory] Error escaneando ${normalizedPath}:`, err.message);
      }
    }
  }

  // ─── Actualización incremental ─────────────────────────────────────

  private async incrementalUpdate(): Promise<void> {
    // Si no hay cambios detectados por watchers, verificar mtime de directorios clave
    if (this.changedDirs.size === 0) {
      for (const [, dirPath] of this.keyPaths.entries()) {
        if (dirPath === os.homedir()) continue;
        const scanned = this.scannedDirs.get(path.normalize(dirPath));
        if (!scanned) {
          this.changedDirs.add(dirPath);
          continue;
        }
        try {
          const stats = await fsPromises.stat(dirPath);
          if (stats.mtimeMs > scanned.lastScanMs) {
            this.changedDirs.add(dirPath);
          }
        } catch { /* ignorar */ }
      }
    }

    if (this.changedDirs.size === 0) return;

    console.log(`[PathMemory] Actualización incremental — ${this.changedDirs.size} directorio(s) con cambios.`);

    const dirsToUpdate = [...this.changedDirs];
    this.changedDirs.clear();

    for (const dirPath of dirsToUpdate) {
      const existing = this.scannedDirs.get(path.normalize(dirPath));
      const label = existing?.label || '';
      // Re-escanear solo ese directorio (profundidad 1)
      await this.scanDirectory(dirPath, label, 1);
    }

    await this.writePathsMd();
  }

  // ─── fs.watch en directorios clave ─────────────────────────────────

  private setupWatchers(): void {
    // Limpiar watchers anteriores
    for (const w of this.watchers) {
      try { w.close(); } catch { /* ignorar */ }
    }
    this.watchers = [];

    const watchTargets: string[] = [];

    for (const [label, dirPath] of this.keyPaths.entries()) {
      if (label === 'Home' || label === 'OneDrive') continue;
      watchTargets.push(dirPath);
    }

    for (const dirPath of watchTargets) {
      try {
        const watcher = fs.watch(dirPath, { persistent: false }, (_eventType, _filename) => {
          // Debounce: acumular cambios durante 5 segundos
          const existing = this.watchDebounceTimers.get(dirPath);
          if (existing) clearTimeout(existing);

          this.watchDebounceTimers.set(dirPath, setTimeout(() => {
            this.watchDebounceTimers.delete(dirPath);
            this.changedDirs.add(dirPath);
            // Disparar actualización incremental inmediata
            this.incrementalUpdate().catch(err => {
              console.error(`[PathMemory] Error en actualización por watch:`, err.message);
            });
          }, WATCH_DEBOUNCE_MS));
        });

        this.watchers.push(watcher);
      } catch (err: any) {
        console.warn(`[PathMemory] No se pudo monitorear ${dirPath}: ${err.message}`);
      }
    }

    console.log(`[PathMemory] ${this.watchers.length} watcher(s) activos.`);
  }

  // ─── Generación de PATHS.md ────────────────────────────────────────

  private async writePathsMd(): Promise<void> {
    const home = os.homedir();
    const username = path.basename(home);
    const now = new Date().toLocaleString('es-MX', { timeZone: 'America/Mexico_City' });

    let md = `# Mapa de Rutas del Sistema\n`;
    md += `Última actualización: ${now}\n`;
    md += `Usuario: ${username}\n`;
    md += `Home: ${home}\n\n`;

    // Sección de rutas clave
    md += `## Rutas Clave\n`;
    for (const [label, dirPath] of this.keyPaths.entries()) {
      md += `- ${label}: ${dirPath}\n`;
    }
    md += `\n`;

    // Secciones por directorio escaneado (solo los que tienen label o son clave)
    const keyDirs = new Set([...this.keyPaths.values()].map(p => path.normalize(p)));

    // Primero mostrar directorios clave con sus contenidos
    for (const [normalizedPath, scanned] of this.scannedDirs.entries()) {
      if (!keyDirs.has(normalizedPath) && !scanned.label) continue;

      const displayLabel = scanned.label || path.basename(normalizedPath);
      md += `## ${displayLabel} (${normalizedPath})\n`;

      const fileEntries = scanned.entries.filter(e => !e.isDir);
      const dirEntries = scanned.entries.filter(e => e.isDir);

      if (dirEntries.length > 0) {
        md += `Carpetas: ${dirEntries.map(d => d.name).join(', ')}\n`;
      }

      // Mostrar archivos recientes (máximo 30 por directorio para no explotar el tamaño)
      const recentFiles = fileEntries.slice(0, 30);
      if (recentFiles.length > 0) {
        md += `Archivos recientes:\n`;
        for (const f of recentFiles) {
          const sizeStr = f.size !== undefined ? ` (${this.formatSize(f.size)})` : '';
          md += `- ${f.name}${sizeStr}\n`;
        }
      }

      if (fileEntries.length > 30) {
        md += `... y ${fileEntries.length - 30} archivos más\n`;
      }

      md += `\n`;

      // Verificar si ya excedemos el límite
      if (md.length > MAX_PATHS_MD_SIZE) {
        md += `[Truncado — demasiados directorios para indexar]\n`;
        break;
      }
    }

    // Escribir el archivo
    try {
      await fsPromises.writeFile(this.pathsFilePath, md, 'utf-8');
      this.emit('updated', { size: md.length, dirs: this.scannedDirs.size });
    } catch (err: any) {
      console.error('[PathMemory] Error escribiendo PATHS.md:', err.message);
    }
  }

  // ─── Utilidades ────────────────────────────────────────────────────

  private formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  private async dirExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fsPromises.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }
}
