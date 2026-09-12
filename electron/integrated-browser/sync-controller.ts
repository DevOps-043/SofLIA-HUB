import fs from 'node:fs/promises';
import path from 'node:path';
import type { BrowserSyncCategory, BrowserSyncControlRequest, BrowserSyncControlStatus } from './platform-types';
import { BrowserSyncCrypto } from './sync-crypto';
import { BrowserSyncConflictStore } from './sync-conflict-store';
import { BrowserSyncCheckpointStore } from './sync-checkpoint-store';
import { BrowserSyncClient } from './sync-client';
import type { BrowserSyncLocalAdapter } from './sync-local-adapter';
import { BrowserSyncSettingsStore, normalizeSyncCategories } from './sync-settings-store';
import { createBrowserSyncConnection, type BrowserSyncConnection, type BrowserSyncConnectionFactory } from './sync-auth';
import { abortableSync, assertSyncActive, BrowserSyncError } from './sync-remote';
import { assertSyncRecoveryAvailable } from './sync-recovery-guard';
import { prepareSyncStateRecovery } from './sync-state-recovery';

export interface BrowserSyncControlContext {
  enabled: boolean;
  authenticated: boolean;
  profileRoot: string;
  guard: () => void;
  local: BrowserSyncLocalAdapter;
  confirm: (action: 'configure' | 'run' | 'pause' | 'keys-export' | 'keys-import' | 'resolve' | 'recover-settings' | 'recover-state' | 'rollback-state', detail: string) => Promise<boolean>;
  recoveryPath: (action: 'export' | 'import') => Promise<string | null>;
}
type Resolution = { category: BrowserSyncCategory; choice: 'local' | 'remote'; reviewId?: string };
export function validateSyncControlRequest(raw: unknown): BrowserSyncControlRequest {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new BrowserSyncError('La solicitud de sincronización es inválida.');
  const value = raw as Record<string, unknown>;
  const keys = Object.keys(value).sort().join(',');
  if (keys === 'action' && typeof value.action === 'string' && ['status', 'run', 'pause', 'export-key', 'import-key', 'recover-settings', 'recover-state', 'rollback-state'].includes(value.action)) return { action: value.action } as BrowserSyncControlRequest;
  if (keys === 'action,categories' && value.action === 'configure') return { action: 'configure', categories: normalizeSyncCategories(value.categories) };
  if (value.action === 'resolve' && ['action,category,choice', 'action,category,choice,reviewId'].includes(keys)
    && typeof value.choice === 'string' && ['local', 'remote'].includes(value.choice) && (value.reviewId === undefined || (typeof value.reviewId === 'string' && /^[a-f0-9]{64}$/.test(value.reviewId)))) {
    const [category] = normalizeSyncCategories([value.category]);
    return { action: 'resolve', category, choice: value.choice as 'local' | 'remote', ...(value.reviewId ? { reviewId: value.reviewId as string } : {}) };
  }
  throw new BrowserSyncError('La solicitud de sincronización es inválida.');
}
const empty = (): BrowserSyncControlStatus => ({ enabled: false, keyAvailable: false, categories: [], lastSyncedAt: null, state: 'disabled', completed: [], initialCategories: [], conflicts: [] });

