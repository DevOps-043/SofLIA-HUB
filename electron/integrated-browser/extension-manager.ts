import { dialog, type BrowserWindow, type Session } from 'electron';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { browserProfilePath, resolveStoreLocation } from './profile-scope';
import type { BrowserExtensionInstallPreview, BrowserExtensionMetadata } from './types';
import { normalizeExtensionSites, restrictExtensionManifest } from './extension-site-access';
import { getExtensionCatalogEntry, verifyCatalogFiles } from './extension-catalog';

type StoredExtension = BrowserExtensionMetadata & { managedPath: string; integrity?: string };
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
type ExtensionContext = { root: string; assertCurrent: () => void };
type PendingInstall = { token: string; inspected: InspectedExtension; expiresAt: number; context: ExtensionContext; catalogId?: string; update?: StoredExtension };

const MAX_EXTENSION_FILES = 2_000;
const MAX_EXTENSION_BYTES = 20 * 1024 * 1024;
const MAX_MANIFEST_BYTES = 256 * 1024;
const BLOCKED_PERMISSIONS = new Set(['nativeMessaging', 'debugger', 'proxy', 'management']);
const PENDING_INSTALL_TTL_MS = 5 * 60_000;

export class BrowserExtensionManager {
  private writeQueue: Promise<void> = Promise.resolve();
  private pendingInstall: PendingInstall | null = null;
  private pendingInstallTimer: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private reviewRevision = 0;
  private readonly loaded = new Map<Session, Set<string>>();

  /**
   * Las extensiones pertenecen al perfil del usuario activo: una extension
   * instalada por una cuenta no debe cargarse en la sesion de otra.
   */
  constructor(private readonly root: string | (() => string) = () => browserProfilePath('extensions')) {}

  private get managedRoot(): string {
    return resolveStoreLocation(this.root);
  }

  resetForProfileChange(): void {
    this.generation += 1;
    this.reviewRevision += 1;
    this.clearPendingInstall();
    for (const [session, ids] of this.loaded) {
      for (const id of ids) session.extensions.removeExtension(id);
    }
    this.loaded.clear();
  }

  async flush(): Promise<void> {
    await this.writeQueue;
  }

  private captureContext(assertCallerCurrent: () => void = () => undefined): ExtensionContext {
    const root = this.managedRoot;
    const generation = this.generation;
    const assertCurrent = () => {
      assertCallerCurrent();
      if (root !== this.managedRoot || generation !== this.generation) throw new Error('El perfil cambió durante la operación de extensiones.');
    };
    assertCurrent();
    return { root, assertCurrent };
  }

  async list(assertCallerCurrent?: () => void): Promise<BrowserExtensionMetadata[]> {
    const context = this.captureContext(assertCallerCurrent);
    await this.writeQueue;
    context.assertCurrent();
    const registry = await this.readRegistry(context);
    context.assertCurrent();
    return registry.extensions.map(toMetadata);
  }

