import type { WebContents } from 'electron';
import { randomUUID } from 'node:crypto';
import { acquireCdpLease, type CdpLease } from './cdp-session';
import { CREDENTIAL_BINDING, CREDENTIAL_OBSERVER_SOURCE, CREDENTIAL_WORLD } from './credential-autosave-script';
import { normalizeCredentialOrigin } from './credential-vault';
import type { BrowserCredentialTransferEntry } from './credential-vault';

/** Puente privado página-main. No usa consola, IPC del renderer ni herramientas runtime. */
export class BrowserCredentialAutosave {
  private lease: CdpLease | null = null;
  private installing: Promise<boolean> | null = null;
  private scriptId: string | null = null;
  private disposed = false;
  private mainFrame = '';
  private world = '';
  private readonly contexts = new Map<number, { frameId: string; uniqueId: string }>();

  constructor(private readonly contents: WebContents, private readonly offer: (candidate: BrowserCredentialTransferEntry) => void) {}

  install(): Promise<boolean> {
    if (this.disposed || this.contents.isDestroyed()) return Promise.resolve(false);
    if (this.lease?.alive && this.scriptId) return Promise.resolve(true);
    if (!this.installing) this.installing = this.doInstall().finally(() => { this.installing = null; });
    return this.installing;
  }

  private async doInstall(): Promise<boolean> {
    try {
      const lease = await acquireCdpLease(this.contents, ['Page', 'Runtime']);
      this.lease = lease;
      const current = () => { if (this.disposed || !lease.alive) throw new Error('Observador cancelado.'); };
      current();
      // Una desconexión puede dejar scripts y mundos vivos. Limpiarlos por ID
      // único antes de crear otro mundo; no reutilizar un contexto ya emitido.
      await this.clearRegistration(lease);
      current();
      this.world = `${CREDENTIAL_WORLD}-${randomUUID()}`;
      lease.on('Page.frameNavigated', (params) => {
        const frame = params.frame as { id?: unknown; parentId?: unknown } | undefined;
        if (frame && !frame.parentId && typeof frame.id === 'string') this.mainFrame = frame.id;
      });
      lease.on('Runtime.executionContextsCleared', () => this.contexts.clear());
      lease.on('Runtime.executionContextDestroyed', (params) => this.contexts.delete(Number(params.executionContextId)));
      lease.on('Runtime.executionContextCreated', (params) => {
        const context = params.context as { id?: unknown; name?: unknown; uniqueId?: unknown; auxData?: { frameId?: unknown } } | undefined;
        if (context?.name === this.world && typeof context.id === 'number'
          && typeof context.uniqueId === 'string' && typeof context.auxData?.frameId === 'string') {
          this.contexts.set(context.id, { frameId: context.auxData.frameId, uniqueId: context.uniqueId });
        }
      });
      lease.on('Runtime.bindingCalled', (params) => {
        if (this.disposed || !lease.alive || params.name !== CREDENTIAL_BINDING
          || typeof params.executionContextId !== 'number'
          || this.contexts.get(params.executionContextId)?.frameId !== this.mainFrame || !this.mainFrame) return;
        const candidate = parseCredentialCandidate(params.payload);
        if (!candidate) return;
        try {
          if (candidate.origin === normalizeCredentialOrigin(this.contents.getURL())) this.offer(candidate);
        } catch { /* Contenido no confiable; no registrar el payload ni la causa. */ }
        finally { candidate.password = ''; }
      });
      const tree = await lease.send('Page.getFrameTree');
      current();
      const frameId = (tree?.frameTree as { frame?: { id?: unknown } } | undefined)?.frame?.id;
      if (typeof frameId !== 'string') throw new Error('Marco principal no disponible.');
      this.mainFrame = frameId;
      await lease.send('Runtime.addBinding', { name: CREDENTIAL_BINDING, executionContextName: this.world });
      current();
      const script = await lease.send('Page.addScriptToEvaluateOnNewDocument', {
        source: CREDENTIAL_OBSERVER_SOURCE, worldName: this.world, runImmediately: true,
      });
      this.scriptId = typeof script?.identifier === 'string' ? script.identifier : null;
      current();
      if (!this.scriptId) throw new Error('No se pudo instalar el observador.');
      return true;
    } catch {
      await this.teardown();
      return false;
    }
  }

  private async clearRegistration(lease: CdpLease | null): Promise<void> {
    const scriptId = this.scriptId;
    this.scriptId = null;
    if (lease?.alive) {
      if (scriptId) await lease.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: scriptId }).catch(() => undefined);
      for (const { uniqueId } of this.contexts.values()) {
        await lease.send('Runtime.evaluate', {
          expression: 'globalThis.__sofliaCredentialObserverStop?.()', uniqueContextId: uniqueId, silent: true,
        }).catch(() => undefined);
      }
      await lease.send('Runtime.removeBinding', { name: CREDENTIAL_BINDING }).catch(() => undefined);
    }
    this.contexts.clear(); this.mainFrame = '';
  }

  private async teardown(): Promise<void> {
    const lease = this.lease;
    this.lease = null;
    await this.clearRegistration(lease);
    await lease?.release();
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.installing;
    await this.teardown();
  }
}

export function parseCredentialCandidate(payload: unknown): BrowserCredentialTransferEntry | null {
  if (typeof payload !== 'string' || payload.length > 30_000) return null;
  try {
    const value = JSON.parse(payload) as Record<string, unknown>;
    if (!value || Array.isArray(value) || Object.keys(value).length !== 3
      || typeof value.origin !== 'string' || value.origin.length > 2_048
      || typeof value.username !== 'string' || !value.username.trim() || value.username.length > 320
      || /[\p{Cc}\p{Cf}]/u.test(value.username)
      || typeof value.password !== 'string' || !value.password || value.password.length > 4_096) return null;
    const origin = normalizeCredentialOrigin(value.origin);
    if (origin !== value.origin) return null;
    return { origin, username: value.username.trim(), password: value.password };
  } catch { return null; }
}
