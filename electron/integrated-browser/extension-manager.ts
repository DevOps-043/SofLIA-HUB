import { dialog, type BrowserWindow, type Session } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import type { BrowserExtensionInstallPreview, BrowserExtensionMetadata } from './types';

type StoredExtension = BrowserExtensionMetadata & { managedPath: string };
type ExtensionRegistry = { version: 1; extensions: StoredExtension[] };
type ExtensionManifest = {
  manifest_version?: unknown;
  name?: unknown;
  version?: unknown;
  permissions?: unknown;
  host_permissions?: unknown;
  optional_permissions?: unknown;
  optional_host_permissions?: unknown;
  content_scripts?: unknown;
};
type ScannedFile = { source: string; relative: string; size: number; sha256: string };
type InspectedExtension = Awaited<ReturnType<typeof inspectExtension>>;
type PendingInstall = { token: string; inspected: InspectedExtension; expiresAt: number };

const MAX_EXTENSION_FILES = 2_000;
const MAX_EXTENSION_BYTES = 20 * 1024 * 1024;
const BLOCKED_PERMISSIONS = new Set(['nativeMessaging', 'debugger', 'proxy', 'management']);
const PENDING_INSTALL_TTL_MS = 5 * 60_000;

export class BrowserExtensionManager {
  private writeQueue: Promise<void> = Promise.resolve();
  private pendingInstall: PendingInstall | null = null;
  private pendingInstallTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Las extensiones pertenecen al perfil del usuario activo: una extension
   * instalada por una cuenta no debe cargarse en la sesion de otra.
   */
  constructor(private readonly root: string | (() => string) = () => browserProfilePath('extensions')) {}

  private get managedRoot(): string {
    return resolveStoreLocation(this.root);
  }

  private get registryPath(): string {
    return path.join(this.managedRoot, 'registry.json');
  }

  async list(): Promise<BrowserExtensionMetadata[]> {
    await this.writeQueue;
    return (await this.readRegistry()).extensions.map(toMetadata);
  }

  async prepareFromDialog(parent: BrowserWindow): Promise<{ canceled: boolean; preview?: BrowserExtensionInstallPreview }> {
    this.clearPendingInstall();
    const selection = await dialog.showOpenDialog(parent, {
      title: 'Seleccionar extension desempaquetada',
      properties: ['openDirectory'],
      buttonLabel: 'Revisar extension',
    });
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true };