  async prepareFromDialog(parent: BrowserWindow, assertCallerCurrent?: () => void, catalog?: { id: string; updateInstallId?: string }): Promise<{ canceled: boolean; preview?: BrowserExtensionInstallPreview }> {
    this.clearPendingInstall();
    const reviewRevision = ++this.reviewRevision;
    const reviewContext = this.captureContext(() => {
      assertCallerCurrent?.();
      if (parent.isDestroyed() || reviewRevision !== this.reviewRevision) throw new Error('La revisión de extensión ya no está vigente.');
    });
    const entry = catalog ? getExtensionCatalogEntry(catalog.id) : undefined;
    let update: StoredExtension | undefined;
    if (catalog?.updateInstallId) {
      await this.writeQueue; reviewContext.assertCurrent();
      update = (await this.readRegistry(reviewContext)).extensions.find(item => item.installId === catalog.updateInstallId);
      if (!update || update.catalogId !== catalog.id || update.enabled || update.extensionId) throw new Error('Deshabilita primero la extensión del catálogo que deseas actualizar.');
    }
    const selection = await dialog.showOpenDialog(parent, {
      title: 'Seleccionar extension desempaquetada',
      properties: ['openDirectory'],
      buttonLabel: 'Revisar extension',
    });
    reviewContext.assertCurrent();
    if (selection.canceled || !selection.filePaths[0]) return { canceled: true };

    const sourceRoot = path.resolve(selection.filePaths[0]);
    const resolvedManagedRoot = path.resolve(reviewContext.root);
    if (sourceRoot === resolvedManagedRoot || sourceRoot.startsWith(`${resolvedManagedRoot}${path.sep}`)) {
      throw new Error('Selecciona una extension fuera del directorio administrado por SofLIA.');
    }
    const inspected = await inspectExtension(sourceRoot);
    if (catalog) verifyCatalogFiles(catalog.id, inspected.files);
    reviewContext.assertCurrent();
    const token = randomUUID();
    this.pendingInstall = { token, inspected, expiresAt: Date.now() + PENDING_INSTALL_TTL_MS, context: reviewContext, ...(catalog ? { catalogId: catalog.id } : {}), ...(update ? { update } : {}) };
    this.pendingInstallTimer = setTimeout(() => {
      if (this.pendingInstall?.token === token) this.clearPendingInstall();
    }, PENDING_INSTALL_TTL_MS);
    this.pendingInstallTimer.unref?.();
    return {
      canceled: false,
      preview: {
        ...(entry ? { catalogName: entry.publisher } : {}),
        ...(update ? { updateName: update.name } : {}),
        token,
        name: inspected.name,
        version: inspected.version,
        permissions: [...inspected.permissions],
        hostPermissions: [...inspected.hostPermissions],
      },
    };
  }

  async confirmInstall(token: string, session: Session, assertCallerCurrent?: () => void): Promise<BrowserExtensionMetadata> {
    this.assertPersistentSession(session);
    const current = this.captureContext(assertCallerCurrent);
    validateInstallToken(token);
    const pending = this.pendingInstall;
    if (!pending || pending.token !== token) throw new Error('La solicitud de instalacion ya no esta disponible.');
    if (pending.expiresAt < Date.now()) {
      this.clearPendingInstall();
      throw new Error('La solicitud de instalacion expiro. Selecciona de nuevo la carpeta.');
    }
    this.clearPendingInstall();
    const { inspected } = pending;
    const context: ExtensionContext = { root: current.root, assertCurrent: () => { current.assertCurrent(); pending.context.assertCurrent(); } };
    context.assertCurrent();

    const installId = randomUUID();
    const managedPath = this.resolveManagedPath(installId, context.root);
    await fs.mkdir(managedPath, { recursive: true });
    try {
      for (const file of inspected.files) {
        context.assertCurrent();
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
        context.assertCurrent();
        await fs.writeFile(destination, content);
      }
    } catch (error) {
      await fs.rm(managedPath, { recursive: true, force: true });
      throw error;
    }

    let installedInspection = inspected;
    if (pending.update?.siteAccess) {
      try {
        const manifestPath = path.join(managedPath, 'manifest.json');
        const manifest = restrictExtensionManifest(JSON.parse(await fs.readFile(manifestPath, 'utf8')), pending.update.siteAccess);
        context.assertCurrent();
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
        installedInspection = await inspectExtension(managedPath);
        context.assertCurrent();
      } catch (error) {
        await fs.rm(managedPath, { recursive: true, force: true }); throw error;
      }
    }
    let extensionId: string | null = null;
    let status: BrowserExtensionMetadata['status'] = 'error';
    let loadError: string | null = null;
    try {
      const loaded = await this.loadExtension(session, managedPath, context, extensionIntegrity(installedInspection.files));
      extensionId = loaded.id;
      status = 'loaded';
    } catch {
      reportLoadFailure();
      loadError = PUBLIC_LOAD_ERROR;
    }
    if (pending.catalogId && status !== 'loaded') {
      await fs.rm(managedPath, { recursive: true, force: true });
      throw new Error('El paquete verificado no pudo cargarse; se conservó la instalación anterior.');
    }
    const stored: StoredExtension = {
      ...(pending.catalogId ? { catalogId: pending.catalogId, catalogRevision: getExtensionCatalogEntry(pending.catalogId).revision } : {}),
      ...(pending.update?.siteAccess ? { siteAccess: [...pending.update.siteAccess] } : {}),
      installId,
      extensionId,
      managedPath,
      integrity: extensionIntegrity(installedInspection.files),
      name: inspected.name,
      version: inspected.version,
      permissions: installedInspection.permissions,
      hostPermissions: installedInspection.hostPermissions,
      enabled: true,
      status,
      error: loadError,
    };
    try {
      await this.mutate(context, (registry) => {
        if (pending.update) {
          const index = registry.extensions.findIndex(item => item.installId === pending.update!.installId);
          const previous = registry.extensions[index];
          if (!previous || previous.enabled || previous.extensionId || JSON.stringify(previous) !== JSON.stringify(pending.update)) throw new Error('La extensión cambió después de revisar la actualización.');
          registry.extensions[index] = stored;
        } else {
          if (registry.extensions.length >= 100 || pending.catalogId && registry.extensions.some(item => item.catalogId === pending.catalogId)) throw new Error('Límite de extensiones o paquete ya instalado; usa su actualización explícita.');
          registry.extensions.push(stored);
        }
      });
    } catch (error) {
      if (extensionId) this.unloadExtension(session, extensionId);
      await fs.rm(managedPath, { recursive: true, force: true });
      throw error;
    }
    if (pending.update) {
      // Sólo la copia sustituida y ya retirada del registro; una interrupción puede dejar un huérfano inactivo.
      await fs.rm(this.resolveManagedPath(pending.update.installId, context.root), { recursive: true, force: true })
        .catch(() => console.warn('[Navegador][Extensiones] Actualización aplicada; quedó una copia anterior inactiva.'));
    }
    return toMetadata(stored);
  }

