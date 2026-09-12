import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { BrowserSessionSnapshot, BrowserSessionTab, BrowserTabGroup } from './platform-types';
import { BROWSER_TAB_GROUP_COLORS } from './platform-types';

const MAX_SESSION_BYTES = 1_000_000;
const MAX_SESSION_TABS = 500;
const MAX_SESSION_GROUPS = 100;
const FILE_CHAINS = new Map<string, Promise<unknown>>();

class UnsupportedSessionVersion extends Error {
  constructor() { super('La versión de sesión no es compatible; se conserva sin modificar.'); }
}

/** Serializa lecturas, escrituras y descartes entre instancias del mismo perfil. */
function atFile<T>(file: string, operation: () => Promise<T>): Promise<T> {
  const next = (FILE_CHAINS.get(file) ?? Promise.resolve()).catch(() => undefined).then(operation);
  FILE_CHAINS.set(file, next);
  void next.finally(() => { if (FILE_CHAINS.get(file) === next) FILE_CHAINS.delete(file); }).catch(() => undefined);
  return next;
}

export class BrowserSessionStore {
  constructor(private readonly location: string | (() => string)) {}

  load(): Promise<BrowserSessionSnapshot | null> {
    const file = this.filePath();
    return atFile(file, async () => {
      const candidate = await this.readCandidate(file) ?? await this.readCandidate(`${file}.bak`);
      return candidate?.snapshot ?? null;
    });
  }

  async save(snapshot: BrowserSessionSnapshot): Promise<void> {
    const file = this.filePath();
    const serialized = `${JSON.stringify(parseBrowserSession(JSON.stringify(snapshot)), null, 2)}\n`;
    if (Buffer.byteLength(serialized, 'utf8') > MAX_SESSION_BYTES) throw new Error('La sesión excede la cuota permitida.');
    await atFile(file, () => this.writeSnapshot(file, serialized));
  }

  clear(): Promise<void> {
    const file = this.filePath();
    return atFile(file, async () => {
      // La lápida vacía gana al respaldo incluso si el proceso se cierra antes
      // de retirarlo. No recuperar una sesión que ya se descartó.
      const empty: BrowserSessionSnapshot = {
        version: 2, savedAt: new Date().toISOString(), cleanExit: true,
        tabs: [], groups: [], activeTabId: null, primaryTabId: null,
        secondaryTabId: null, detachedTabIds: [], viewMode: 'single', tabLayout: 'horizontal',
      };
      await this.writeSnapshot(file, `${JSON.stringify(empty)}\n`);
      await fs.unlink(`${file}.bak`).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    });
  }

  /** Espera a que termine cualquier lectura o escritura del archivo actual. */
  async flush(): Promise<void> {
    await atFile(this.filePath(), async () => undefined);
  }

  private filePath(): string {
    return path.resolve(typeof this.location === 'function' ? this.location() : this.location);
  }

  private async writeSnapshot(file: string, serialized: string): Promise<void> {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const previous = await this.readCandidate(file);
    // No reemplazar una versión futura ni el último respaldo válido con datos
    // corruptos. El principal permanece en su sitio hasta el rename final.
    if (previous) await atomicWrite(`${file}.bak`, previous.raw);
    else await this.readCandidate(`${file}.bak`);
    await atomicWrite(file, serialized);
  }

  private async readCandidate(file: string): Promise<{ raw: string; snapshot: BrowserSessionSnapshot } | null> {
    let raw: string;
    try {
      const handle = await fs.open(file, 'r');
      try {
        // Cuota + 1 evita reservar memoria ilimitada aun si el archivo crece.
        const buffer = Buffer.alloc(MAX_SESSION_BYTES + 1);
        let length = 0;
        while (length < buffer.length) {
          const result = await handle.read(buffer, length, buffer.length - length, null);
          if (!result.bytesRead) break;
          length += result.bytesRead;
        }
        raw = buffer.subarray(0, length).toString('utf8');
      } finally { await handle.close(); }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
      // Permisos/E/S no prueban corrupción ni autorizan renombrar datos.
      throw error;
    }
    try { return { raw, snapshot: parseBrowserSession(raw) }; }
    catch (error) {
      if (error instanceof UnsupportedSessionVersion) throw error;
      await fs.rename(file, `${file}.corrupt-${randomUUID()}`);
      return null;
    }
  }
}

async function atomicWrite(file: string, serialized: string): Promise<void> {
  const temporary = `${file}.${process.pid}.${randomUUID()}.tmp`;
  try {
    const handle = await fs.open(temporary, 'wx', 0o600);
    try { await handle.writeFile(serialized, 'utf8'); await handle.sync(); }
    finally { await handle.close(); }
    await fs.rename(temporary, file);
  } finally { await fs.unlink(temporary).catch(() => undefined); }
}

