import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// `vi.mock` se eleva al inicio del archivo: la fabrica no puede leer una
// variable de modulo declarada despues.
const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));

vi.mock('../../config', () => ({
  LEARNING_SSO: { BASE_URL: 'https://soflia.ai', ENABLED: true },
  isLearningSsoConfigured: () => true,
}));

vi.mock('../../lib/sofia-client', () => ({
  sofiaSupa: { auth: { verifyOtp } },
}));

import {
  createLearningSsoRequest,
  exchangeTicketForSofiaSession,
  LearningSsoError,
} from '../../services/learning-sso';

const TICKET = 'a'.repeat(64);
const VERIFIER = 'b'.repeat(43);

function jsonResponse(status: number, body: unknown): Response {
  return {
    json: async () => body,
    ok: status >= 200 && status < 300,
    status,
  } as unknown as Response;
}

describe('learning-sso: canje del ticket', () => {
  beforeEach(() => {
    verifyOtp.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('devuelve la sesion SOFIA cuando el canje prospera', async () => {
    const session = { access_token: 'token', user: { email: 'persona@soflia.ai' } };
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { tokenHash: 'hash-123' }));
    verifyOtp.mockResolvedValue({ data: { session }, error: null });

    await expect(exchangeTicketForSofiaSession(TICKET, VERIFIER)).resolves.toBe(session);

    expect(verifyOtp).toHaveBeenCalledWith({ token_hash: 'hash-123', type: 'magiclink' });
    const [, init] = vi.mocked(fetch).mock.calls[0];
    // El endpoint se autentica por ticket y verificador: mandar cookies solo
    // abriria superficie.
    expect((init as RequestInit).credentials).toBe('omit');
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      code_verifier: VERIFIER,
      ticket: TICKET,
    });
  });

  it('no reintenta cuando el acceso esta denegado', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(403, { code: 'access_denied' }));

    await expect(exchangeTicketForSofiaSession(TICKET, VERIFIER)).rejects.toMatchObject({
      code: 'access_denied',
      retryable: false,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('no reintenta un ticket invalido', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(400, { code: 'invalid_ticket' }));

    await expect(exchangeTicketForSofiaSession(TICKET, VERIFIER)).rejects.toMatchObject({
      code: 'invalid_ticket',
      retryable: false,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('reintenta de forma acotada ante un fallo transitorio', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(503, { code: 'exchange_unavailable' }));

    await expect(exchangeTicketForSofiaSession(TICKET, VERIFIER)).rejects.toMatchObject({
      code: 'exchange_unavailable',
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('trata un fallo de red como reintentable', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(exchangeTicketForSofiaSession(TICKET, VERIFIER)).rejects.toBeInstanceOf(
      LearningSsoError,
    );
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('falla si la respuesta no trae la prueba de acceso', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, {}));

    await expect(exchangeTicketForSofiaSession(TICKET, VERIFIER)).rejects.toMatchObject({
      code: 'exchange_unavailable',
      retryable: false,
    });
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it('falla si el canje del enlace magico no produce sesion', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse(200, { tokenHash: 'hash-123' }));
    verifyOtp.mockResolvedValue({ data: { session: null }, error: { message: 'expirado' } });

    await expect(exchangeTicketForSofiaSession(TICKET, VERIFIER)).rejects.toMatchObject({
      code: 'exchange_unavailable',
    });
  });
});

describe('learning-sso: generacion de la solicitud', () => {
  it('produce un desafio S256 en base64url derivado del verificador', async () => {
    const request = await createLearningSsoRequest();

    expect(request.codeChallenge).toHaveLength(43);
    expect(request.codeChallenge).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(request.state).toMatch(/^[A-Za-z0-9_-]+$/);

    const digest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(request.codeVerifier),
    );
    const expected = btoa(String.fromCharCode(...new Uint8Array(digest)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    expect(request.codeChallenge).toBe(expected);
  });

  it('genera una solicitud distinta cada vez', async () => {
    const [first, second] = await Promise.all([
      createLearningSsoRequest(),
      createLearningSsoRequest(),
    ]);

    expect(first.state).not.toBe(second.state);
    expect(first.codeVerifier).not.toBe(second.codeVerifier);
  });
});