  async restore(session: Session, assertCallerCurrent?: () => void): Promise<BrowserExtensionMetadata[]> {
    this.assertPersistentSession(session);
    const context = this.captureContext(assertCallerCurrent);
    let result: BrowserExtensionMetadata[] = [];
    const loadedIds: string[] = [];
    await this.mutate(context, async (registry) => {
      for (const item of registry.extensions) {
        context.assertCurrent();
        if (!item.enabled) {
          item.extensionId = null;
          item.status = 'disabled';
          item.error = null;
          continue;
        }
        try {
          if (item.extensionId) this.unloadExtension(session, item.extensionId);
          const loaded = await this.loadExtension(session, item.managedPath, context, item.integrity);
          loadedIds.push(loaded.id);
          item.extensionId = loaded.id;
          item.status = 'loaded';
          item.error = null;
        } catch {
          item.extensionId = null;
          item.status = 'error';
          item.error = PUBLIC_LOAD_ERROR;
          reportLoadFailure();
        }
      }
      result = registry.extensions.map(toMetadata);
    }).catch((error: unknown) => {
      for (const id of loadedIds) this.unloadExtension(session, id);
      throw error;
    });
    context.assertCurrent();
    return result;
  }

  async setEnabled(installId: string, enabled: boolean, session: Session, assertCallerCurrent?: () => void): Promise<BrowserExtensionMetadata> {
    this.assertPersistentSession(session);
    const context = this.captureContext(assertCallerCurrent);
    validateInstallId(installId);
    if (typeof enabled !== 'boolean') throw new Error('El estado de la extension es invalido.');
    let result: StoredExtension | null = null;
    let loadedId: string | null = null;
    await this.mutate(context, async (registry) => {
      const item = registry.extensions.find((candidate) => candidate.installId === installId);
      if (!item) throw new Error('Extension no encontrada.');
      if (enabled && item.enabled && item.status === 'loaded' && item.extensionId) {
        try { await this.verifyIntegrity(item.managedPath, context, item.integrity); }
        catch {
          this.unloadExtension(session, item.extensionId);
          item.extensionId = null; item.status = 'error'; item.error = PUBLIC_LOAD_ERROR;
        }
        context.assertCurrent(); result = item; return;
      }
      if (!enabled) {
        if (item.extensionId) this.unloadExtension(session, item.extensionId);
        item.enabled = false;
        item.extensionId = null;
        item.status = 'disabled';
        item.error = null;
      } else {
        try {
          if (item.extensionId) this.unloadExtension(session, item.extensionId);
          const loaded = await this.loadExtension(session, item.managedPath, context, item.integrity);
          loadedId = loaded.id;
          item.enabled = true;
          item.extensionId = loaded.id;
          item.status = 'loaded';
          item.error = null;
        } catch {
          item.enabled = true;
          item.extensionId = null;
          item.status = 'error';
          item.error = PUBLIC_LOAD_ERROR;
          reportLoadFailure();
        }
      }
      result = item;
    }).catch((error: unknown) => {
      if (loadedId) this.unloadExtension(session, loadedId);
      throw error;
    });
    if (!result) throw new Error('No se pudo actualizar la extension.');
    return toMetadata(result);
  }

