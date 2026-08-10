import type { Session } from '@supabase/supabase-js';
import { LEARNING_SSO, isLearningSsoConfigured } from '../config';
import { sofiaSupa } from '../lib/sofia-client';

/**
 * Inicio de sesion federado con SofLIA Learning.
 *
 * Learning ejecuta su propio SSO (Google y Microsoft) y devuelve al escritorio
 * un ticket de un solo uso por el deep link `soflia://auth/callback`. Ese canal
 * no es confidencial: cualquier aplicacion local puede registrar el esquema.
 *
 * Por eso el ticket no basta. Este modulo genera un verificador que nunca sale
 * del renderer ni se escribe a disco, y envia solo su hash al iniciar el flujo.
 * El canje exige ambos, de modo que quien intercepte el retorno no tenga con
 * que canjearlo (PKCE S256, RFC 8252).
 */

const EXCHANGE_PATH = '/api/auth/desktop/exchange';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 750];

export interface LearningSsoCallback {
  ticket: string | null;
  state: string;
  error: string | null;
}

export interface LearningSsoRequest {
  state: string;
  codeVerifier: string;
  codeChallenge: string;
}

export type LearningSsoErrorCode =
  | 'invalid_ticket'
  | 'access_denied'
  | 'exchange_unavailable'
  | 'not_configured';

export class LearningSsoError extends Error {
  constructor(
    readonly code: LearningSsoErrorCode,
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'LearningSsoError';
  }
}

export function isLearningSsoAvailable(): boolean {
  return isLearningSsoConfigured() && Boolean(getIpc());
}

/**
 * Genera la solicitud. El verificador se queda en memoria del renderer: no
 * cruza al proceso principal ni se persiste.
 */
export async function createLearningSsoRequest(): Promise<LearningSsoRequest> {
  const state = toBase64Url(crypto.getRandomValues(new Uint8Array(16)));
  const codeVerifier = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier),
  );

  return { codeChallenge: toBase64Url(new Uint8Array(digest)), codeVerifier, state };
}

/** El main construye la URL desde su configuracion; aqui solo van state y desafio. */
export async function openLearningSso(request: LearningSsoRequest): Promise<void> {
  const ipc = getIpc();
  if (!ipc) throw new LearningSsoError('not_configured', false);

  const result = await ipc.invoke('auth:open-sso', {
    codeChallenge: request.codeChallenge,
    state: request.state,
  }) as { success: boolean; error?: string } | null;

  if (!result?.success) throw new LearningSsoError('not_configured', false);
}

export function subscribeToLearningSsoCallback(
  handler: (payload: LearningSsoCallback) => void,
): () => void {
  const ipc = getIpc();
  if (!ipc) return () => {};

  const listener = (_event: unknown, payload: LearningSsoCallback) => handler(payload);
  ipc.on('app:auth-callback', listener);
  return () => ipc.off?.('app:auth-callback', listener);
}

/** Retorno recibido durante un arranque en frio, antes de que existiera el renderer. */
export async function consumePendingLearningSsoCallback(): Promise<LearningSsoCallback | null> {
  const ipc = getIpc();
  if (!ipc) return null;

  try {
    return await ipc.invoke('app:get-pending-auth-callback') as LearningSsoCallback | null;
  } catch {
    console.warn('[sso-learning] no se pudo recuperar el retorno pendiente');
    return null;
  }
}

/**
 * Canjea el ticket por una sesion SOFIA ordinaria.
 *
 * Misma politica que el intercambio de conversaciones: 401 y 403 no se
 * reintentan porque la respuesta no va a cambiar; red y 5xx si, de forma
 * acotada.
 */
export async function exchangeTicketForSofiaSession(
  ticket: string,
  codeVerifier: string,
): Promise<Session> {
  if (!isLearningSsoConfigured()) throw new LearningSsoError('not_configured', false);
  if (!sofiaSupa) throw new LearningSsoError('exchange_unavailable', false);

  let lastError: LearningSsoError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await exchangeOnce(ticket, codeVerifier);
    } catch (error) {
      const ssoError = toSsoError(error);
      lastError = ssoError;
      if (!ssoError.retryable || attempt === MAX_ATTEMPTS - 1) throw ssoError;
      await wait(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
    }
  }

  throw lastError || new LearningSsoError('exchange_unavailable', true);
}

async function exchangeOnce(ticket: string, codeVerifier: string): Promise<Session> {
  const response = await fetch(`${LEARNING_SSO.BASE_URL}${EXCHANGE_PATH}`, {
    body: JSON.stringify({ code_verifier: codeVerifier, ticket }),
    // Sin credenciales: el endpoint se autentica por el ticket y el verificador,
    // no por cookie. Enviarlas solo abriria superficie.
    credentials: 'omit',
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) throw errorFromStatus(response.status);

  const payload = await response.json().catch(() => null) as { tokenHash?: unknown } | null;
  if (!payload || typeof payload.tokenHash !== 'string' || !payload.tokenHash) {
    throw new LearningSsoError('exchange_unavailable', false);
  }

  const { data, error } = await sofiaSupa!.auth.verifyOtp({
    token_hash: payload.tokenHash,
    type: 'magiclink',
  });

  if (error || !data.session) throw new LearningSsoError('exchange_unavailable', true);
  return data.session;
}

function errorFromStatus(status: number): LearningSsoError {
  if (status === 403) return new LearningSsoError('access_denied', false);
  if (status === 400 || status === 401) return new LearningSsoError('invalid_ticket', false);
  return new LearningSsoError('exchange_unavailable', status === 429 || status >= 500);
}

function toSsoError(error: unknown): LearningSsoError {
  if (error instanceof LearningSsoError) return error;
  // Fallo de red: el `fetch` rechaza sin status y merece reintento.
  return new LearningSsoError('exchange_unavailable', true);
}

function getIpc(): {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: (...args: any[]) => void) => void;
  off?: (channel: string, listener: (...args: any[]) => void) => void;
} | null {
  return (window as any).ipcRenderer || null;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