    const sourceRoot = path.resolve(selection.filePaths[0]);
    const resolvedManagedRoot = path.resolve(this.managedRoot);
    if (sourceRoot === resolvedManagedRoot || sourceRoot.startsWith(`${resolvedManagedRoot}${path.sep}`)) {
      throw new Error('Selecciona una extension fuera del directorio administrado por SofLIA.');
    }
    const inspected = await inspectExtension(sourceRoot);
    const token = randomUUID();
    this.pendingInstall = { token, inspected, expiresAt: Date.now() + PENDING_INSTALL_TTL_MS };
    this.pendingInstallTimer = setTimeout(() => {
      if (this.pendingInstall?.token === token) this.clearPendingInstall();
    }, PENDING_INSTALL_TTL_MS);
    this.pendingInstallTimer.unref?.();
    return {
      canceled: false,
      preview: {
        token,
        name: inspected.name,
        version: inspected.version,
        permissions: [...inspected.permissions],
        hostPermissions: [...inspected.hostPermissions],
      },
    };
  }

  async confirmInstall(token: string, session: Session): Promise<BrowserExtensionMetadata> {
    validateInstallToken(token);
    const pending = this.pendingInstall;
    if (!pending || pending.token !== token) throw new Error('La solicitud de instalacion ya no esta disponible.');
    if (pending.expiresAt < Date.now()) {
      this.clearPendingInstall();
      throw new Error('La solicitud de instalacion expiro. Selecciona de nuevo la carpeta.');
    }
    this.clearPendingInstall();
    const { inspected } = pending;

    const installId = randomUUID();
    const managedPath = this.resolveManagedPath(installId);
    await fs.mkdir(managedPath, { recursive: true });
    try {
      for (const file of inspected.files) {
        const destination = safeJoin(managedPath, file.relative);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        const stat = await fs.lstat(file.source);
        if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== file.size) {
          throw new Error('La extension cambio durante la instalacion.');
        }
        const content = await fs.readFile(file.source);
        if (content.byteLength !== file.size || hashBuffer(content) !== file.sha256) {
          throw new Error('La extension cambio durante la instalacion.');
        }
        await fs.writeFile(destination, content);
      }
    } catch (error) {
      await fs.rm(managedPath, { recursive: true, force: true });
      throw error;
    }

    let extensionId: string | null = null;
    let status: BrowserExtensionMetadata['status'] = 'error';
    let loadError: string | null = null;
    try {
      const loaded = await session.extensions.loadExtension(managedPath, { allowFileAccess: false });
      extensionId = loaded.id;
      status = 'loaded';
    } catch (error) {
      reportLoadFailure(error);
      loadError = PUBLIC_LOAD_ERROR;
    }
    const stored: StoredExtension = {
      installId,
      extensionId,
      managedPath,
      name: inspected.name,
      version: inspected.version,
      permissions: inspected.permissions,
      hostPermissions: inspected.hostPermissions,
      enabled: true,
      status,
      error: loadError,
    };
    try {
      await this.mutate((registry) => { registry.extensions.push(stored); });
    } catch (error) {
      if (extensionId) session.extensions.removeExtension(extensionId);
      await fs.rm(managedPath, { recursive: true, force: true });
      throw error;
    }
    return toMetadata(stored);
  }

  async restore(session: Session): Promise<BrowserExtensionMetadata[]> {
    await this.mutate(async (registry) => {
      for (const item of registry.extensions) {
        if (!item.enabled) {
          item.extensionId = null;
          item.status = 'disabled';
          item.error = null;
          continue;
        }
        try {
          const loaded = await session.extensions.loadExtension(item.managedPath, { allowFileAccess: false });
          item.extensionId = loaded.id;
          item.status = 'loaded';
          item.error = null;
        } catch (error) {
          item.extensionId = null;
          item.status = 'error';
          item.error = PUBLIC_LOAD_ERROR;
          reportLoadFailure(error);
        }
      }
    });
    return this.list();
  }

  async setEnabled(installId: string, enabled: boolean, session: Session): Promise<BrowserExtensionMetadata> {
    validateInstallId(installId);
    if (typeof enabled !== 'boolean') throw new Error('El estado de la extension es invalido.');
    let result: StoredExtension | null = null;
    await this.mutate(async (registry) => {
      const item = registry.extensions.find((candidate) => candidate.installId === installId);
      if (!item) throw new Error('Extension no encontrada.');
      if (enabled && item.enabled && item.status === 'loaded' && item.extensionId) {
        result = item;
        return;
      }
      if (!enabled) {
        if (item.extensionId) session.extensions.removeExtension(item.extensionId);
        item.enabled = false;
        item.extensionId = null;
        item.status = 'disabled';
        item.error = null;
      } else {
        try {
          const loaded = await session.extensions.loadExtension(item.managedPath, { allowFileAccess: false });
          item.enabled = true;
          item.extensionId = loaded.id;
          item.status = 'loaded';
          item.error = null;
        } catch (error) {
          item.enabled = true;
          item.extensionId = null;
          item.status = 'error';
          item.error = PUBLIC_LOAD_ERROR;
          reportLoadFailure(error);
        }
      }
      result = item;
    });
    if (!result) throw new Error('No se pudo actualizar la extension.');
    return toMetadata(result);
  }

  async remove(installId: string, session: Session): Promise<boolean> {
    validateInstallId(installId);
    await this.writeQueue;
    const registry = await this.readRegistry();
    const item = registry.extensions.find((candidate) => candidate.installId === installId);
    if (!item) return false;
    if (item.extensionId) session.extensions.removeExtension(item.extensionId);
    const managedPath = this.resolveManagedPath(installId);
    if (path.resolve(item.managedPath) !== managedPath) throw new Error('Ruta administrada de extension invalida.');
    await this.mutate((current) => {
      current.extensions = current.extensions.filter((candidate) => candidate.installId !== installId);
    });
    await fs.rm(managedPath, { recursive: true, force: true });
    return true;
  }

  private resolveManagedPath(installId: string): string {
    validateInstallId(installId);
    return safeJoin(this.managedRoot, installId);
  }

  private clearPendingInstall(): void {
    if (this.pendingInstallTimer) clearTimeout(this.pendingInstallTimer);
    this.pendingInstallTimer = null;
    this.pendingInstall = null;
  }

  private async mutate(operation: (registry: ExtensionRegistry) => void | Promise<void>): Promise<void> {
    const pending = this.writeQueue.then(async () => {
      const registry = await this.readRegistry();
      await operation(registry);
      await this.writeRegistry(registry);
    });
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }

  private async readRegistry(): Promise<ExtensionRegistry> {
    try {
      const parsed = JSON.parse(await fs.readFile(this.registryPath, 'utf8')) as Partial<ExtensionRegistry>;
      if (parsed.version !== 1 || !Array.isArray(parsed.extensions)) {
        throw new Error('El formato del registro de extensiones no es valido.');
      }
      const extensions = parsed.extensions.filter((value): value is StoredExtension => {
        if (!isStoredExtension(value)) return false;
        try {
          return path.resolve(value.managedPath) === this.resolveManagedPath(value.installId);
        } catch {
          return false;
        }
      });
      if (extensions.length !== parsed.extensions.length) {
        throw new Error('El registro contiene una extension o ruta invalida.');
      }
      return { version: 1, extensions: extensions.slice(0, 100) };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, extensions: [] };
      console.error('[Navegador][Extensiones] No se pudo leer el registro:', safeError(error));
      throw new Error('El registro de extensiones esta danado o no se puede leer.');
    }
  }

  private async writeRegistry(registry: ExtensionRegistry): Promise<void> {
    await fs.mkdir(this.managedRoot, { recursive: true });
    const temporary = `${this.registryPath}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(registry, null, 2), 'utf8');
    await fs.rename(temporary, this.registryPath);
  }
}

async function inspectExtension(root: string): Promise<{
  name: string;
  version: string;
  permissions: string[];
  hostPermissions: string[];
  files: ScannedFile[];
}> {
  const files: ScannedFile[] = [];
  let totalBytes = 0;
  const walk = async (directory: string): Promise<void> => {
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const source = path.join(directory, entry.name);
      const stat = await fs.lstat(source);
      if (entry.isSymbolicLink() || stat.isSymbolicLink()) throw new Error('Las extensiones con enlaces simbolicos no estan permitidas.');
      if (entry.isDirectory()) {
        await walk(source);
        continue;
      }
      if (!entry.isFile()) throw new Error('La extension contiene un tipo de archivo no permitido.');
      totalBytes += stat.size;
      if (files.length + 1 > MAX_EXTENSION_FILES || totalBytes > MAX_EXTENSION_BYTES) {
        throw new Error('La extension excede los limites de archivos o tamano.');
      }
      const content = await fs.readFile(source);
      if (content.byteLength !== stat.size) throw new Error('La extension cambio durante la inspeccion.');
      files.push({ source, relative: path.relative(root, source), size: stat.size, sha256: hashBuffer(content) });
    }
  };
  await walk(root);
  const manifestFile = files.find((file) => file.relative.replace(/\\/g, '/') === 'manifest.json');
  if (!manifestFile || manifestFile.size > 256 * 1024) throw new Error('La extension no contiene un manifest valido.');
  const manifestContent = await fs.readFile(manifestFile.source);
  if (manifestContent.byteLength !== manifestFile.size || hashBuffer(manifestContent) !== manifestFile.sha256) {
    throw new Error('La extension cambio durante la inspeccion.');
  }
  const manifest = JSON.parse(manifestContent.toString('utf8')) as ExtensionManifest;
  if (manifest.manifest_version !== 3) throw new Error('Solo se permiten extensiones Manifest V3.');
  const name = readManifestText(manifest.name, 'nombre', 120);
  const version = readManifestText(manifest.version, 'version', 40);
  const permissions = [...new Set([
    ...readStringArray(manifest.permissions, 100),
    ...readStringArray(manifest.optional_permissions, 100),
  ])];
  const hostPermissions = [...new Set([
    ...readStringArray(manifest.host_permissions, 100),
    ...readStringArray(manifest.optional_host_permissions, 100),
    ...readContentScriptMatches(manifest.content_scripts),
  ])];
  if (hostPermissions.length > 300) throw new Error('La extension declara demasiados sitios.');
  const blocked = permissions.find((permission) => BLOCKED_PERMISSIONS.has(permission));
  if (blocked) throw new Error(`La extension solicita el permiso bloqueado ${blocked}.`);
  return { name, version, permissions, hostPermissions, files };
}

function safeJoin(root: string, relative: string): string {
  const resolvedRoot = path.resolve(root);
  const target = path.resolve(resolvedRoot, relative);
  if (target !== resolvedRoot && !target.startsWith(`${resolvedRoot}${path.sep}`)) {
    throw new Error('La ruta de extension sale del directorio administrado.');
  }
  return target;
}

function readManifestText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== 'string' || !value.trim() || value.length > maxLength) {
    throw new Error(`El ${label} de la extension es invalido.`);
  }
  return value.trim();
}

function readStringArray(value: unknown, maxItems: number): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > maxItems || !value.every((item) => typeof item === 'string' && item.length <= 300)) {
    throw new Error('Los permisos de la extension son invalidos.');
  }
  return [...new Set(value)];
}

function readContentScriptMatches(value: unknown): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 100) throw new Error('Los content scripts de la extension son invalidos.');
  const matches: string[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') throw new Error('Los content scripts de la extension son invalidos.');
    matches.push(...readStringArray((item as { matches?: unknown }).matches, 100));
  }
  if (matches.length > 300) throw new Error('La extension declara demasiados sitios para content scripts.');
  return matches;
}

function validateInstallId(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f\d-]{16,64}$/i.test(value)) throw new Error('Identificador de extension invalido.');
}

function validateInstallToken(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-f\d-]{16,64}$/i.test(value)) throw new Error('Token de instalacion invalido.');
}

function isStoredExtension(value: unknown): value is StoredExtension {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<StoredExtension>;
  return typeof item.installId === 'string'
    && /^[a-f\d-]{16,64}$/i.test(item.installId)
    && typeof item.managedPath === 'string'
    && typeof item.name === 'string'
    && typeof item.version === 'string'
    && (item.extensionId === null || typeof item.extensionId === 'string')
    && typeof item.enabled === 'boolean'
    && (item.status === 'loaded' || item.status === 'disabled' || item.status === 'error')
    && (item.error === null || typeof item.error === 'string')
    && isStringArray(item.permissions)
    && isStringArray(item.hostPermissions);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length <= 300 && value.every((item) => typeof item === 'string' && item.length <= 300);
}

function toMetadata(value: StoredExtension): BrowserExtensionMetadata {
  const { installId, extensionId, name, version, permissions, hostPermissions, enabled, status } = value;
  return { installId, extensionId, name, version, permissions: [...permissions], hostPermissions: [...hostPermissions], enabled, status, error: status === 'error' ? PUBLIC_LOAD_ERROR : null };
}

function safeError(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).replace(/[\r\n\t]+/g, ' ').slice(0, 240);
}

const PUBLIC_LOAD_ERROR = 'No se pudo cargar la extensión. Revisa que sea compatible con Electron y vuelve a intentarlo.';

function reportLoadFailure(error: unknown): void {
  console.warn('[Navegador][Extensiones] Falló una carga:', safeError(error));
}

function hashBuffer(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}