  async remove(installId: string, session: Session, assertCallerCurrent?: () => void): Promise<boolean> {
    const context = this.captureContext(assertCallerCurrent);
    validateInstallId(installId);
    const managedPath = this.resolveManagedPath(installId, context.root);
    let removed = false;
    await this.mutate(context, (current) => {
      const item = current.extensions.find((candidate) => candidate.installId === installId);
      if (!item) return;
      if (path.resolve(item.managedPath) !== managedPath) throw new Error('Ruta administrada de extension invalida.');
      if (item.extensionId) this.unloadExtension(session, item.extensionId);
      current.extensions = current.extensions.filter((candidate) => candidate.installId !== installId);
      removed = true;
    });
    if (!removed) return false;
    await fs.rm(managedPath, { recursive: true, force: true });
    return true;
  }

  /** Sólo reduce el manifiesto aprobado. Ampliar un permiso retirado requiere reinstalación revisada. */
  async restrictSites(installId: string, rawSites: unknown, assertCallerCurrent: () => void): Promise<BrowserExtensionMetadata> {
    validateInstallId(installId);
    const sites = normalizeExtensionSites(rawSites);
    const context = this.captureContext(assertCallerCurrent);
    let result: BrowserExtensionMetadata | null = null;
    await this.mutate(context, async registry => {
      const item = registry.extensions.find(value => value.installId === installId);
      if (!item || item.enabled || item.extensionId) throw new Error('Deshabilita primero la extensión.');
      await this.verifyIntegrity(item.managedPath, context, item.integrity);
      const inspected = await inspectExtension(item.managedPath);
      if (extensionIntegrity(inspected.files) !== item.integrity) throw new Error('La extensión cambió.');
      const file = inspected.files.find(value => value.relative === 'manifest.json')!;
      const previous = await fs.readFile(file.source);
      if (hashBuffer(previous) !== file.sha256) throw new Error('El manifiesto cambió.');
      const manifest = restrictExtensionManifest(JSON.parse(previous.toString('utf8')), sites);
      // La compilación puede expandir wildcards: validar con las MISMAS cuotas de carga.
      const metadata = readManifestMetadata(manifest);
      const bytes = Buffer.from(JSON.stringify(manifest, null, 2));
      if (bytes.length > MAX_MANIFEST_BYTES
        || inspected.files.reduce((total, value) => total + value.size, 0) - file.size + bytes.length > MAX_EXTENSION_BYTES) {
        throw new Error('La restricción excede los límites de tamaño de la extensión.');
      }
      const temporary = path.join(context.root, `manifest-${randomUUID()}.tmp`);
      try {
        context.assertCurrent();
        await fs.writeFile(temporary, bytes, { flag: 'wx' });
        context.assertCurrent();
        await fs.rename(temporary, file.source);
        // Si falla publicar el registro, el hash anterior impide cargar el paquete;
        // nunca se autoriza automáticamente un estado parcial tras interrupción.
        context.assertCurrent();
        item.integrity = extensionIntegrity(inspected.files.map(value => value === file ? { ...value, size: bytes.length, sha256: hashBuffer(bytes) } : value));
        item.hostPermissions = metadata.hostPermissions;
        item.siteAccess = sites;
        item.permissions = metadata.permissions;
        item.error = null; item.status = 'disabled';
        result = toMetadata(item);
      } finally { await fs.rm(temporary, { force: true }); }
    });
    if (!result) throw new Error('No se pudo restringir la extensión.');
    return result;
  }

