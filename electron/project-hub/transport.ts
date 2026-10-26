import type { ProjectHubEnvelope, ProjectHubRequestOptions } from './types';
import { setTimeout as delay } from 'node:timers/promises';
import { MAX_PROJECT_HUB_BODY_BYTES, MAX_PROJECT_HUB_RESPONSE_BYTES, PROJECT_HUB_TIMEOUT_MS,
  PROJECT_HUB_READ_RETRIES, PROJECT_HUB_RETRY_BACKOFF_MS, ProjectHubError, projectHubHttpError } from './session-contract';

export interface ProjectHubTransportContext { accessToken?: string; signal: AbortSignal; assert(): void }

export function normalizeProjectHubEndpoint(value: string): string {
  try {
    const url = new URL(value);
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) || url.username || url.password || url.search || url.hash) return '';
    return url.href.replace(/\/+$/, '');
  } catch { return ''; }
}

/** El transporte recibe credenciales capturadas; nunca consulta la sesión global. */
export class ProjectHubTransport {
  readonly baseUrl: string;
  constructor(value: string) { this.baseUrl = normalizeProjectHubEndpoint(value); }

  async request<T>(route: string, options: ProjectHubRequestOptions, context: ProjectHubTransportContext): Promise<ProjectHubEnvelope<T>> {
    context.assert();
    if (!this.baseUrl) throw new ProjectHubError('NOT_CONFIGURED', 'Project Hub no está configurado en esta versión de Soflia Hub.');
    const body = this.body(options.body);
    const accessToken = context.accessToken;
    if (options.idempotencyKey && (options.idempotencyKey.length > 200 || /[\r\n]/u.test(options.idempotencyKey) || options.idempotencyKey.includes('\0'))) {
      throw new ProjectHubError('INVALID_REQUEST', 'La clave de operación Project Hub no es válida.');
    }
    const method = options.method ?? 'GET';
    const retries = options.retry !== false && method === 'GET' ? PROJECT_HUB_READ_RETRIES : 0;
    const correlation = crypto.randomUUID();
    for (let attempt = 0; ; attempt++) {
      context.assert();
      const timeout = new AbortController();
      const signal = AbortSignal.any([context.signal, timeout.signal]);
      const timer = setTimeout(() => timeout.abort(), PROJECT_HUB_TIMEOUT_MS);
      try {
        const headers: Record<string, string> = { accept: 'application/json', 'x-correlation-id': correlation };
        if (body !== undefined) headers['content-type'] = 'application/json';
        if (accessToken) headers.authorization = `Bearer ${accessToken}`;
        if (options.idempotencyKey) headers['idempotency-key'] = options.idempotencyKey;
        context.assert();
        const response = await fetch(`${this.baseUrl}${route}`, { method, headers, body, signal, redirect: 'error' });
        context.assert();
        if (!response.ok) throw await this.httpError(response, context);
        const payload = await this.envelope<T>(response, context); context.assert();
        return payload;
      } catch (error) {
        context.assert();
        if (error instanceof ProjectHubError) throw error;
        if (attempt < retries) {
          clearTimeout(timer); timeout.abort();
          try { await delay(PROJECT_HUB_RETRY_BACKOFF_MS * 2 ** attempt, undefined, { signal: context.signal }); }
          catch { context.assert(); throw new ProjectHubError('SESSION_CHANGED', 'La operación Project Hub fue cancelada.'); }
          context.assert(); continue;
        }
        if (timeout.signal.aborted) throw new ProjectHubError('TIMEOUT', 'Project Hub tardó demasiado en responder.');
        throw new ProjectHubError('UNAVAILABLE', 'Project Hub no está disponible.');
      } finally { clearTimeout(timer); timeout.abort(); }
    }
  }

  private async httpError(response: Response, context: ProjectHubTransportContext): Promise<ProjectHubError> {
    let reason: string | undefined;
    // Sólo se reconoce un código contractual. Nunca se muestra el mensaje ni los detalles remotos.
    if (response.status === 422 && response.headers.get('content-type')?.includes('application/json') && response.body) {
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
      try {
        while (true) {
          const chunk = await reader.read(); context.assert();
          if (chunk.done) break;
          size += chunk.value.byteLength;
          if (size > 16_384) { await reader.cancel(); break; }
          chunks.push(chunk.value);
        }
        if (size <= 16_384) {
          const payload: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
          if (payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object' && 'code' in payload.error && payload.error.code === 'TEAM_REQUIRED') reason = 'TEAM_REQUIRED';
        }
      } catch { context.assert(); }
      finally { reader.releaseLock(); }
    }
    context.assert(); return projectHubHttpError(response.status, reason);
  }

  private body(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    try {
      const body = JSON.stringify(value);
      if (typeof body !== 'string' || Buffer.byteLength(body, 'utf8') > MAX_PROJECT_HUB_BODY_BYTES) throw new Error('excesivo');
      return body;
    } catch { throw new ProjectHubError('INVALID_REQUEST', 'La solicitud Project Hub no es válida o supera su límite.'); }
  }
  private async envelope<T>(response: Response, context: ProjectHubTransportContext): Promise<ProjectHubEnvelope<T>> {
    const invalid = () => new ProjectHubError('INVALID_RESPONSE', 'Project Hub devolvió una respuesta inválida.');
    const declared = Number(response.headers.get('content-length'));
    if (declared > MAX_PROJECT_HUB_RESPONSE_BYTES || !response.body) throw invalid();
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const chunk = await reader.read(); context.assert();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_PROJECT_HUB_RESPONSE_BYTES) throw invalid();
        chunks.push(chunk.value);
      }
    } finally { reader.releaseLock(); }
    try {
      const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
      if (!value || typeof value !== 'object' || Array.isArray(value) || !Object.prototype.hasOwnProperty.call(value, 'data')
        || ('error' in value && value.error != null)) throw invalid();
      const payload = value as ProjectHubEnvelope<T>;
      const meta = payload.meta;
      return { data: payload.data, ...(meta && typeof meta === 'object' ? { meta: {
        ...(typeof meta.correlation_id === 'string' && /^[a-f\d-]{36}$/i.test(meta.correlation_id) ? { correlation_id: meta.correlation_id } : {}),
        ...(typeof meta.next_cursor === 'string' && meta.next_cursor.length <= 2000 ? { next_cursor: meta.next_cursor } : {}),
        ...(meta.next_cursor === null ? { next_cursor: null } : {}),
        ...(typeof meta.has_more === 'boolean' ? { has_more: meta.has_more } : {}),
      } } : {}) };
    } catch { throw invalid(); }
  }
}