/** Coordinación bajo demanda: red, claves y consentimiento permanecen en main. */
export class BrowserSyncController {
  private pending: AbortController | null = null;
  private confirming = false;
  private latest: { root: string; status: BrowserSyncControlStatus } | null = null;
  constructor(private readonly connect: BrowserSyncConnectionFactory = createBrowserSyncConnection) {}
  cancel() { this.pending?.abort(); }
  async status(context: BrowserSyncControlContext): Promise<BrowserSyncControlStatus> {
    context.guard();
    if (!context.enabled || !context.authenticated) return empty();
    const settings = await new BrowserSyncSettingsStore(path.join(context.profileRoot, 'sync-settings.json')).read();
    const keyAvailable = await new BrowserSyncCrypto(path.join(context.profileRoot, 'sync-key.json')).hasKey();
    context.guard();
    const previous = this.latest?.root === context.profileRoot ? this.latest.status : empty();
    return { ...previous, enabled: true, keyAvailable, categories: settings.categories, lastSyncedAt: settings.lastSyncedAt,
      state: settings.categories.length ? (previous.state === 'disabled' ? 'ready' : previous.state) : 'disabled' };
  }
  recoverSettings(context: BrowserSyncControlContext) {
    return this.run(context, async (signal, guard) => {
      const store = new BrowserSyncSettingsStore(path.join(context.profileRoot, 'sync-settings.json'));
      const review = await store.prepareRecovery(guard); guard();
      const keyAvailable = await new BrowserSyncCrypto(path.join(context.profileRoot, 'sync-key.json')).hasKey(); guard();
      if (!await this.confirm(context, 'recover-settings', '', signal)) return { ...empty(), enabled: true, keyAvailable, canceled: true };
      guard(); await review.commit(); guard(); this.latest = null;
      // No consultar Auth ni clave tras el commit: un fallo ajeno no vuelve ambiguo su resultado.
      return { ...empty(), enabled: true, keyAvailable };
    });
  }
  recoverState(action: 'recover-state' | 'rollback-state', context: BrowserSyncControlContext) {
    return this.run(context, async (signal, guard) => {
      const review = prepareSyncStateRecovery(context.profileRoot, action, guard); guard();
      const keyAvailable = await new BrowserSyncCrypto(path.join(context.profileRoot, 'sync-key.json')).hasKey(); guard();
      if (!await this.confirm(context, action, '', signal)) return { ...empty(), enabled: true, keyAvailable, canceled: true };
      guard(); review.commit(); guard(); this.latest = null;
      return { ...empty(), enabled: true, keyAvailable, categories: review.settings.categories, lastSyncedAt: review.settings.lastSyncedAt,
        state: review.settings.categories.length ? 'ready' : 'disabled' };
    }, true);
  }
  configure(raw: unknown, context: BrowserSyncControlContext) {
    const categories = normalizeSyncCategories(raw);
    return this.run(context, async (signal, guard) => {
      if (!await this.confirm(context, categories.length ? 'configure' : 'pause', categories.join(', '), signal)) return { ...await this.status(context), canceled: true };
      const store = new BrowserSyncSettingsStore(path.join(context.profileRoot, 'sync-settings.json'));
      const previous = await store.read(); guard();
      if (!categories.length) { await store.write({ ...previous, categories: [] }, guard); this.latest = null; return this.status(context); }
      const connection = await this.connect(signal, guard);
      try {
        await this.requireActive(connection, signal, guard);
        if (!await new BrowserSyncCrypto(path.join(context.profileRoot, 'sync-key.json')).hasKey()) throw new BrowserSyncError('Crea o recupera la clave antes de activar categorías.');
        guard();
        if (previous.ownerId && (previous.ownerId !== connection.binding.ownerId || previous.origin !== connection.binding.origin)) throw new BrowserSyncError('La configuración pertenece a otra identidad Lia. No se mezclaron los datos.');
        await store.write({ ...previous, ownerId: connection.binding.ownerId, origin: connection.binding.origin, categories }, guard);
        this.latest = null;
        return this.status(context);
      } finally { connection.dispose(); }
    });
  }
  keys(action: 'export' | 'import', context: BrowserSyncControlContext) {
    return this.run(context, async (signal, guard) => {
      if (!await this.confirm(context, action === 'export' ? 'keys-export' : 'keys-import', '', signal)) return { ...await this.status(context), canceled: true };
      const destination = await abortableSync(context.recoveryPath(action), signal); guard();
      if (!destination) return { ...await this.status(context), canceled: true };
      const crypto = new BrowserSyncCrypto(path.join(context.profileRoot, 'sync-key.json'));
      if (action === 'export') {
        if (!await crypto.hasKey()) {
          const connection = await this.connect(signal, guard);
          try {
            await this.requireActive(connection, signal, guard);
            for (const category of ['bookmarks', 'groups', 'tabs', 'settings'] as const) {
              if (await connection.remote.read(category, signal)) throw new BrowserSyncError('Ya hay datos cifrados en la cuenta. Importa su código de recuperación; no se generó otra clave.');
            }
            guard(); await crypto.initialize(guard); guard();
          } finally { connection.dispose(); }
        }
        const code = await crypto.exportRecoveryCode(); guard();
        // Archivo nuevo y elegido por el titular; nunca sobreescribir una copia existente.
        const file = await fs.open(destination, 'wx', 0o600);
        try { guard(); await file.writeFile(code, 'utf8'); await file.sync(); } finally { await file.close(); }
      } else {
        const file = await fs.open(destination, 'r');
        let code: string;
        try {
          const buffer = Buffer.alloc(1025); let size = 0;
          while (size < buffer.length) { const part = await file.read(buffer, size, buffer.length - size, null); if (!part.bytesRead) break; size += part.bytesRead; }
          if (size > 1024) throw new BrowserSyncError('El archivo de recuperación supera la cuota.');
          code = buffer.subarray(0, size).toString('utf8');
        } finally { await file.close(); }
        guard(); await crypto.restore(code, guard); guard();
      }
      return this.status(context);
    });
  }
  synchronize(context: BrowserSyncControlContext, resolution?: Resolution) {
    return this.run(context, async (signal, guard) => {
      const store = new BrowserSyncSettingsStore(path.join(context.profileRoot, 'sync-settings.json'));
      const settings = await store.read(); guard();
      if (!settings.categories.length) throw new BrowserSyncError('Activa al menos una categoría antes de sincronizar.');
      if (resolution && (!settings.categories.includes(resolution.category) || !['local', 'remote'].includes(resolution.choice))) throw new BrowserSyncError('La decisión de sincronización es inválida.');
      if (resolution) {
        const reviewed = this.latest?.root === context.profileRoot ? this.latest.status : null;
        const matches = resolution.reviewId
          ? reviewed?.conflicts.some((review) => review.reviewId === resolution.reviewId && review.category === resolution.category)
          : reviewed?.initialCategories.includes(resolution.category);
        if (!matches) throw new BrowserSyncError('La decisión no corresponde a una revisión visible de esta categoría. Consulta de nuevo la sincronización.');
      }
      if (!await this.confirm(context, resolution ? 'resolve' : 'run', resolution ? `${resolution.category}: ${resolution.choice === 'local' ? 'conservar datos locales' : 'usar datos remotos'}. También se comprobarán las categorías activas: ${settings.categories.join(', ')}.` : settings.categories.join(', '), signal)) return { ...await this.status(context), canceled: true };
      const connection = await this.connect(signal, guard);
      try {
        await this.requireActive(connection, signal, guard);
        if (settings.ownerId !== connection.binding.ownerId || settings.origin !== connection.binding.origin) throw new BrowserSyncError('La sesión Lia no corresponde a la configuración de sincronización.');
        const client = new BrowserSyncClient({ checkpoints: new BrowserSyncCheckpointStore(path.join(context.profileRoot, 'sync-checkpoints.json')),
          crypto: new BrowserSyncCrypto(path.join(context.profileRoot, 'sync-key.json')), local: context.local,
          conflicts: new BrowserSyncConflictStore(path.join(context.profileRoot, 'sync-conflicts.json')) });
        const result = await client.synchronize({ categories: settings.categories, remote: connection.remote, binding: connection.binding, signal, guard,
          ...(resolution ? resolution.reviewId ? { conflictResolution: { [resolution.reviewId]: resolution.choice } } : { initialResolution: { [resolution.category]: resolution.choice } } : {}) });
        guard();
        if (result.state === 'idle') await store.write({ ...settings, lastSyncedAt: new Date().toISOString() }, guard);
        const status = { ...await this.status(context), ...result }; guard();
        this.latest = { root: context.profileRoot, status };
        return status;
      } finally { connection.dispose(); }
    });
  }
  private async requireActive(connection: BrowserSyncConnection, signal: AbortSignal, guard: () => void) {
    if (!await connection.remote.active(signal)) throw new BrowserSyncError('Registra este dispositivo antes de sincronizar.');
    guard();
  }
  private async confirm(context: BrowserSyncControlContext, action: Parameters<BrowserSyncControlContext['confirm']>[0], detail: string, signal: AbortSignal) {
    this.confirming = true;
    return abortableSync(Promise.resolve().then(() => context.confirm(action, detail)).finally(() => { this.confirming = false; }), signal);
  }
  private async run(context: BrowserSyncControlContext, action: (signal: AbortSignal, guard: () => void) => Promise<BrowserSyncControlStatus>, recovery = false): Promise<BrowserSyncControlStatus> {
    context.guard();
    if (!context.enabled || !context.authenticated) throw new BrowserSyncError('La sincronización no está habilitada para este perfil.');
    if (this.pending || this.confirming) throw new BrowserSyncError('Ya hay una operación o confirmación pendiente.');
    const controller = new AbortController(); this.pending = controller;
    const timer = setTimeout(() => controller.abort(), 120_000);
    const guard = () => { assertSyncActive(controller.signal, context.guard); if (!recovery) assertSyncRecoveryAvailable(context.profileRoot); };
    try { guard(); const result = await action(controller.signal, guard); guard(); return result; }
    catch (error) { if (error instanceof BrowserSyncError) throw error; throw new BrowserSyncError('No se pudo completar la sincronización. Se conservaron los datos y revisiones disponibles.'); }
    finally { clearTimeout(timer); if (this.pending === controller) this.pending = null; }
  }
}