  private resolveManagedPath(installId: string, root: string): string {
    validateInstallId(installId);
    return safeJoin(root, installId);
  }

  private assertPersistentSession(session: Session): void {
    if (!session.isPersistent()) throw new Error('Las extensiones no están disponibles en perfiles privados o de invitado.');
  }

  private unloadExtension(session: Session, id: string): void {
    session.extensions.removeExtension(id);
    const ids = this.loaded.get(session);
    ids?.delete(id);
    if (ids?.size === 0) this.loaded.delete(session);
  }

  private async verifyIntegrity(managedPath: string, context: ExtensionContext, integrity?: string): Promise<void> {
    context.assertCurrent();
    if (!integrity || !/^[a-f0-9]{64}$/.test(integrity)) throw new Error('La extensión necesita revisión e instalación explícita de su integridad.');
    const inspected = await inspectExtension(managedPath);
    context.assertCurrent();
    if (extensionIntegrity(inspected.files) !== integrity) throw new Error('La extensión cambió desde su instalación.');
  }

  private async loadExtension(session: Session, managedPath: string, context: ExtensionContext, integrity?: string) {
    await this.verifyIntegrity(managedPath, context, integrity);
    context.assertCurrent();
    const extension = await session.extensions.loadExtension(managedPath, { allowFileAccess: false });
    try { context.assertCurrent(); } catch (error) {
      session.extensions.removeExtension(extension.id);
      throw error;
    }
    const ids = this.loaded.get(session) ?? new Set<string>();
    ids.add(extension.id);
    this.loaded.set(session, ids);
    return extension;
  }

  private clearPendingInstall(): void {
    if (this.pendingInstallTimer) clearTimeout(this.pendingInstallTimer);
    this.pendingInstallTimer = null;
    this.pendingInstall = null;
  }

  private async mutate(context: ExtensionContext, operation: (registry: ExtensionRegistry) => void | Promise<void>): Promise<void> {
    const pending = this.writeQueue.then(async () => {
      context.assertCurrent();
      const registry = await this.readRegistry(context);
      context.assertCurrent();
      await operation(registry);
      context.assertCurrent();
      await this.writeRegistry(registry, context);
    });
    this.writeQueue = pending.catch(() => undefined);
    await pending;
  }

  private async readRegistry(context: ExtensionContext): Promise<ExtensionRegistry> {
    try {
      const parsed = JSON.parse(await fs.readFile(path.join(context.root, 'registry.json'), 'utf8')) as Partial<ExtensionRegistry>;
      if (parsed.version !== 1 || !Array.isArray(parsed.extensions)) {
        throw new Error('El formato del registro de extensiones no es valido.');
      }
      const extensions = parsed.extensions.filter((value): value is StoredExtension => {
        if (!isStoredExtension(value)) return false;
        try {
          return path.resolve(value.managedPath) === this.resolveManagedPath(value.installId, context.root);
        } catch {
          return false;
        }
      });
      if (extensions.length !== parsed.extensions.length) {
        throw new Error('El registro contiene una extension o ruta invalida.');
      }
      if (extensions.length > 100 || new Set(extensions.map((item) => item.installId)).size !== extensions.length) throw new Error('El registro excede su cuota o contiene duplicados.');
      return { version: 1, extensions };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, extensions: [] };
      console.error('[Navegador][Extensiones] No se pudo leer el registro administrado.');
      throw new Error('El registro de extensiones esta danado o no se puede leer.');
    }
  }

  private async writeRegistry(registry: ExtensionRegistry, context: ExtensionContext): Promise<void> {
    const registryPath = path.join(context.root, 'registry.json');
    const temporary = `${registryPath}.${randomUUID()}.tmp`;
    try {
      context.assertCurrent();
      await fs.mkdir(context.root, { recursive: true });
      context.assertCurrent();
      await fs.writeFile(temporary, JSON.stringify(registry, null, 2), { encoding: 'utf8', flag: 'wx' });
      context.assertCurrent();
      await fs.rename(temporary, registryPath);
    } finally {
      await fs.rm(temporary, { force: true });
    }
  }
}

