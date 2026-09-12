import { flushPolicyFile, preparePolicyRecovery, readPolicyFile, serializePolicyFile, writePolicyFile, type PolicyRecoveryReview } from './policy-file-recovery';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
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
  private cachePath: string | null = null;
  private loading: { destination: string; promise: Promise<Map<string, StoredOrigin>> } | null = null;
  private writeQueue: Promise<void> = Promise.resolve();
  private readonly readFailures = new Map<string, Error>();
  private recoveryRevision = 0;

  constructor(
    private readonly location: string | (() => string) = () => browserProfilePath('site-permissions.json'),
  ) {}

  private get filePath(): string {
    return resolveStoreLocation(this.location);
  }

  /**
   * Suelta el archivo en memoria. Obligatorio al cambiar de usuario: el cache
   * pertenece al perfil anterior y `resolveSync` seguiria concediendo camara o
   * microfono con decisiones que la nueva sesion nunca tomo.
   */
  invalidateCache(): void {
    this.cache = null;
    this.cachePath = null;
    this.loading = null;
  }

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
    const stored = this.cachePath === this.filePath ? this.cache?.get(normalized) : undefined;
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
    }, true);
  }

  async clear(): Promise<void> {
    await this.mutate((origins) => origins.clear(), true);
  }

  /** Como `clear`, pero informa cuantos origenes tenian una decision guardada. */
  async clearAll(): Promise<number> {
    let removed = 0;
    await this.mutate((origins) => {
      removed = origins.size;
      origins.clear();
    }, true);
    return removed;
  }

  /** Precarga el archivo para que `resolveSync` responda desde el primer chequeo. */
  async warmUp(): Promise<void> {
    await this.load();
  }

  private async load(destination = this.filePath): Promise<Map<string, StoredOrigin>> {
    if (this.cache && this.cachePath === destination) return this.cache;
    if (this.loading?.destination === destination) return this.loading.promise;
    const promise = this.readFromDisk(destination);
    this.loading = { destination, promise };
    const origins = await promise;
    if (this.loading?.promise === promise) {
      this.loading = null;
      if (this.filePath === destination) { this.cache = origins; this.cachePath = destination; }
    }
    return origins;
  }

  async prepareRecovery(guard: () => void): Promise<PolicyRecoveryReview> {
    const destination = this.filePath; await this.flush(); guard();
    let restored!: StoredFile;
    const review = await preparePolicyRecovery<StoredFile>(destination, validatePermissionFile, file => {
      const origins: StoredFile['origins'] = {};
      for (const [origin, stored] of Object.entries(file.origins)) {
        origins[origin] = Object.fromEntries(BROWSER_SITE_PERMISSION_KINDS.map(kind => [kind, { decidedAt: new Date(0).toISOString(), state: stored[kind]?.state === 'denied' ? 'denied' : 'ask' }]));
      }
      restored = validatePermissionFile({ version: 1, origins });
      return { count: Object.keys(restored.origins).length, value: restored };
    }, guard);
    return { count: review.count, commit: async () => {
      await review.commit(); this.recoveryRevision++; this.readFailures.delete(destination);
      if (this.filePath === destination) {
        // No conceder defaults de presentación entre invalidar la caché y una lectura asíncrona.
        this.loading = null;
        this.cache = new Map(Object.entries(restored.origins)); this.cachePath = destination;
      }
    } };
  }

  /** Espera la última mutación antes de eliminar el directorio del perfil. */
  async flush(): Promise<void> {
    const destination = this.filePath;
    await this.writeQueue;
    await this.loading?.promise;
    await flushPolicyFile(destination);
  }

  private async readFromDisk(destination: string): Promise<Map<string, StoredOrigin>> {
    const revision = this.recoveryRevision;
    try {
      const parsed = await readPolicyFile(destination, validatePermissionFile, () => ({ version: 1, origins: {} }));
      if (revision !== this.recoveryRevision) throw new Error('La recuperación cambió los permisos durante la lectura.');
      this.readFailures.delete(destination);
      return new Map(Object.entries(parsed.origins));
    } catch {
      // Un fallo tardío de una lectura anterior no invalida la proyección recién publicada.
      if (revision !== this.recoveryRevision) throw new Error('La recuperación cambió los permisos durante la lectura.');
      this.markReadFailure(destination);
      return new Map();
    }
  }

  private markReadFailure(destination: string): void {
    if (this.cachePath === destination) { this.cache = null; this.cachePath = null; }
    if (!this.readFailures.has(destination)) console.warn('[Navegador][Permisos] Almacén no disponible. Se usan valores por omisión y se conserva el archivo sin sobrescribirlo.');
    this.readFailures.set(destination, new Error('No se pueden guardar permisos: el archivo es ilegible o de una versión no compatible. Se conserva para recuperación.'));
  }

  private async mutate(operation: (origins: Map<string, StoredOrigin>) => void, eraseCopies = false): Promise<void> {
    const destination = this.filePath;
    const pending = this.writeQueue.then(() => serializePolicyFile(destination, async () => {
      // Una caché válida no autoriza sobrescribir un archivo cambiado por una actualización.
      const origins = new Map(await this.readFromDisk(destination));
      const readFailure = this.readFailures.get(destination);
      if (readFailure) throw readFailure;
      operation(origins);
      // Un archivo sin limite crece con cada sitio visitado que pida algo.
      while (origins.size > MAX_ORIGINS) {
        const oldest = origins.keys().next();
        if (oldest.done) break;
        origins.delete(oldest.value);
      }
      const file: StoredFile = { version: 1, origins: Object.fromEntries(origins) };
      await writePolicyFile(destination, file, validatePermissionFile, () => {}, eraseCopies);
      if (this.filePath === destination) { this.cache = origins; this.cachePath = destination; }
    }));
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }
}

function validatePermissionFile(raw: unknown): StoredFile {
  const file = raw as StoredFile;
  if (!file || file.version !== 1 || !file.origins || typeof file.origins !== 'object' || Array.isArray(file.origins) || Object.keys(file.origins).length > MAX_ORIGINS) throw new Error('Formato de permisos no compatible.');
  const entries: Array<[string, StoredOrigin]> = [];
  for (const [origin, value] of Object.entries(file.origins)) {
    const normalized = normalizeOrigin(origin);
    if (!normalized || !value || typeof value !== 'object') continue;
    const sanitized = sanitizeStoredOrigin(value as Record<string, unknown>);
    if (Object.keys(sanitized).length) entries.push([normalized, sanitized]);
  }
  return { version: 1, origins: Object.fromEntries(entries) };
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