export function parseBrowserSession(raw: string): BrowserSessionSnapshot {
  if (Buffer.byteLength(raw, 'utf8') > MAX_SESSION_BYTES) throw new Error('La sesión excede la cuota permitida.');
  const value = JSON.parse(raw) as Record<string, unknown> | null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('La sesión es inválida.');
  if (value.version !== 1 && value.version !== 2) throw new UnsupportedSessionVersion();
  if (typeof value.savedAt !== 'string' || !Number.isFinite(Date.parse(value.savedAt)) || typeof value.cleanExit !== 'boolean') {
    throw new Error('La fecha o estado de sesión es inválido.');
  }
  if (!Array.isArray(value.tabs) || value.tabs.length > MAX_SESSION_TABS) throw new Error('La lista de pestañas es inválida.');
  if (!Array.isArray(value.groups) || value.groups.length > MAX_SESSION_GROUPS) throw new Error('La lista de grupos es inválida.');
  if (value.viewMode !== 'single' && value.viewMode !== 'split' && value.viewMode !== 'overlay') throw new Error('El modo de sesión es inválido.');
  if (value.tabLayout !== 'horizontal' && value.tabLayout !== 'vertical') throw new Error('La disposición de pestañas es inválida.');

  const groups: BrowserTabGroup[] = value.groups.map((group: BrowserTabGroup) => {
    if (!group || !validId(group.id) || typeof group.name !== 'string' || !group.name.trim() || group.name.length > 80
      || !BROWSER_TAB_GROUP_COLORS.includes(group.color) || typeof group.collapsed !== 'boolean') {
      throw new Error('Un grupo de pestañas es inválido.');
    }
    return { id: group.id, name: group.name, color: group.color, collapsed: group.collapsed };
  });
  const groupIds = new Set(groups.map((group) => group.id));
  if (groupIds.size !== groups.length) throw new Error('Hay grupos duplicados.');
  const tabs: BrowserSessionTab[] = value.tabs.map((tab: BrowserSessionTab, index: number) => {
    if (!tab || !validId(tab.id) || typeof tab.url !== 'string' || !isRestorableUrl(tab.url)
      || typeof tab.title !== 'string' || tab.title.length > 500 || typeof tab.pinned !== 'boolean'
      || typeof tab.muted !== 'boolean' || (tab.groupId !== null && !groupIds.has(tab.groupId))
      || !Number.isSafeInteger(tab.position) || tab.position < 0 || tab.position >= MAX_SESSION_TABS) {
      throw new Error('Una pestaña restaurable es inválida.');
    }
    // Proyección cerrada: no copiar formularios, cookies u otros extras.
    return { id: tab.id, url: tab.url, title: tab.title, pinned: tab.pinned, muted: tab.muted, groupId: tab.groupId, position: index };
  });
  const tabIds = new Set(tabs.map((tab) => tab.id));
  if (tabIds.size !== tabs.length) throw new Error('Hay pestañas duplicadas.');
  const activeTabId = typeof value.activeTabId === 'string' && tabIds.has(value.activeTabId) ? value.activeTabId : tabs[0]?.id ?? null;
  const detachedTabIds: string[] = value.version === 1 ? [] : value.detachedTabIds as string[];
  if (!Array.isArray(detachedTabIds) || detachedTabIds.length > 4 || new Set(detachedTabIds).size !== detachedTabIds.length
    || detachedTabIds.some((id) => !tabIds.has(id)) || (tabs.length > 0 && detachedTabIds.length === tabs.length)) {
    throw new Error('Las ventanas de sesión son inválidas.');
  }
  const workspaceIds = tabs.filter((tab) => !detachedTabIds.includes(tab.id)).map((tab) => tab.id);
  const primaryTabId = value.version === 1 ? activeTabId : value.primaryTabId as string | null;
  const secondaryTabId = value.version === 1
    ? value.viewMode === 'single' ? null : workspaceIds.find((id) => id !== primaryTabId) ?? null
    : value.secondaryTabId as string | null;
  if ((workspaceIds.length ? !workspaceIds.includes(primaryTabId!) : primaryTabId !== null)
    || (secondaryTabId !== null && (!workspaceIds.includes(secondaryTabId) || secondaryTabId === primaryTabId))
    || (value.version === 2 && ((value.viewMode === 'single') !== (secondaryTabId === null)))) {
    throw new Error('La disposición de sesión es inválida.');
  }
  return {
    version: 2, savedAt: value.savedAt, cleanExit: value.cleanExit, activeTabId, primaryTabId, secondaryTabId,
    detachedTabIds: [...detachedTabIds], viewMode: secondaryTabId ? value.viewMode : 'single', tabLayout: value.tabLayout, tabs, groups,
  };
}

function validId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 128;
}

function isRestorableUrl(raw: string): boolean {
  if (raw === 'about:blank') return true;
  if (raw.length > 32_768) return false;
  try {
    const url = new URL(raw);
    return (url.protocol === 'https:' || url.protocol === 'http:') && !url.username && !url.password;
  } catch { return false; }
}