async function inspectExtension(root: string): Promise<{
  name: string;
  version: string;
  permissions: string[];
  hostPermissions: string[];
  files: ScannedFile[];
}> {
  const rootStat = await fs.lstat(root);
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error('La raíz de la extensión debe ser un directorio sin enlaces.');
  const files: ScannedFile[] = [];
  let totalBytes = 0;
  let directories = 0;
  const walk = async (directory: string, depth = 0): Promise<void> => {
    if (++directories > 2_000 || depth > 32) throw new Error('La extensión excede los límites de directorios o profundidad.');
    for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
      const source = path.join(directory, entry.name);
      const stat = await fs.lstat(source);
      if (entry.isSymbolicLink() || stat.isSymbolicLink()) throw new Error('Las extensiones con enlaces simbolicos no estan permitidas.');
      if (entry.isDirectory()) {
        await walk(source, depth + 1);
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
  if (!manifestFile || manifestFile.size > MAX_MANIFEST_BYTES) throw new Error('La extension no contiene un manifest valido.');
  const manifestContent = await fs.readFile(manifestFile.source);
  if (manifestContent.byteLength !== manifestFile.size || hashBuffer(manifestContent) !== manifestFile.sha256) {
    throw new Error('La extension cambio durante la inspeccion.');
  }
  const manifest = JSON.parse(manifestContent.toString('utf8')) as ExtensionManifest;
  return { ...readManifestMetadata(manifest), files };
}

function readManifestMetadata(manifest: ExtensionManifest) {
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
  return { name, version, permissions, hostPermissions };
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
    && (item.integrity === undefined || typeof item.integrity === 'string' && /^[a-f0-9]{64}$/.test(item.integrity))
    && (item.extensionId === null || typeof item.extensionId === 'string')
    && typeof item.enabled === 'boolean'
    && (item.siteAccess === undefined || isValidSites(item.siteAccess))
    && (item.catalogId === undefined && item.catalogRevision === undefined
      || typeof item.catalogId === 'string' && /^[a-z0-9-]{1,80}$/.test(item.catalogId) && typeof item.catalogRevision === 'string' && /^[a-f0-9]{40}$/.test(item.catalogRevision))
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
  return { installId, extensionId, name, version, permissions: [...permissions], hostPermissions: [...hostPermissions], enabled, status, error: status === 'error' ? PUBLIC_LOAD_ERROR : null,
    ...(value.siteAccess ? { siteAccess: [...value.siteAccess] } : {}),
    ...(value.catalogId ? { catalogId: value.catalogId, catalogRevision: value.catalogRevision } : {}) };
}

function isValidSites(value: unknown): boolean {
  try { return JSON.stringify(normalizeExtensionSites(value)) === JSON.stringify(value); } catch { return false; }
}

const PUBLIC_LOAD_ERROR = 'No se pudo verificar o cargar la extensión. Revisa su compatibilidad; si cambió o es antigua, retírala y vuelve a instalarla con revisión explícita.';

function reportLoadFailure(): void {
  console.warn('[Navegador][Extensiones] Falló una carga; revisa compatibilidad y permisos.');
}

function hashBuffer(value: Uint8Array): string {
  return createHash('sha256').update(value).digest('hex');
}

/** La huella liga nombres, tamaños y contenido; no autentica al editor del paquete. */
function extensionIntegrity(files: ScannedFile[]): string {
  const inventory = files.map((file) => [file.relative.replace(/\\/g, '/'), file.size, file.sha256] as const)
    .sort((left, right) => left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0);
  return hashBuffer(Buffer.from(JSON.stringify(inventory), 'utf8'));
}
