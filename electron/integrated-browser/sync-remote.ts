import { randomUUID } from 'node:crypto';
import type { BrowserSyncCategory } from './platform-types';
import { validateBrowserSyncEnvelope, type BrowserSyncEnvelope } from './sync-crypto';

export interface BrowserSyncAuth {
  origin: string; apiKey: string; accessToken: string; ownerId: string; sessionId: string;
}
export interface BrowserSyncRemoteDevice { id: string; createdAt: string; revokedAt: string | null }
export class BrowserSyncError extends Error {}
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export function assertSyncUuid(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !UUID.test(value)) throw new BrowserSyncError('El identificador de sincronización es inválido.');
}
export function assertSyncActive(signal: AbortSignal, guard: () => void): void {
  if (signal.aborted) throw new BrowserSyncError('Operación cancelada. Si ya llegó al servidor, consulta el estado de nuevo.');
  guard();
}
export function abortableSync<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new BrowserSyncError('Operación cancelada. Si ya llegó al servidor, consulta el estado de nuevo.'));
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    void promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const finish = () => { signal.removeEventListener('abort', abort); resolve(); };
    const timer = setTimeout(finish, ms);
    const abort = () => { clearTimeout(timer); signal.removeEventListener('abort', abort); reject(new BrowserSyncError('Operación cancelada.')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
function categoryPath(category: BrowserSyncCategory): string {
  if (!['bookmarks', 'groups', 'tabs', 'settings'].includes(category)) throw new BrowserSyncError('La categoría no puede sincronizarse.');
  return category;
}
function iso(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

/** Transporte main-only: endpoints cerrados, JWT de usuario y cancelación real. */
export class BrowserSyncRemote {
  private readonly auth: Readonly<BrowserSyncAuth>;
  constructor(auth: BrowserSyncAuth, private readonly guard: () => void, private readonly fetcher: typeof fetch = fetch) {
    let url: URL;
    try { url = new URL(auth.origin); } catch { throw new BrowserSyncError('El backend de sincronización no está configurado.'); }
    if (url.protocol !== 'https:' || !/^[a-z0-9-]+\.supabase\.co$/.test(url.hostname) || url.port || url.username || url.password
      || url.search || url.hash || url.pathname !== '/' || !auth.apiKey || !auth.accessToken || auth.accessToken.length > 16_384) {
      throw new BrowserSyncError('El backend de sincronización no está configurado.');
    }
    assertSyncUuid(auth.ownerId); assertSyncUuid(auth.sessionId);
    this.auth = Object.freeze({ ...auth, origin: url.origin });
  }

  async verify(signal: AbortSignal): Promise<void> {
    const user = await this.request('/auth/v1/user', undefined, signal, 64 * 1024) as { id?: unknown; is_anonymous?: unknown } | null;
    if (!user || user.id !== this.auth.ownerId || user.is_anonymous !== false) throw new BrowserSyncError('Se necesita una sesión Lia no anónima verificada.');
  }
  async active(signal: AbortSignal): Promise<boolean> {
    const value = await this.request('/rest/v1/rpc/browser_sync_session_active', {}, signal);
    if (typeof value !== 'boolean') throw new BrowserSyncError('El backend no cumple el contrato de sincronización.');
    return value;
  }
  async register(id: string, traceId: string, signal: AbortSignal): Promise<void> {
    assertSyncUuid(id); assertSyncUuid(traceId);
    const value = await this.request('/rest/v1/rpc/browser_sync_register_device', { p_device_id: id, p_trace_id: traceId }, signal);
    if (value !== id) throw new BrowserSyncError('No se confirmó el registro del dispositivo.');
  }
  async devices(signal: AbortSignal): Promise<BrowserSyncRemoteDevice[]> {
    const rows = await this.request('/rest/v1/browser_sync_devices?select=device_id,created_at,revoked_at&order=created_at.asc,device_id.asc&limit=101', undefined, signal, 64 * 1024);
    if (!Array.isArray(rows) || rows.length > 100) throw new BrowserSyncError('La lista de dispositivos no cumple el contrato.');
    const result = rows.map((row: { device_id?: unknown; created_at?: unknown; revoked_at?: unknown }) => {
      if (!row || Object.keys(row).sort().join(',') !== 'created_at,device_id,revoked_at') throw new BrowserSyncError('La lista de dispositivos no cumple el contrato.');
      assertSyncUuid(row.device_id);
      if (!iso(row.created_at) || (row.revoked_at !== null && !iso(row.revoked_at))) throw new BrowserSyncError('La lista de dispositivos no cumple el contrato.');
      return { id: row.device_id, createdAt: row.created_at, revokedAt: row.revoked_at };
    });
    if (new Set(result.map((row) => row.id)).size !== result.length) throw new BrowserSyncError('La lista contiene dispositivos duplicados.');
    return result;
  }
  async revoke(id: string, signal: AbortSignal): Promise<void> {
    assertSyncUuid(id);
    const value = await this.request('/rest/v1/rpc/browser_sync_revoke_device', { p_device_id: id, p_trace_id: randomUUID() }, signal);
    if (value !== true) throw new BrowserSyncError('No se confirmó la revocación del dispositivo.');
  }
  async read(category: BrowserSyncCategory, signal: AbortSignal): Promise<{ revision: number; envelope: BrowserSyncEnvelope } | null> {
    const rows = await this.request(`/rest/v1/browser_sync_envelopes?select=revision,envelope&category=eq.${categoryPath(category)}&limit=2`, undefined, signal, 3 * 1024 * 1024);
    if (!Array.isArray(rows) || rows.length > 1) throw new BrowserSyncError('La instantánea remota es inválida.');
    if (!rows.length) return null;
    const row = rows[0] as { revision: number; envelope: unknown };
    if (!row || Object.keys(row).sort().join(',') !== 'envelope,revision' || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new BrowserSyncError('La versión remota es inválida.');
    const envelope = validateBrowserSyncEnvelope(row.envelope);
    if (envelope.category !== category) throw new BrowserSyncError('La instantánea no corresponde a la categoría solicitada.');
    return { revision: row.revision, envelope: { ...envelope } };
  }
  async put(envelope: BrowserSyncEnvelope, revision: number, idempotencyKey: string, traceId: string, signal: AbortSignal): Promise<{ status: 'written' | 'replayed' | 'conflict'; revision: number }> {
    const value = validateBrowserSyncEnvelope(envelope);
    assertSyncUuid(idempotencyKey); assertSyncUuid(traceId);
    if (!Number.isSafeInteger(revision) || revision < 0 || revision >= Number.MAX_SAFE_INTEGER) throw new BrowserSyncError('La revisión base es inválida.');
    const result = await this.request('/rest/v1/rpc/browser_sync_put', { p_category: value.category, p_envelope: value, p_expected_revision: revision, p_idempotency_key: idempotencyKey, p_trace_id: traceId }, signal) as { status: 'written' | 'replayed' | 'conflict'; revision: number };
    if (!result || Object.keys(result).sort().join(',') !== 'revision,status' || !['written', 'replayed', 'conflict'].includes(result.status)
      || !Number.isSafeInteger(result.revision) || result.revision < 0
      || (result.status !== 'conflict' && result.revision !== revision + 1)) throw new BrowserSyncError('El recibo de sincronización es inválido.');
    return result;
  }

  private async request(endpoint: string, body: unknown, outer: AbortSignal, maxBytes = 4096): Promise<unknown> {
    const controller = new AbortController();
    const stop = () => controller.abort();
    outer.addEventListener('abort', stop, { once: true });
    if (outer.aborted) stop();
    const timer = setTimeout(stop, 20_000);
    const serialized = body === undefined ? undefined : JSON.stringify(body);
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        assertSyncActive(controller.signal, this.guard);
        let response: Response;
        try {
          response = await abortableSync(this.fetcher(`${this.auth.origin}${endpoint}`, {
            method: serialized === undefined ? 'GET' : 'POST', body: serialized,
            headers: { apikey: this.auth.apiKey, Authorization: `Bearer ${this.auth.accessToken}`, 'Content-Type': 'application/json', Accept: 'application/json' },
            signal: controller.signal, redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
          }), controller.signal);
        } catch {
          assertSyncActive(controller.signal, this.guard);
          if (attempt === 2) throw new BrowserSyncError('El servicio de sincronización no está disponible.');
          await delay([250, 750][attempt], controller.signal); continue;
        }
        assertSyncActive(controller.signal, this.guard);
        if (!response.ok) {
          void response.body?.cancel().catch(() => undefined);
          if ((response.status === 429 || response.status >= 500) && attempt < 2) { await delay([250, 750][attempt], controller.signal); continue; }
          throw new BrowserSyncError(response.status === 401 || response.status === 403
            ? 'La sesión o el dispositivo no están autorizados para sincronizar.' : 'El backend de sincronización no está disponible o no cumple el contrato.');
        }
        if (!response.body || !response.headers.get('content-type')?.includes('application/json')) throw new BrowserSyncError('La respuesta de sincronización es inválida.');
        const reader = response.body.getReader();
        const chunks: Uint8Array[] = []; let bytes = 0;
        try {
          while (true) {
            const part = await abortableSync(reader.read(), controller.signal);
            assertSyncActive(controller.signal, this.guard);
            if (part.done) break;
            bytes += part.value.byteLength;
            if (bytes > maxBytes) throw new BrowserSyncError('La respuesta de sincronización supera la cuota.');
            chunks.push(part.value);
          }
          try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
          catch { throw new BrowserSyncError('La respuesta de sincronización es inválida.'); }
        } finally { void reader.cancel().catch(() => undefined); }
      }
      throw new BrowserSyncError('El servicio de sincronización no está disponible.');
    } finally { controller.abort(); clearTimeout(timer); outer.removeEventListener('abort', stop); }
  }
}
