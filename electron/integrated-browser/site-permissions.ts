import { app } from 'electron';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  BrowserSitePermissionDecision,
  BrowserSitePermissionKind,
  BrowserSitePermissionState,
} from './types';
import { BROWSER_SITE_PERMISSION_DEFAULTS, BROWSER_SITE_PERMISSION_KINDS } from './types';

const MAX_ORIGINS = 500;

type StoredOrigin = Partial<Record<BrowserSitePermissionKind, BrowserSitePermissionDecision>>;

interface StoredFile {
  version: 1;
  origins: Record<string, StoredOrigin>;
}

/**
 * Permisos por origen del navegador integrado, equivalentes al panel del
 * candado de un navegador de escritorio. Viven en disco porque una llamada o
 * una videoconferencia no puede volver a pedir camara y microfono cada vez que
 * la aplicacion arranca, y porque el usuario necesita poder revocarlos despues
 * sin depender de que el sitio vuelva a preguntar.
 */
export class BrowserSitePermissionStore {
  private cache: Map<string, StoredOrigin> | null = null;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(
    private readonly filePath = path.join(app.getPath('userData'), 'integrated-browser', 'site-permissions.json'),
  ) {}

  /**
   * Estado efectivo de un permiso. `ask` significa que todavia hay que
   * consultar al usuario; los valores por omision reproducen lo que hace un
   * navegador: fullscreen o portapapeles saneado no interrumpen, la captura de
   * dispositivos si.
   */
  async resolve(origin: string, kind: BrowserSitePermissionKind): Promise<BrowserSitePermissionState> {
    const normalized = normalizeOrigin(origin);
    if (!normalized) return 'denied';
    const stored = (await this.load()).get(normalized);
    return stored?.[kind]?.state ?? BROWSER_SITE_PERMISSION_DEFAULTS[kind];
  }

  /** Version sincrona para los handlers de Electron, que no admiten promesas. */
  resolveSync(origin: string, kind: BrowserSitePermissionKind): BrowserSitePermissionState {
    const normalized = normalizeOrigin(origin);
    if (!normalized) return 'denied';
    const stored = this.cache?.get(normalized);
    return stored?.[kind]?.state ?? BROWSER_SITE_PERMISSION_DEFAULTS[kind];
  }

  async list(origin: string): Promise<Record<BrowserSitePermissionKind, BrowserSitePermissionState>> {
    const normalized = normalizeOrigin(origin);
    const stored = normalized ? (await this.load()).get(normalized) : undefined;
    const entries = BROWSER_SITE_PERMISSION_KINDS.map((kind) => [
      kind,
      stored?.[kind]?.state ?? BROWSER_SITE_PERMISSION_DEFAULTS[kind],
    ] as const);
    return Object.fromEntries(entries) as Record<BrowserSitePermissionKind, BrowserSitePermissionState>;
  }

  async set(origin: string, kind: BrowserSitePermissionKind, state: BrowserSitePermissionState): Promise<void> {
    const normalized = normalizeOrigin(origin);
    if (!normalized) throw new Error('El origen del permiso no es valido.');
    if (!BROWSER_SITE_PERMISSION_KINDS.includes(kind)) throw new Error('El permiso indicado no existe.');
    if (state !== 'ask' && state !== 'granted' && state !== 'denied') {
      throw new Error('El estado del permiso no es valido.');
    }
    await this.mutate((origins) => {
      const entry = { ...(origins.get(normalized) ?? {}) };
      // `ask` es el estado por omision: guardarlo solo agrandaria el archivo.
      if (state === BROWSER_SITE_PERMISSION_DEFAULTS[kind]) delete entry[kind];
      else entry[kind] = { state, decidedAt: new Date().toISOString() };
      if (Object.keys(entry).length === 0) origins.delete(normalized);
      else origins.set(normalized, entry);
    });
  }

  async reset(origin: string): Promise<void> {
    const normalized = normalizeOrigin(origin);
    if (!normalized) return;
    await this.mutate((origins) => {
      origins.delete(normalized);
    });
  }

  async clear(): Promise<void> {
    await this.mutate((origins) => origins.clear());
  }

  /** Precarga el archivo para que `resolveSync` responda desde el primer chequeo. */
  async warmUp(): Promise<void> {
    await this.load();
  }

  private async load(): Promise<Map<string, StoredOrigin>> {
    if (this.cache) return this.cache;
    this.cache = await this.readFromDisk();
    return this.cache;
  }

  private async readFromDisk(): Promise<Map<string, StoredOrigin>> {
    let raw: string;
    try {
      raw = await fs.readFile(this.filePath, 'utf8');
    } catch {
      return new Map();
    }
    try {
      const parsed = JSON.parse(raw) as Partial<StoredFile>;
      const origins = parsed?.origins;
      if (!origins || typeof origins !== 'object') return new Map();
      const entries: Array<[string, StoredOrigin]> = [];
      for (const [origin, value] of Object.entries(origins)) {
        const normalized = normalizeOrigin(origin);
        if (!normalized || !value || typeof value !== 'object') continue;
        const sanitized = sanitizeStoredOrigin(value as Record<string, unknown>);
        if (Object.keys(sanitized).length) entries.push([normalized, sanitized]);
      }
      return new Map(entries.slice(-MAX_ORIGINS));
    } catch {
      return new Map();
    }
  }

  private async mutate(operation: (origins: Map<string, StoredOrigin>) => void): Promise<void> {
    const pending = this.writeQueue.then(async () => {
      const origins = await this.load();
      operation(origins);
      // Un archivo sin limite crece con cada sitio visitado que pida algo.
      while (origins.size > MAX_ORIGINS) {
        const oldest = origins.keys().next();
        if (oldest.done) break;
        origins.delete(oldest.value);
      }
      const file: StoredFile = { version: 1, origins: Object.fromEntries(origins) };
      await fs.mkdir(path.dirname(this.filePath), { recursive: true });
      await fs.writeFile(this.filePath, `${JSON.stringify(file, null, 2)}\n`, 'utf8');
    });
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }
}

export function normalizeOrigin(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function sanitizeStoredOrigin(value: Record<string, unknown>): StoredOrigin {
  const sanitized: StoredOrigin = {};
  for (const kind of BROWSER_SITE_PERMISSION_KINDS) {
    const decision = value[kind];
    if (!decision || typeof decision !== 'object') continue;
    const state = (decision as { state?: unknown }).state;
    if (state !== 'granted' && state !== 'denied' && state !== 'ask') continue;
    const decidedAt = (decision as { decidedAt?: unknown }).decidedAt;
    sanitized[kind] = {
      state,
      decidedAt: typeof decidedAt === 'string' ? decidedAt : new Date().toISOString(),
    };
  }
  return sanitized;
}
