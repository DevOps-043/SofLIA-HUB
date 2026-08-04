import type { Session } from '@supabase/supabase-js';
import { sofiaSupa } from '../lib/sofia-client';
import { supabase } from '../lib/supabase';

const FUNCTION_NAME = 'sofia-session-exchange';
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [250, 750];

type ExchangePayload = {
  tokenHash?: unknown;
  code?: unknown;
};

export class LiaSessionExchangeError extends Error {
  constructor(
    readonly code: 'not_authenticated' | 'access_denied' | 'exchange_unavailable',
    readonly retryable: boolean,
  ) {
    super(code);
    this.name = 'LiaSessionExchangeError';
  }
}

export async function exchangeSofiaForLiaSession(
  expectedEmail: string,
  suppliedAccessToken?: string | null,
): Promise<Session> {
  const accessToken = suppliedAccessToken || await getSofiaAccessToken();
  if (!accessToken) throw new LiaSessionExchangeError('not_authenticated', false);

  let lastError: LiaSessionExchangeError | null = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    try {
      return await exchangeOnce(expectedEmail, accessToken);
    } catch (error) {
      const exchangeError = toExchangeError(error);
      lastError = exchangeError;
      if (!exchangeError.retryable || attempt === MAX_ATTEMPTS - 1) throw exchangeError;
      await wait(RETRY_DELAYS_MS[attempt] || RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1]);
    }
  }

  throw lastError || new LiaSessionExchangeError('exchange_unavailable', true);
}

async function exchangeOnce(expectedEmail: string, accessToken: string): Promise<Session> {
  const { data, error } = await supabase.functions.invoke<ExchangePayload>(FUNCTION_NAME, {
    body: {},
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (error) throw error;
  if (!data || typeof data.tokenHash !== 'string' || !data.tokenHash) {
    throw new LiaSessionExchangeError(readResponseCode(data), false);
  }

  const { data: verification, error: verificationError } = await supabase.auth.verifyOtp({
    token_hash: data.tokenHash,
    type: 'magiclink',
  });
  if (verificationError || !verification.session) {
    throw new LiaSessionExchangeError('exchange_unavailable', true);
  }

  const verifiedEmail = normalizeEmail(verification.session.user.email);
  if (!verifiedEmail || verifiedEmail !== normalizeEmail(expectedEmail)) {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
    throw new LiaSessionExchangeError('access_denied', false);
  }

  return verification.session;
}

async function getSofiaAccessToken(): Promise<string | null> {
  if (!sofiaSupa) return null;
  const { data, error } = await sofiaSupa.auth.getSession();
  if (error) throw new LiaSessionExchangeError('exchange_unavailable', true);
  return data.session?.access_token || null;
}

function readResponseCode(data: ExchangePayload | null): LiaSessionExchangeError['code'] {
  if (data?.code === 'not_authenticated' || data?.code === 'access_denied') return data.code;
  return 'exchange_unavailable';
}

function toExchangeError(error: unknown): LiaSessionExchangeError {
  if (error instanceof LiaSessionExchangeError) return error;
  const status = readStatus(error);
  if (status === 401) return new LiaSessionExchangeError('not_authenticated', false);
  if (status === 403) return new LiaSessionExchangeError('access_denied', false);
  return new LiaSessionExchangeError('exchange_unavailable', status === 0 || status === 429 || status >= 500);
}

function readStatus(error: unknown): number {
  if (!error || typeof error !== 'object') return 0;
  const direct = 'status' in error && typeof error.status === 'number' ? error.status : null;
  if (direct !== null) return direct;
  const context = 'context' in error && error.context && typeof error.context === 'object' ? error.context : null;
  return context && 'status' in context && typeof context.status === 'number' ? context.status : 0;
}

function normalizeEmail(value: string | null | undefined): string {
  return value?.trim().toLowerCase() || '';
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}
