import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { OAUTH_REDIRECT_URI } from './constants';

export interface OAuthProof {
  readonly state: string;
  readonly verifier: string;
  readonly challenge: string;
}

export function createOAuthProof(): OAuthProof {
  const verifier = randomBytes(32).toString('base64url');
  return Object.freeze({ state: randomBytes(32).toString('base64url'), verifier,
    challenge: createHash('sha256').update(verifier).digest('base64url') });
}

export function validOAuthState(actual: string | null, expected: string): boolean {
  return typeof actual === 'string' && /^[a-zA-Z0-9_-]{43}$/.test(actual)
    && /^[a-zA-Z0-9_-]{43}$/.test(expected)
    && timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
}

export function validOAuthCode(code: string | null): code is string {
  return typeof code === 'string' && /^[\x21-\x7e]{1,8192}$/.test(code)
    && !/^[a-z][a-z0-9+.-]*:/i.test(code) && !code.startsWith('//');
}

const authorizationEndpoints = {
  google: 'https://accounts.google.com/o/oauth2/v2/auth',
  microsoft: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize',
} as const;

export function validateOAuthDestination(authUrl: string, provider: 'google' | 'microsoft', proof: OAuthProof, clientId: string): void {
  if (typeof authUrl !== 'string' || authUrl.length > 16384 || typeof clientId !== 'string' || !clientId || clientId.length > 4096) throw new Error('Destino OAuth inválido.');
  const url = new URL(authUrl);
  if (url.username || url.password || url.hash || url.origin + url.pathname !== authorizationEndpoints[provider]) throw new Error('Destino OAuth no permitido.');
  const expected = { client_id: clientId, redirect_uri: OAUTH_REDIRECT_URI, response_type: 'code', state: proof.state,
    code_challenge: proof.challenge, code_challenge_method: 'S256' };
  for (const [key, value] of Object.entries(expected)) {
    if (url.searchParams.getAll(key).length !== 1 || url.searchParams.get(key) !== value) throw new Error('La autorización OAuth no corresponde al intento.');
  }
  if (!validOAuthState(proof.state, proof.state) || !/^[a-zA-Z0-9_-]{43}$/.test(proof.verifier)
    || createHash('sha256').update(proof.verifier).digest('base64url') !== proof.challenge) throw new Error('Prueba OAuth inválida.');
}
